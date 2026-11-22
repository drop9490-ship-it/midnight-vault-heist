// Midnight Vault — The Kestrel Job: fixed CCTV cameras.
// A camera sits on a wall and sweeps its cone back and forth forever.
// An EMP pulse kills the nearest camera for a few seconds.
import { CAMERA_FOV, CAMERA_RANGE, CAMERA_SWEEP, CAMERA_SWEEP_SPEED } from './config.js';
import { hasLineOfSight, pointInCone } from './vision.js';

export class Camera {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.baseAngle = def.baseAngle;
    this.sweep = def.sweep ?? CAMERA_SWEEP;
    this.phase = def.phase ?? 0;
    this.range = CAMERA_RANGE;
    this.fov = CAMERA_FOV;
    this.angle = def.baseAngle;
    this.sweepSpeed = CAMERA_SWEEP_SPEED; // scaled by difficulty
    this.disabledUntil = -1; // game clock; -1 means alive
    this.seeing = false;
  }

  /** Sweep the cone. `now` is the scene's running game clock in seconds. */
  update(now) {
    this.angle = this.baseAngle + Math.sin(now * this.sweepSpeed + this.phase) * this.sweep;
  }

  isDisabled(now) {
    return now < this.disabledUntil;
  }

  /** Kill this camera until `now + seconds`. */
  emp(now, seconds) {
    this.disabledUntil = now + seconds;
  }

  canSee(thiefX, thiefY, blockers, smokeBlocks, now) {
    if (this.isDisabled(now)) return false;
    if (!pointInCone(thiefX, thiefY, this.x, this.y, this.angle, this.fov, this.range)) return false;
    if (!hasLineOfSight(this.x, this.y, thiefX, thiefY, blockers)) return false;
    if (smokeBlocks && smokeBlocks(this.x, this.y, thiefX, thiefY)) return false;
    return true;
  }

  exposure(thiefX, thiefY) {
    const d = Math.hypot(thiefX - this.x, thiefY - this.y);
    return Math.max(0, 1 - d / this.range);
  }
}
