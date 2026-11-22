// Midnight Vault — The Kestrel Job: keyboard input.
// Plain DOM listeners (no Phaser dependency), keyed by event.code so WASD
// and arrows work on any layout. `pressed` is edge-triggered and consumed.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this.onBlur = () => {
      this.down.clear();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  /** True once per physical press; consumes the press. */
  consumePressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Clear edge presses at the end of each frame so nothing double-fires. */
  endFrame() {
    this.pressed.clear();
  }
}
