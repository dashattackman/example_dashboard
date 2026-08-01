// WebAudio platform layer — plain WebAudio, ZERO @babylonjs (docs/05 allows sim
// code to skip Babylon entirely; this lives in engine/ because it is platform,
// not game logic — src/world/soundscape.ts owns WHAT plays, this owns HOW).
//
// Mobile contract (docs/06 + package brief):
//  - No AudioContext exists until the first user gesture (pointerdown/keydown).
//    Every public call before that is a silent no-op — headless e2e must boot
//    with zero errors and zero audio work.
//  - suspend() on visibilitychange hidden, resume() on visible (battery).
//  - One master gain; mute is a hard 0 on a separate stage so volume survives.
//  - Loops are cheap node graphs (source → filter? → gain → pan? → master);
//    per-frame updates are setTargetAtTime on gain/pan ONLY.
//  - Buffers (mp3 — iOS Safari cannot decode ogg vorbis) fetch lazily AFTER
//    unlock, so nothing lands in the boot path or the install precache.

export type NoiseColor = 'white' | 'pink' | 'brown';

export interface LoopSpec {
  /** Sound source: a lazily-fetched buffer, generated noise, or tonal partials. */
  src:
    | { kind: 'buffer'; url: string; loopTrim?: number }
    | {
        kind: 'noise';
        color: NoiseColor;
        seconds?: number;
        /** Amplitude modulation baked into the generated buffer (lake lap ≈ 0.12 Hz). */
        am?: { freq: number; depth: number };
      }
    | { kind: 'tone'; partials: Array<{ freq: number; gain: number }> };
  filter?: {
    type: BiquadFilterType;
    freq: number;
    q?: number;
    /** Slow wander on the cutoff (wind gusts). */
    lfo?: { freq: number; depth: number };
  };
  /** Tremolo on the loop gain (cricket shimmer). */
  gainLfo?: { freq: number; depth: number };
  rate?: number;
}

export interface LoopHandle {
  /** Retarget loudness (0..1) with a time constant in seconds — THE crossfade
   *  primitive. Values ≤0.001 park the loop (source stopped, nodes dropped). */
  setGain(target: number, tc?: number): void;
  /** Stereo position -1..1 (cheap spatialization; no HRTF panner on mobile). */
  setPan(pan: number): void;
  dispose(): void;
}

export interface SweepOpts {
  type?: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain: number;
  delay?: number;
  attack?: number;
  pan?: number;
  vibrato?: { freq: number; depth: number };
  /** Optional lowpass to push the source into the distance. */
  lowpass?: number;
}

export interface NoiseBurstOpts {
  dur: number;
  gain: number;
  attack?: number;
  pan?: number;
  color?: NoiseColor;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
  delay?: number;
}

export interface PlayBufferOpts {
  gain?: number;
  rate?: number;
  pan?: number;
}

export interface AudioEngineHandle {
  readonly unlocked: boolean;
  readonly muted: boolean;
  readonly volume: number;
  onUnlock(cb: () => void): void;
  createLoop(spec: LoopSpec): LoopHandle;
  /** Fire-and-forget one-shot from a (cached, lazily fetched) buffer URL. */
  playBuffer(url: string, opts?: PlayBufferOpts): void;
  /** Warm the buffer cache (network + decode) — post-unlock only. */
  preload(urls: string[]): void;
  sweep(opts: SweepOpts): void;
  noiseBurst(opts: NoiseBurstOpts): void;
  setMuted(m: boolean): void;
  setVolume(v: number): void;
  dispose(): void;
}

/** Master volume constant — settings UI owns a slider later. */
export const MASTER_VOLUME = 0.9;

interface LoopState {
  spec: LoopSpec;
  target: number;
  tc: number;
  pan: number;
  disposed: boolean;
  nodes: {
    sources: Array<AudioScheduledSourceNode>;
    lfos: OscillatorNode[];
    gain: GainNode;
    pan: StereoPannerNode | null;
    tail: AudioNode; // last node before master
  } | null;
}

