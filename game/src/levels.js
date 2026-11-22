// Midnight Vault — The Kestrel Job: the Halcyon Gallery level.
// One room, three routes: the guarded MAIN HALL, the camera-watched SERVICE
// CORRIDOR along the bottom, and a narrow VENT slit through the divider wall.
// All coordinates are in the 1280x720 canvas; the HUD occupies the top 56 px,
// so the playable floor runs from y=72 (below the top wall) to y=704.
import { HUD_HEIGHT } from './config.js';

// Every rectangle below is { x, y, w, h } in canvas pixels.
export const LEVEL = {
  name: 'Halcyon Gallery',
  // Solid walls: block the thief, block guard/camera sight, block the vent.
  walls: [
    { x: 0, y: HUD_HEIGHT, w: 1280, h: 16 }, // top wall (under the HUD)
    { x: 0, y: 704, w: 1280, h: 16 }, // bottom wall
    { x: 0, y: HUD_HEIGHT, w: 16, h: 648 }, // left wall
    { x: 1264, y: HUD_HEIGHT, w: 16, h: 648 }, // right wall
    // Vault room (top right): door gap in its floor wall at x 1080..1160.
    { x: 960, y: 72, w: 16, h: 168 }, // vault west wall
    { x: 960, y: 224, w: 120, h: 16 }, // vault south wall, west of the door
    { x: 1160, y: 224, w: 104, h: 16 }, // vault south wall, east of the door
    // Divider wall between the hall and the vault side: main gap y 200..270,
    // vent slit y 380..404 (thief crawls through it at half speed).
    { x: 640, y: 270, w: 16, h: 110 },
    { x: 640, y: 404, w: 16, h: 156 },
    // Service-corridor ceiling: gaps at x 300..380 and x 880..960.
    { x: 200, y: 560, w: 100, h: 16 },
    { x: 380, y: 560, w: 500, h: 16 },
    { x: 960, y: 560, w: 120, h: 16 },
  ],
  // Display cases: solid cover the thief hides behind; they block sight too.
  cases: [
    { x: 280, y: 150, w: 130, h: 56 },
    { x: 520, y: 150, w: 130, h: 56 },
    { x: 760, y: 300, w: 130, h: 56 },
    { x: 300, y: 420, w: 120, h: 56 },
    { x: 900, y: 420, w: 130, h: 56 },
  ],
  // The vent slit itself: inside this box the thief moves at VENT_SLOW speed.
  ventZone: { x: 600, y: 372, w: 120, h: 40 },
  // The getaway: step in here after stealing the diamond to win.
  exitZone: { x: 24, y: 600, w: 120, h: 96 },
  // Where Kestrel slips in (bottom left, just outside the exit zone).
  spawn: { x: 200, y: 660 },
  // Floor labels so the three routes read at a glance, even in a thumbnail.
  labels: [
    { x: 450, y: 335, text: 'MAIN HALL' },
    { x: 640, y: 668, text: 'SERVICE CORRIDOR' },
    { x: 676, y: 388, text: 'VENT' },
    { x: 1120, y: 205, text: 'VAULT' },
    { x: 84, y: 652, text: 'EXIT' },
  ],
  // Loot: the diamond is the job; the rest is bonus score.
  loot: [
    { kind: 'diamond', x: 1120, y: 140, points: 500, label: 'DIAMOND 500' },
    { kind: 'painting', x: 44, y: 180, points: 100, label: 'PAINTING 100' },
    { kind: 'gold', x: 420, y: 645, points: 150, label: 'GOLD 150' },
    { kind: 'vase', x: 760, y: 470, points: 80, label: 'VASE 80' },
  ],
  // Three patrolling guards: hall, vault approach, service corridor.
  guards: [
    {
      x: 350, y: 320,
      waypoints: [
        { x: 350, y: 320 }, { x: 600, y: 320 },
        { x: 600, y: 500 }, { x: 350, y: 500 },
      ],
    },
    {
      x: 850, y: 260,
      waypoints: [
        { x: 850, y: 260 }, { x: 1180, y: 260 },
        { x: 1180, y: 480 }, { x: 850, y: 480 },
      ],
    },
    {
      x: 300, y: 640,
      waypoints: [{ x: 300, y: 640 }, { x: 1000, y: 640 }],
    },
  ],
  // Two fixed CCTV cameras: one sweeping down from the top wall, one
  // sweeping left from the right wall.
  cameras: [
    { x: 500, y: 74, baseAngle: Math.PI / 2, sweep: 0.7, phase: 0 },
    { x: 1252, y: 360, baseAngle: Math.PI, sweep: 0.7, phase: 1.6 },
  ],
};

// Everything that blocks movement and sight: walls plus display cases.
export function levelBlockers() {
  return [...LEVEL.walls, ...LEVEL.cases];
}
