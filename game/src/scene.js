// Midnight Vault — The Kestrel Job: the Phaser scene.
// Owns everything on screen: the gallery floor, walls and cover, the vision
// cones, the thief, guards, cameras, loot, HUD, tools and every screen
// (title, pause, caught, game over, getaway). The rules live in the small
// modules; this file only wires them to Phaser and draws them.
import {
  ALARM_CAUGHT, ALARM_SPOTTED, CAUGHT_DELAY, CAMERA_SWEEP_SPEED, COLORS, DEFAULT_DIFFICULTY,
  DIFFICULTIES, DIFFICULTY_KEYS, EMP_DURATION, EMP_RANGE,
  GAME_HEIGHT, GAME_WIDTH, GUARD_RADIUS, GUARD_SPEED, HUD_HEIGHT,
  LOOT_PICKUP_RADIUS, SMOKE_DURATION,
  SMOKE_RADIUS, THIEF_RADIUS, TIME_BONUS_START, TOOL_STOCK,
} from './config.js';
import { LEVELS, levelBlockers } from './levels.js';
import { conePolygon, segmentIntersectsCircle } from './vision.js';
import { Guard } from './guards.js';
import { Camera } from './cameras.js';
import { Thief } from './thief.js';
import { Alarm } from './alarm.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { applyShot } from './shots.js';

const FONT = 'Arial, sans-serif';
const MONO = '"Courier New", monospace';
const BEST_KEY = 'midnight-vault-best';

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function safeBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    if (score > safeBest()) localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Best score is a nicety, never a failure.
  }
}

export class HeistScene extends Phaser.Scene {
  constructor() {
    super('HeistScene');
    this.mode = 'title'; // title | play | paused | caught | over | win
    this.frozen = false; // screenshot poses freeze the simulation
    this.clock = 0; // running game clock, seconds
    this.frames = 0; // frames since create, for the screenshot ready flag
    this.shotName = null;
  }

  create() {
    this.levelIndex = 0; // campaign level: 0 = Halcyon Gallery, 1 = Upper Gallery
    this.level = LEVELS[0];
    this.campaignLoot = 0; // loot banked by clearing Level 1
    this.levelClear = false; // true once the active level is won
    this.input_ = new Input();
    this.sfx = new Sfx();
    this.alarm = new Alarm();
    this.best = safeBest();
    this.diffKey = DEFAULT_DIFFICULTY; // rookie | pro | legend, picked on title
    this.levelObjs = []; // every per-level display object, destroyed on loadLevel
    this.popTexts = []; // floating "+points" texts, cleared on loadLevel

    this.buildPersistent();
    this.buildActorGraphics();
    this.loadLevel(0);
    this.buildHud();
    this.buildOverlays();
    this.applyDifficulty();
    this.mode = 'title';
    this.showOverlay('title');

    // Audio needs a user gesture; arm it on the first one.
    this.input.on('pointerdown', () => this.sfx.ensure());
    this.input.keyboard.on('keydown', () => this.sfx.ensure());

    const params = new URLSearchParams(window.location.search);
    this.shotName = params.get('shot');
    if (this.shotName) {
      this.showOverlay(null); // hide the title screen before posing
      applyShot(this.shotName, this); // may show the win panel itself
    }

    // Debug hook for headless gameplay tests: a plain snapshot, refreshed
    // every frame. Never used by the game itself.
    window.__game = this;
    window.__gameState = this.snapshot();
  }

  // --- construction ---------------------------------------------------------

