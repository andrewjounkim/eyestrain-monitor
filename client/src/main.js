// Entry point. Wires the modules together; the real logic lives in the other files.
import './style.css';
import { els, setStatus, renderResult, drawEyes } from './ui.js';
import { startCamera, describeCameraError } from './camera.js';
import { startMainDetector } from './detector-main.js';
import { EarGraph } from './graph.js';

const graph = new EarGraph(els.graph);
let detector = null;

function handleMessage(msg) {
  switch (msg.type) {
    case 'ready':
      els.diagDelegate.textContent = msg.delegate;
      setStatus('Looking for your face…', 'ok');
      break;
    case 'result':
      renderResult(msg);
      if (document.visibilityState === 'visible') drawEyes(msg.faceFound ? msg.eyePoints : null);
      if (msg.faceFound) graph.push(msg.at, msg.ear, msg.closedThreshold, msg.reopenThreshold);
      break;
    case 'stats':
      els.diagFps.textContent = msg.fps.toFixed(1);
      break;
    case 'error':
      setStatus(msg.stage === 'model' ? `Face model failed to load: ${msg.message}` : msg.message, 'error');
      break;
  }
}

els.startBtn.addEventListener('click', async () => {
  els.startBtn.disabled = true;
  setStatus('Starting camera…');
  try {
    await startCamera(els.video);
  } catch (err) {
    setStatus(describeCameraError(err), 'error');
    els.startBtn.disabled = false;
    return;
  }
  els.placeholder.hidden = true;
  setStatus('Loading face model…');
  detector = await startMainDetector(els.video, { onMessage: handleMessage });
  els.recalibrateBtn.disabled = false;
});

els.recalibrateBtn.addEventListener('click', () => {
  detector?.recalibrate();
  graph.clear();
});
