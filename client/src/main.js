// Entry point. Wires the modules together; the real logic lives in the other files.
//
// Data flow:
//   camera.js (MediaStream)
//     -> worker mode:  detector-worker.js -> worker.js    (frames never touch the page)
//        main mode:    detector-main.js on the <video>    (requestAnimationFrame loop)
//     -> both run FaceLandmarker, then frame-processor.js (ear.js + blink.js)
//     -> 'result' / 'stats' messages -> handleMessage() below -> ui / graph / diagnostics
import './style.css';
import { els, setStatus, showBanner, renderResult, drawEyes, onStatusChange, renderComfort } from './ui.js';
import { startCamera, describeCameraError } from './camera.js';
import { startMainDetector } from './detector-main.js';
import { startWorkerDetector, supportsWorkerMode } from './detector-worker.js';
import { createDiagnostics } from './diagnostics.js';
import { EarGraph } from './graph.js';
import { setupNotifications } from './notifications.js';
import { SessionStats } from './session.js';
import { showSummary } from './summary-view.js';
import { epochNow } from './frame-processor.js';
import { createWidget, supportsWidget } from './widget.js';
import { saveSession } from './history.js';
import { setupHistory } from './history-view.js';
import { setupIntro } from './intro.js';
import { setupViews } from './views.js';
import { ComfortTracker } from './comfort.js';
import { Nudger } from './nudge.js';

// Skip the intro when the page was opened by a notification click (?app) or
// reloaded by an automatic update (flag set just before that reload).
const params = new URLSearchParams(location.search);
let skipIntro = params.has('app');
try {
  skipIntro ||= sessionStorage.getItem('skipIntroOnce') === '1';
  sessionStorage.removeItem('skipIntroOnce');
} catch {
  // storage blocked: just show the intro
}
setupIntro({ skip: skipIntro });

setupViews();
const comfort = new ComfortTracker();
const nudger = new Nudger();

const graph = new EarGraph(els.graph);
const diagnostics = createDiagnostics(els);
setupNotifications(els);
const history = setupHistory(els);

// APP UPDATES
// Each build gives files new names (e.g. worker-AB12.js). When a new service
// worker takes over, it deletes the old build's files from its cache, so a page
// still running the OLD build can no longer load its old worker file. Reload
// into the new version right away if nothing is running; otherwise say so.
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller); // false on the very first visit
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (session || starting) {
      showBanner('A new version of the app is ready. Reload the page after you end this session.');
    } else {
      try {
        sessionStorage.setItem('skipIntroOnce', '1'); // don't replay the intro for an update
      } catch {}
      window.location.reload();
    }
  });
}

// Floating always-on-top widget (Document Picture-in-Picture).
const widget = createWidget({
  start: () => startSession(),
  end: () => endSession(),
  showSummary: () => lastSummary && !els.summaryDialog.open && showSummary(els, lastSummary),
});
onStatusChange((status, statusKind) => widget.update({ status, statusKind }));
if (supportsWidget()) {
  els.widgetBtn.addEventListener('click', () =>
    widget.open().catch((err) => setStatus(`Couldn’t open the widget: ${err.message}`, 'error')),
  );
} else {
  els.widgetBtn.disabled = true;
  els.widgetBtn.title = 'The floating widget needs Chrome or Edge 116 or newer.';
}

let stream = null;
let detector = null;
let session = null; // SessionStats while a session is running
let starting = false;
let lastSummary = null;
// Remembered so switching detection mode doesn't force a new calibration.
let lastBaseline = null;

const FALLBACK_NOTE =
  'This browser can’t run detection in the background (no MediaStreamTrackProcessor). ' +
  'Detection runs on the page instead and pauses when this window is hidden or minimized, ' +
  'so keep it visible, e.g. in a small window beside your work. Chrome or Edge on desktop is recommended.';
const CONTROL_NOTE = 'Main-thread mode (control): detection is expected to pause while this page is hidden.';

// Feature detection: worker mode needs MediaStreamTrackProcessor.
const workerSupported = supportsWorkerMode();
let mode = workerSupported ? 'worker' : 'main';
els.modeSelect.value = mode;
if (!workerSupported) {
  els.modeSelect.querySelector('option[value="worker"]').disabled = true;
  showBanner(FALLBACK_NOTE);
}

