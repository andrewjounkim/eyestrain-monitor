// Turns the live numbers into one calm "how are my eyes doing" state plus a
// short tip. Used by the Monitor view and the floating widget.
//
// States: 'good' | 'fair' | 'act' | 'neutral' (not running / calibrating / no face)
//
// A new state is only shown after it has lasted COMFORT_HOLD_SECONDS, so the
// widget's color doesn't jump around when you glance away for a second.
// Pure logic, no DOM.

import { CONFIG } from './config.js';

function rawState(r, distanceCm) {
  if (!r) return { state: 'neutral', tip: 'Not running.' };
  if (r.phase === 'calibrating') return { state: 'neutral', tip: 'Calibrating: look at the screen and blink normally.' };
  if (!r.faceFound) return { state: 'neutral', tip: r.tooDark ? 'Too dark to see your eyes. Add some light in front of you.' : 'Face not in view.' };
  if (r.tooDark) return { state: 'fair', tip: 'Low light: tracking may be unreliable.' };
  if (distanceCm != null && distanceCm < CONFIG.DISTANCE_TOO_CLOSE_CM) {
    return { state: 'act', reason: 'distance', tip: 'You’re close to the screen. Lean back a little.' };
  }
  // The first minute's rate is an estimate; don't judge it yet.
  if (!r.estimate && r.perMinute < CONFIG.LOW_BLINKS_PER_MIN) {
    return { state: 'act', reason: 'blink', tip: 'Your blink rate is low. Try a few slow, full blinks.' };
  }
  if (!r.estimate && r.perMinute < CONFIG.HEALTHY_BLINKS_PER_MIN) {
    return { state: 'fair', tip: 'Blinking a little less than a relaxed rate.' };
  }
  return { state: 'good', tip: 'Looking good. Keep blinking naturally.' };
}

export class ComfortTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.shown = { state: 'neutral', tip: 'Not running.' };
    this.pending = null;
    this.pendingSince = 0;
    this.distanceCm = null;
  }

  // r: a 'result' message (or null when stopped). now: ms.
  update(r, now) {
    // Smooth the distance: per-frame estimates jitter by a few cm.
    if (r?.faceFound && r.distanceCm) {
      this.distanceCm = this.distanceCm == null ? r.distanceCm : this.distanceCm * 0.9 + r.distanceCm * 0.1;
    }
    const next = rawState(r, this.distanceCm);

    if (next.state === this.shown.state) {
      this.shown = next; // same state, maybe a newer tip
      this.pending = null;
    } else if (this.pending?.state !== next.state) {
      this.pending = next;
      this.pendingSince = now;
    } else if (now - this.pendingSince >= CONFIG.COMFORT_HOLD_SECONDS * 1000) {
      this.shown = next;
      this.pending = null;
    }
    return { ...this.shown, distanceCm: this.distanceCm };
  }
}