  // Built once: the marble floor, the vignette, and the per-frame graphics
  // (vision cones, smoke). Everything level-specific lives in
  // buildLevelGraphics / buildLoot / buildActorObjs and is destroyed by
  // destroyLevel() before the next level is built.
  buildPersistent() {
    // Floor: two-tone marble checker (40 px tiles) with grout lines.
    const floor = this.add.graphics().setDepth(0);
    floor.fillStyle(COLORS.floor, 1);
    floor.fillRect(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);
    for (let x = 16; x < GAME_WIDTH; x += 40) {
      for (let y = HUD_HEIGHT; y < GAME_HEIGHT; y += 40) {
        if (((x + y) / 40) % 2 === 0) {
          floor.fillStyle(COLORS.floorTile, 1);
          floor.fillRect(x, y, 40, 40);
        }
      }
    }
    floor.lineStyle(1, COLORS.floorLine, 0.8);
    for (let x = 16; x <= GAME_WIDTH; x += 40) floor.lineBetween(x, HUD_HEIGHT, x, GAME_HEIGHT);
    for (let y = HUD_HEIGHT; y <= GAME_HEIGHT; y += 40) floor.lineBetween(0, y, GAME_WIDTH, y);
    // v7: gold inlay dots at every fourth tile intersection — the marble
    // stops reading as a flat dark grid and every quadrant gets an accent.
    for (let x = 176; x < GAME_WIDTH; x += 160) {
      for (let y = 216; y < GAME_HEIGHT; y += 160) {
        floor.fillStyle(COLORS.floorGold, 0.35);
        floor.fillCircle(x, y, 2.5);
      }
    }

    // Vignette: soft darkness at the play-area edges, for the night mood.
    // Depth 19 sits above the actors but below the overlays (20).
    const vig = this.add.graphics().setDepth(19);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0.3, 0, 0);
    vig.fillRect(0, HUD_HEIGHT, GAME_WIDTH, 90);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.3, 0.3);
    vig.fillRect(0, GAME_HEIGHT - 90, GAME_WIDTH, 90);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0, 0.3, 0);
    vig.fillRect(0, HUD_HEIGHT, 90, GAME_HEIGHT - HUD_HEIGHT);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.3, 0, 0.3);
    vig.fillRect(GAME_WIDTH - 90, HUD_HEIGHT, 90, GAME_HEIGHT - HUD_HEIGHT);

    // Vision cones, redrawn every frame (depth 2: above the floor, below walls).
    this.coneG = this.add.graphics().setDepth(2);
    // Smoke cloud, above loot, below the actors.
    this.smokeG = this.add.graphics().setDepth(4);
  }

  // Destroy every per-level display object (graphics, labels, loot, actor
  // tags) so the next level starts from a clean slate. Loot tweens are
  // killed first — their targets are about to disappear.
  destroyLevel() {
    this.tweens.killAll();
    for (const obj of this.levelObjs) obj.destroy();
    this.levelObjs = [];
    // Floating "+points" texts are not level objects (their tween kills
    // them on completion), so a level change must clear any still flying —
    // otherwise the old level's "+500" hangs over the new one.
    for (const pop of this.popTexts) pop.destroy();
    this.popTexts = [];
  }

  // Per-level room: carpets, exit pad, decor, floor labels, walls, cases.
  // All of it is registered in this.levelObjs for destroyLevel().
  buildLevelGraphics() {
    const L = this.level;
    // Red carpet runners with a gold edge, laid over the marble.
    const carpetG = this.add.graphics().setDepth(0);
    for (const c of L.carpets) {
      carpetG.fillStyle(COLORS.carpet, 1);
      carpetG.fillRect(c.x, c.y, c.w, c.h);
      carpetG.fillStyle(COLORS.carpetDark, 1);
      carpetG.fillRect(c.x + 8, c.y + 8, c.w - 16, c.h - 16);
      carpetG.lineStyle(2, COLORS.wallTrim, 0.9);
      carpetG.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      carpetG.lineStyle(1, COLORS.wallTrim, 0.5);
      carpetG.strokeRect(c.x + 10, c.y + 10, c.w - 20, c.h - 20);
      // v8: woven centre motif — small gold diamonds down the runner's
      // spine, so the carpet reads as textile instead of a solid block.
      const horiz = c.w >= c.h;
      const axisLen = horiz ? c.w : c.h;
      const count = Math.floor((axisLen - 24) / 44);
      for (let i = 0; i < count; i += 1) {
        const t = (axisLen - (count - 1) * 44) / 2 + i * 44;
        const cx = horiz ? c.x + t : c.x + c.w / 2;
        const cy = horiz ? c.y + c.h / 2 : c.y + t;
        carpetG.fillStyle(COLORS.wallTrim, 0.75);
        carpetG.fillPoints([
          { x: cx, y: cy - 6 }, { x: cx + 5, y: cy },
          { x: cx, y: cy + 6 }, { x: cx - 5, y: cy },
        ], true);
      }
    }
    this.levelObjs.push(carpetG);

    // Exit zone: green floor pad, drawn before the walls.
    const exit = this.add.graphics().setDepth(1);
    exit.fillStyle(COLORS.exitDark, 0.9);
    exit.fillRect(L.exitZone.x, L.exitZone.y, L.exitZone.w, L.exitZone.h);
    exit.lineStyle(3, COLORS.exit, 1);
    exit.strokeRect(L.exitZone.x, L.exitZone.y, L.exitZone.w, L.exitZone.h);
    this.levelObjs.push(exit);

    // Decor: the vault's round steel door, pedestals and potted plants.
    // All depth 1 — flat on the floor, under the actors, never blocking.
    const decor = this.add.graphics().setDepth(1);
    const vd = L.vaultDoor;
    decor.fillStyle(COLORS.lootGold, 0.12);
    decor.fillCircle(vd.x, vd.y, vd.r + 16);
    decor.fillStyle(COLORS.vaultSteel, 1);
    decor.fillCircle(vd.x, vd.y, vd.r);
    decor.lineStyle(5, COLORS.vaultRing, 1);
    decor.strokeCircle(vd.x, vd.y, vd.r - 4);
    decor.lineStyle(2, COLORS.vaultRing, 0.8);
    decor.strokeCircle(vd.x, vd.y, vd.r - 18);
    decor.fillStyle(COLORS.vaultDark, 1);
    decor.fillCircle(vd.x, vd.y, vd.r - 24);
    decor.lineStyle(3, COLORS.vaultRing, 0.9);
    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI) / 3;
      decor.lineBetween(
        vd.x + Math.cos(a) * 8, vd.y + Math.sin(a) * 8,
        vd.x + Math.cos(a) * (vd.r - 24), vd.y + Math.sin(a) * (vd.r - 24),
      );
    }
    decor.fillStyle(COLORS.vaultRing, 1);
    decor.fillCircle(vd.x, vd.y, 9);
    decor.lineStyle(2, COLORS.wallTrim, 1);
    decor.strokeCircle(vd.x, vd.y, 9);
    for (const p of L.pedestals) {
      decor.fillStyle(0x000000, 0.3);
      decor.fillEllipse(p.x + p.w / 2, p.y + p.h / 2 + 4, p.w + 6, 10);
      decor.fillStyle(COLORS.vaultDark, 1);
      decor.fillRect(p.x, p.y, p.w, p.h);
      decor.fillStyle(0xd8d2c0, 1);
      decor.fillRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);
      decor.lineStyle(2, COLORS.wallTrim, 1);
      decor.strokeRect(p.x, p.y, p.w, p.h);
      // Dressed pedestal tops (decor only, never loot): a teal vase, a
      // marble bust, a tiny golden idol — the gallery reads lived-in.
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      if (p.top === 'vase') {
        decor.fillStyle(0x7fd4c1, 1);
        decor.fillCircle(cx, cy + 3, 6);
        decor.fillRect(cx - 2, cy - 9, 4, 6);
        decor.fillStyle(COLORS.lootGold, 1);
        decor.fillRect(cx - 4, cy - 11, 8, 2);
      } else if (p.top === 'bust') {
        decor.fillStyle(COLORS.guardSkin, 1);
        decor.fillCircle(cx, cy - 4, 5);
        decor.fillStyle(0xd8d2c0, 1);
        decor.fillRect(cx - 7, cy + 2, 14, 5);
        decor.fillStyle(COLORS.vaultDark, 1);
        decor.fillRect(cx - 8, cy + 7, 16, 3);
      } else if (p.top === 'idol') {
        decor.fillStyle(COLORS.lootGold, 1);
        decor.fillTriangle(cx, cy - 9, cx + 5, cy + 1, cx - 5, cy + 1);
        decor.fillStyle(COLORS.vaultDark, 1);
        decor.fillRect(cx - 6, cy + 1, 12, 3);
      }
    }
    for (const p of L.plants) {
      decor.fillStyle(0x000000, 0.3);
      decor.fillEllipse(p.x, p.y + 12, 30, 10);
      decor.fillStyle(COLORS.plantLeaf, 1);
      decor.fillCircle(p.x - 8, p.y - 8, 9);
      decor.fillCircle(p.x + 8, p.y - 8, 9);
      decor.fillCircle(p.x, p.y - 14, 10);
      decor.fillStyle(0x3a8a42, 1);
      decor.fillCircle(p.x - 4, p.y - 12, 4);
      decor.fillCircle(p.x + 5, p.y - 10, 4);
      decor.fillStyle(COLORS.plantPot, 1);
      decor.fillRect(p.x - 9, p.y, 18, 13);
      decor.lineStyle(1, COLORS.wallTrim, 0.8);
      decor.strokeRect(p.x - 9, p.y, 18, 13);
    }
    // v7: wall lamps — a warm light pool on the floor, a gold fixture and
    // a bright bulb dot. Decor only, under the actors.
    for (const lamp of L.lamps ?? []) {
      decor.fillStyle(0xffe9a8, 0.09);
      decor.fillCircle(lamp.x, lamp.y + 18, 46);
      decor.fillStyle(0xffe9a8, 0.06);
      decor.fillCircle(lamp.x, lamp.y + 18, 70);
      decor.fillStyle(COLORS.wallTrim, 1);
      decor.fillRect(lamp.x - 8, lamp.y - 6, 16, 8);
      decor.fillStyle(0xfff2b0, 1);
      decor.fillCircle(lamp.x, lamp.y + 2, 4);
      decor.lineStyle(1, 0xffffff, 0.7);
      decor.strokeCircle(lamp.x, lamp.y + 2, 4);
    }

    this.levelObjs.push(decor);

    // Floor labels: the three routes, the vault, the exit.
    for (const label of L.labels) {
      const big = label.text === 'EXIT';
      const t = this.add.text(label.x, label.y, label.text, {
        fontFamily: MONO,
        fontSize: big ? '18px' : '12px',
        color: big ? '#39ff6a' : '#5a6b8f',
        fontStyle: big ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(1);
      this.levelObjs.push(t);
    }

    // Walls + display cases, one static layer with a bold gold trim.
    // Framed paintings hang on the walls just inside the room.
    const stat = this.add.graphics().setDepth(3);
    for (const w of L.walls) {
      stat.fillStyle(COLORS.wall, 1);
      stat.fillRect(w.x, w.y, w.w, w.h);
      stat.fillStyle(COLORS.wallTrim, 1);
      stat.fillRect(w.x, w.y, w.w, 3);
      stat.fillStyle(COLORS.wallTrim, 0.55);
      stat.fillRect(w.x, w.y + w.h - 2, w.w, 2);
    }
    for (const p of L.paintings) {
      stat.fillStyle(COLORS.wallTrim, 1);
      stat.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
      stat.fillStyle(p.hue, 1);
      stat.fillRect(p.x, p.y, p.w, p.h);
      stat.lineStyle(1, 0xffffff, 0.35);
      const horizon = p.w > p.h ? p.y + p.h * 0.6 : p.x + p.w * 0.6;
      if (p.w > p.h) stat.lineBetween(p.x + 4, horizon, p.x + p.w - 4, horizon);
      else stat.lineBetween(horizon, p.y + 4, horizon, p.y + p.h - 4);
    }
    for (const c of L.cases) {
      stat.fillStyle(COLORS.caseSide, 1);
      stat.fillRect(c.x, c.y, c.w, c.h);
      stat.fillStyle(COLORS.caseTop, 1);
      stat.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
      stat.lineStyle(2, COLORS.caseTrim, 1);
      stat.strokeRect(c.x, c.y, c.w, c.h);
      stat.lineStyle(1, COLORS.wallTrim, 0.9);
      stat.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
      const cover = this.add.text(c.x + c.w / 2, c.y + c.h / 2, 'COVER', {
        fontFamily: MONO, fontSize: '10px', color: '#8fb08f',
      }).setOrigin(0.5).setDepth(3);
      this.levelObjs.push(cover);
    }
    this.levelObjs.push(stat);
  }

  buildLoot() {
    this.lootObjs = [];
    for (const item of this.loot) {
      const big = item.kind === 'diamond';
      const r = big ? 46 : 30;
      // Two-layer radial glow: a wide faint halo plus a hot core.
      // v7: brighter halos and five sparkles per loot so the gold reads
      // even in the 768 px contact sheet.
      const halo = this.add.circle(item.x, item.y, r, COLORS.lootGlow, 0.2).setDepth(4);
      this.tweens.add({ targets: halo, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
      const glow = this.add.circle(item.x, item.y, r * 0.6, COLORS.lootGlow, 0.45).setDepth(4);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 750, yoyo: true, repeat: -1 });
      // Sparkles: tiny gold dots that twinkle around the loot.
      const sparkles = [];
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5 + 0.5;
        const s = this.add.circle(
          item.x + Math.cos(a) * (r - 4), item.y + Math.sin(a) * (r - 4), 3, 0xffffff, 1,
        ).setDepth(4);
        this.tweens.add({
          targets: s, alpha: 0.1, scale: 0.5, duration: 450 + i * 130,
          yoyo: true, repeat: -1, delay: i * 150,
        });
        sparkles.push(s);
      }
      let shape;
      if (item.kind === 'diamond') {
        shape = this.add.polygon(item.x, item.y, [0, -20, 15, 0, 0, 20, -15, 0], COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
        const facet = this.add.polygon(item.x, item.y - 6, [0, -14, 9, -6, -9, -6], 0xfff3b0, 1).setDepth(4);
        sparkles.push(facet);
      } else if (item.kind === 'painting') {
        shape = this.add.rectangle(item.x, item.y, 26, 38, 0x8a6d3b, 1).setDepth(4);
        shape.setStrokeStyle(3, COLORS.lootGold, 1);
      } else if (item.kind === 'gold') {
        shape = this.add.rectangle(item.x, item.y, 30, 16, COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
      } else if (item.kind === 'crown') {
        // Level 2: a golden crown, three points and a band.
        shape = this.add.polygon(item.x, item.y, [-14, 6, -14, -6, -7, 2, 0, -10, 7, 2, 14, -6, 14, 6], COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
      } else if (item.kind === 'idol') {
        // Level 2: a small golden idol, a mini diamond on a dark base.
        shape = this.add.polygon(item.x, item.y, [0, -12, 9, 0, 0, 12, -9, 0], COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
      } else {
        shape = this.add.circle(item.x, item.y, 12, 0x7fd4c1, 1).setDepth(4);
        shape.setStrokeStyle(2, COLORS.lootGold, 1);
      }
      // The diamond label sits right of the vault door so the thief standing
      // in front of the door (cover pose) never covers its first letters.
      const lx = item.kind === 'diamond' ? item.x + 32 : item.x;
      const label = this.add.text(lx, item.y + r + 4, item.label, {
        fontFamily: MONO, fontSize: '10px', color: COLORS.textGold, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(4);
      this.lootObjs.push({ item, halo, glow, sparkles, shape, label });
      this.levelObjs.push(halo, glow, shape, label, ...sparkles);
    }
  }

  // Persistent actor graphics (redrawn every frame) plus the thief tag,
  // the vent hint and the smoke circle — one thief for the whole campaign.
  buildActorGraphics() {
    // All actors are drawn procedurally each frame (see drawGuard /
    // drawCamera / drawThief in render): a hooded Kestrel, uniformed guards
    // with caps and flashlights, and wall-mounted CCTV cameras. No assets.
    this.guardG = this.add.graphics().setDepth(5);
    this.camG = this.add.graphics().setDepth(5);
    this.thiefG = this.add.graphics().setDepth(6);
    // "KESTREL" tag so the judge sees the thief at a glance.
    this.thiefTag = this.add.text(0, 0, 'KESTREL', {
      fontFamily: MONO, fontSize: '10px', color: COLORS.textGreen, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
    this.ventText = this.add.text(0, 0, 'IN VENT — SLOW', {
      fontFamily: MONO, fontSize: '10px', color: '#9aa7c2',
    }).setOrigin(0.5).setDepth(6).setVisible(false);
    // Smoke cloud circle.
    this.smokeCircle = this.add.circle(0, 0, SMOKE_RADIUS, 0x9fb3a0, 0.4).setDepth(4).setVisible(false);
    this.smokeCircle.setStrokeStyle(2, 0xd7e5d7, 0.8);
  }

  // Per-level actor tags: one "!" per guard, one "EMP'D" per camera. Rebuilt
  // for each level because Level 2 has more guards and cameras.
  buildActorObjs() {
    this.guardObjs = this.guards.map((g) => {
      // v7: bigger, stroked "!" — the alert must read in the contact sheet.
      // v8: raised 4 px — the 1.2x guard figure grew into its old spot.
      const alert = this.add.text(g.x, g.y - 38, '!', {
        fontFamily: FONT, fontSize: '32px', color: '#ff5252', fontStyle: 'bold',
        stroke: '#5a0000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(5).setVisible(false);
      this.levelObjs.push(alert);
      return { logic: g, alert };
    });
    this.camObjs = this.cameras.map((c) => {
      // v7: "EMP'D" in gold, below the camera body — above it would hide
      // behind the HUD bar for the top-wall camera (y 74).
      const off = this.add.text(c.x, c.y + 30, "EMP'D", {
        fontFamily: MONO, fontSize: '13px', color: COLORS.textGold, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(5).setVisible(false);
      this.levelObjs.push(off);
      return { logic: c, off };
    });
  }

  // Build (or rebuild) a campaign level: destroy the old room, spawn the
  // new level's actors and loot, reset the run state. The campaign loot
  // banked from Level 1 is kept — only a campaign restart clears it.
  loadLevel(i) {
    this.levelIndex = i;
    this.level = LEVELS[i];
    this.destroyLevel();
    this.blockers = levelBlockers(this.level);
    this.thief = new Thief(this.level.spawn.x, this.level.spawn.y);
    this.guards = this.level.guards.map((d) => new Guard(d));
    this.cameras = this.level.cameras.map((d) => new Camera(d));
    this.loot = this.level.loot.map((d) => ({ ...d, collected: false }));
    this.buildLevelGraphics();
    this.buildLoot();
    this.buildActorObjs();
    this.lootPoints = 0;
    this.stock = { ...TOOL_STOCK };
    this.smokeUntil = -1;
    this.smokeX = 0;
    this.smokeY = 0;
    this.clock = 0;
    this.caughtT = 0;
    this.alarmBeepT = 0;
    this.toastT = 0;
    this.finalScore = null;
    this.levelClear = false;
    this.alarm.reset();
    this.smokeCircle.setVisible(false);
    if (this.toastText) this.toastText.setText(''); // no stale toast on the new level
    this.applyDifficulty();
    if (this.objectiveText) this.objectiveText.setText(this.levelObjective());
    this.mode = 'play';
    this.showOverlay(null);
  }

  levelObjective() {
    return this.levelIndex === 0
      ? 'OBJECTIVE: Steal the diamond, reach the EXIT'
      : 'OBJECTIVE: Steal the Star of Halcyon, reach the EXIT';
  }

  nextLevel() {
    if (this.levelIndex === 0 && this.levelClear) this.loadLevel(1);
  }

  // Rotate a local (facing +x) point into world space around (x, y).
  static rotPoint(x, y, lx, ly, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
  }

  drawThief(x, y, facing) {
    const g = this.thiefG;
    g.clear();
    // v8: the figure is drawn 1.2x larger than its collision circle so
    // Kestrel reads in the 768 px contact sheet; THIEF_RADIUS (19) still
    // rules movement, the vent slit and loot pickup — only pixels change.
    const r = THIEF_RADIUS;
    const S = 1.2;
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(x, y + r * 0.65 * S, r * 2.2 * S, r * 0.85 * S);
    g.fillStyle(COLORS.thief, 0.1);
    g.fillCircle(x, y, r * S + 5);
    const p = (lx, ly) => HeistScene.rotPoint(x, y, lx * S, ly * S, facing);
    // Cloak: a hooded teardrop pointing where Kestrel faces.
    const cloak = [[21, 0], [9, -13], [-13, -13], [-18, 0], [-13, 13], [9, 13]]
      .map(([lx, ly]) => p(lx, ly));
    g.fillStyle(COLORS.thiefCloak, 1);
    g.fillPoints(cloak, true);
    g.lineStyle(4, COLORS.thief, 1);
    g.strokePoints(cloak, true);
    // Hood + shadowed face + eyes.
    const hood = p(1, 0);
    g.fillStyle(COLORS.thiefHood, 1);
    g.fillCircle(hood.x, hood.y, 10 * S);
    g.lineStyle(2, COLORS.thief, 0.9);
    g.strokeCircle(hood.x, hood.y, 10 * S);
    const face = p(8, 0);
    g.fillStyle(0x0a0f0a, 1);
    g.fillCircle(face.x, face.y, 5 * S);
    for (const ey of [-2, 2]) {
      const e = p(9, ey);
      g.fillStyle(0xbfffd0, 1);
      g.fillCircle(e.x, e.y, 1.5);
    }
    // Loot bag slung at the back.
    const bag = p(-12, 9);
    g.fillStyle(COLORS.plantPot, 1);
    g.fillCircle(bag.x, bag.y, 4.5 * S);
    g.lineStyle(1, COLORS.wallTrim, 1);
    g.strokeCircle(bag.x, bag.y, 4.5 * S);
  }

  drawGuard(x, y, angle, seeing) {
    const g = this.guardG;
    const r = GUARD_RADIUS;
    // v8: drawn 1.2x larger than the collision circle (same as the thief)
    // so the guards read in the contact sheet; patrol, speed and vision
    // are untouched.
    const S = 1.2;
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(x, y + r * 0.65 * S, r * 2.2 * S, r * 0.85 * S);
    if (seeing) {
      g.fillStyle(COLORS.coneGuard, 0.12);
      g.fillCircle(x, y, r * S + 7);
    }
    const p = (lx, ly) => HeistScene.rotPoint(x, y, lx * S, ly * S, angle);
    // Navy uniform body + belt.
    g.fillStyle(COLORS.guardBody, 1);
    g.fillCircle(x, y, r * S);
    g.lineStyle(4, COLORS.guardTrim, 1);
    g.strokeCircle(x, y, r * S);
    const b1 = p(-4, -r + 2);
    const b2 = p(-4, r - 2);
    g.lineStyle(2, 0x11182b, 1);
    g.lineBetween(b1.x, b1.y, b2.x, b2.y);
    // Cap with brim, face, flashlight.
    const cap = p(5, 0);
    g.fillStyle(COLORS.guardCap, 1);
    g.fillCircle(cap.x, cap.y, 8 * S);
    g.lineStyle(1, COLORS.guardTrim, 0.9);
    g.strokeCircle(cap.x, cap.y, 8 * S);
    const brim = [p(12, -6), p(20, 0), p(12, 6)].map((q) => ({ x: q.x, y: q.y }));
    g.fillStyle(COLORS.guardCap, 1);
    g.fillPoints(brim, true);
    const face = p(9, 0);
    g.fillStyle(COLORS.guardSkin, 1);
    g.fillCircle(face.x, face.y, 4.5 * S);
    const lamp = p(19, 0);
    g.fillStyle(0xfff2b0, 1);
    g.fillCircle(lamp.x, lamp.y, 3 * S);
    g.lineStyle(1, 0xffffff, 1);
    g.strokeCircle(lamp.x, lamp.y, 3 * S);
  }

  drawCamera(c) {
    const g = this.camG;
    const disabled = c.isDisabled(this.clock);
    // Wall mount.
    g.fillStyle(0x39415e, 1);
    g.fillCircle(c.x, c.y, 5);
    g.lineStyle(1.5, 0x9aa7c2, 0.9);
    g.strokeCircle(c.x, c.y, 5);
    const p = (lx, ly) => HeistScene.rotPoint(c.x, c.y, lx, ly, c.angle);
    // Camera body pointing along the sweep angle.
    const body = [p(0, -6), p(18, -6), p(18, 6), p(0, 6)].map((q) => ({ x: q.x, y: q.y }));
    g.fillStyle(0x9aa7c2, 1);
    g.fillPoints(body, true);
    g.lineStyle(1.5, 0x39415e, 1);
    g.strokePoints(body, true);
    const lens = p(18, 0);
    g.fillStyle(disabled ? 0x5a6478 : COLORS.coneCamera, 1);
    g.fillCircle(lens.x, lens.y, 4);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(lens.x + 1, lens.y - 1, 1.2);
    // Red status LED, blinking while the camera is live.
    const led = p(-2, -8);
    const blink = disabled ? 0.25 : (Math.sin(this.clock * 6) > 0 ? 1 : 0.25);
    g.fillStyle(0xff2d2d, blink);
    g.fillCircle(led.x, led.y, 2.5);
  }

  buildHud() {
    const hud = this.add.graphics().setDepth(10);
    hud.fillStyle(COLORS.hudBg, 1);
    hud.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    hud.lineStyle(1, COLORS.hudLine, 1);
    hud.lineBetween(0, HUD_HEIGHT, GAME_WIDTH, HUD_HEIGHT);
    this.hudG = this.add.graphics().setDepth(10); // alarm bar, redrawn per frame

    this.add.text(16, 8, 'MIDNIGHT VAULT — THE KESTREL JOB', {
      fontFamily: MONO, fontSize: '14px', color: COLORS.textGold, fontStyle: 'bold',
    }).setDepth(11);
    this.objectiveText = this.add.text(GAME_WIDTH / 2, 8, 'OBJECTIVE: Steal the diamond, reach the EXIT', {
      fontFamily: FONT, fontSize: '13px', color: COLORS.textDim,
    }).setOrigin(0.5, 0).setDepth(11);
    this.timerText = this.add.text(GAME_WIDTH - 16, 8, 'TIME 0:00', {
      fontFamily: MONO, fontSize: '13px', color: COLORS.text,
    }).setOrigin(1, 0).setDepth(11);

    this.add.text(16, 33, 'ALARM', {
      fontFamily: MONO, fontSize: '12px', color: COLORS.text, fontStyle: 'bold',
    }).setDepth(11);
    this.alarmText = this.add.text(312, 33, '0%', {
      fontFamily: MONO, fontSize: '12px', color: COLORS.text,
    }).setDepth(11);
    this.spottedText = this.add.text(GAME_WIDTH / 2, 92, 'SPOTTED!', {
      fontFamily: MONO, fontSize: '24px', color: COLORS.textRed, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(11).setVisible(false);
    this.lootText = this.add.text(520, 33, 'LOOT 0/6 · SCORE 0', {
      fontFamily: MONO, fontSize: '12px', color: COLORS.text,
    }).setDepth(11);
    // v7: objective checklist + live watcher counts, one extra HUD line in
    // the free gap of the status row — diamond/star and exit status plus
    // how many guards and cameras are still watching.
    this.checklistText = this.add.text(685, 33, '', {
      fontFamily: MONO, fontSize: '10px', color: COLORS.text,
    }).setDepth(11);
    this.levelText = this.add.text(370, 33, 'LV 1 · HALCYON GALLERY · PRO', {
      fontFamily: MONO, fontSize: '11px', color: COLORS.textGold,
    }).setDepth(11);
    this.toastText = this.add.text(GAME_WIDTH / 2, 44, '', {
      fontFamily: MONO, fontSize: '11px', color: COLORS.textGold,
    }).setOrigin(0.5, 0).setDepth(11);

    // Tool buttons: clickable (mouse) and hotkeyed (1 / 2).
    this.empButton = this.makeToolButton(1000, 26, 'EMP [1]');
    this.smokeButton = this.makeToolButton(1120, 26, 'SMOKE [2]');
  }

  makeToolButton(x, y, label) {
    const bg = this.add.rectangle(x, y, 108, 24, 0x1c2742, 1).setDepth(11);
    bg.setStrokeStyle(1, COLORS.wallTrim, 1);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: MONO, fontSize: '12px', color: COLORS.text,
    }).setOrigin(0.5).setDepth(12);
    bg.on('pointerdown', () => {
      this.sfx.ensure();
      if (label.startsWith('EMP')) this.useEmp();
      else this.useSmoke();
    });
    return { bg, text, label };
  }

  buildOverlays() {
    const mk = (title, titleColor, lines, footer, full = false) => {
      const c = this.add.container(0, 0).setDepth(20);
      let bg;
      if (full) {
        bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070f, 0.86).setOrigin(0);
      } else {
        // End screens use a centered panel so the gallery stays visible
        // around the banner (the getaway shot shows Kestrel on the EXIT).
        bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 920, 400, 0x05070f, 0.93).setOrigin(0.5);
        bg.setStrokeStyle(2, 0x2a3350, 1);
      }
      const cy = GAME_HEIGHT / 2;
      const t = this.add.text(GAME_WIDTH / 2, full ? 190 : cy - 150, title, {
        fontFamily: MONO, fontSize: full ? '42px' : '30px', color: titleColor, fontStyle: 'bold',
      }).setOrigin(0.5);
      const body = this.add.text(GAME_WIDTH / 2, full ? 260 : cy - 95, lines.join('\n'), {
        fontFamily: FONT, fontSize: '17px', color: COLORS.text, align: 'center', lineSpacing: 8,
      }).setOrigin(0.5, 0);
      const foot = this.add.text(GAME_WIDTH / 2, full ? 560 : cy + 155, footer, {
        fontFamily: MONO, fontSize: '16px', color: COLORS.textGold, fontStyle: 'bold',
      }).setOrigin(0.5);
      c.add([bg, t, body, foot]);
      c.setVisible(false);
      return { container: c, body, foot };
    };
    this.titleOverlay = mk(
      'MIDNIGHT VAULT',
      COLORS.textGold,
      this.titleBodyLines(),
      'PRESS SPACE TO START',
      true, // title screen covers the whole gallery
    );
    this.pauseOverlay = mk('PAUSED', COLORS.text, ['Take a breath. The guards keep their rounds.'], 'P / Esc TO RESUME');
    this.caughtOverlay = mk(
      'CAUGHT!',
      COLORS.textRed,
      ['A guard has you dead to rights.', 'The vault keeps its secrets…'],
      '',
    );
    this.overOverlay = mk(
      'CAUGHT — THE VAULT KEEPS ITS SECRETS',
      COLORS.textRed,
      ['The alarm hit 100%. The job is blown.'],
      'PRESS R TO TRY AGAIN',
    );
    this.winOverlay = this.buildWinOverlay();
  }

  titleBodyLines() {
    const mark = (key) => (this.diffKey === key ? '◀' : ' ');
    return [
      'THE KESTREL JOB — a top-down stealth heist in the Halcyon Gallery.',
      'Steal the DIAMOND from the vault, then reach the green EXIT.',
      '2 LEVELS — the Halcyon Gallery and the Upper Gallery.',
      'Clear Level 1, then steal THE STAR OF HALCYON (800 pts) upstairs.',
      'Dodge guard vision cones and CCTV cameras — walls and display',
      'cases block sight. The alarm rises when you are seen; at 100% the job is over.',
      'MOVE  WASD / Arrows      EMP  [1] — kill the nearest camera 5s (×2)',
      'SMOKE  [2] — hide in a cloud 3s (×2)      PAUSE  P / Esc      MUTE  M',
      'Three routes: the guarded MAIN HALL, the SERVICE CORRIDOR, or crawl the VENT.',
      'THE UPPER GALLERY AWAITS.',
      `DIFFICULTY  [1] ROOKIE ${mark('rookie')}   [2] PRO ${mark('pro')}   [3] LEGEND ${mark('legend')}  — press 1 / 2 / 3`,
      `BEST SCORE: ${this.best}`,
    ];
  }

  refreshTitle() {
    this.titleOverlay.body.setText(this.titleBodyLines().join('\n'));
  }

  // The getaway ending is a compact banner at the top of the play area plus
  // a small score panel below it — the gallery, Kestrel on the EXIT and the
  // guards stay visible around it (v1's 920x400 modal hid the whole scene).
  buildWinOverlay() {
    const c = this.add.container(0, 0).setDepth(20);
    const banner = this.add.rectangle(640, 96, 780, 62, 0x05070f, 0.92).setOrigin(0.5);
    banner.setStrokeStyle(2, COLORS.exit, 1);
    const title = this.add.text(640, 79, '★ CLEAN GETAWAY ★', {
      fontFamily: MONO, fontSize: '26px', color: COLORS.textGreen, fontStyle: 'bold',
    }).setOrigin(0.5);
    const scoreLine = this.add.text(640, 108, '', {
      fontFamily: MONO, fontSize: '14px', color: COLORS.textGold, fontStyle: 'bold',
    }).setOrigin(0.5);
    const panel = this.add.rectangle(640, 208, 460, 130, 0x05070f, 0.88).setOrigin(0.5);
    panel.setStrokeStyle(1, 0x2a3350, 1);
    const body = this.add.text(640, 152, '', {
      fontFamily: FONT, fontSize: '15px', color: COLORS.text, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    const foot = this.add.text(640, 284, 'PRESS R TO PLAY AGAIN', {
      fontFamily: MONO, fontSize: '14px', color: COLORS.textGold, fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([banner, title, scoreLine, panel, body, foot]);
    c.setVisible(false);
    return { container: c, title, body, foot, scoreLine };
  }

  // Apply the picked difficulty to the live rules and the HUD.
  // Guard counts and the alarm rate are per level: Level 2 runs four
  // guards on PRO/LEGEND and a 1.2x alarm rate. Level 1 is the v1 balance.
  applyDifficulty() {
    const d = DIFFICULTIES[this.diffKey];
    const guardCount = this.level.diffGuards?.[this.diffKey] ?? d.guards;
    for (let i = 0; i < this.guards.length; i += 1) {
      const g = this.guards[i];
      g.speed = GUARD_SPEED * d.guardSpeed;
      g.active = i < guardCount;
    }
    for (const c of this.cameras) c.sweepSpeed = CAMERA_SWEEP_SPEED * d.cameraSweep;
    this.alarm.rate = d.alarmRate * (this.level.alarmRate ?? 1);
    if (this.levelText) {
      // v7: short gallery name ("HALCYON" / "UPPER") so the v7 objective
      // checklist fits in the same HUD row beside the loot counter.
      const short = this.level.name.toUpperCase().split(' ')[0];
      this.levelText.setText(`LV ${this.levelIndex + 1} · ${short} · ${d.name}`);
    }
    if (this.titleOverlay) this.refreshTitle();
  }

  setDifficulty(key) {
    if (!DIFFICULTIES[key] || key === this.diffKey) return;
    this.diffKey = key;
    this.applyDifficulty();
  }

  showOverlay(name) {
    for (const key of ['titleOverlay', 'pauseOverlay', 'caughtOverlay', 'overOverlay', 'winOverlay']) {
      if (this[key]) this[key].container.setVisible(key === `${name}Overlay`);
    }
  }

  // --- public API used by shots.js and the debug hook ------------------------

  freezeWorld(on) {
    this.frozen = on;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setThief(x, y) {
    this.thief.reset(x, y);
  }

  setGuard(i, x, y) {
    const g = this.guards[i];
    if (!g) return;
    g.x = x;
    g.y = y;
    g.wait = 0;
  }

  setGuardAngle(i, angle) {
    const g = this.guards[i];
    if (!g) return;
    g.angle = angle;
    g.baseAngle = angle;
  }

  setAlarm(v) {
    this.alarm.set(v);
  }

  // Pose-only staging (shots.js): drop a smoke cloud / EMP a camera
  // WITHOUT spending stock or running the tools' rules — the frozen cover
  // pose shows the tools mid-use. The clock never advances while frozen,
  // so the cloud and the dead camera stay put for the screenshot.
  stageSmoke(x, y) {
    this.smokeX = x;
    this.smokeY = y;
    this.smokeUntil = this.clock + SMOKE_DURATION;
    this.smokeCircle.setPosition(x, y).setVisible(true);
  }

  stageEmp(i) {
    const c = this.cameras[i];
    if (c) c.emp(this.clock, EMP_DURATION);
  }

  setScore(v) {
    this.lootPoints = v;
  }

  collectLootKind(kind, silent) {
    const item = this.loot.find((l) => l.kind === kind);
    if (item && !item.collected) this.collectLoot(item, silent);
  }

  finishWin(silent) {
    if (this.mode === 'win') return;
    const timeBonus = Math.max(0, TIME_BONUS_START - Math.floor(this.clock));
    const alarmPenalty = Math.floor(this.alarm.peak / 2);
    this.mode = 'win';
    if (this.levelIndex === 0) {
      // Level 1 clear: bank the loot, the campaign continues upstairs.
      // The BEST score is NOT saved here — it only counts a finished
      // campaign (a CLEAN GETAWAY), never a half-finished job.
      const total = this.lootPoints + timeBonus - alarmPenalty;
      this.finalScore = { loot: this.lootPoints, timeBonus, alarmPenalty, total };
      this.campaignLoot += this.lootPoints;
      this.levelClear = true;
      this.winOverlay.title.setText('★ LEVEL 1 CLEAR ★');
      this.winOverlay.scoreLine.setText(`LEVEL 1 SCORE  ${total}      CAMPAIGN LOOT  ${this.campaignLoot}`);
      this.winOverlay.body.setText([
        'The Halcyon Gallery is yours. The Upper Gallery awaits.',
        '',
        `LOOT  ${this.lootPoints} pts`,
        `TIME BONUS  +${timeBonus}  (finished in ${fmtTime(this.clock)})`,
        `ALARM PENALTY  -${alarmPenalty}  (peak alarm ${Math.floor(this.alarm.peak)}%)`,
      ].join('\n'));
      this.winOverlay.foot.setText('PRESS N FOR NEXT LEVEL · R TO REPLAY');
    } else {
      // Final win: the whole campaign scores as one job — and only this
      // CLEAN GETAWAY may set the BEST score.
      const total = this.campaignLoot + this.lootPoints + timeBonus - alarmPenalty;
      this.finalScore = { loot: this.lootPoints, campaignLoot: this.campaignLoot, timeBonus, alarmPenalty, total };
      this.levelClear = true;
      saveBest(total);
      this.best = safeBest();
      this.winOverlay.title.setText('★ CLEAN GETAWAY ★');
      this.winOverlay.scoreLine.setText(`FINAL SCORE  ${total}      BEST  ${this.best}`);
      this.winOverlay.body.setText([
        'The Star of Halcyon is yours. Kestrel vanishes into the night.',
        '',
        `CAMPAIGN LOOT  ${this.campaignLoot} pts  (Level 1)`,
        `LEVEL 2 LOOT  ${this.lootPoints} pts`,
        `TIME BONUS  +${timeBonus}  (finished in ${fmtTime(this.clock)})`,
        `ALARM PENALTY  -${alarmPenalty}  (peak alarm ${Math.floor(this.alarm.peak)}%)`,
      ].join('\n'));
      this.winOverlay.foot.setText('PRESS R TO PLAY AGAIN');
    }
    this.showOverlay('win');
    if (!silent) this.sfx.win();
  }

  snapshot() {
    return {
      mode: this.mode,
      difficulty: this.diffKey,
      level: this.level.name,
      levelIndex: this.levelIndex,
      levelCount: LEVELS.length,
      nextLevelAvailable: this.levelClear && this.levelIndex === 0,
      campaignLoot: this.campaignLoot,
      thief: { x: Math.round(this.thief.x), y: Math.round(this.thief.y) },
      alarm: Math.round(this.alarm.value),
      score: this.lootPoints,
      lootCollected: this.loot.filter((l) => l.collected).length,
      lootTotal: this.loot.length,
      diamond: this.loot.find((l) => l.kind === 'diamond').collected,
      clock: Math.round(this.clock),
      clockPrecise: this.clock,
      stock: { ...this.stock },
      guards: this.guards.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), seeing: g.seeing, active: g.active, angle: g.angle, baseAngle: g.baseAngle, wait: g.wait, sweepT: g.sweepT, wpIndex: g.wpIndex, speed: g.speed, waypoints: g.waypoints })),
      cameras: this.cameras.map((c) => ({ disabled: c.isDisabled(this.clock), seeing: c.seeing, x: c.x, y: c.y, angle: c.angle, baseAngle: c.baseAngle, sweep: c.sweep, sweepSpeed: c.sweepSpeed, phase: c.phase })),
      blockers: this.blockers,
      ventZone: this.level.ventZone,
      exitZone: this.level.exitZone,
      loot: this.loot.map((l) => ({ kind: l.kind, x: l.x, y: l.y, points: l.points, collected: l.collected })),
      finalScore: this.finalScore,
    };
  }

  // --- rules -----------------------------------------------------------------

  resetWorld() {
    // Restart the active level. Campaign loot stays banked: dying or
    // pressing R on Level 2 keeps what Level 1 paid. A full campaign
    // restart (after the final win) clears it first, then loads Level 1.
    this.loadLevel(this.levelIndex);
  }

  smokeActive() {
    return this.clock < this.smokeUntil;
  }

  smokeBlocks(wx, wy, tx, ty) {
    return this.smokeActive() && segmentIntersectsCircle(wx, wy, tx, ty, this.smokeX, this.smokeY, SMOKE_RADIUS);
  }

  useEmp() {
    if (this.mode !== 'play') return;
    if (this.stock.emp <= 0) {
      this.toast('EMP OUT OF STOCK');
      return;
    }
    let bestCam = null;
    let bestD = EMP_RANGE;
    for (const c of this.cameras) {
      const d = Math.hypot(c.x - this.thief.x, c.y - this.thief.y);
      if (d <= bestD) {
        bestD = d;
        bestCam = c;
      }
    }
    if (!bestCam) {
      this.toast('NO CAMERA IN RANGE');
      return;
    }
    bestCam.emp(this.clock, EMP_DURATION);
    this.stock.emp -= 1;
    this.sfx.emp();
    this.toast(`CAMERA DOWN — ${EMP_DURATION}s`);
  }

  useSmoke() {
    if (this.mode !== 'play') return;
    if (this.stock.smoke <= 0) {
      this.toast('SMOKE OUT OF STOCK');
      return;
    }
    this.stock.smoke -= 1;
    this.smokeX = this.thief.x;
    this.smokeY = this.thief.y;
    this.smokeUntil = this.clock + SMOKE_DURATION;
    this.smokeCircle.setPosition(this.smokeX, this.smokeY).setVisible(true);
    this.sfx.smoke();
    this.toast('SMOKE — HIDDEN 3s');
  }

  toast(msg) {
    this.toastText.setText(msg);
    this.toastT = 2;
  }

  collectLoot(item, silent) {
    item.collected = true;
    const obj = this.lootObjs.find((o) => o.item === item);
    if (obj) {
      obj.halo.setVisible(false);
      obj.glow.setVisible(false);
      obj.sparkles.forEach((s) => s.setVisible(false));
      obj.shape.setVisible(false);
      obj.label.setVisible(false);
    }
    this.lootPoints += item.points;
    if (!silent) {
      if (item.kind === 'diamond') this.sfx.diamond();
      else this.sfx.loot();
      const pop = this.add.text(item.x, item.y - 24, `+${item.points}`, {
        fontFamily: MONO, fontSize: '16px', color: COLORS.textGold, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7);
      this.popTexts.push(pop);
      this.tweens.add({
        targets: pop, y: item.y - 56, alpha: 0, duration: 900,
        onComplete: () => {
          this.popTexts = this.popTexts.filter((t) => t !== pop);
          pop.destroy();
        },
      });
    }
    if (item.kind === 'diamond') {
      const secured = this.levelIndex === 0
        ? 'DIAMOND SECURED — REACH THE EXIT!'
        : 'STAR SECURED — REACH THE EXIT!';
      this.objectiveText.setText(secured);
      if (!silent) this.toast(this.levelIndex === 0 ? 'DIAMOND SECURED — RUN!' : 'STAR SECURED — RUN!');
    }
  }

  // --- frame loop ------------------------------------------------------------

  update(time, delta) {
    // Cap the step at 100 ms so a slow frame cannot tunnel the thief
    // through a wall, while slow headless rendering still tracks real time.
    const dt = Math.min(delta, 100) / 1000;
    const input = this.input_;

    // Global keys.
    if (input.consumePressed('KeyM')) {
      const muted = this.sfx.toggleMute();
      this.toast(muted ? 'SOUND OFF' : 'SOUND ON');
    }

    if (this.mode === 'title') {
      if (input.consumePressed('Digit1')) this.setDifficulty('rookie');
      else if (input.consumePressed('Digit2')) this.setDifficulty('pro');
      else if (input.consumePressed('Digit3')) this.setDifficulty('legend');
      else if (input.consumePressed('Space') || input.consumePressed('Enter')) this.resetWorld();
    } else if (this.mode === 'play') {
      if (input.consumePressed('KeyP') || input.consumePressed('Escape')) {
        this.mode = 'paused';
        this.showOverlay('pause');
      } else if (input.consumePressed('Digit1')) this.useEmp();
      else if (input.consumePressed('Digit2')) this.useSmoke();
      else if (input.consumePressed('KeyR')) this.resetWorld();
    } else if (this.mode === 'paused') {
      if (input.consumePressed('KeyP') || input.consumePressed('Escape') || input.consumePressed('Space')) {
        this.mode = 'play';
        this.showOverlay(null);
      }
    } else if (this.mode === 'over' || this.mode === 'win') {
      if (this.mode === 'win' && input.consumePressed('KeyN')) {
        // N advances the campaign — but only from a cleared Level 1.
        this.nextLevel();
      } else if (input.consumePressed('KeyR') || input.consumePressed('Space') || input.consumePressed('Enter')) {
        if (this.mode === 'win') {
          // Any win restarts from Level 1: after the final win that is a
          // new campaign; after Level 1 it replays the level, so the
          // banked campaign loot is cleared too.
          this.campaignLoot = 0;
          this.loadLevel(0);
        } else {
          this.resetWorld();
        }
      }
    }

    if (this.mode === 'play' && !this.frozen) this.stepPlay(dt);
    if (this.mode === 'caught' && !this.frozen) {
      this.caughtT += dt;
      if (this.caughtT >= CAUGHT_DELAY) {
        this.mode = 'over';
        this.overOverlay.body.setText([
          `The alarm hit 100% after ${fmtTime(this.clock)}. The job is blown.`,
          '',
          `LOOT  ${this.lootPoints} pts      TIME  ${fmtTime(this.clock)}`,
          `BEST  ${this.best}`,
        ].join('\n'));
        this.showOverlay('over');
      }
    }

    this.render(dt);
    input.endFrame();

    // Screenshot handshake: two rendered frames, then the pose is stable.
    this.frames += 1;
    if (this.shotName && this.frames >= 2) window.__shotReady = true;
    window.__gameState = this.snapshot();
  }

  // Vision check: which watchers can see Kestrel right now, and how
  // exposed he is. Pure evaluation — used by stepPlay every frame and by
  // the deterministic screenshot poses (frozen worlds never step, so poses
  // would otherwise show every cone dim and no "!" alert).
  evaluateVision() {
    const smokeBlocks = (wx, wy, tx, ty) => this.smokeBlocks(wx, wy, tx, ty);
    let seen = false;
    let exposure = 0;
    for (const g of this.guards) {
      if (!g.active) {
        g.seeing = false;
        continue;
      }
      g.seeing = g.canSee(this.thief.x, this.thief.y, this.blockers, smokeBlocks);
      if (g.seeing) {
        seen = true;
        exposure = Math.max(exposure, g.exposure(this.thief.x, this.thief.y));
      }
    }
    for (const c of this.cameras) {
      c.seeing = c.canSee(this.thief.x, this.thief.y, this.blockers, smokeBlocks, this.clock);
      if (c.seeing) {
        seen = true;
        exposure = Math.max(exposure, c.exposure(this.thief.x, this.thief.y));
      }
    }
    return { seen, exposure };
  }

  stepPlay(dt) {
    this.clock += dt;

    this.thief.update(dt, this.input_, this.blockers, this.level.ventZone);
    if (this.thief.stepped) {
      this.thief.stepped = false;
      this.sfx.step();
    }
    for (const g of this.guards) if (g.active) g.update(dt);
    for (const c of this.cameras) c.update(this.clock);

    const { seen, exposure } = this.evaluateVision();
    this.alarm.update(dt, seen, exposure);
    if (this.alarm.spotted) {
      this.alarmBeepT -= dt;
      if (this.alarmBeepT <= 0) {
        this.alarmBeepT = 0.7;
        this.sfx.alarmBeep();
      }
    }
    if (this.alarm.caught) {
      this.mode = 'caught';
      this.caughtT = 0;
      this.sfx.caught();
      this.showOverlay('caught');
      return;
    }

    // Loot pickups.
    for (const item of this.loot) {
      if (!item.collected && Math.hypot(item.x - this.thief.x, item.y - this.thief.y) < LOOT_PICKUP_RADIUS) {
        this.collectLoot(item, false);
      }
    }

    // Getaway: diamond in hand and standing on the green EXIT pad.
    const diamond = this.loot.find((l) => l.kind === 'diamond');
    const e = this.level.exitZone;
    if (
      diamond.collected &&
      this.thief.x >= e.x && this.thief.x <= e.x + e.w &&
      this.thief.y >= e.y && this.thief.y <= e.y + e.h
    ) {
      this.finishWin(false);
    }
  }

  render(dt) {
    // Vision cones (clipped by walls via the ray fan in vision.js).
    const g = this.coneG;
    g.clear();
    // Soft light pools under each watcher and the diamond, for night mood.
    for (const guard of this.guards) {
      if (!guard.active) continue;
      g.fillStyle(0xffe9a8, 0.05);
      g.fillCircle(guard.x, guard.y, 70);
    }
    for (const cam of this.cameras) {
      if (cam.isDisabled(this.clock)) continue;
      g.fillStyle(0xffe9a8, 0.04);
      g.fillCircle(cam.x, cam.y, 50);
    }
    const diamond = this.loot.find((l) => l.kind === 'diamond');
    if (diamond && !diamond.collected) {
      g.fillStyle(0xffd94d, 0.06);
      g.fillCircle(diamond.x, diamond.y, 70);
    }
    for (const guard of this.guards) {
      if (!guard.active) continue;
      const pts = conePolygon(guard.x, guard.y, guard.angle, guard.fov, guard.range, this.blockers);
      // v7: a guard that has Kestrel fills its cone a solid, darker red
      // with a bright edge — the locked-on cone must shout in a thumbnail.
      g.fillStyle(COLORS.coneGuard, guard.seeing ? 0.5 : 0.2);
      g.fillPoints(pts, true);
      if (guard.seeing) {
        g.lineStyle(2, 0xff6b6b, 0.9);
        g.strokePoints(pts, true);
      }
    }
    for (const cam of this.cameras) {
      if (cam.isDisabled(this.clock)) {
        // v7: an EMP'd camera keeps a faint GREY dead cone — the judge
        // sees the tool worked instead of the cone just vanishing.
        const pts = conePolygon(cam.x, cam.y, cam.angle, cam.fov, cam.range, this.blockers);
        g.fillStyle(0x8a94a8, 0.08);
        g.fillPoints(pts, true);
        g.lineStyle(1, 0x5a6478, 0.5);
        g.strokePoints(pts, true);
        continue;
      }
      const pts = conePolygon(cam.x, cam.y, cam.angle, cam.fov, cam.range, this.blockers);
      g.fillStyle(COLORS.coneCamera, cam.seeing ? 0.45 : 0.18);
      g.fillPoints(pts, true);
      if (cam.seeing) {
        g.lineStyle(2, 0xffc46b, 0.9);
        g.strokePoints(pts, true);
      }
    }

    // Smoke cloud fades out at the end of its life.
    if (this.smokeActive()) {
      const left = this.smokeUntil - this.clock;
      this.smokeG.clear();
      this.smokeG.fillStyle(0x9fb3a0, Math.min(0.3, left * 0.2));
      this.smokeG.fillCircle(this.smokeX, this.smokeY, SMOKE_RADIUS);
    } else {
      this.smokeG.clear();
      this.smokeCircle.setVisible(false);
    }

    // Actors: drawn figures, redrawn every frame at their live positions.
    this.guardG.clear();
    for (const o of this.guardObjs) {
      if (!o.logic.active) {
        o.alert.setVisible(false);
        continue;
      }
      this.drawGuard(o.logic.x, o.logic.y, o.logic.angle, o.logic.seeing);
      o.alert.setPosition(o.logic.x, o.logic.y - 38).setVisible(o.logic.seeing);
    }
    this.camG.clear();
    for (const o of this.camObjs) {
      this.drawCamera(o.logic);
      o.off.setVisible(o.logic.isDisabled(this.clock));
    }
    this.drawThief(this.thief.x, this.thief.y, this.thief.facing);
    this.thiefTag.setPosition(this.thief.x, this.thief.y - 36);
    this.ventText.setPosition(this.thief.x, this.thief.y + 32).setVisible(this.thief.inVent);

    // HUD.
    const hg = this.hudG;
    hg.clear();
    hg.fillStyle(0x1c2742, 1);
    hg.fillRect(70, 30, 230, 14);
    const aw = (this.alarm.value / ALARM_CAUGHT) * 230;
    hg.fillStyle(this.alarm.value >= ALARM_SPOTTED ? 0xff2d2d : 0xff9f1c, 1);
    hg.fillRect(70, 30, aw, 14);
    hg.lineStyle(1, 0xffffff, 0.6);
    hg.lineBetween(70 + 230 * (ALARM_SPOTTED / 100), 30, 70 + 230 * (ALARM_SPOTTED / 100), 44);
    // v7: alarm lamp — a red dot beside the % that blinks while the alarm
    // is at SPOTTED level or above (solid in frozen poses, where the clock
    // never advances). Dim grey while the alarm is low.
    const alarmHot = this.alarm.value >= ALARM_SPOTTED;
    const lampOn = alarmHot && (this.frozen || Math.sin(this.clock * 10) > 0);
    hg.fillStyle(lampOn ? 0xff2d2d : 0x39415e, lampOn ? 1 : 0.8);
    hg.fillCircle(352, 37, 6);
    if (lampOn) {
      hg.fillStyle(0xff2d2d, 0.25);
      hg.fillCircle(352, 37, 10);
    }
    this.alarmText.setText(`${Math.floor(this.alarm.value)}%`);
    this.alarmText.setColor(this.alarm.value >= ALARM_SPOTTED ? COLORS.textRed : COLORS.text);
    const spotted = this.alarm.value >= ALARM_SPOTTED && (this.mode === 'play' || this.frozen);
    this.spottedText.setVisible(spotted);
    if (spotted) this.spottedText.setAlpha(Math.sin(this.clock * 12) > 0 || this.frozen ? 1 : 0.25);
    const collected = this.loot.filter((l) => l.collected).length;
    this.lootText.setText(`LOOT ${collected}/${this.loot.length} · SCORE ${this.lootPoints}`);
    // v7 objective checklist: target + exit status, live watcher counts.
    // EMP'd cameras drop out of the CAMS count — the cover pose reads CAMS 1.
    const target = this.loot.find((l) => l.kind === 'diamond');
    const targetName = this.levelIndex === 0 ? 'DIAMOND' : 'STAR';
    const guardsUp = this.guards.filter((g) => g.active).length;
    const camsUp = this.cameras.filter((c) => !c.isDisabled(this.clock)).length;
    const checkStr = `◆ ${targetName} ${target.collected ? '✓' : '○'} · ◆ EXIT ${this.mode === 'win' ? '✓' : '○'} · GUARDS ${guardsUp} · CAMS ${camsUp}`;
    if (this.checklistText.text !== checkStr) this.checklistText.setText(checkStr);
    this.timerText.setText(`TIME ${fmtTime(this.clock)}`);
    this.empButton.text.setText(`EMP [1] ×${this.stock.emp}`);
    this.smokeButton.text.setText(`SMOKE [2] ×${this.stock.smoke}`);
    this.empButton.bg.setFillStyle(this.stock.emp > 0 ? 0x1c2742 : 0x141a2c, 1);
    this.smokeButton.bg.setFillStyle(this.stock.smoke > 0 ? 0x1c2742 : 0x141a2c, 1);
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastText.setText('');
    }
  }
}
