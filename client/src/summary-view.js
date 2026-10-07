// Renders the end-of-session summary dialog: headline numbers, a verdict, and
// a column chart of blinks per minute over the session (plain SVG, no library).

import { CONFIG } from './config.js';

const RATINGS = {
  good: { icon: '✓', label: 'Healthy blink rate', tip: 'Your eyes were getting regular blinks. Keep it up.' },
  fair: {
    icon: '!',
    label: 'A little low',
    tip: 'Your blink rate was below a relaxed rate. Try a few slow, full blinks whenever you switch tasks.',
  },
  low: {
    icon: '⚠',
    label: 'Low blink rate',
    tip: 'This is the screen-stare pattern that dries out eyes. Try the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.',
  },
  'not-enough-data': {
    icon: '–',
    label: 'Not enough data',
    tip: `The session needs at least ${CONFIG.SUMMARY_MIN_TOTAL_FACE_SECONDS} s of monitoring (after calibration) with your face visible to rate it.`,
  },
};

function formatDuration(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${s % 60} s`;
  return `${s} s`;
}

const time = (epochMs) => new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Group minutes into bins so long sessions still have readable columns
// (at most ~40 columns). Each bin gets a rate only if the face was visible long enough.
function binMinutes(minutes) {
  const size = Math.max(1, Math.ceil(minutes.length / 40));
  const bins = [];
  for (let i = 0; i < minutes.length; i += size) {
    const group = minutes.slice(i, i + size);
    const blinks = group.reduce((sum, m) => sum + m.blinks, 0);
    const faceSeconds = group.reduce((sum, m) => sum + m.faceSeconds, 0);
    bins.push({
      from: i + 1,
      to: i + group.length,
      blinks,
      faceSeconds,
      rate: faceSeconds >= CONFIG.SUMMARY_MIN_FACE_SECONDS * group.length ? blinks / (faceSeconds / 60) : null,
    });
  }
  return bins;
}

const binLabel = (b) => (b.from === b.to ? `Minute ${b.from}` : `Minutes ${b.from}–${b.to}`);

function renderChart(container, tooltip, bins) {
  const W = 560;
  const H = 200;
  const pad = { top: 12, right: 12, bottom: 28, left: 32 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxRate = Math.max(CONFIG.HEALTHY_BLINKS_PER_MIN * 1.5, ...bins.map((b) => b.rate ?? 0));
  const yMax = Math.ceil(maxRate / 10) * 10; // clean tick values: 0, 10, 20, ...
  const y = (v) => pad.top + plotH - (v / yMax) * plotH;
  const slot = plotW / bins.length;
  const barW = Math.min(24, Math.max(2, slot - 2)); // 2px gap between touching bars

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Blinks per minute for each minute of the session');
  const el = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    svg.appendChild(node);
    return node;
  };

  // Recessive hairline gridlines + y ticks.
  for (let v = 0; v <= yMax; v += 10) {
    el('line', { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: 'grid' });
    el('text', { x: pad.left - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, v);
  }

  // Reference line: typical relaxed blink rate.
  const ref = CONFIG.HEALTHY_BLINKS_PER_MIN;
  // (Its label is in the note under the chart; inside the plot it collided with the columns.)
  el('line', { x1: pad.left, x2: W - pad.right, y1: y(ref), y2: y(ref), class: 'ref' });

  // Columns: 4px rounded top, square at the baseline (path instead of <rect rx>).
  bins.forEach((b, i) => {
    const cx = pad.left + slot * i + slot / 2;
    const x0 = cx - barW / 2;
    const base = y(0);
    if (b.rate !== null && b.rate > 0) {
      const top = y(b.rate);
      const r = Math.min(4, barW / 2, base - top);
      el('path', {
        class: 'bar',
        d: `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`,
      });
    } else if (b.rate === null) {
      // Not enough face time this minute: a short gray stub instead of a fake 0.
      el('rect', { x: x0, y: base - 2, width: barW, height: 2, class: 'bar-missing' });
    }
    // Invisible full-height hit target, larger than the mark, for the tooltip.
    const hit = el('rect', { x: pad.left + slot * i, y: pad.top, width: slot, height: plotH, class: 'hit' });
    const text =
      b.rate === null
        ? `${binLabel(b)}: face not visible long enough`
        : `${binLabel(b)}: ${b.rate.toFixed(1)} blinks/min (${b.blinks} blinks, face visible ${Math.round(b.faceSeconds)} s)`;
    hit.addEventListener('pointerenter', () => {
      tooltip.textContent = text;
      tooltip.hidden = false;
      // Center over the column, but keep the whole tooltip inside the chart.
      const width = container.getBoundingClientRect().width;
      const half = tooltip.offsetWidth / 2;
      const px = (cx / W) * width;
      tooltip.style.left = `${Math.min(Math.max(px, half), width - half)}px`;
    });
    hit.addEventListener('pointerleave', () => (tooltip.hidden = true));
  });

  // X labels: first, last, and a few in between.
  const every = Math.max(1, Math.ceil(bins.length / 6));
  bins.forEach((b, i) => {
    if (i % every && i !== bins.length - 1) return;
    el('text', { x: pad.left + slot * i + slot / 2, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, b.from);
  });

  container.querySelector('svg')?.remove();
  container.prepend(svg);
}

export function showSummary(els, s) {
  const rating = RATINGS[s.rating];
  els.summaryRange.textContent = `${time(s.startedAt)} – ${time(s.endedAt)}`;
  els.summaryDuration.textContent = formatDuration(s.durationSeconds);
  els.summaryBlinks.textContent = s.totalBlinks;
  els.summaryRate.textContent = s.blinksPerMinute == null ? '–' : s.blinksPerMinute.toFixed(1);
  els.summaryFace.textContent = formatDuration(s.faceSeconds);
  els.summaryVerdict.className = `verdict verdict-${s.rating}`;
  els.summaryVerdictIcon.textContent = rating.icon;
  els.summaryVerdictLabel.textContent = rating.label;
  els.summaryTip.textContent = rating.tip;

  els.summaryRefNote.textContent = `${CONFIG.HEALTHY_BLINKS_PER_MIN}/min`;
  els.summaryDialog.showModal();

  const bins = binMinutes(s.minutes);
  els.summaryChartWrap.hidden = bins.length === 0;
  if (bins.length) {
    renderChart(els.summaryChart, els.summaryTooltip, bins);
    // Same numbers as a table, for screen readers and exact values.
    els.summaryTable.innerHTML = '';
    for (const b of bins) {
      const row = els.summaryTable.insertRow();
      for (const text of [
        binLabel(b),
        b.blinks,
        `${Math.round(b.faceSeconds)} s`,
        b.rate === null ? '–' : b.rate.toFixed(1),
      ]) {
        row.insertCell().textContent = text;
      }
    }
  }

  els.summaryCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(s, null, 2));
      els.summaryCopy.textContent = 'Copied!';
    } catch {
      els.summaryCopy.textContent = 'Copy failed';
    }
    setTimeout(() => (els.summaryCopy.textContent = 'Copy as JSON'), 1500);
  };
}
