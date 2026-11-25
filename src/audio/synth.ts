// Procedural Web Audio API tactile sound synthesizer (muted by default for distraction-free focus)

class DojoSynth {
  private ctx: AudioContext | null = null;
  private muted = true;

  constructor() {
    try {
      // Keystroke SFX is OFF by default for distraction-free memory building; only enable if user explicitly opts in
      this.muted = localStorage.getItem('inkkey_sfx_enabled') !== 'true';
    } catch {
      this.muted = true;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    try {
      localStorage.setItem('inkkey_sfx_enabled', String(!val));
    } catch {
      // Ignore
    }
  }

  private ensureContext(ignoreKeySfxMute = false): AudioContext | null {
    if (!ignoreKeySfxMute && this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMetronomeAudioTime(): number | null {
    const ctx = this.ensureContext(true);
    if (!ctx || ctx.state !== 'running') return null;
    return ctx.currentTime;
  }

  // Whisper-soft sandalwood/guqin damped pulse for the invisible rhythm beat track
  public playMetronomeTick(isDownbeat: boolean, volumeScale = 1, when?: number): void {
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    const t = when !== undefined ? Math.max(ctx.currentTime, when) : ctx.currentTime;
    const vol = Math.max(0, Math.min(1.5, volumeScale));

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = isDownbeat ? 'triangle' : 'sine';
    const startHz = isDownbeat ? 295 : 225;
    const endHz = isDownbeat ? 168 : 142;
    const decay = isDownbeat ? 0.044 : 0.030;
    const peakGain = (isDownbeat ? 0.048 : 0.025) * vol;

    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + decay);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isDownbeat ? 640 : 460, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay + 0.008);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.015);
  }

  // Soft muted mechanical keycap thock (no distracting ding-ding chimes)
  public playKeyHit(_combo: number, isWordComplete: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(isWordComplete ? 185 : 155, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(56, now + 0.042);
    bodyGain.gain.setValueAtTime(isWordComplete ? 0.14 : 0.1, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    bodyOsc.connect(bodyGain).connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.052);
  }

  // Muted wooden tap for wrong key (non-harsh, fast motor feedback)
  public playKeyMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Combo milestone fanfare (10x, 25x, 50x)
  public playMilestone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((hz, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // Tile reached bottom / life lost
  public playLifeLost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.28);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Clean UI click
  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.035);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}

export const synth = new DojoSynth();
