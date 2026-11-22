// Midnight Vault — The Kestrel Job: the alarm meter.
// Rises while any guard or camera sees Kestrel (faster up close), falls while
// hidden. 60+ means SPOTTED!, 100 means caught — after a short fair delay.
import { ALARM_CAUGHT, ALARM_DECAY, ALARM_RISE_BASE, ALARM_RISE_CLOSE, ALARM_SPOTTED } from './config.js';

export class Alarm {
  constructor() {
    this.value = 0; // 0..100
    this.peak = 0; // highest value reached this run (scores the getaway)
    this.spotted = false;
    this.caught = false;
  }

  reset() {
    this.value = 0;
    this.peak = 0;
    this.spotted = false;
    this.caught = false;
  }

  set(value) {
    this.value = Math.max(0, Math.min(ALARM_CAUGHT, value));
    this.peak = Math.max(this.peak, this.value);
    this.spotted = this.value >= ALARM_SPOTTED;
    this.caught = this.value >= ALARM_CAUGHT;
  }

  /**
   * dt seconds pass. `seen` is true when any watcher sees the thief;
   * `exposure` is 0..1 (how close the nearest watcher is) and scales the rise.
   */
  update(dt, seen, exposure) {
    if (seen) {
      const rate = ALARM_RISE_BASE + ALARM_RISE_CLOSE * exposure;
      this.set(this.value + rate * dt);
    } else {
      this.set(this.value - ALARM_DECAY * dt);
    }
  }
}
