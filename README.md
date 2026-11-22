# Midnight Vault — The Kestrel Job

[![best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/rank/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/reward/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

**Midnight Vault — The Kestrel Job: a top-down stealth heist game in 2 LEVELS — slip past guards and cameras, steal the diamond, then climb to the Upper Gallery for the Star of Halcyon (800 pts) and escape clean. 3 routes, EMP + smoke tools, alarm meter, 2 tools, WebAudio sound, no assets, runs offline.**

You are Kestrel, a thief in the Halcyon Gallery at midnight. Cross one gallery room, dodge patrolling guards and sweeping CCTV cameras, steal the diamond from the vault, and reach the green EXIT — before the alarm hits 100%. Clear Level 1 and press N: the Upper Gallery awaits upstairs, with four guards, three cameras, six loot targets and a faster alarm — steal the Star of Halcyon and make the final clean getaway. Your Level 1 loot banks into the campaign total.

## How to play

```bash
node serve.ts
# open http://localhost:8080
```

No build step, no network, no assets: Phaser 4 is vendored under `game/vendor/`, all art is procedural, all sound is WebAudio oscillators.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move Kestrel |
| 1 or click EMP | EMP pulse — kills the nearest camera for 5s (2 charges) |
| 2 or click SMOKE | Smoke pellet — hide in a cloud for 3s (2 charges) |
| 1 / 2 / 3 on title | Difficulty — ROOKIE / PRO / LEGEND (patrol speed, cameras, alarm, guards) |
| P / Esc | Pause |
| M | Mute |
| R | Restart after caught / getaway |
| N | Next level — after clearing Level 1 |
| Space | Start |

## Features

- **One tense room, three routes** — the guarded MAIN HALL, the camera-watched SERVICE CORRIDOR, or crawl the narrow VENT (slow, but safe).
- **3 patrolling guards** with waypoint patrols, pause-and-sweep vision cones, and wall raycasting — display cases block sight.
- **2 sweeping CCTV cameras** with amber cones; EMP them or smoke past them.
- **Alarm meter 0–100** — rises when you are seen (faster up close), falls while hidden; SPOTTED! warning at 60%, a fair 1.5s grace at 100% before you are CAUGHT.
- **Two-level campaign** — Level 1, the Halcyon Gallery (3 guards, 2 cameras, 4 loot); clear it and press N for Level 2, the Upper Gallery: the vault moves to the top left, the EXIT to the bottom right, four guards on tighter overlapping patrols, a third camera on the divider wall, and a 1.2× alarm rate.
- **4 loot targets in Level 1** — the diamond (500), gold bars (150), a painting (100), a vase (80). **6 in Level 2** — the Star of Halcyon (800), a crown (250), gold (150), an idol (120), a painting (100), a vase (80). Final score = campaign loot (Level 1) + Level 2 loot + time bonus − alarm penalty.
- **Difficulty on the title screen** — ROOKIE (2 guards, slower patrols and alarm), PRO (the balanced game), LEGEND (faster patrols, cameras and alarm); shown in the HUD.
- **Drawn characters, no assets** — hooded Kestrel with a loot bag, uniformed guards with caps and flashlights, wall-mounted CCTV with blinking LEDs; a round steel vault door, red carpet runners, framed paintings, pedestals, potted plants, vignette and light pools.
- **Full game loop** — title screen with best score, pause, caught / getaway endings, restart.
- **Procedural everything** — marble floor, gold-trimmed walls, glowing loot, WebAudio footsteps, loot chimes, alarm beeps, caught sting. No external files.

## Layout

```
game/
  index.html            page: Phaser (classic) + src/main.js (module)
  vendor/phaser.min.js  Phaser 4, vendored (MIT)
  src/
    config.js   tuning constants + palette
    levels.js   Halcyon Gallery + Upper Gallery: walls, routes, loot, patrols
    vision.js   line-of-sight + cone raycasting (pure math)
    guards.js   patrol + sweep + sight
    cameras.js  sweeping CCTV + EMP
    thief.js    movement, wall sliding, vent crawl
    alarm.js    alarm meter
    audio.js    WebAudio sound, no files
    input.js    keyboard input
    shots.js    deterministic screenshot poses (?shot=)
    scene.js    Phaser scene: render, HUD, tools, screens
    main.js     boot
```

Screenshots are real renders of the game via `?shot=cover|approach|spotted|getaway` (see `shots.json`).

## Entry

Entered on make.fun (https://make.fun/?ref=9ncycshz) — competition [best-heist-game-20261122-0559](https://make.fun/bounty/best-heist-game-20261122-0559).
