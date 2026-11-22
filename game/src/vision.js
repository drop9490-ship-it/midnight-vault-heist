// Midnight Vault — The Kestrel Job: line-of-sight geometry.
// Pure math, no Phaser dependency, so the same code drives the live game and
// the deterministic screenshot poses. Walls are axis-aligned rectangles;
// vision cones are sampled ray fans clipped by the nearest wall hit.

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// --- segment helpers -------------------------------------------------------

function orientation(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2; // 1 clockwise, 2 counter-clockwise
}

function onSegment(ax, ay, bx, by, cx, cy) {
  return (
    bx <= Math.max(ax, cx) + 1e-9 && bx >= Math.min(ax, cx) - 1e-9 &&
    by <= Math.max(ay, cy) + 1e-9 && by >= Math.min(ay, cy) - 1e-9
  );
}

/** True when segments (p1,p2) and (p3,p4) touch or cross. */
export function segmentsIntersect(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const o1 = orientation(p1x, p1y, p2x, p2y, p3x, p3y);
  const o2 = orientation(p1x, p1y, p2x, p2y, p4x, p4y);
  const o3 = orientation(p3x, p3y, p4x, p4y, p1x, p1y);
  const o4 = orientation(p3x, p3y, p4x, p4y, p2x, p2y);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1x, p1y, p3x, p3y, p2x, p2y)) return true;
  if (o2 === 0 && onSegment(p1x, p1y, p4x, p4y, p2x, p2y)) return true;
  if (o3 === 0 && onSegment(p3x, p3y, p1x, p1y, p4x, p4y)) return true;
  if (o4 === 0 && onSegment(p3x, p3y, p2x, p2y, p4x, p4y)) return true;
  return false;
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** True when the segment from (x1,y1) to (x2,y2) touches rectangle r. */
export function segmentIntersectsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const { x, y, w, h } = r;
  return (
    segmentsIntersect(x1, y1, x2, y2, x, y, x + w, y) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x, y + h, x, y)
  );
}

/** True when the segment from (x1,y1) to (x2,y2) passes through circle (cx,cy,r). */
export function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}

// --- ray casting -----------------------------------------------------------

/**
 * Distance along a ray from (ox,oy) in direction (dx,dy) to the nearest
 * rectangle in `rects`, capped at maxDist (slab method per rect).
 */
export function rayHitDistance(ox, oy, dx, dy, maxDist, rects) {
  let best = maxDist;
  for (const r of rects) {
    let tmin = 0;
    let tmax = best;
    // X slab.
    if (Math.abs(dx) < 1e-9) {
      if (ox < r.x || ox > r.x + r.w) continue;
    } else {
      let t1 = (r.x - ox) / dx;
      let t2 = (r.x + r.w - ox) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    // Y slab.
    if (Math.abs(dy) < 1e-9) {
      if (oy < r.y || oy > r.y + r.h) continue;
    } else {
      let t1 = (r.y - oy) / dy;
      let t2 = (r.y + r.h - oy) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin < best && tmin >= 0) best = tmin;
  }
  return best;
}

/** True when nothing in `blockers` stands between (x1,y1) and (x2,y2). */
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  for (const r of blockers) {
    if (segmentIntersectsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

/** True when (px,py) sits inside the cone from (ox,oy), angle, fov, range. */
export function pointInCone(px, py, ox, oy, angle, fov, range) {
  const d = distance(ox, oy, px, py);
  if (d > range) return false;
  if (d < 1e-6) return true;
  return Math.abs(angleDiff(angleTo(ox, oy, px, py), angle)) <= fov / 2;
}

/**
 * A vision cone as a drawable polygon: the origin plus a fan of rays, each
 * clipped by the nearest wall, so cones visibly stop at walls and cases.
 * Returns [{x,y}, ...] starting at the origin.
 */
export function conePolygon(ox, oy, angle, fov, range, blockers, steps = 26) {
  const points = [{ x: ox, y: oy }];
  for (let i = 0; i <= steps; i += 1) {
    const a = angle - fov / 2 + (fov * i) / steps;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const d = rayHitDistance(ox, oy, dx, dy, range, blockers);
    points.push({ x: ox + dx * d, y: oy + dy * d });
  }
  return points;
}
