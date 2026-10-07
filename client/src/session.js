// Statistics for one monitoring session, from "Start" to "End session".
// Fed every 'result' message; produces a summary of plain numbers when the
// session ends. Pure logic, no DOM. (The summary object is also the shape a
// later phase will send to the backend: numbers only, never images.)

import { CONFIG } from './config.js';

// Gaps between results longer than this (page throttled, camera stalled) are
// not counted as "time at the screen".
const MAX_GAP_MS = 1000;

export class SessionStats {
  constructor(startedAt) {
    this.startedAt = startedAt;
    this.monitoringStart = null; // first result after calibration finished
    this.lastAt = null;
    this.faceMs = 0;
    this.totalBlinks = 0;
    this.minutes = []; // [{ blinks, faceMs }] one entry per minute of monitoring
  }

  onResult(r) {
    const dt = this.lastAt === null ? 0 : Math.min(r.at - this.lastAt, MAX_GAP_MS);
    this.lastAt = r.at;
    // Calibration time isn't part of the stats: no blinks are counted then.
    if (r.phase !== 'monitoring') return;
    if (this.monitoringStart === null) this.monitoringStart = r.at;

    const minute = this.minuteAt(r.at);
    if (r.faceFound) {
      this.faceMs += dt;
      minute.faceMs += dt;
    }
    if (r.blink) {
      this.totalBlinks += 1;
      minute.blinks += 1;
    }
  }

  minuteAt(at) {
    const index = Math.floor((at - this.monitoringStart) / 60000);
    while (this.minutes.length <= index) this.minutes.push({ blinks: 0, faceMs: 0 });
    return this.minutes[index];
  }

  summary(endedAt) {
    const faceSeconds = this.faceMs / 1000;
    // Rate = blinks per minute of time your face was actually in view, so
    // stepping away from the desk doesn't drag the average down.
    const blinksPerMinute = faceSeconds > 0 ? this.totalBlinks / (faceSeconds / 60) : null;

    let rating = 'not-enough-data';
    if (faceSeconds >= CONFIG.SUMMARY_MIN_TOTAL_FACE_SECONDS) {
      if (blinksPerMinute >= CONFIG.HEALTHY_BLINKS_PER_MIN) rating = 'good';
      else if (blinksPerMinute >= CONFIG.LOW_BLINKS_PER_MIN) rating = 'fair';
      else rating = 'low';
    }

    return {
      startedAt: this.startedAt,
      endedAt,
      durationSeconds: (endedAt - this.startedAt) / 1000,
      faceSeconds,
      totalBlinks: this.totalBlinks,
      blinksPerMinute,
      rating,
      minutes: this.minutes.map((m) => ({ blinks: m.blinks, faceSeconds: m.faceMs / 1000 })),
    };
  }
}
