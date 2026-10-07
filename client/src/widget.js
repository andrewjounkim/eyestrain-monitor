// Floating mini window ("widget") that stays on top of all other apps.
//
// Uses the Document Picture-in-Picture API (Chrome/Edge 116+): like video
// picture-in-picture, but the floating window can hold any HTML. It is a real
// second window owned by THIS page, which means:
// - Our code (running in the main page) builds and updates its DOM directly,
//   no messaging needed: `pip.document` is just another document.
// - It can only be opened from a click (a "user gesture").
// - It closes automatically when the main app window/tab is closed.
//
// What it shows:
// - The app's eye logo, mirroring YOUR eyes live: it blinks when you blink,
//   opens as wide as your eyes are open, and the iris follows your gaze.
// - One number (click it to switch: blinks/min, total blinks, session time, distance).
// - A very soft background tint that drifts toward green when things are fine,
//   amber when your blink rate is a bit low, and muted red when you should act.
//   The state is held for a few seconds before changing (comfort.js) and the
//   color fades over seconds, so it stays calm and out of the way.

import { formatClock } from './ui.js';

const METRICS = ['rate', 'total', 'time', 'distance'];

const TEMPLATE = `
  <div class="w" data-ref="root" data-state="neutral">
    <svg class="w-eye" viewBox="40 136 432 240" aria-hidden="true">
      <defs>
        <clipPath id="w-eye-shape"><path d="M64 256 Q256 80 448 256 Q256 432 64 256 Z" /></clipPath>
        <radialGradient id="w-iris-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#cfeee0" />
          <stop offset="55%" stop-color="#8fd3b4" />
          <stop offset="100%" stop-color="#3f7d66" />
        </radialGradient>
      </defs>
      <g data-ref="head">
        <g data-ref="lids" class="w-lids">
          <g clip-path="url(#w-eye-shape)">
            <g data-ref="iris" class="w-iris">
              <circle cx="256" cy="256" r="78" fill="url(#w-iris-fill)" />
              <circle cx="256" cy="256" r="32" class="w-pupil" />
              <circle cx="232" cy="230" r="9" fill="#f4fbf7" opacity="0.85" />
            </g>
          </g>
          <path class="w-outline" d="M64 256 Q256 80 448 256 Q256 432 64 256 Z" />
        </g>
      </g>
    </svg>
    <div class="w-info">
      <button class="w-metric" data-ref="metric" title="Click to change what's shown">
        <span data-ref="value" class="w-value">–</span>
        <span data-ref="unit" class="w-unit">blinks / min</span>
      </button>
      <p data-ref="tip" class="w-tip">Not running.</p>
    </div>
    <div class="w-actions">
      <button data-ref="start" class="w-btn">Start</button>
      <button data-ref="end" class="w-btn">End</button>
      <button data-ref="summary" class="w-btn">Summary</button>
    </div>
  </div>`;

export function supportsWidget() {
  return 'documentPictureInPicture' in window;
}

// The floating window starts as an empty document. Copy our stylesheets into
// it so it looks like the app (including the bundled fonts).
function copyStyles(targetDoc) {
  for (const sheet of document.styleSheets) {
    try {
      const style = targetDoc.createElement('style');
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
      targetDoc.head.appendChild(style);
    } catch {
      // Cross-origin sheets can't be read; link to them instead.
      const link = targetDoc.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      targetDoc.head.appendChild(link);
    }
  }
}

function loadMetric() {
  try {
    return METRICS.includes(localStorage.getItem('eyestrain.widgetMetric')) ? localStorage.getItem('eyestrain.widgetMetric') : 'rate';
  } catch {
    return 'rate';
  }
}

