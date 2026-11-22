// Midnight Vault — The Kestrel Job: boot.
// Phaser loads as a classic script (game/vendor/phaser.min.js) so the global
// `Phaser` exists before this module runs. No build step, no network: the
// whole game is static files. `?shot=cover|approach|spotted|getaway|l2approach`
// stages a deterministic screenshot pose (see shots.js) and raises window.__shotReady.
import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { HeistScene } from './scene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#0a0e1a',
  scene: [HeistScene],
  fps: { target: 60 },
  render: { antialias: true },
});

window.__midnightVault = game;
