// Decides when to show a gentle nudge ("blink a few times", "lean back").
// Shown inside the widget and on the Monitor page, never as a system
// notification. Pure logic, no DOM: main.js passes in the comfort state.
//
// Timeline:  comfort state 'act' for NUDGE_AFTER_SECONDS  ->  nudge shown
//            problem fixed (state no longer 'act') or NUDGE_MAX_SECONDS  ->  nudge hidden
//            then no new nudge for NUDGE_COOLDOWN_MINUTES

import { CONFIG } from './config.js';

const MESSAGES = {
  blink: 'Blink a few times: slow, full blinks.',
  distance: 'Lean back to about arm’s length.',
};

export class Nudger {
  constructor() {
    this.reset();
  }

  reset() {
    this.actSince = null; // when the current 'act' stretch started
    this.shownAt = null; // when the current nudge appeared (null = none showing)
    this.lastNudgeAt = -Infinity;
    this.message = null;
  }

  // comfort: { state, reason } from ComfortTracker. now: ms.
  // Returns the nudge message to show, or null.
  update(comfort, now) {
    const acting = comfort.state === 'act';
    if (!acting) this.actSince = null;
    else if (this.actSince === null) this.actSince = now;

    if (this.shownAt !== null) {
      // Hide once the problem is fixed or after the max time.
      if (!acting || now - this.shownAt >= CONFIG.NUDGE_MAX_SECONDS * 1000) {
        this.shownAt = null;
        this.message = null;
        this.actSince = acting ? now : null; // a still-ongoing problem starts a fresh wait
      }
    } else if (
      acting &&
      now - this.actSince >= CONFIG.NUDGE_AFTER_SECONDS * 1000 &&
      now - this.lastNudgeAt >= CONFIG.NUDGE_COOLDOWN_MINUTES * 60 * 1000
    ) {
      this.shownAt = now;
      this.lastNudgeAt = now;
      this.message = MESSAGES[comfort.reason] || comfort.tip;
    }
    return this.message;
  }
}
