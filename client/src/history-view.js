// History card: headline numbers, a trend chart of blinks/min across all saved
// sessions, and a table. Plain SVG, no chart library.

import { CONFIG } from './config.js';
import { loadSessions, deleteSession, clearSessions } from './history.js';

// How many recent sessions make up "recent average" and the trend line.
const RECENT = 5;

const fmtDate = (ms) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
const fmtDateTime = (ms) =>
  new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtMinutes = (seconds) => {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Average of each session and up to RECENT-1 sessions before it: smooths out
// one-off good or bad days so the direction of change is visible.
function rollingAverage(rates) {
  return rates.map((_, i) => mean(rates.slice(Math.max(0, i - RECENT + 1), i + 1)));
}

function renderTiles(els, sessions) {
  const rates = sessions.map((s) => s.blinksPerMinute);
  const recent = rates.slice(-RECENT);
  const earlier = rates.slice(0, -RECENT);

  els.historyCount.textContent = sessions.length;
  els.historyRecent.textContent = mean(recent).toFixed(1);
  els.historyTime.textContent = fmtMinutes(sessions.reduce((sum, s) => sum + s.faceSeconds, 0));

  // Trend: recent sessions vs everything before them. More blinks = better.
  const trend = els.historyTrend;
  if (earlier.length === 0) {
    trend.className = 'trend';
    trend.innerHTML = `<span class="trend-icon" aria-hidden="true">–</span> Trend appears after ${RECENT + 1} sessions`;
    return;
  }
  const delta = mean(recent) - mean(earlier);
  const better = delta >= 0;
  trend.className = `trend ${Math.abs(delta) < 0.5 ? '' : better ? 'trend-up' : 'trend-down'}`;
  trend.innerHTML = '';
  const icon = document.createElement('span');
  icon.className = 'trend-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = Math.abs(delta) < 0.5 ? '=' : better ? '▲' : '▼';
  trend.append(
    icon,
    Math.abs(delta) < 0.5
      ? ' About the same as your earlier sessions'
      : ` ${Math.abs(delta).toFixed(1)} blinks/min ${better ? 'more' : 'fewer'} than your earlier sessions (${better ? 'better' : 'worse'})`,
  );
}

function renderChart(els, sessions) {
  const container = els.historyChart;
  const tooltip = els.historyTooltip;
  // Draw at the container's real pixel width (not a scaled viewBox), so text
  // stays 12px on any screen. Re-run on resize (see setupHistory).
  const W = Math.max(280, Math.round(container.clientWidth));
  // Fill the card's height too (the History view is sized to the window).
  const H = Math.max(200, Math.round(container.clientHeight) - 4);
  const pad = { top: 16, right: 16, bottom: 30, left: 34 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const rates = sessions.map((s) => s.blinksPerMinute);
  const avg = rollingAverage(rates);
  const yMax = Math.ceil(Math.max(CONFIG.HEALTHY_BLINKS_PER_MIN * 1.5, ...rates) / 10) * 10;
  const n = sessions.length;
  const x = (i) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => pad.top + plotH - (v / yMax) * plotH;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Blinks per minute for each saved session, with a rolling average');
  const el = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    svg.appendChild(node);
    return node;
  };

  for (let v = 0; v <= yMax; v += 10) {
    el('line', { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: 'grid' });
    el('text', { x: pad.left - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, v);
  }
  const ref = CONFIG.HEALTHY_BLINKS_PER_MIN;
  el('line', { x1: pad.left, x2: W - pad.right, y1: y(ref), y2: y(ref), class: 'ref' });

  // X labels: dates of a few evenly spaced sessions.
  const maxLabels = Math.max(2, Math.floor(plotW / 90)); // ~90px per date label
  const every = Math.max(1, Math.ceil(n / maxLabels));
  sessions.forEach((s, i) => {
    // Every `every`-th session, plus the last one; drop a regular label that
    // would sit too close to the last one.
    if (i !== n - 1 && (i % every || n - 1 - i < every * 0.6)) return;
    // First/last labels align to the plot edges so they aren't clipped.
    const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    el('text', { x: x(i), y: H - 8, class: 'tick', 'text-anchor': anchor }, fmtDate(s.startedAt));
  });

  const crosshair = el('line', { x1: 0, x2: 0, y1: pad.top, y2: pad.top + plotH, class: 'crosshair', visibility: 'hidden' });

  // Rolling average: the 2px line, the one the eye should follow.
  if (n > 1) {
    el('polyline', { class: 'avg-line', points: avg.map((v, i) => `${x(i)},${y(v)}`).join(' ') });
  }
  // Each session: a dot (in the lighter de-emphasis step of the same hue).
  const dots = sessions.map((s, i) => el('circle', { cx: x(i), cy: y(s.blinksPerMinute), r: 4, class: 'session-dot' }));

  // One hit area over the whole plot; the nearest session gets the tooltip.
  const hit = el('rect', { x: pad.left - 8, y: pad.top, width: plotW + 16, height: plotH, class: 'hit' });
  let active = null;
  hit.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - pad.left) / plotW) * (n - 1))));
    if (i === active) return;
    active = i;
    dots.forEach((d, j) => d.classList.toggle('active', j === i));
    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    crosshair.setAttribute('visibility', 'visible');

    const s = sessions[i];
    // Two deliberate lines (white-space: pre-line) instead of random wrapping.
    tooltip.textContent =
      `${fmtDateTime(s.startedAt)} · ${fmtMinutes(s.durationSeconds)}\n` +
      `${s.blinksPerMinute.toFixed(1)} blinks/min · ${RECENT}\u2011session avg ${avg[i].toFixed(1)}`;
    tooltip.hidden = false;
    const width = container.getBoundingClientRect().width;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.min(Math.max((x(i) / W) * width, half), width - half)}px`;
  });
  hit.addEventListener('pointerleave', () => {
    tooltip.hidden = true;
    crosshair.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.classList.remove('active'));
    active = null;
  });

  container.querySelector('svg')?.remove();
  container.prepend(svg);
}

function renderTable(els, sessions, refresh) {
  els.historyTable.innerHTML = '';
  // Newest first in the table.
  for (const s of [...sessions].reverse()) {
    const row = els.historyTable.insertRow();
    for (const text of [
      fmtDateTime(s.startedAt),
      fmtMinutes(s.durationSeconds),
      s.totalBlinks,
      s.blinksPerMinute.toFixed(1),
    ]) {
      row.insertCell().textContent = text;
    }
    const del = document.createElement('button');
    del.className = 'link-button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (confirm(`Delete the session from ${fmtDateTime(s.startedAt)}?`)) {
        deleteSession(s.id);
        refresh();
      }
    });
    row.insertCell().append(del);
  }
}

export function setupHistory(els) {
  function refresh() {
    const sessions = loadSessions();
    const has = Boolean(sessions?.length);
    els.historyContent.hidden = !has;
    els.historyEmpty.hidden = has;
    if (sessions === null) {
      els.historyEmpty.textContent =
        'History can’t be saved in this browser mode (site data is blocked or this is a private window).';
      return;
    }
    if (!has) {
      els.historyEmpty.textContent =
        'No sessions yet. End a session with at least a minute of monitoring and it will appear here.';
      return;
    }
    renderTiles(els, sessions);
    renderChart(els, sessions);
    renderTable(els, sessions, refresh);
  }

  els.historyClear.addEventListener('click', () => {
    if (confirm('Delete all saved sessions? This can’t be undone.')) {
      clearSessions();
      refresh();
    }
  });
  els.historyRefNote.textContent = `${CONFIG.HEALTHY_BLINKS_PER_MIN}/min`;

  // Chart <-> table, in the same space, so the page never needs to scroll.
  els.historyTableToggle.addEventListener('click', () => {
    const showTable = els.historyTableWrap.hidden;
    els.historyTableWrap.hidden = !showTable;
    els.historyChart.hidden = showTable;
    els.historyTableToggle.textContent = showTable ? 'Show chart' : 'Show as table';
    els.historyTableToggle.setAttribute('aria-expanded', String(showTable));
  });

  // Redraw the chart when its size changes (window resize, switching to the
  // History view, phone rotation). Skipped while it's hidden (size 0).
  let lastSize = '';
  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const size = `${Math.round(width)}x${Math.round(height)}`;
    if (!width || size === lastSize || els.historyContent.hidden) return;
    lastSize = size;
    const sessions = loadSessions();
    if (sessions?.length) renderChart(els, sessions);
  }).observe(els.historyChart);

  refresh();
  return { refresh };
}
