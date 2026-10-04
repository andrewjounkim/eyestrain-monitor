// Background experiment diagnostics.
//
// Question: does detection keep running at full speed while the page is hidden?
//
// How it measures:
// - The detector (in the worker, in worker mode) counts processed frames and sends
//   a 'stats' sample about once a second, stamped with the time it was MEASURED.
// - This file keeps a timeline of visibility changes (Page Visibility API).
// - Each sample is assigned to the visible/hidden period it was measured in, by
//   its timestamp, not by when the message arrived. So even if the page itself is
//   throttled while hidden and receives messages late, the numbers stay correct.
// - "Longest gap" = longest time with no stats sample. If detection stalls while
//   hidden, it shows up here as a big gap even if the average looks fine.

const now = () => performance.timeOrigin + performance.now();

export function createDiagnostics(els) {
  let mode = null;
  let timeline = []; // [{ state: 'visible'|'hidden', start }]
  let samples = []; // [{ at, frames, fps }]
  let blinkTimes = [];

  function reset(newMode) {
    mode = newMode;
    timeline = [{ state: document.visibilityState, start: now() }];
    samples = [];
    blinkTimes = [];
    els.diagMode.textContent = newMode === 'worker' ? 'Background worker' : 'Main thread (control)';
    els.diagSummary.hidden = true;
    render();
  }

  function segments() {
    const end = now();
    return timeline.map((seg, i) => {
      const segEnd = timeline[i + 1]?.start ?? end;
      const inSeg = (at) => at >= seg.start && at < segEnd;
      const segSamples = samples.filter((s) => inSeg(s.at));
      const frames = segSamples.reduce((sum, s) => sum + s.frames, 0);
      const durationS = (segEnd - seg.start) / 1000;

      let longestGap = 0;
      let prev = seg.start;
      for (const s of segSamples) {
        longestGap = Math.max(longestGap, s.at - prev);
        prev = s.at;
      }
      longestGap = Math.max(longestGap, segEnd - prev);

      return {
        state: seg.state,
        start: seg.start,
        durationS,
        frames,
        avgFps: durationS > 0 ? frames / durationS : 0,
        longestGapS: longestGap / 1000,
        blinks: blinkTimes.filter(inSeg).length,
      };
    });
  }

  function render() {
    els.diagLog.innerHTML = '';
    // Newest first; skip near-empty periods (e.g. a quick alt-tab).
    for (const s of segments().reverse()) {
      if (s.durationS < 1) continue;
      const row = els.diagLog.insertRow();
      if (s.state === 'hidden') row.className = 'hidden-row';
      for (const text of [
        s.state,
        `${s.durationS.toFixed(0)} s`,
        s.frames,
        s.avgFps.toFixed(1),
        `${s.longestGapS.toFixed(2)} s`,
        s.blinks,
      ]) {
        row.insertCell().textContent = text;
      }
    }
  }

  // Coming back to the page: summarize what happened while it was hidden.
  document.addEventListener('visibilitychange', () => {
    if (!mode) return;
    timeline.push({ state: document.visibilityState, start: now() });
    if (document.visibilityState !== 'visible') return;

    const hidden = segments().filter((s) => s.state === 'hidden').at(-1);
    if (hidden) {
      els.diagSummary.hidden = false;
      els.diagSummary.textContent =
        `While hidden for ${hidden.durationS.toFixed(0)} s: ${hidden.frames} frames processed ` +
        `(${hidden.avgFps.toFixed(1)} fps avg), longest gap ${hidden.longestGapS.toFixed(2)} s, ` +
        `${hidden.blinks} blinks detected. Mode: ${els.diagMode.textContent}.`;
    }
    render();
  });

  els.diagCopy.addEventListener('click', async () => {
    const data = { mode, userAgent: navigator.userAgent, standalone: matchMedia('(display-mode: standalone)').matches, segments: segments() };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      els.diagCopy.textContent = 'Copied!';
    } catch {
      els.diagCopy.textContent = 'Copy failed';
    }
    setTimeout(() => (els.diagCopy.textContent = 'Copy log as JSON'), 1500);
  });
  els.diagClear.addEventListener('click', () => mode && reset(mode));

  let lastTitle = '';

  return {
    reset,
    recordStats(msg) {
      samples.push(msg);
      els.diagFps.textContent = msg.fps.toFixed(1);
      if (document.visibilityState === 'visible') render();
    },
    recordBlink(at) {
      blinkTimes.push(at);
    },
    // Live count in the tab/window title, so you can watch it from another window.
    updateTitle(r) {
      const title = r.phase === 'calibrating'
        ? `Calibrating ${Math.round(r.calibrationProgress * 100)}%`
        : `👁 ${r.total} blinks · ${r.perMinute.toFixed(0)}/min`;
      if (title !== lastTitle) document.title = lastTitle = title;
    },
  };
}
