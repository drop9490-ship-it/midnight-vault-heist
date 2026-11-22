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
    // vent slit y 372..412 (40 px — matches ventZone, so the 34 px-wide thief
    // can actually crawl through it; v1's 24 px slit was impassable).
    { x: 640, y: 270, w: 16, h: 102 },
    { x: 640, y: 412, w: 16, h: 148 },
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
  // Decoration (depth 1, under the actors — never blocks movement or sight):
  // red carpet runners, framed paintings on the walls, display pedestals,
  // potted plants in the corners, and the vault's round steel door.
  carpets: [
    { x: 270, y: 240, w: 130, h: 305 }, // main-hall runner
    { x: 1070, y: 188, w: 100, h: 36 }, // vault runner, in front of the door
  ],
  paintings: [
    { x: 150, y: 92, w: 64, h: 24, hue: 0x7a4a3a },
    { x: 700, y: 92, w: 64, h: 24, hue: 0x3a5a7a },
    { x: 880, y: 92, w: 64, h: 24, hue: 0x4a6b3a },
    { x: 22, y: 300, w: 24, h: 64, hue: 0x6b5a8a },
    { x: 22, y: 520, w: 24, h: 64, hue: 0x8a6d3b },
  ],
  pedestals: [
    { x: 200, y: 640, w: 26, h: 26, top: 'vase' },
    { x: 44, y: 540, w: 26, h: 26, top: 'bust' },
    { x: 1232, y: 640, w: 26, h: 26, top: 'idol' },
  ],
  plants: [
    { x: 48, y: 100 },
    { x: 620, y: 100 },
    { x: 1232, y: 668 },
  ],
  // The vault door: a round steel safe door the diamond sits in front of.
  vaultDoor: { x: 1120, y: 128, r: 56 },
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
    { x: 1120, y: 216, text: 'VAULT' },
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
export function levelBlockers(level) {
  return [...level.walls, ...level.cases];
}

// Level 2 "The Upper Gallery": the vault is mirrored to the TOP LEFT and
// the getaway to the BOTTOM RIGHT, so Kestrel must cross the whole floor.
// A divider wall splits the room: a main gap y 420..490 plus a narrow VENT
// slit y 240..280 (40 px, same as Level 1). Four guards patrol tighter,
// overlapping loops; a third camera watches the east hall from the divider.
export const LEVEL_2 = {
  name: 'Upper Gallery',
  alarmRate: 1.2, // the alarm climbs faster up here (per-level, L1 untouched)
  diffGuards: { rookie: 2, pro: 4, legend: 4 },
  walls: [
    { x: 0, y: HUD_HEIGHT, w: 1280, h: 16 }, // top wall (under the HUD)
    { x: 0, y: 704, w: 1280, h: 16 }, // bottom wall
    { x: 0, y: HUD_HEIGHT, w: 16, h: 648 }, // left wall
    { x: 1264, y: HUD_HEIGHT, w: 16, h: 648 }, // right wall
    // Vault room (top left): door gap in its floor wall at x 120..200.
    { x: 304, y: 72, w: 16, h: 168 }, // vault east wall
    { x: 16, y: 224, w: 104, h: 16 }, // vault south wall, west of the door
    { x: 200, y: 224, w: 120, h: 16 }, // vault south wall, east of the door
    // Divider wall: main gap y 420..490, vent slit y 240..280.
    { x: 640, y: 72, w: 16, h: 168 },
    { x: 640, y: 280, w: 16, h: 140 },
    { x: 640, y: 490, w: 16, h: 214 },
    // Service-corridor ceiling: gaps at x 340..420 and x 720..800.
    { x: 160, y: 560, w: 180, h: 16 },
    { x: 420, y: 560, w: 300, h: 16 },
    { x: 800, y: 560, w: 240, h: 16 },
  ],
  cases: [
    { x: 420, y: 150, w: 130, h: 56 },
    { x: 700, y: 150, w: 130, h: 56 },
    { x: 980, y: 150, w: 130, h: 56 },
    { x: 420, y: 340, w: 130, h: 56 },
    { x: 900, y: 320, w: 130, h: 56 },
    { x: 300, y: 420, w: 120, h: 56 },
    { x: 760, y: 420, w: 130, h: 56 },
  ],
  carpets: [
    { x: 880, y: 240, w: 130, h: 305 }, // east-hall runner
    { x: 110, y: 188, w: 100, h: 36 }, // vault runner, in front of the door
  ],
  paintings: [
    { x: 450, y: 92, w: 64, h: 24, hue: 0x7a4a3a },
    { x: 1000, y: 92, w: 64, h: 24, hue: 0x3a5a7a },
    { x: 1150, y: 92, w: 64, h: 24, hue: 0x4a6b3a },
    { x: 22, y: 300, w: 24, h: 64, hue: 0x6b5a8a },
    { x: 22, y: 520, w: 24, h: 64, hue: 0x8a6d3b },
  ],
  pedestals: [
    { x: 44, y: 300, w: 26, h: 26, top: 'bust' },
    { x: 1232, y: 640, w: 26, h: 26, top: 'vase' },
    { x: 1100, y: 100, w: 26, h: 26, top: 'idol' },
  ],
  plants: [
    { x: 340, y: 100 },
    { x: 1232, y: 100 },
    { x: 48, y: 668 },
  ],
  vaultDoor: { x: 160, y: 128, r: 56 },
  ventZone: { x: 600, y: 240, w: 120, h: 40 },
  exitZone: { x: 1136, y: 600, w: 120, h: 96 },
  spawn: { x: 200, y: 660 },
  labels: [
    { x: 1150, y: 300, text: 'UPPER GALLERY' },
    { x: 450, y: 335, text: 'MEZZANINE' },
    { x: 400, y: 668, text: 'SERVICE CORRIDOR' },
    { x: 676, y: 256, text: 'VENT' },
    { x: 160, y: 216, text: 'VAULT' },
    { x: 1196, y: 652, text: 'EXIT' },
  ],
  // Loot: the Star of Halcyon is the job; the crown and the idol are new.
  loot: [
    { kind: 'diamond', x: 160, y: 140, points: 800, label: 'STAR OF HALCYON 800' },
    { kind: 'painting', x: 44, y: 180, points: 100, label: 'PAINTING 100' },
    { kind: 'gold', x: 860, y: 645, points: 150, label: 'GOLD 150' },
    { kind: 'vase', x: 480, y: 470, points: 80, label: 'VASE 80' },
    { kind: 'crown', x: 1150, y: 470, points: 250, label: 'CROWN 250' },
    { kind: 'idol', x: 620, y: 110, points: 120, label: 'IDOL 120' },
  ],
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
    {
      x: 700, y: 400,
      waypoints: [
        { x: 700, y: 400 }, { x: 1100, y: 400 },
        { x: 1100, y: 500 }, { x: 700, y: 500 },
      ],
    },
  ],
  cameras: [
    { x: 500, y: 74, baseAngle: Math.PI / 2, sweep: 0.7, phase: 0 },
    { x: 1252, y: 360, baseAngle: Math.PI, sweep: 0.7, phase: 1.6 },
    { x: 656, y: 500, baseAngle: 0, sweep: 0.7, phase: 3.1 },
  ],
};

// Level 1 keeps its original per-difficulty guard counts (PRO balance = v1).
LEVEL.diffGuards = { rookie: 2, pro: 3, legend: 3 };

export const LEVELS = [LEVEL, LEVEL_2];
