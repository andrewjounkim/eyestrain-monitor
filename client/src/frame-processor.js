// Everything that happens to ONE frame after the face model has run on it:
// measure the eyes, update calibration/blinks, check lighting, count frames per
// second, and send a plain-object message to whoever is listening.
//
// Both detectors use this, so worker mode and main-thread mode produce exactly
// the same messages and the page doesn't care which one is running:
//   { type: 'result', ... }  once per frame
//   { type: 'stats',  ... }  about once per second (for diagnostics)

import { CONFIG } from './config.js';
import { measureEyes } from './ear.js';
import { measurePose } from './pose.js';
import { BlinkDetector } from './blink.js';
import { averageBrightness } from './lighting.js';

// Wall-clock time in ms. performance.now() alone starts at 0 separately in the
// page and in the worker; adding timeOrigin puts both on the same clock, so the
// page can line up worker timestamps with its own visibility changes.
export const epochNow = () => performance.timeOrigin + performance.now();

export class FrameProcessor {
  // `send` is postMessage (in the worker) or a direct callback (main thread).
  constructor(send, { baseline = null } = {}) {
    this.send = send;
    this.blink = new BlinkDetector(CONFIG);
    if (baseline) this.blink.setBaseline(baseline);
    this.framesSinceStats = 0;
    this.statsStart = epochNow();
    this.lastBrightnessCheck = -Infinity;
    this.brightness = null;
  }

  recalibrate() {
    this.blink.reset();
  }

  // result: FaceLandmarker output. t: frame time in ms (same clock as the
  // timestamps given to MediaPipe). source: the image, for the brightness check.
  handle(result, t, width, height, source) {
    const at = epochNow();

    if (at - this.lastBrightnessCheck >= CONFIG.BRIGHTNESS_CHECK_MS) {
      this.brightness = averageBrightness(source);
      this.lastBrightnessCheck = at;
    }

    const landmarks = result.faceLandmarks[0];
    const message = {
      type: 'result',
      at,
      faceFound: Boolean(landmarks),
      tooDark: this.brightness !== null && this.brightness < CONFIG.MIN_BRIGHTNESS,
      brightness: this.brightness,
      blink: null,
    };

    if (landmarks) {
      const eyes = measureEyes(landmarks, width, height);
      Object.assign(message, eyes, measurePose(landmarks, width, height));
      message.blink = this.blink.update(eyes.ear, t);
    } else {
      // No face: report that instead of inventing numbers.
      this.blink.faceLost();
    }
    Object.assign(message, this.blink.status(t));
    this.send(message);

    this.countFrame(at);
  }

  // Counted HERE (inside the worker, in worker mode) rather than on the page, so
  // the measurement is still correct if the page itself is being throttled.
  countFrame(at) {
    this.framesSinceStats += 1;
    const elapsed = at - this.statsStart;
    if (elapsed >= CONFIG.STATS_INTERVAL_MS) {
      this.send({
        type: 'stats',
        at,
        frames: this.framesSinceStats,
        fps: (this.framesSinceStats * 1000) / elapsed,
      });
      this.framesSinceStats = 0;
      this.statsStart = at;
    }
  }
}
