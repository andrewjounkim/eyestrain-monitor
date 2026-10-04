// Live EAR line graph on a plain <canvas>, for tuning thresholds by eye.
// Blinks show up as sharp dips below the red "closed" line.

import { CONFIG } from './config.js';

export class EarGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.points = []; // { at, ear }
    this.thresholds = { closed: null, reopen: null };
  }

  push(at, ear, closed, reopen) {
    this.points.push({ at, ear });
    this.thresholds = { closed, reopen };
    const cutoff = at - CONFIG.GRAPH_SECONDS * 1000;
    while (this.points.length && this.points[0].at < cutoff) this.points.shift();
    // Drawing is wasted work while nobody can see it.
    if (document.visibilityState === 'visible') this.draw(at);
  }

  clear() {
    this.points = [];
    this.draw(performance.timeOrigin + performance.now());
  }

  draw(now) {
    const { canvas, ctx } = this;
    // Match the canvas's pixel size to its on-screen size (sharp on retina screens).
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    const spanMs = CONFIG.GRAPH_SECONDS * 1000;
    const x = (at) => w - ((now - at) / spanMs) * w;
    const y = (ear) => h - (Math.min(ear, CONFIG.GRAPH_MAX_EAR) / CONFIG.GRAPH_MAX_EAR) * h;
    const css = getComputedStyle(document.documentElement);

    const hline = (value, color) => {
      if (value == null) return;
      ctx.strokeStyle = color;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, y(value));
      ctx.lineTo(w, y(value));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    hline(this.thresholds.closed, css.getPropertyValue('--closed'));
    hline(this.thresholds.reopen, css.getPropertyValue('--reopen'));

    ctx.strokeStyle = css.getPropertyValue('--ear');
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    this.points.forEach((p, i) => (i ? ctx.lineTo(x(p.at), y(p.ear)) : ctx.moveTo(x(p.at), y(p.ear))));
    ctx.stroke();
  }
}
