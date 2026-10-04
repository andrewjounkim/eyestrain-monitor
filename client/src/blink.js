// Calibration + blink counting. Feed it one EAR value per frame with a timestamp.
// Pure logic, no DOM: the same class runs inside the Web Worker and on the main thread.
//
// Phases:
//   'calibrating' -> collect open-eye EAR samples while a face is visible
//   'monitoring'  -> detect blinks with thresholds based on the calibration
//
// Blink state machine (monitoring phase):
//
//   OPEN --(EAR < closed threshold)--> CLOSED --(EAR > reopen threshold)--> OPEN
//                                                 |
//                     closed for MIN_BLINK_MS..MAX_BLINK_MS?  -> count a blink

// Frames further apart than this are treated as a break in tracking (face lost,
// or frames stopped arriving) and not added to calibration time.
const MAX_FRAME_GAP_MS = 250;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class BlinkDetector {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  // Start over, including a fresh calibration.
  reset() {
    this.phase = 'calibrating';
    this.samples = [];
    this.calibratedMs = 0;
    this.lastTime = null;
    this.baseline = null;
    this.closedThreshold = null;
    this.reopenThreshold = null;
    this.eyeClosed = false;
    this.closedSince = 0;
    this.total = 0;
    this.blinkTimes = [];
    this.monitoringSince = null;
  }

  // Skip calibration by reusing a known baseline (e.g. when switching detection
  // mode, so you don't have to calibrate again). If `now` isn't known yet, the
  // blink-rate window starts at the next frame.
  setBaseline(baseline, now = null) {
    this.phase = 'monitoring';
    this.baseline = baseline;
    this.closedThreshold = baseline * this.config.CLOSED_RATIO;
    this.reopenThreshold = baseline * this.config.REOPEN_RATIO;
    this.monitoringSince = now;
  }

  // Call when no face is found in a frame.
  faceLost() {
    this.lastTime = null;
    // Don't let "face disappeared while eyes were closed" become a fake blink.
    this.eyeClosed = false;
  }

  // Process one frame. `now` is in milliseconds. Returns a blink object
  // { durationMs } when a blink just finished, otherwise null.
  update(ear, now) {
    const gap = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;

    if (this.phase === 'calibrating') {
      this.calibrate(ear, gap, now);
      return null;
    }
    if (this.monitoringSince === null) this.monitoringSince = now;

    if (!this.eyeClosed && ear < this.closedThreshold) {
      this.eyeClosed = true;
      this.closedSince = now;
    } else if (this.eyeClosed && ear > this.reopenThreshold) {
      this.eyeClosed = false;
      const durationMs = now - this.closedSince;
      if (durationMs >= this.config.MIN_BLINK_MS && durationMs <= this.config.MAX_BLINK_MS) {
        this.total += 1;
        this.blinkTimes.push(now);
        return { durationMs };
      }
    }
    return null;
  }

  calibrate(ear, gap, now) {
    this.samples.push(ear);
    if (gap <= MAX_FRAME_GAP_MS) this.calibratedMs += gap;

    const doneTime = this.calibratedMs >= this.config.CALIBRATION_SECONDS * 1000;
    const doneSamples = this.samples.length >= this.config.MIN_CALIBRATION_SAMPLES;
    if (doneTime && doneSamples) {
      // Median, not mean: the few low EAR values from blinks during calibration
      // barely move the median, but would drag an average down.
      this.setBaseline(median(this.samples), now);
      this.samples = [];
    }
  }

  // Blinks per minute over the recent window.
  blinksPerMinute(now) {
    const windowMs = this.config.BLINK_RATE_WINDOW_SECONDS * 1000;
    this.blinkTimes = this.blinkTimes.filter((t) => now - t <= windowMs);
    // Until a full window has passed since calibration, scale by the time we
    // actually have, and flag the number as an estimate.
    const elapsed = this.monitoringSince === null ? 0 : now - this.monitoringSince;
    const spanMs = Math.min(windowMs, elapsed);
    return {
      perMinute: spanMs > 0 ? (this.blinkTimes.length * 60000) / spanMs : 0,
      estimate: elapsed < windowMs,
    };
  }

  // Snapshot for the UI.
  status(now) {
    return {
      phase: this.phase,
      calibrationProgress: Math.min(1, this.calibratedMs / (this.config.CALIBRATION_SECONDS * 1000)),
      baseline: this.baseline,
      closedThreshold: this.closedThreshold,
      reopenThreshold: this.reopenThreshold,
      total: this.total,
      ...this.blinksPerMinute(now),
    };
  }
}
