// Midnight Vault — The Kestrel Job: Kestrel the thief.
// WASD / arrow-key movement with axis-separated wall sliding, so hugging a
// wall never sticks the thief. Crawling through the vent is slow.
import { THIEF_RADIUS, THIEF_SPEED, VENT_SLOW } from './config.js';

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export class Thief {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = THIEF_RADIUS;
    this.speed = THIEF_SPEED;
    this.facing = -Math.PI / 2; // up, toward the vault
    this.moving = false;
    this.inVent = false;
    this.stepT = 0; // footstep sound timer
    this.stepped = false; // set true on a step, consumed by the scene for sfx
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.facing = -Math.PI / 2;
    this.moving = false;
    this.inVent = false;
  }

  /** Move by dt seconds from the input's held keys; returns true if moved. */
  update(dt, input, blockers, ventZone) {
    let dx = 0;
    let dy = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return false;

    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    this.facing = Math.atan2(dy, dx);

    this.inVent =
      ventZone &&
      this.x >= ventZone.x && this.x <= ventZone.x + ventZone.w &&
      this.y >= ventZone.y && this.y <= ventZone.y + ventZone.h;
    const speed = this.speed * (this.inVent ? VENT_SLOW : 1) * dt;

    // Axis-separated movement: try X, then Y, so walls slide instead of stick.
    const nx = this.x + dx * speed;
    if (!blockers.some((r) => circleHitsRect(nx, this.y, this.radius, r))) this.x = nx;
    const ny = this.y + dy * speed;
    if (!blockers.some((r) => circleHitsRect(this.x, ny, this.radius, r))) this.y = ny;

    // Footstep tick every ~0.32 s of walking (faster in the vent crawl).
    this.stepT += dt;
    const stepEvery = this.inVent ? 0.45 : 0.32;
    if (this.stepT >= stepEvery) {
      this.stepT = 0;
      this.stepped = true;
    }
    return true;
  }
}