export function createAudioEngine(): AudioEngineHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null; // volume stage
  let muteStage: GainNode | null = null; // hard mute stage
  let unlocked = false;
  let muted = false;
  let volume = MASTER_VOLUME;
  let disposed = false;

  const unlockCbs: Array<() => void> = [];
  const loops = new Set<LoopState>();
  const bufferCache = new Map<string, Promise<AudioBuffer | null>>();
  const noiseCache = new Map<string, AudioBuffer>();
  let warnedDecode = false;

  // ---- unlock on first gesture ---------------------------------------------
  const tryUnlock = (): void => {
    if (unlocked || disposed) return;
    try {
      type Ctor = typeof AudioContext;
      const AC: Ctor | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!AC) return removeUnlockListeners(); // ancient browser: stay silent forever
      ctx = new AC();
      void ctx.resume().catch(() => void 0);
      muteStage = ctx.createGain();
      muteStage.gain.value = muted ? 0 : 1;
      muteStage.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(muteStage);
      unlocked = true;
      removeUnlockListeners();
      for (const s of loops) materialize(s);
      for (const cb of unlockCbs.splice(0)) {
        try {
          cb();
        } catch {
          /* a listener must never kill the audio engine */
        }
      }
    } catch {
      // Context refused (weird embedder) — keep listening; stay silent, never throw.
      ctx = null;
    }
  };
  const removeUnlockListeners = (): void => {
    window.removeEventListener('pointerdown', tryUnlock);
    window.removeEventListener('keydown', tryUnlock);
  };
  window.addEventListener('pointerdown', tryUnlock);
  window.addEventListener('keydown', tryUnlock);

  // Battery respect (docs/06): park the whole context when backgrounded.
  const onVisibility = (): void => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => void 0);
    else void ctx.resume().catch(() => void 0);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ---- buffers ---------------------------------------------------------------
  const loadBuffer = (url: string): Promise<AudioBuffer | null> => {
    let p = bufferCache.get(url);
    if (!p) {
      p = (async () => {
        if (!ctx) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status}`);
          const bytes = await res.arrayBuffer();
          return await ctx.decodeAudioData(bytes);
        } catch (err) {
          if (!warnedDecode) {
            warnedDecode = true;
            console.warn(`audio: could not load ${url} — staying silent`, err);
          }
          return null;
        }
      })();
      bufferCache.set(url, p);
    }
    return p;
  };

  const noiseBuffer = (color: NoiseColor, seconds = 2, am?: { freq: number; depth: number }): AudioBuffer => {
    const key = `${color}:${seconds}:${am ? `${am.freq}/${am.depth}` : ''}`;
    const cached = noiseCache.get(key);
    if (cached) return cached;
    const c = ctx!;
    const n = Math.floor(seconds * c.sampleRate);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let brown = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      let v: number;
      if (color === 'white') v = white;
      else if (color === 'pink') {
        // Paul Kellet's economy pink approximation.
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        v = (b0 + b1 + b2 + white * 0.1848) * 0.18;
      } else {
        brown = (brown + 0.02 * white) / 1.02;
        v = brown * 3.2;
      }
      if (am) {
        // Loop-seam-safe AM: force a whole number of modulation cycles.
        const cycles = Math.max(1, Math.round(am.freq * seconds));
        const phase = (2 * Math.PI * cycles * i) / n;
        v *= 1 - am.depth * (0.5 + 0.5 * Math.sin(phase));
      }
      data[i] = v;
    }
    noiseCache.set(key, buf);
    return buf;
  };

  // ---- loops -----------------------------------------------------------------
  const materialize = (s: LoopState): void => {
    if (!ctx || !master || s.disposed || s.nodes || s.target <= 0.001) return;
    const c = ctx;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(s.target, c.currentTime, s.tc);
    let tail: AudioNode = gain;
    let pan: StereoPannerNode | null = null;
    if (c.createStereoPanner) {
      pan = c.createStereoPanner();
      pan.pan.value = s.pan;
      gain.connect(pan);
      tail = pan;
    }
    tail.connect(master);

    let head: AudioNode = gain;
    const lfos: OscillatorNode[] = [];
    if (s.spec.filter) {
      const f = c.createBiquadFilter();
      f.type = s.spec.filter.type;
      f.frequency.value = s.spec.filter.freq;
      f.Q.value = s.spec.filter.q ?? 1;
      if (s.spec.filter.lfo) {
        const lfo = c.createOscillator();
        lfo.frequency.value = s.spec.filter.lfo.freq;
        const depth = c.createGain();
        depth.gain.value = s.spec.filter.lfo.depth;
        lfo.connect(depth).connect(f.frequency);
        lfo.start();
        lfos.push(lfo);
      }
      f.connect(head);
      head = f;
    }
    if (s.spec.gainLfo) {
      const lfo = c.createOscillator();
      lfo.frequency.value = s.spec.gainLfo.freq;
      const depth = c.createGain();
      depth.gain.value = s.spec.gainLfo.depth * s.target;
      lfo.connect(depth).connect(gain.gain);
      lfo.start();
      lfos.push(lfo);
    }

    const sources: AudioScheduledSourceNode[] = [];
    const spec = s.spec;
    if (spec.src.kind === 'tone') {
      for (const p of spec.src.partials) {
        const osc = c.createOscillator();
        osc.frequency.value = p.freq;
        const g = c.createGain();
        g.gain.value = p.gain;
        osc.connect(g).connect(head);
        osc.start();
        sources.push(osc);
      }
    } else if (spec.src.kind === 'noise') {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(spec.src.color, spec.src.seconds ?? 2, spec.src.am);
      src.loop = true;
      src.playbackRate.value = spec.rate ?? 1;
      src.connect(head);
      src.start();
      sources.push(src);
    } else {
      const url = spec.src.url;
      const trim = spec.src.loopTrim ?? 0;
      const rate = spec.rate ?? 1;
      void loadBuffer(url).then((buf) => {
        // Loop may have been parked/disposed while the mp3 streamed in.
        if (!buf || s.disposed || s.nodes?.gain !== gain) return;
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        // Trim the LAME encoder gap out of the loop seam (the shipped loops
        // carry a crossfaded seam region, so a ~60ms shave is inaudible).
        src.loopStart = trim;
        src.loopEnd = buf.duration - trim;
        src.playbackRate.value = rate;
        src.connect(head);
        src.start(0, trim);
        s.nodes?.sources.push(src);
      });
    }
    s.nodes = { sources, lfos, gain, pan, tail };
  };

  const park = (s: LoopState): void => {
    if (!s.nodes) return;
    const n = s.nodes;
    s.nodes = null;
    for (const src of n.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const l of n.lfos) l.stop();
    n.tail.disconnect();
    n.gain.disconnect();
  };

  const createLoop = (spec: LoopSpec): LoopHandle => {
    const s: LoopState = { spec, target: 0, tc: 1, pan: 0, disposed: false, nodes: null };
    loops.add(s);
    let parkTimer: ReturnType<typeof setTimeout> | null = null;
    return {
      setGain(target: number, tc = 1) {
        if (s.disposed) return;
        s.target = target;
        s.tc = tc;
        if (parkTimer) {
          clearTimeout(parkTimer);
          parkTimer = null;
        }
        if (target > 0.001) {
          if (!s.nodes) materialize(s);
          else if (ctx) s.nodes.gain.gain.setTargetAtTime(target, ctx.currentTime, tc);
        } else if (s.nodes && ctx) {
          s.nodes.gain.gain.setTargetAtTime(0, ctx.currentTime, tc);
          parkTimer = setTimeout(() => park(s), Math.max(200, tc * 5000));
        }
      },
      setPan(pan: number) {
        s.pan = pan;
        if (s.nodes?.pan && ctx) s.nodes.pan.pan.setTargetAtTime(pan, ctx.currentTime, 0.08);
      },
      dispose() {
        s.disposed = true;
        park(s);
        loops.delete(s);
      },
    };
  };

  // ---- one-shots ---------------------------------------------------------------
  const oneShotTail = (c: AudioContext, pan: number | undefined): AudioNode => {
    if (pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      p.connect(master!);
      return p;
    }
    return master!;
  };

  const playBuffer = (url: string, opts: PlayBufferOpts = {}): void => {
    if (!unlocked || !ctx) return;
    const c = ctx;
    void loadBuffer(url).then((buf) => {
      if (!buf || disposed) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      const g = c.createGain();
      g.gain.value = opts.gain ?? 1;
      src.connect(g).connect(oneShotTail(c, opts.pan));
      src.onended = () => g.disconnect();
      src.start();
    });
  };

  const sweep = (o: SweepOpts): void => {
    if (!unlocked || !ctx) return;
    const c = ctx;
    const t0 = c.currentTime + (o.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.from), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur);
    if (o.vibrato) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibrato.freq;
      const depth = c.createGain();
      depth.gain.value = o.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    const g = c.createGain();
    const attack = Math.min(o.attack ?? 0.02, o.dur * 0.5);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.gain, t0 + attack);
    g.gain.setValueAtTime(o.gain, t0 + o.dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + o.dur);
    let head: AudioNode = g;
    if (o.lowpass) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      f.connect(g);
      head = f;
    }
    osc.connect(head);
    g.connect(oneShotTail(c, o.pan));
    osc.onended = () => g.disconnect();
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  };

  const noiseBurst = (o: NoiseBurstOpts): void => {
    if (!unlocked || !ctx) return;
    const c = ctx;
    const t0 = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(o.color ?? 'brown', 2);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.filter?.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.filter?.from ?? 800, t0);
    if (o.filter?.to)
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.to), t0 + o.dur);
    f.Q.value = o.filter?.q ?? 0.8;
    const g = c.createGain();
    const attack = Math.min(o.attack ?? o.dur * 0.4, o.dur * 0.6);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.gain, t0 + attack);
    g.gain.linearRampToValueAtTime(0, t0 + o.dur);
    src.connect(f).connect(g).connect(oneShotTail(c, o.pan));
    src.onended = () => g.disconnect();
    src.start(t0);
    src.stop(t0 + o.dur + 0.05);
  };

  return {
    get unlocked() {
      return unlocked;
    },
    get muted() {
      return muted;
    },
    get volume() {
      return volume;
    },
    onUnlock(cb) {
      if (unlocked) cb();
      else unlockCbs.push(cb);
    },
    createLoop,
    playBuffer,
    preload(urls) {
      if (!unlocked) return;
      for (const u of urls) void loadBuffer(u);
    },
    sweep,
    noiseBurst,
    setMuted(m) {
      muted = m;
      if (muteStage && ctx) muteStage.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    },
    setVolume(v) {
      volume = Math.min(Math.max(v, 0), 1);
      if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    dispose() {
      disposed = true;
      removeUnlockListeners();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const s of [...loops]) {
        s.disposed = true;
        park(s);
      }
      loops.clear();
      void ctx?.close().catch(() => void 0);
      ctx = null;
    },
  };
}