function handleMessage(msg) {
  // Ignore anything still in flight after "End session".
  if (!session) return;
  switch (msg.type) {
    case 'ready':
      els.diagDelegate.textContent = msg.delegate;
      // Start the log now, so model-loading time doesn't count as "slow while visible".
      diagnostics.reset(mode);
      setStatus('Looking for your face…', 'ok');
      break;
    case 'result':
      renderResult(msg);
      session.onResult(msg);
      const c = comfort.update(msg, msg.at);
      const nudge = nudger.update(c, msg.at); // message string, or null
      const elapsedMs = msg.at - session.startedAt;
      renderComfort(c, elapsedMs, nudge);
      widget.update({
        running: true,
        phase: msg.phase,
        calibrationProgress: msg.calibrationProgress,
        perMinute: msg.perMinute,
        estimate: msg.estimate,
        total: msg.total,
        elapsedMs,
        faceFound: msg.faceFound,
        // How open the eyes are relative to your calibrated open-eye EAR (0 = shut).
        openness: msg.faceFound ? Math.min(1.15, msg.ear / (msg.baseline || 0.3)) : 1,
        gazeX: msg.gazeX ?? 0,
        gazeY: msg.gazeY ?? 0,
        headX: msg.headX ?? 0,
        headY: msg.headY ?? 0,
        comfortState: c.state,
        tip: c.tip,
        nudge,
        distanceCm: c.distanceCm,
      });
      diagnostics.updateTitle(msg);
      if (msg.baseline) lastBaseline = msg.baseline;
      if (msg.blink) diagnostics.recordBlink(msg.at);
      // Drawing is skipped while hidden; nobody can see it.
      if (document.visibilityState === 'visible') drawEyes(msg.faceFound ? msg.eyePoints : null);
      if (msg.faceFound) graph.push(msg.at, msg.ear, msg.closedThreshold, msg.reopenThreshold);
      break;
    case 'stats':
      diagnostics.recordStats(msg);
      break;
    case 'note':
      console.info(msg.message);
      break;
    case 'error':
      setStatus(
        msg.stage === 'model'
          ? `Face model failed to load (${msg.message}). Check your connection and reload.`
          : `Detection error: ${msg.message}`,
        'error',
      );
      break;
  }
}

async function startDetector() {
  detector?.stop();
  detector = null;
  graph.clear();
  diagnostics.reset(mode);
  showBanner(!workerSupported ? FALLBACK_NOTE : mode === 'main' ? CONTROL_NOTE : '');
  setStatus('Loading face model…');
  const options = { onMessage: handleMessage, baseline: lastBaseline };
  detector = mode === 'worker' ? startWorkerDetector(stream, options) : await startMainDetector(els.video, options);
}

// Start the camera + detection. Called by the Start button and by the widget.
async function startSession() {
  if (session || starting) return;
  starting = true;
  els.startBtn.disabled = true;
  els.placeholderMsg.textContent = 'Starting camera…';
  setStatus('Starting camera…');
  try {
    stream = await startCamera(els.video);
  } catch (err) {
    const message = describeCameraError(err);
    setStatus(message, 'error');
    els.placeholderMsg.textContent = message; // also show it where the video would be
    els.startBtn.disabled = false;
    starting = false;
    return;
  }
  els.placeholder.hidden = true;
  // Fires if the camera is lost (e.g. unplugged). Not fired by our own track.stop().
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    endSession();
    setStatus('Camera disconnected. Reconnect it to start a new session.', 'error');
  });
  session = new SessionStats(epochNow());
  starting = false;
  widget.update({ running: true, phase: 'calibrating', calibrationProgress: 0, summary: null });
  await startDetector();
  els.recalibrateBtn.disabled = false;
  els.endBtn.disabled = false;
}

els.startBtn.addEventListener('click', startSession);

// Stop the camera and detection, then show how the session went.
function endSession() {
  if (!session) return;
  const summary = session.summary(epochNow());
  lastSummary = summary;
  session = null; // from here on, late messages are ignored (see handleMessage)
  comfort.reset();
  nudger.reset();
  renderComfort({ state: 'neutral', tip: 'Session ended. Start a new one any time.', distanceCm: null }, null);
  widget.update({ running: false, summary, comfortState: 'neutral', tip: 'Session ended.', nudge: null, faceFound: false });

  detector?.stop();
  detector = null;
  stream?.getTracks().forEach((track) => track.stop()); // camera light turns off
  stream = null;
  els.video.srcObject = null;
  drawEyes(null);

  els.placeholder.hidden = false;
  els.placeholderMsg.textContent = 'Session ended';
  els.startBtn.textContent = 'Start new session';
  els.startBtn.disabled = false;
  els.endBtn.disabled = true;
  els.recalibrateBtn.disabled = true;
  els.calibration.hidden = true;
  setStatus('Session ended');
  document.title = 'Eye Strain Monitor';

  // Only sessions with enough data are worth keeping in the trend.
  if (summary.rating === 'not-enough-data') {
    els.summarySaved.textContent = 'Too short to save to your history.';
  } else {
    els.summarySaved.textContent = saveSession(summary)
      ? 'Saved to your history.'
      : 'Couldn’t save to history (site data is blocked in this browser).';
    history.refresh();
  }
  showSummary(els, summary);
}

els.endBtn.addEventListener('click', endSession);

els.modeSelect.addEventListener('change', () => {
  mode = els.modeSelect.value;
  if (stream) startDetector();
});

els.recalibrateBtn.addEventListener('click', () => {
  lastBaseline = null;
  detector?.recalibrate();
  graph.clear();
});
