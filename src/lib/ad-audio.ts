/**
 * Audio engine for the landing "Product film" ad.
 *
 * Provides:
 *   • a looping background music track (NCS, copyright-free) served from
 *     /public via an HTMLAudioElement
 *   • short, timeline-synced sound effects synthesized with the Web Audio API
 *     (whoosh, tick, click, chime, …)
 *
 * Audio only starts after a user gesture (browser autoplay policy), so the
 * engine is created lazily and `resume()` is called from a click handler.
 */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export class AdAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  // Music is a real track (HTMLAudioElement) routed through the WebAudio graph
  // so we can both control its level and analyse it for reactive visuals.
  private music: HTMLAudioElement | null = null;
  private musicSrc: MediaElementAudioSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;
  private bassAvg = 0; // running average for beat detection
  private static readonly MUSIC_SRC = "/ad-music.mp3";
  private static readonly MUSIC_VOLUME = 0.5;

  private muted = true;
  private musicRunning = false;

  private supported = false;

  constructor() {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0; // start silent; ramp up on unmute
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      // Music chain: <audio> → musicGain → analyser → destination
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.musicGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.supported = true;
    } catch {
      this.supported = false;
    }
  }

  get isSupported() {
    return this.supported;
  }

  /** Resume the context — must be called from a user gesture. */
  async resume() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") await this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const now = this.ctx?.currentTime ?? 0;
    // SFX bus rides the WebAudio master gain.
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, now + 0.25);
    }
    // Music level via its own gain node (kept in the analyser chain).
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(
        muted ? 0 : AdAudio.MUSIC_VOLUME,
        now + 0.25,
      );
    }
  }

  get isMuted() {
    return this.muted;
  }

  // ─── Music bed (real NCS track) ────────────────────────────────────────────

  startMusic() {
    if (typeof window === "undefined" || this.musicRunning) return;
    this.musicRunning = true;
    try {
      if (!this.music) {
        this.music = new Audio(AdAudio.MUSIC_SRC);
        this.music.loop = true;
        this.music.preload = "auto";
        this.music.crossOrigin = "anonymous";
      }
      // Wire the element into the analyser graph once.
      if (this.ctx && this.musicGain && !this.musicSrc) {
        try {
          this.musicSrc = this.ctx.createMediaElementSource(this.music);
          this.musicSrc.connect(this.musicGain);
        } catch {
          // createMediaElementSource throws if called twice — safe to ignore.
        }
      }
      if (this.ctx && this.musicGain) {
        this.musicGain.gain.value = this.muted ? 0 : AdAudio.MUSIC_VOLUME;
      }
      this.music.currentTime = 0;
      const p = this.music.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  stopMusic() {
    this.musicRunning = false;
    if (this.music) {
      try {
        this.music.pause();
        this.music.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  // ─── Live analysis for audio-reactive visuals ──────────────────────────────
  // Returns normalized energy bands the UI can drive motion from. Cheap enough
  // to call once per animation frame.

  getEnergy(): { bass: number; mid: number; level: number; beat: number } {
    if (!this.analyser || !this.freqData || !this.isMusicActive()) {
      return { bass: 0, mid: 0, level: 0, beat: 0 };
    }
    this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
    const bins = this.freqData;
    const n = bins.length;
    // Low ~8 bins ≈ bass, next chunk ≈ mids.
    const bassEnd = Math.max(2, Math.floor(n * 0.08));
    const midEnd = Math.floor(n * 0.4);
    let bassSum = 0;
    let midSum = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const v = bins[i];
      total += v;
      if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
    }
    const bass = bassSum / bassEnd / 255;
    const mid = midSum / Math.max(1, midEnd - bassEnd) / 255;
    const level = total / n / 255;

    // Beat = how much current bass exceeds its smoothed average (0..1).
    this.bassAvg = this.bassAvg * 0.92 + bass * 0.08;
    const beat = clamp01((bass - this.bassAvg) * 3.2);

    return { bass, mid, level, beat };
  }

  // ─── Playhead sync ─────────────────────────────────────────────────────────
  // The animation timeline can lock to the music so visuals never drift from
  // the track. These expose / drive the audio element's playback position.

  /** True once the track is actually playing and we have a usable clock. */
  isMusicActive(): boolean {
    return !!(
      this.music &&
      this.musicRunning &&
      !this.music.paused &&
      !this.muted &&
      this.music.readyState >= 2 // HAVE_CURRENT_DATA
    );
  }

  /** Current playback position of the music, in seconds. */
  getMusicTime(): number {
    return this.music ? this.music.currentTime : 0;
  }

  /** Jump the music to a given time (used when scrubbing the film). */
  seekMusic(seconds: number) {
    if (!this.music) return;
    try {
      const dur = this.music.duration;
      this.music.currentTime =
        Number.isFinite(dur) && dur > 0 ? seconds % dur : Math.max(0, seconds);
    } catch {
      /* ignore */
    }
  }

  // ─── Sound effects ──────────────────────────────────────────────────────

  private tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType = "sine",
    glideTo?: number,
  ) {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private noiseSweep(dur: number, vol: number, from: number, to: number) {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(to, now + dur);
    filter.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /** Scene transition — airy upward whoosh. */
  whoosh() {
    this.noiseSweep(0.5, 0.18, 400, 2600);
  }

  /** Typing keystroke — tiny soft blip. */
  tick() {
    this.tone(1500 + Math.random() * 250, 0.05, 0.05, "square");
  }

  /** Button press / cursor click. */
  click() {
    this.tone(820, 0.06, 0.14, "triangle");
    this.tone(1300, 0.05, 0.07, "sine");
  }

  /** Brand reveal / impact sting. */
  sting() {
    this.tone(330, 0.5, 0.16, "sawtooth", 660);
    this.tone(165, 0.6, 0.1, "sine");
    this.noiseSweep(0.4, 0.12, 800, 200);
  }

  /** Success — code synced into Studio (rising major arpeggio). */
  chime() {
    const base = this.ctx?.currentTime ?? 0;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.4, 0.13, "triangle"), i * 80);
    });
    void base;
  }

  /** Counter increment — soft pop. */
  pop() {
    this.tone(540 + Math.random() * 120, 0.08, 0.06, "sine");
  }

  /** A line of code appears in the editor — short rising blip. */
  codeLine(step: number) {
    // Step up a small scale so successive lines feel like they "build".
    const scale = [392, 440, 494, 523, 587, 659, 698];
    const f = scale[step % scale.length];
    this.tone(f, 0.09, 0.06, "triangle");
    this.tone(f * 2, 0.06, 0.025, "sine");
  }

  /** The file packet traveling across to Studio — soft filtered sweep. */
  travel() {
    this.noiseSweep(0.45, 0.08, 600, 1800);
  }

  /** Final CTA hit. */
  finale() {
    this.tone(392, 0.7, 0.16, "sawtooth", 784);
    this.tone(196, 0.8, 0.12, "sine");
    this.chime();
  }

  dispose() {
    this.stopMusic();
    if (this.music) {
      try {
        this.music.pause();
        this.music.src = "";
      } catch {
        /* ignore */
      }
      this.music = null;
    }
    try {
      this.musicSrc?.disconnect();
      this.musicGain?.disconnect();
      this.analyser?.disconnect();
    } catch {
      /* ignore */
    }
    this.musicSrc = null;
    try {
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }
}
