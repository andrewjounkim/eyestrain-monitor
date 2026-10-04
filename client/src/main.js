// Entry point. Wires the modules together; the real logic lives in the other files.
//
// Data flow:
//   camera.js (MediaStream)
//     -> worker mode:  detector-worker.js -> worker.js    (frames never touch the page)
//        main mode:    detector-main.js on the <video>    (requestAnimationFrame loop)
//     -> both run FaceLandmarker, then frame-processor.js (ear.js + blink.js)
//     -> 'result' / 'stats' messages -> handleMessage() below -> ui / graph / diagnostics
import './style.css';
import { els, setStatus, showBanner, renderResult, drawEyes } from './ui.js';
import { startCamera, describeCameraError } from './camera.js';
import { startMainDetector } from './detector-main.js';
import { startWorkerDetector, supportsWorkerMode } from './detector-worker.js';
import { createDiagnostics } from './diagnostics.js';
import { EarGraph } from './graph.js';

const graph = new EarGraph(els.graph);
const diagnostics = createDiagnostics(els);

let stream = null;
let detector = null;
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
  switch (msg.type) {
    case 'ready':
      els.diagDelegate.textContent = msg.delegate;
      setStatus('Looking for your face…', 'ok');
      break;
    case 'result':
      renderResult(msg);
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

els.startBtn.addEventListener('click', async () => {
  els.startBtn.disabled = true;
  setStatus('Starting camera…');
  try {
    stream = await startCamera(els.video);
  } catch (err) {
    setStatus(describeCameraError(err), 'error');
    els.startBtn.disabled = false;
    return;
  }
  els.placeholder.hidden = true;
  // e.g. webcam unplugged while running
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    detector?.stop();
    setStatus('Camera disconnected. Reconnect it and reload the page.', 'error');
  });
  await startDetector();
  els.recalibrateBtn.disabled = false;
});

els.modeSelect.addEventListener('change', () => {
  mode = els.modeSelect.value;
  if (stream) startDetector();
});

els.recalibrateBtn.addEventListener('click', () => {
  lastBaseline = null;
  detector?.recalibrate();
  graph.clear();
});
