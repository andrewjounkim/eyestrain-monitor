// All DOM updates live here, so the other modules stay free of page details.

const $ = (id) => document.getElementById(id);

export const els = {
  status: $('status'),
  banner: $('banner'),
  video: $('video'),
  overlay: $('overlay'),
  placeholder: $('video-placeholder'),
  placeholderMsg: $('video-message'),
  startBtn: $('start-btn'),
  recalibrateBtn: $('recalibrate-btn'),
  landmarksToggle: $('landmarks-toggle'),
  modeSelect: $('mode-select'),
  calibration: $('calibration'),
  calibrationBar: $('calibration-bar'),
  calibrationText: $('calibration-text'),
  blinkTotal: $('blink-total'),
  blinkRate: $('blink-rate'),
  earAvg: $('ear-avg'),
  earLR: $('ear-lr'),
  baseline: $('baseline'),
  thresholds: $('thresholds'),
  brightness: $('brightness'),
  graph: $('ear-graph'),
  diagMode: $('diag-mode'),
  diagDelegate: $('diag-delegate'),
  diagFps: $('diag-fps'),
  diagSummary: $('diag-summary'),
  diagLog: $('diag-log'),
  diagCopy: $('diag-copy'),
  diagClear: $('diag-clear'),
  notifyEnable: $('notify-enable'),
  notifyTest: $('notify-test'),
  notifyStatus: $('notify-status'),
};

// kind: 'idle' | 'ok' | 'warn' | 'error'
export function setStatus(text, kind = 'idle') {
  els.status.textContent = text;
  els.status.className = `status status-${kind}`;
}

export function showBanner(text) {
  els.banner.textContent = text;
  els.banner.hidden = !text;
}

const fmt = (n, digits = 3) => (n == null ? '–' : n.toFixed(digits));

// Update the numbers and status from one 'result' message.
export function renderResult(r) {
  // Status, most important problem first. Never show stale numbers as if live.
  if (!r.faceFound && r.tooDark) setStatus('Too dark: add light in front of you', 'warn');
  else if (!r.faceFound) setStatus('No face detected: center your face in the camera', 'warn');
  else if (r.tooDark) setStatus('Low light: detection may be unreliable', 'warn');
  else if (r.phase === 'calibrating') setStatus('Calibrating…', 'ok');
  else setStatus('Monitoring', 'ok');

  els.earAvg.textContent = r.faceFound ? fmt(r.ear) : '–';
  els.earLR.textContent = r.faceFound ? `${fmt(r.earLeft)} / ${fmt(r.earRight)}` : '–';
  els.brightness.textContent = r.brightness == null ? '–' : `${Math.round(r.brightness)} / 255`;

  const calibrating = r.phase === 'calibrating';
  els.calibration.hidden = !calibrating;
  if (calibrating) {
    els.calibrationBar.value = r.calibrationProgress;
    els.calibrationText.textContent = r.faceFound
      ? `${Math.round(r.calibrationProgress * 100)}%`
      : 'Paused: no face visible';
  }

  els.baseline.textContent = fmt(r.baseline);
  els.thresholds.textContent =
    r.closedThreshold == null ? '–' : `${fmt(r.closedThreshold)} / ${fmt(r.reopenThreshold)}`;
  els.blinkTotal.textContent = calibrating ? '–' : r.total;
  els.blinkRate.textContent = calibrating ? '–' : `${r.perMinute.toFixed(1)}${r.estimate ? ' (estimate)' : ''}`;
}

// Draw the 12 eye points over the video. The lines show exactly what EAR measures:
// green = the two eyelid-opening heights, amber = the eye width.
export function drawEyes(eyePoints) {
  const { overlay, video } = els;
  if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!eyePoints || !els.landmarksToggle.checked) return;

  // eyePoints = [x0, y0, x1, y1, ...] normalized 0..1; 6 points per eye (see ear.js).
  const pt = (i) => [eyePoints[i * 2] * overlay.width, eyePoints[i * 2 + 1] * overlay.height];
  const line = (a, b, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(...pt(a));
    ctx.lineTo(...pt(b));
    ctx.stroke();
  };
  ctx.lineWidth = 1.5;
  for (const o of [0, 6]) {
    // o = offset of this eye's first point; p1..p6 are o+0..o+5
    line(o + 1, o + 5, '#8fd3b4'); // p2-p6
    line(o + 2, o + 4, '#8fd3b4'); // p3-p5
    line(o + 0, o + 3, '#e9bb72'); // p1-p4
    ctx.fillStyle = '#ece6d9';
    for (let i = o; i < o + 6; i++) {
      const [x, y] = pt(i);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}
