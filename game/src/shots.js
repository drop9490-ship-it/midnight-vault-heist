// Midnight Vault — The Kestrel Job: deterministic screenshot poses.
// Each pose sets exact positions, alarm and loot — no simulation, no random
// numbers — so the same ?shot= always renders the same frame. The scene
// freezes the world while a pose is active and raises window.__shotReady
// after two rendered frames, which the screenshot script waits for.
//
//   ?shot=cover    every judging element in one frame: thief near the loot,
//                  two guards + cones sweeping close, two cameras, alarm 40%
//   ?shot=approach thief in cover, a guard cone sweeping just ahead of him
//   ?shot=spotted  alarm 85%, a cone locked on the thief, SPOTTED! flashing
//   ?shot=getaway  diamond taken, thief on the EXIT, CLEAN GETAWAY banner
import { angleTo } from './vision.js';

function face(scene, guardIndex, tx, ty) {
  const g = scene.guards[guardIndex];
  g.angle = angleTo(g.x, g.y, tx, ty);
  g.baseAngle = g.angle;
}

export function applyShot(name, scene) {
  scene.freezeWorld(true);
  scene.setMode('play');
  // A neutral starting point; each pose overrides what it needs.
  scene.setAlarm(0);
  scene.setScore(0);

  if (name === 'cover') {
    // Kestrel at the vault door, inches from the diamond; guard 1 stands
    // south of the vault and its cone sweeps straight THROUGH the door gap
    // (x 1080..1160) onto him — the cone is not clipped by the vault wall.
    // Guard 0 sweeps the hall toward the vault; both cameras sweep; alarm
    // sits at 40% — tense, not yet caught.
    scene.setThief(1085, 195);
    scene.setGuard(0, 700, 300);
    scene.setGuard(1, 1120, 420);
    scene.setGuard(2, 700, 640);
    face(scene, 0, 1085, 195);
    face(scene, 1, 1085, 195);
    scene.setGuardAngle(2, Math.PI); // corridor guard looking back left
    scene.setAlarm(40);
    scene.collectLootKind('painting', true);
    scene.setScore(100);
    scene.clock = 47; // 0:47 on the timer, mid-job
  } else if (name === 'approach') {
    // Reading the patrol: Kestrel waits just above a COVER case while
    // guard 1's cone sweeps across the floor toward him.
    scene.setThief(440, 395);
    scene.setGuard(0, 620, 320);
    scene.setGuard(1, 850, 260);
    scene.setGuard(2, 300, 640);
    scene.setGuardAngle(0, Math.PI); // cone pointing left, at the thief
    scene.setAlarm(22);
    scene.clock = 18;
  } else if (name === 'spotted') {
    // Caught in the open: guard 2's cone is locked straight onto Kestrel,
    // alarm 85%, SPOTTED! flashing, seconds from 100%.
    scene.setThief(920, 285);
    scene.setGuard(0, 500, 320);
    scene.setGuard(1, 1060, 300);
    scene.setGuard(2, 700, 640);
    face(scene, 1, 920, 285);
    scene.setAlarm(85);
    scene.collectLootKind('gold', true);
    scene.setScore(150);
    scene.clock = 96;
  } else if (name === 'getaway') {
    // The job is done: diamond in hand, Kestrel on the EXIT, compact banner.
    // Thief at (84, 640) so the KESTREL tag sits above the EXIT label instead
    // of on top of it (v1's overlap).
    scene.setThief(84, 640);
    scene.setGuard(0, 500, 320);
    scene.setGuard(1, 1180, 480);
    scene.setGuard(2, 1000, 640);
    scene.setGuardAngle(1, -Math.PI / 2); // vault guard looking away, too late
    scene.setAlarm(12);
    scene.collectLootKind('diamond', true);
    scene.collectLootKind('painting', true);
    scene.collectLootKind('gold', true);
    scene.collectLootKind('vase', true);
    scene.clock = 132;
    scene.finishWin(true);
  }
  // Frozen poses never step the simulation, so evaluate vision once here —
  // the cones brighten and the "!" alerts show where a watcher has Kestrel.
  scene.evaluateVision();
  return name;
}
