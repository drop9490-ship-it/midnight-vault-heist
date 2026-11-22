// Midnight Vault — The Kestrel Job: patrolling guards.
// A guard walks a waypoint loop, pauses at each waypoint to sweep its vision
// cone, and reports whether it can currently see the thief.
import {
  GUARD_FOV, GUARD_RANGE, GUARD_SPEED, GUARD_SWEEP, GUARD_WAIT,
} from './config.js';
import { angleDiff, angleTo, distance, hasLineOfSight, pointInCone } from './vision.js';

export class Guard {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.waypoints = def.waypoints;
    this.wpIndex = 1 % this.waypoints.length;
    this.speed = GUARD_SPEED;
    this.range = GUARD_RANGE;
    this.fov = GUARD_FOV;
    this.angle = angleTo(def.x, def.y, this.waypoints[this.wpIndex].x, this.waypoints[this.wpIndex].y);
    this.baseAngle = this.angle; // direction the cone sweeps around while waiting
    this.wait = 0;
    this.sweepT = 0;
    this.seeing = false; // true this frame when the thief is in sight
    this.alertT = 0; // seconds since the guard last saw the thief
  }

  /** Advance patrol by dt seconds. Blockers are not needed for movement: the
   *  waypoint routes are drawn clear of walls in levels.js. */
  update(dt) {
    if (this.wait > 0) {
      // Paused at a waypoint: sweep the cone back and forth.
      this.wait -= dt;
      this.sweepT += dt;
      this.angle = this.baseAngle + Math.sin(this.sweepT * 2.2) * GUARD_SWEEP;
      return;
    }
    const target = this.waypoints[this.wpIndex];
    const d = distance(this.x, this.y, target.x, target.y);
    const step = this.speed * dt;
    if (d <= Math.max(step, 4)) {
      this.x = target.x;
      this.y = target.y;
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      const next = this.waypoints[this.wpIndex];
      this.baseAngle = angleTo(this.x, this.y, next.x, next.y);
      this.angle = this.baseAngle;
      this.sweepT = 0;
      this.wait = GUARD_WAIT;
      return;
    }
    const a = angleTo(this.x, this.y, target.x, target.y);
    this.angle = a;
    this.baseAngle = a;
    this.x += Math.cos(a) * step;
    this.y += Math.sin(a) * step;
  }

  /** True when the thief is inside this guard's cone with a clear sight line
   *  and not hidden by smoke (smokeBlocks is a function the scene supplies). */
  canSee(thiefX, thiefY, blockers, smokeBlocks) {
    if (!pointInCone(thiefX, thiefY, this.x, this.y, this.angle, this.fov, this.range)) return false;
    if (!hasLineOfSight(this.x, this.y, thiefX, thiefY, blockers)) return false;
    if (smokeBlocks && smokeBlocks(this.x, this.y, thiefX, thiefY)) return false;
    return true;
  }

  /** How exposed the thief is to this guard: 0 (edge of the cone) to 1 (point blank). */
  exposure(thiefX, thiefY) {
    const d = distance(this.x, this.y, thiefX, thiefY);
    return Math.max(0, 1 - d / this.range);
  }
}

/** A guard's facing angle snapped toward the thief (used by screenshot poses). */
export function facePoint(guard, tx, ty) {
  guard.angle = angleTo(guard.x, guard.y, tx, ty);
  guard.baseAngle = guard.angle;
  return guard;
}

export { angleDiff };
