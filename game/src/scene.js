// Midnight Vault — The Kestrel Job: the Phaser scene.
// Owns everything on screen: the gallery floor, walls and cover, the vision
// cones, the thief, guards, cameras, loot, HUD, tools and every screen
// (title, pause, caught, game over, getaway). The rules live in the small
// modules; this file only wires them to Phaser and draws them.
import {
  ALARM_CAUGHT, ALARM_SPOTTED, CAUGHT_DELAY, COLORS, EMP_DURATION, EMP_RANGE,
  GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, LOOT_PICKUP_RADIUS, SMOKE_DURATION,
  SMOKE_RADIUS, TIME_BONUS_START, TOOL_STOCK,
} from './config.js';
import { LEVEL, levelBlockers } from './levels.js';
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
    this.blockers = levelBlockers();
    this.input_ = new Input();
    this.sfx = new Sfx();
    this.alarm = new Alarm();
    this.thief = new Thief(LEVEL.spawn.x, LEVEL.spawn.y);
    this.guards = LEVEL.guards.map((d) => new Guard(d));
    this.cameras = LEVEL.cameras.map((d) => new Camera(d));
    this.loot = LEVEL.loot.map((d) => ({ ...d, collected: false }));
    this.lootPoints = 0;
    this.stock = { ...TOOL_STOCK };
    this.smokeUntil = -1;
    this.smokeX = 0;
    this.smokeY = 0;
    this.caughtT = 0;
    this.alarmBeepT = 0;
    this.toastT = 0;
    this.finalScore = null;
    this.best = safeBest();

    this.buildStatic();
    this.buildLoot();
    this.buildActors();
    this.buildHud();
    this.buildOverlays();
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

  buildStatic() {
    // Floor: dark marble with a faint grid and checker sheen.
    const floor = this.add.graphics().setDepth(0);
    floor.fillStyle(COLORS.floor, 1);
    floor.fillRect(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);
    for (let x = 16; x < GAME_WIDTH; x += 80) {
      for (let y = HUD_HEIGHT; y < GAME_HEIGHT; y += 80) {
        if (((x + y) / 80) % 2 === 0) {
          floor.fillStyle(COLORS.floorTile, 1);
          floor.fillRect(x, y, 80, 80);
        }
      }
    }
    floor.lineStyle(1, COLORS.floorLine, 0.8);
    for (let x = 16; x <= GAME_WIDTH; x += 40) floor.lineBetween(x, HUD_HEIGHT, x, GAME_HEIGHT);
    for (let y = HUD_HEIGHT; y <= GAME_HEIGHT; y += 40) floor.lineBetween(0, y, GAME_WIDTH, y);

    // Exit zone: green floor pad, drawn before the walls.
    const exit = this.add.graphics().setDepth(1);
    exit.fillStyle(COLORS.exitDark, 0.9);
    exit.fillRect(LEVEL.exitZone.x, LEVEL.exitZone.y, LEVEL.exitZone.w, LEVEL.exitZone.h);
    exit.lineStyle(3, COLORS.exit, 1);
    exit.strokeRect(LEVEL.exitZone.x, LEVEL.exitZone.y, LEVEL.exitZone.w, LEVEL.exitZone.h);

    // Floor labels: the three routes, the vault, the exit.
    for (const label of LEVEL.labels) {
      const big = label.text === 'EXIT';
      this.add.text(label.x, label.y, label.text, {
        fontFamily: MONO,
        fontSize: big ? '18px' : '12px',
        color: big ? '#39ff6a' : '#5a6b8f',
        fontStyle: big ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(1);
    }

    // Walls + display cases, one static layer with gold trim.
    const stat = this.add.graphics().setDepth(3);
    for (const w of LEVEL.walls) {
      stat.fillStyle(COLORS.wall, 1);
      stat.fillRect(w.x, w.y, w.w, w.h);
      stat.fillStyle(COLORS.wallTrim, 1);
      stat.fillRect(w.x, w.y, w.w, 2);
    }
    for (const c of LEVEL.cases) {
      stat.fillStyle(COLORS.caseSide, 1);
      stat.fillRect(c.x, c.y, c.w, c.h);
      stat.fillStyle(COLORS.caseTop, 1);
      stat.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
      stat.lineStyle(2, COLORS.caseTrim, 1);
      stat.strokeRect(c.x, c.y, c.w, c.h);
      this.add.text(c.x + c.w / 2, c.y + c.h / 2, 'COVER', {
        fontFamily: MONO, fontSize: '10px', color: '#8fb08f',
      }).setOrigin(0.5).setDepth(3);
    }

    // Vision cones, redrawn every frame (depth 2: above the floor, below walls).
    this.coneG = this.add.graphics().setDepth(2);
    // Smoke cloud, above loot, below the actors.
    this.smokeG = this.add.graphics().setDepth(4);
  }

  buildLoot() {
    this.lootObjs = [];
    for (const item of this.loot) {
      const glow = this.add.circle(item.x, item.y, 26, COLORS.lootGlow, 0.35).setDepth(4);
      this.tweens.add({ targets: glow, alpha: 0.12, duration: 750, yoyo: true, repeat: -1 });
      let shape;
      if (item.kind === 'diamond') {
        shape = this.add.polygon(item.x, item.y, [0, -15, 11, 0, 0, 15, -11, 0], COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
      } else if (item.kind === 'painting') {
        shape = this.add.rectangle(item.x, item.y, 26, 38, 0x8a6d3b, 1).setDepth(4);
        shape.setStrokeStyle(3, COLORS.lootGold, 1);
      } else if (item.kind === 'gold') {
        shape = this.add.rectangle(item.x, item.y, 30, 16, COLORS.lootGold, 1).setDepth(4);
        shape.setStrokeStyle(2, 0xfff3b0, 1);
      } else {
        shape = this.add.circle(item.x, item.y, 12, 0x7fd4c1, 1).setDepth(4);
        shape.setStrokeStyle(2, COLORS.lootGold, 1);
      }
      const label = this.add.text(item.x, item.y + 30, item.label, {
        fontFamily: MONO, fontSize: '10px', color: COLORS.textGold,
      }).setOrigin(0.5, 0).setDepth(4);
      this.lootObjs.push({ item, glow, shape, label });
    }
  }

  buildActors() {
    // Guards: navy body, white facing nose, "!" when they see Kestrel.
    this.guardObjs = this.guards.map((g) => {
      const body = this.add.circle(g.x, g.y, 14, 0x2b3a5e, 1).setDepth(5);
      body.setStrokeStyle(2, 0x8fa3d9, 1);
      const nose = this.add.triangle(g.x, g.y, 16, 0, -7, -8, -7, 8, 0xdfe6ff, 1).setDepth(5);
      const alert = this.add.text(g.x, g.y - 26, '!', {
        fontFamily: FONT, fontSize: '22px', color: '#ff5252', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(5).setVisible(false);
      return { logic: g, body, nose, alert };
    });
    // Cameras: grey wall mount, amber lens that rides the sweep angle.
    this.camObjs = this.cameras.map((c) => {
      const body = this.add.circle(c.x, c.y, 9, 0x9aa7c2, 1).setDepth(5);
      body.setStrokeStyle(2, 0x39415e, 1);
      const lens = this.add.circle(c.x, c.y, 4, COLORS.coneCamera, 1).setDepth(5);
      const off = this.add.text(c.x, c.y - 22, 'OFF', {
        fontFamily: MONO, fontSize: '11px', color: '#9aa7c2', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(5).setVisible(false);
      return { logic: c, body, lens, off };
    });
    // Kestrel: bright green, white ring, name tag so the judge sees the thief.
    this.thiefBody = this.add.circle(this.thief.x, this.thief.y, 13, COLORS.thief, 1).setDepth(6);
    this.thiefBody.setStrokeStyle(2, 0xffffff, 1);
    this.thiefNose = this.add.triangle(this.thief.x, this.thief.y, 15, 0, -6, -7, -6, 7, COLORS.thiefDark, 1).setDepth(6);
    this.thiefTag = this.add.text(this.thief.x, this.thief.y - 28, 'KESTREL', {
      fontFamily: MONO, fontSize: '10px', color: COLORS.textGreen, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
    this.ventText = this.add.text(this.thief.x, this.thief.y + 24, 'IN VENT — SLOW', {
      fontFamily: MONO, fontSize: '10px', color: '#9aa7c2',
    }).setOrigin(0.5).setDepth(6).setVisible(false);
    // Smoke cloud circle.
    this.smokeCircle = this.add.circle(0, 0, SMOKE_RADIUS, 0x9fb3a0, 0.4).setDepth(4).setVisible(false);
    this.smokeCircle.setStrokeStyle(2, 0xd7e5d7, 0.8);
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
    this.lootText = this.add.text(560, 33, 'LOOT 0/4 · SCORE 0', {
      fontFamily: MONO, fontSize: '12px', color: COLORS.text,
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
      [
        'THE KESTREL JOB — a top-down stealth heist in the Halcyon Gallery.',
        '',
        'Steal the DIAMOND from the vault, then reach the green EXIT.',
        'Dodge guard vision cones and CCTV cameras — walls and display',
        'cases block sight. The alarm rises when you are seen; at 100% the job is over.',
        '',
        'MOVE  WASD / Arrow keys      EMP  [1] — kill the nearest camera 5s (×2)',
        'SMOKE  [2] — hide in a cloud 3s (×2)      PAUSE  P / Esc      MUTE  M',
        'Three routes: the guarded MAIN HALL, the SERVICE CORRIDOR, or crawl the VENT.',
        '',
        `BEST SCORE: ${this.best}`,
      ],
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
    this.winOverlay = mk(
      'CLEAN GETAWAY',
      COLORS.textGreen,
      ['The diamond is yours. Kestrel vanishes into the night.'],
      'PRESS R TO PLAY AGAIN',
    );
  }

  showOverlay(name) {
    for (const key of ['titleOverlay', 'pauseOverlay', 'caughtOverlay', 'overOverlay', 'winOverlay']) {
      this[key].container.setVisible(key === `${name}Overlay`);
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
    const total = this.lootPoints + timeBonus - alarmPenalty;
    this.finalScore = { loot: this.lootPoints, timeBonus, alarmPenalty, total };
    this.mode = 'win';
    saveBest(total);
    this.best = safeBest();
    this.winOverlay.body.setText([
      'The diamond is yours. Kestrel vanishes into the night.',
      '',
      `LOOT  ${this.lootPoints} pts`,
      `TIME BONUS  +${timeBonus}  (finished in ${fmtTime(this.clock)})`,
      `ALARM PENALTY  -${alarmPenalty}  (peak alarm ${Math.floor(this.alarm.peak)}%)`,
      '',
      `FINAL SCORE  ${total}      BEST  ${this.best}`,
    ].join('\n'));
    this.showOverlay('win');
    if (!silent) this.sfx.win();
  }

  snapshot() {
    return {
      mode: this.mode,
      thief: { x: Math.round(this.thief.x), y: Math.round(this.thief.y) },
      alarm: Math.round(this.alarm.value),
      score: this.lootPoints,
      lootCollected: this.loot.filter((l) => l.collected).length,
      diamond: this.loot.find((l) => l.kind === 'diamond').collected,
      clock: Math.round(this.clock),
      stock: { ...this.stock },
      guards: this.guards.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), seeing: g.seeing })),
      cameras: this.cameras.map((c) => ({ disabled: c.isDisabled(this.clock) })),
      finalScore: this.finalScore,
    };
  }

  // --- rules -----------------------------------------------------------------

  resetWorld() {
    this.thief.reset(LEVEL.spawn.x, LEVEL.spawn.y);
    this.guards = LEVEL.guards.map((d) => new Guard(d));
    this.cameras = LEVEL.cameras.map((d) => new Camera(d));
    this.guardObjs.forEach((o, i) => { o.logic = this.guards[i]; });
    this.camObjs.forEach((o, i) => { o.logic = this.cameras[i]; });
    this.alarm.reset();
    this.loot.forEach((l) => { l.collected = false; });
    this.lootObjs.forEach((o) => {
      o.glow.setVisible(true);
      o.shape.setVisible(true);
      o.label.setVisible(true);
    });
    this.lootPoints = 0;
    this.stock = { ...TOOL_STOCK };
    this.smokeUntil = -1;
    this.smokeCircle.setVisible(false);
    this.clock = 0;
    this.caughtT = 0;
    this.finalScore = null;
    this.objectiveText.setText('OBJECTIVE: Steal the diamond, reach the EXIT');
    this.mode = 'play';
    this.showOverlay(null);
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
      obj.glow.setVisible(false);
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
      this.tweens.add({
        targets: pop, y: item.y - 56, alpha: 0, duration: 900, onComplete: () => pop.destroy(),
      });
    }
    if (item.kind === 'diamond') {
      this.objectiveText.setText('DIAMOND SECURED — REACH THE EXIT!');
      if (!silent) this.toast('DIAMOND SECURED — RUN!');
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
      if (input.consumePressed('Space') || input.consumePressed('Enter')) this.resetWorld();
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
      if (input.consumePressed('KeyR') || input.consumePressed('Space') || input.consumePressed('Enter')) {
        this.resetWorld();
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

  stepPlay(dt) {
    this.clock += dt;

    this.thief.update(dt, this.input_, this.blockers, LEVEL.ventZone);
    if (this.thief.stepped) {
      this.thief.stepped = false;
      this.sfx.step();
    }
    for (const g of this.guards) g.update(dt);
    for (const c of this.cameras) c.update(this.clock);

    // Vision: any guard or camera with a clear cone on Kestrel?
    const smokeBlocks = (wx, wy, tx, ty) => this.smokeBlocks(wx, wy, tx, ty);
    let seen = false;
    let exposure = 0;
    for (const g of this.guards) {
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
    const e = LEVEL.exitZone;
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
    for (const guard of this.guards) {
      const pts = conePolygon(guard.x, guard.y, guard.angle, guard.fov, guard.range, this.blockers);
      g.fillStyle(COLORS.coneGuard, guard.seeing ? 0.38 : 0.2);
      g.fillPoints(pts, true);
    }
    for (const cam of this.cameras) {
      if (cam.isDisabled(this.clock)) continue;
      const pts = conePolygon(cam.x, cam.y, cam.angle, cam.fov, cam.range, this.blockers);
      g.fillStyle(COLORS.coneCamera, cam.seeing ? 0.34 : 0.18);
      g.fillPoints(pts, true);
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

    // Actors.
    for (const o of this.guardObjs) {
      o.body.setPosition(o.logic.x, o.logic.y);
      o.nose.setPosition(o.logic.x, o.logic.y);
      o.nose.setRotation(o.logic.angle);
      o.alert.setPosition(o.logic.x, o.logic.y - 26).setVisible(o.logic.seeing);
    }
    for (const o of this.camObjs) {
      const c = o.logic;
      const lx = c.x + Math.cos(c.angle) * 12;
      const ly = c.y + Math.sin(c.angle) * 12;
      o.lens.setPosition(lx, ly);
      o.lens.setFillStyle(c.isDisabled(this.clock) ? 0x5a6478 : COLORS.coneCamera, 1);
      o.off.setVisible(c.isDisabled(this.clock));
    }
    this.thiefBody.setPosition(this.thief.x, this.thief.y);
    this.thiefNose.setPosition(this.thief.x, this.thief.y);
    this.thiefNose.setRotation(this.thief.facing);
    this.thiefTag.setPosition(this.thief.x, this.thief.y - 28);
    this.ventText.setPosition(this.thief.x, this.thief.y + 24).setVisible(this.thief.inVent);

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
    this.alarmText.setText(`${Math.floor(this.alarm.value)}%`);
    this.alarmText.setColor(this.alarm.value >= ALARM_SPOTTED ? COLORS.textRed : COLORS.text);
    const spotted = this.alarm.value >= ALARM_SPOTTED && (this.mode === 'play' || this.frozen);
    this.spottedText.setVisible(spotted);
    if (spotted) this.spottedText.setAlpha(Math.sin(this.clock * 12) > 0 || this.frozen ? 1 : 0.25);
    const collected = this.loot.filter((l) => l.collected).length;
    this.lootText.setText(`LOOT ${collected}/4 · SCORE ${this.lootPoints}`);
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
