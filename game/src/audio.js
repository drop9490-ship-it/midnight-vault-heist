// Midnight Vault — The Kestrel Job: procedural sound, no audio files.
// Every sound is a WebAudio oscillator, built on first user input (browsers
// require a gesture before audio starts). All calls are safe before that:
// they simply do nothing until the context exists.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  /** Create/resume the audio context. Call from any key or pointer handler. */
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', vol = 0.08, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  step() {
    this.tone(170 + Math.random() * 50, 0.05, 'triangle', 0.025);
  }

  loot() {
    this.tone(880, 0.12, 'sine', 0.09);
    this.tone(1318, 0.2, 'sine', 0.07, 0.09);
  }

  diamond() {
    [880, 1108, 1318, 1760].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.08, i * 0.08));
  }

  alarmBeep() {
    this.tone(620, 0.14, 'square', 0.045);
  }

  emp() {
    this.tone(1400, 0.12, 'sawtooth', 0.05);
    this.tone(500, 0.25, 'sawtooth', 0.05, 0.1);
  }

  smoke() {
    this.tone(280, 0.3, 'sine', 0.05);
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 0.09);
    this.tone(110, 0.9, 'sawtooth', 0.09, 0.2);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.09, i * 0.12));
  }
}