// actions: { start(), end(), showSummary() } provided by main.js
export function createWidget(actions) {
  let pip = null; // the floating Window, while open
  let refs = null;
  let metric = loadMetric();
  // Latest state, so a newly opened widget shows current numbers immediately.
  let state = { running: false, comfortState: 'neutral', tip: 'Not running.' };
  // Smoothed eye pose. Results arrive ~20-30 times a second; easing toward
  // each new value removes jitter without noticeably lagging.
  const eye = { openness: 1, gazeX: 0, gazeY: 0, headX: 0, headY: 0 };

  function metricText(s) {
    if (!s.running && s.summary) {
      const rate = s.summary.blinksPerMinute;
      return { value: rate == null ? '–' : rate.toFixed(1), unit: 'avg blinks / min' };
    }
    if (!s.running) return { value: '–', unit: 'not running' };
    if (s.phase === 'calibrating') return { value: `${Math.round(s.calibrationProgress * 100)}%`, unit: 'calibrating' };
    switch (metric) {
      case 'total':
        return { value: String(s.total), unit: 'blinks' };
      case 'time':
        return { value: formatClock(s.elapsedMs ?? 0), unit: 'session time' };
      case 'distance':
        return { value: s.distanceCm == null ? '–' : `${Math.round(s.distanceCm)}`, unit: 'cm from screen (approx.)' };
      default:
        return { value: s.perMinute.toFixed(0), unit: s.estimate ? 'blinks / min · est.' : 'blinks / min' };
    }
  }

  function renderEye(s) {
    const live = s.running && s.faceFound;
    // Targets: a relaxed, open, centered eye when there's no live face.
    const target = live
      ? { openness: Math.max(0, Math.min(1.1, s.openness)), gazeX: s.gazeX, gazeY: s.gazeY, headX: s.headX, headY: s.headY }
      : { openness: 1, gazeX: 0, gazeY: 0, headX: 0, headY: 0 };
    // Openness eases fast (blinks are ~150 ms); position eases slower (calmer).
    eye.openness += (target.openness - eye.openness) * 0.7;
    for (const k of ['gazeX', 'gazeY', 'headX', 'headY']) eye[k] += (target[k] - eye[k]) * 0.3;

    // Lids: squash the whole eye vertically (the iris is clipped to the eye shape).
    const scaleY = 0.06 + 0.94 * Math.min(1, eye.openness);
    refs.lids.setAttribute('transform', `translate(0 ${256 * (1 - scaleY)}) scale(1 ${scaleY})`);
    // Iris: up to ±62 units sideways, ±26 up/down inside the eye (SVG units).
    refs.iris.setAttribute('transform', `translate(${(eye.gazeX * 62).toFixed(1)} ${(eye.gazeY * 26).toFixed(1)})`);
    // Whole eye drifts a little with your head position.
    refs.head.setAttribute('transform', `translate(${(eye.headX * 18).toFixed(1)} ${(eye.headY * 10).toFixed(1)})`);
    refs.root.classList.toggle('w-idle', !live);
  }

  function render() {
    if (!refs) return;
    const s = state;
    refs.root.dataset.state = s.comfortState || 'neutral';
    const { value, unit } = metricText(s);
    if (refs.value.textContent !== value) refs.value.textContent = value;
    if (refs.unit.textContent !== unit) refs.unit.textContent = unit;
    const tip = s.running ? s.tip : s.summary ? 'Session ended.' : 'Not running.';
    if (refs.tip.textContent !== tip) refs.tip.textContent = tip;

    refs.start.hidden = s.running;
    refs.start.textContent = s.summary ? 'New session' : 'Start';
    refs.end.hidden = !s.running;
    refs.summary.hidden = s.running || !s.summary;
    renderEye(s);
  }

  async function open() {
    if (pip) {
      pip.focus();
      return;
    }
    pip = await documentPictureInPicture.requestWindow({ width: 340, height: 190 });
    copyStyles(pip.document);
    pip.document.title = 'Eye Strain';
    pip.document.body.classList.add('widget-body');
    pip.document.body.innerHTML = TEMPLATE;

    refs = {};
    for (const node of pip.document.querySelectorAll('[data-ref]')) refs[node.dataset.ref] = node;
    refs.start.addEventListener('click', () => actions.start());
    refs.end.addEventListener('click', () => actions.end());
    refs.summary.addEventListener('click', () => {
      // Clicking inside the widget counts as user activation, which lets us
      // bring the main app window to the front where the summary is shown.
      window.focus();
      actions.showSummary();
    });
    refs.metric.addEventListener('click', () => {
      metric = METRICS[(METRICS.indexOf(metric) + 1) % METRICS.length];
      try {
        localStorage.setItem('eyestrain.widgetMetric', metric);
      } catch {}
      render();
    });

    // Fires when the user closes the floating window (or the app closes).
    pip.addEventListener('pagehide', () => {
      pip = null;
      refs = null;
    });
    render();
  }

  return {
    open,
    isOpen: () => pip !== null,
    // Merge in new values and redraw. Called by main.js on every result and
    // whenever the status changes.
    update(partial) {
      state = { ...state, ...partial };
      render();
    },
  };
}
