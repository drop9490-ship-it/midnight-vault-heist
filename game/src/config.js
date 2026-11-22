// Midnight Vault — The Kestrel Job: shared tuning constants.
// One place for every number the rest of the game balances against.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const HUD_HEIGHT = 56;

export const THIEF_SPEED = 180; // px per second on open floor
export const THIEF_RADIUS = 19; // drawn hooded figure, bigger than v1
export const GUARD_RADIUS = 18; // drawn uniformed figure
export const GUARD_SPEED = 55; // patrol walk, px per second
export const GUARD_RANGE = 230; // vision cone reach, px
export const GUARD_FOV = (70 * Math.PI) / 180; // vision cone spread
export const GUARD_WAIT = 1.4; // seconds a guard pauses at each waypoint, sweeping
export const GUARD_SWEEP = 0.65; // radians the cone sweeps while the guard waits
export const CAMERA_RANGE = 200;
export const CAMERA_FOV = (70 * Math.PI) / 180;
export const CAMERA_SWEEP = 0.7; // radians either side of the camera's base angle
export const CAMERA_SWEEP_SPEED = 0.9; // radians per second of sweep phase

export const ALARM_RISE_BASE = 18; // per second while seen, far away
export const ALARM_RISE_CLOSE = 32; // extra per second when the watcher is on top of you
export const ALARM_DECAY = 14; // per second while hidden
export const ALARM_SPOTTED = 60; // "SPOTTED!" warning threshold
export const ALARM_CAUGHT = 100; // caught at full meter
export const CAUGHT_DELAY = 1.5; // fair grace seconds between 100% and game over

export const EMP_RANGE = 260; // px: nearest camera inside this range is zapped
export const EMP_DURATION = 5; // seconds the camera stays dead
export const SMOKE_DURATION = 3; // seconds the pellet cloud lasts
export const SMOKE_RADIUS = 70; // px: cloud radius that blocks sight
export const VENT_SLOW = 0.55; // speed multiplier while crawling through the vent
export const LOOT_PICKUP_RADIUS = 32;

export const LOOT_POINTS = { diamond: 500, painting: 100, gold: 150, vase: 80 };
export const TIME_BONUS_START = 300; // bonus points at the getaway, minus 1 per second
export const TOOL_STOCK = { emp: 2, smoke: 2 };

// Difficulty: picked on the title screen with 1 / 2 / 3, shown in the HUD.
// ROOKIE drops the corridor guard and slows everything; LEGEND speeds the
// patrols and the alarm. PRO is the v1 balance, unchanged.
export const DIFFICULTIES = {
  rookie: { name: 'ROOKIE', guardSpeed: 0.75, cameraSweep: 0.8, alarmRate: 0.8, guards: 2 },
  pro: { name: 'PRO', guardSpeed: 1.0, cameraSweep: 1.0, alarmRate: 1.0, guards: 3 },
  legend: { name: 'LEGEND', guardSpeed: 1.35, cameraSweep: 1.3, alarmRate: 1.25, guards: 3 },
};
export const DIFFICULTY_KEYS = ['rookie', 'pro', 'legend'];
export const DEFAULT_DIFFICULTY = 'pro';

// Night-gallery palette: dark blue marble, gold trim, olive cover, red danger, green thief.
export const COLORS = {
  bg: 0x0a0e1a,
  floor: 0x10182b,
  floorLine: 0x1a2440,
  floorTile: 0x0d1424,
  wall: 0x2a3350,
  wallTrim: 0xc9a227,
  caseTop: 0x3a5a3a,
  caseSide: 0x1d2b1d,
  caseTrim: 0x6b8f6b,
  coneGuard: 0xff2d2d,
  coneCamera: 0xff9f1c,
  thief: 0x39ff6a,
  thiefDark: 0x0e7a2e,
  thiefCloak: 0x0f3d24,
  thiefHood: 0x14532d,
  guardBody: 0x2b3a5e,
  guardTrim: 0x8fa3d9,
  guardCap: 0x1a2440,
  guardSkin: 0xd9a986,
  carpet: 0x4a1220,
  carpetDark: 0x3a0d18,
  vaultSteel: 0x3a4152,
  vaultDark: 0x232838,
  plantLeaf: 0x2e6b34,
  plantPot: 0x6b4a2b,
  exit: 0x2fae4e,
  exitDark: 0x123d20,
  lootGold: 0xffd94d,
  lootGlow: 0xffe98a,
  hudBg: 0x0b1020,
  hudLine: 0x2a3350,
  text: '#e8ecf5',
  textDim: '#9aa7c2',
  textGold: '#ffd94d',
  textRed: '#ff5252',
  textGreen: '#39ff6a',
};
