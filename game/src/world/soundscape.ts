// The Alive Corner, HEARD — what plays where and when. Pure orchestration:
// every Web Audio call goes through the engine/audio.ts platform layer, and all
// of the decision logic (phase beds, footstep cadence, emitter falloff, sparse
// one-shot scheduling) is exported as pure TS so vitest covers it without a
// browser (docs/05 sim-purity spirit).
//
// Sound design (docs/01 tone: intimate scale, sodium-warm, never bombastic):
//  - Phase beds crossfade on phase change: MORN birds + lake, DAY light city,
//    EVE city hum + lake + the record-store spill at its warmest, LATE crickets
//    + neon hum + rare distant sirens. Everything sits LOW — a bed you notice
//    only when it's gone.
//  - Positional emitters (distance gain + cheap stereo pan, no HRTF): LAGOON
//    RECORDS spills a lo-fi jazz loop from the storefront glass; the lake laps
//    from the west shore; the LOON blade sign carries a 120Hz neon hum at LATE.
//    addEmitter() is the jukebox-ready hook for later venues.
//  - Footsteps sync to Eli's gait: clip name (Walk/Run) picks the stride, the
//    OBSERVED ground speed drives the cadence — no per-frame engine work beyond
//    one position read.
//
// ANCHORS (same caveat as ambient.ts): storefront glass x≈4.94 z 2.2..6.2, LOON
// blade sign (4.35, 21.9), lake shore lip x≈-75 — read from beautyCorner.ts
// geometry; if the ENV author moves furniture, these constants drift.
//
// Assets: 4 Kenney footsteps + 2 UI ticks + 1 open-lofi music loop (all CC0,
// ~1MB total — public/assets/audio/CREDITS.md). Beds/one-shots are SYNTHESIZED
// (filtered noise + swept oscillators): zero download, zero precache, and no
// looping-obvious field recording. Nothing here ships in the install precache
// (vite globPatterns excludes mp3) and nothing fetches before the first gesture.

import type { Phase } from '../sim/clock';
import {
  createAudioEngine,
  MASTER_VOLUME,
  type AudioEngineHandle,
  type LoopHandle,
  type LoopSpec,
} from '../engine/audio';

// ---------------------------------------------------------------------------
// Pure decision logic (unit-tested in test/unit/world/soundscape.test.ts).
// ---------------------------------------------------------------------------

/** Per-phase target levels for every bed/emitter, 0..1 (multiplied onto each
 *  loop's base gain). Music is the LAGOON RECORDS spill — the store is open
 *  DAY/EVE; MORN it hasn't opened, LATE it's closed and the neon hums instead. */
export interface BedLevels {
  city: number;
  wind: number;
  lakeLap: number;
  crickets: number;
  neon: number;
  music: number;
}

export function bedLevelsFor(phase: Phase): BedLevels {
  switch (phase) {
    case 'MORN':
      return { city: 0.35, wind: 0.7, lakeLap: 0.9, crickets: 0, neon: 0, music: 0 };
    case 'DAY':
      return { city: 0.7, wind: 0.55, lakeLap: 0.6, crickets: 0, neon: 0, music: 0.85 };
    case 'EVE':
      return { city: 1, wind: 0.4, lakeLap: 0.8, crickets: 0, neon: 0.25, music: 1 };
    case 'LATE':
      return { city: 0.45, wind: 0.3, lakeLap: 0.55, crickets: 1, neon: 1, music: 0 };
  }
}

/** Mean seconds between ambient one-shots per phase (null = never). Sparse by
 *  design — a gull is an event, not a loop. */
export interface OneShotPlan {
  birdsMean: number | null;
  gullMean: number | null;
  sirenMean: number | null;
  trafficMean: number | null;
}

export function oneShotPlanFor(phase: Phase): OneShotPlan {
  switch (phase) {
    case 'MORN':
      return { birdsMean: 14, gullMean: 55, sirenMean: null, trafficMean: 45 };
    case 'DAY':
      return { birdsMean: 34, gullMean: null, sirenMean: null, trafficMean: 26 };
    case 'EVE':
      return { birdsMean: 55, gullMean: null, sirenMean: null, trafficMean: 30 };
    case 'LATE':
      return { birdsMean: null, gullMean: null, sirenMean: 150, trafficMean: 55 };
  }
}

/** Stride lengths (m) per gait clip — cadence = speed / stride. Tuned against
 *  the same clip-rate constants ambient.ts uses (WALK 1.45 m/s, RUN 3.8 m/s
 *  nominal), so feet and steps agree with what the rig is visibly doing. */
const STRIDE = { Walk: 0.72, Run: 1.5 } as const;

/** Seconds between footfalls for a gait clip at an observed ground speed, or
 *  null when the gait makes no steps (Idle, unknown clips, standing drift). */
export function stepIntervalFor(clip: string | null, speedMps: number): number | null {
  if (clip !== 'Walk' && clip !== 'Run') return null;
  if (speedMps < 0.3) return null;
  const stride = STRIDE[clip];
  const floor = clip === 'Walk' ? 0.6 : 2.0; // clamp so near-zero speed never → ∞ interval
  return stride / Math.max(speedMps, floor);
}

/** Distance falloff for a positional emitter: 1 inside `ref`, inverse-power
 *  rolloff beyond it, hard 0 past `max` (so far-off emitters cost nothing). */
export function emitterGain(dist: number, ref: number, rolloff: number, max: number): number {
  if (dist >= max) return 0;
  if (dist <= ref) return 1;
  return Math.pow(ref / dist, rolloff);
}

/** Round-robin-ish variant picker that never repeats the last pick — four
 *  footstep files must not read as a metronome on the same sample. */
export class StepPattern {
  private last = -1;
  constructor(
    private readonly variants: number,
    private readonly rand: () => number = Math.random,
  ) {}
  next(): number {
    if (this.variants <= 1) return 0;
    let pick = Math.floor(this.rand() * (this.variants - 1));
    if (pick >= this.last) pick += 1;
    this.last = pick;
    return pick;
  }
}

/** Sparse event timer: fires roughly every `mean` seconds, jittered 0.4x–1.6x
 *  so nothing ever sounds like a cron job. tick(dt) → true at most once. */
export class SparseScheduler {
  private wait: number;
  constructor(
    private readonly mean: number,
    private readonly rand: () => number = Math.random,
  ) {
    // First fire comes early-ish (0.2x–0.8x) so a phase's signature sound is
    // heard within the first minute of standing in it.
    this.wait = mean * (0.2 + 0.6 * this.rand());
  }
  tick(dt: number): boolean {
    this.wait -= dt;
    if (this.wait > 0) return false;
    this.wait = this.mean * (0.4 + 1.2 * this.rand());
    return true;
  }
}

// ---------------------------------------------------------------------------
// Orchestration (browser-only from here down).
// ---------------------------------------------------------------------------

const AUDIO_DIR = 'assets/audio/';
const STEP_URLS = [1, 2, 3, 4].map((i) => `${AUDIO_DIR}step-concrete-${i}.mp3`);
const UI_TICKS = { a: `${AUDIO_DIR}ui-tick-a.mp3`, b: `${AUDIO_DIR}ui-tick-b.mp3` } as const;
const MUSIC_URL = `${AUDIO_DIR}lagoon-loop.mp3`;

/** World anchors (see header caveat). [x, z] */
const RECORD_STORE: [number, number] = [4.9, 4.2];
const LAKE_SHORE: [number, number] = [-74, 15];
const BLADE_SIGN: [number, number] = [4.35, 21.9];

/** Stereo pan from listener→emitter east-offset. The camera looks mostly north
 *  up the avenue, so +X (east) ≈ screen-right; crude but right-enough (r1). */
const panFor = (dx: number): number => Math.max(-0.8, Math.min(0.8, dx / 18));

interface Emitter {
  handle: LoopHandle;
  x: number;
  z: number;
  ref: number;
  rolloff: number;
  max: number;
  base: number;
  /** Phase level key that gates this emitter (multiplied onto distance gain). */
  level: keyof BedLevels | null;
}

export interface Soundscape {
  /** Crossfade the beds to a new phase (the M4 sim-clock hook). */
  setPhase(phase: Phase): void;
  /** Jukebox-ready: park a looping emitter in the world (venues, boomboxes). */
  addEmitter(spec: LoopSpec, x: number, z: number, opts?: { ref?: number; rolloff?: number; max?: number; base?: number }): void;
  uiTick(kind?: keyof typeof UI_TICKS): void;
  dispose(): void;
}

export interface SoundscapeOptions {
  phase: Phase;
  /** Player ground position [x, z] — read once per frame, nothing else. */
  player(): [number, number];
  /** Current gait clip name from the rig ('Idle' | 'Walk' | 'Run' | null). */
  gait(): string | null;
  /** Injectable for tests; defaults to the real WebAudio engine. */
  engine?: AudioEngineHandle;
}

export function initSoundscape(opts: SoundscapeOptions): Soundscape {
  const engine = opts.engine ?? createAudioEngine();
  let phase = opts.phase;
  let levels = bedLevelsFor(phase);
  let plan = oneShotPlanFor(phase);
  let disposed = false;

  // --- beds (all synthesized — see header) -----------------------------------
  const BED_TC = 1.6; // seconds — the phase crossfade feel
  const cityBed = engine.createLoop({
    src: { kind: 'noise', color: 'brown', seconds: 4 },
    filter: { type: 'lowpass', freq: 340, q: 0.6 },
    gainLfo: { freq: 0.07, depth: 0.3 }, // slow city breathing
  });
  const windBed = engine.createLoop({
    src: { kind: 'noise', color: 'pink', seconds: 4 },
    filter: { type: 'bandpass', freq: 480, q: 0.55, lfo: { freq: 0.11, depth: 240 } }, // gusts
  });
  const cricketsBed = engine.createLoop({
    src: { kind: 'noise', color: 'white', seconds: 3 },
    filter: { type: 'bandpass', freq: 4300, q: 14 },
    gainLfo: { freq: 17, depth: 0.85 }, // pulse-train shimmer
  });
  const CITY_G = 0.05;
  const WIND_G = 0.035;
  const CRICKETS_G = 0.022;

  // --- positional emitters ----------------------------------------------------
  const emitters: Emitter[] = [];
  const addEmitter = (
    spec: LoopSpec,
    x: number,
    z: number,
    o: { ref?: number; rolloff?: number; max?: number; base?: number; level?: keyof BedLevels | null } = {},
  ): void => {
    emitters.push({
      handle: engine.createLoop(spec),
      x,
      z,
      ref: o.ref ?? 4,
      rolloff: o.rolloff ?? 1.4,
      max: o.max ?? 30,
      base: o.base ?? 0.5,
      level: o.level === undefined ? null : o.level,
    });
  };
  // LAGOON RECORDS spill — the mp3 loop, mono, through the storefront glass.
  addEmitter(
    { src: { kind: 'buffer', url: MUSIC_URL, loopTrim: 0.06 } },
    RECORD_STORE[0],
    RECORD_STORE[1],
    { ref: 3.5, rolloff: 1.5, max: 30, base: 0.55, level: 'music' },
  );
  // Lake lap from the west shore — big reference distance: it reads as a wash
  // from the whole shoreline, not a point.
  addEmitter(
    {
      src: { kind: 'noise', color: 'white', seconds: 8, am: { freq: 0.13, depth: 0.6 } },
      filter: { type: 'lowpass', freq: 850, q: 0.7 },
    },
    LAKE_SHORE[0],
    LAKE_SHORE[1],
    { ref: 30, rolloff: 1.2, max: 120, base: 0.05, level: 'lakeLap' },
  );
  // Neon hum on the LOON blade sign (LATE only via levels.neon).
  addEmitter(
    {
      src: {
        kind: 'tone',
        partials: [
          { freq: 120, gain: 1 },
          { freq: 241, gain: 0.4 },
          { freq: 362, gain: 0.1 },
        ],
      },
      gainLfo: { freq: 8.3, depth: 0.12 }, // faulty-ballast flutter
    },
    BLADE_SIGN[0],
    BLADE_SIGN[1],
    { ref: 3, rolloff: 1.8, max: 16, base: 0.012, level: 'neon' },
  );

  // --- one-shot schedulers ------------------------------------------------------
  let birds = plan.birdsMean ? new SparseScheduler(plan.birdsMean) : null;
  let gull = plan.gullMean ? new SparseScheduler(plan.gullMean) : null;
  let siren = plan.sirenMean ? new SparseScheduler(plan.sirenMean) : null;
  let traffic = plan.trafficMean ? new SparseScheduler(plan.trafficMean) : null;

  const playBirdMotif = (): void => {
    // 3–6 short chirps around a per-motif base pitch, off to one side.
    const base = 2600 + Math.random() * 1300;
    const pan = Math.random() * 1.4 - 0.7;
    let at = 0;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const f = base * (0.9 + Math.random() * 0.25);
      engine.sweep({
        from: f + 250 + Math.random() * 350,
        to: f,
        dur: 0.05 + Math.random() * 0.08,
        gain: 0.028,
        delay: at,
        pan,
      });
      at += 0.08 + Math.random() * 0.17;
    }
  };
  const playGull = (): void => {
    const pan = -0.5 - Math.random() * 0.3; // out over the lake, west = left
    engine.sweep({ from: 1350, to: 820, dur: 0.5, gain: 0.03, pan, vibrato: { freq: 26, depth: 45 }, attack: 0.08 });
    engine.sweep({ from: 1220, to: 780, dur: 0.42, gain: 0.024, pan, delay: 0.7, vibrato: { freq: 24, depth: 40 }, attack: 0.07 });
  };
  const playSiren = (): void => {
    // Distant two-tone wail: slow vibrato IS the wail; lowpass pushes it blocks away.
    engine.sweep({
      from: 780,
      to: 740,
      dur: 6.5,
      gain: 0.012,
      pan: Math.random() < 0.5 ? -0.6 : 0.6,
      vibrato: { freq: 0.4, depth: 130 },
      attack: 2.2,
      lowpass: 1200,
    });
  };
  const playTrafficSwell = (): void => {
    const dur = 3.5 + Math.random() * 3;
    engine.noiseBurst({
      dur,
      gain: 0.02 + Math.random() * 0.012,
      attack: dur * 0.45,
      pan: Math.random() * 1.2 - 0.6,
      color: 'brown',
      filter: { type: 'lowpass', from: 320, to: 620 },
    });
  };

  // --- bed/emitter level application -------------------------------------------
  const applyLevels = (tc: number): void => {
    cityBed.setGain(CITY_G * levels.city, tc);
    windBed.setGain(WIND_G * levels.wind, tc);
    cricketsBed.setGain(CRICKETS_G * levels.crickets, tc);
    // Emitters get their phase gate here; distance modulation rides update().
  };

  // --- per-frame update (self-owned rAF: main.ts wiring stays one init call) ----
  const steps = new StepPattern(STEP_URLS.length);
  let stepClock = 0;
  let lastX = 0;
  let lastZ = 0;
  let speed = 0;
  let havePos = false;
  let lastT = 0;
  let raf = 0;

  const update = (tMs: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(update);
    const dt = Math.min((tMs - lastT) / 1000, 0.25) || 0;
    lastT = tMs;
    if (!engine.unlocked || dt <= 0) return; // fully idle until the first gesture

    const [px, pz] = opts.player();
    if (!havePos) {
      lastX = px;
      lastZ = pz;
      havePos = true;
    }
    const inst = Math.min(Math.hypot(px - lastX, pz - lastZ) / dt, 10);
    speed += (inst - speed) * Math.min(dt * 8, 1); // ~1/8s smoothing
    lastX = px;
    lastZ = pz;

    // Footsteps: gait clip picks the stride, observed speed the cadence.
    const interval = stepIntervalFor(opts.gait(), speed);
    if (interval === null) {
      stepClock = 0;
    } else {
      stepClock += dt;
      if (stepClock >= interval) {
        stepClock %= interval;
        const run = opts.gait() === 'Run';
        engine.playBuffer(STEP_URLS[steps.next()]!, {
          gain: run ? 0.4 : 0.26,
          rate: (run ? 1.02 : 0.96) + Math.random() * 0.09,
        });
      }
    }

    // Emitters: distance gain + pan — the whole per-frame audio cost.
    for (const e of emitters) {
      const gate = e.level ? levels[e.level] : 1;
      const g =
        gate <= 0 ? 0 : gate * e.base * emitterGain(Math.hypot(px - e.x, pz - e.z), e.ref, e.rolloff, e.max);
      e.handle.setGain(g, 0.25);
      if (g > 0) e.handle.setPan(panFor(e.x - px));
    }

    // Sparse one-shots.
    if (birds?.tick(dt)) playBirdMotif();
    if (gull?.tick(dt)) playGull();
    if (siren?.tick(dt)) playSiren();
    if (traffic?.tick(dt)) playTrafficSwell();
  };
  raf = requestAnimationFrame(update);

  engine.onUnlock(() => {
    applyLevels(2.5); // beds breathe in gently on unlock, no hard attack
    engine.preload([...STEP_URLS, UI_TICKS.a, UI_TICKS.b]); // tiny; music streams via its loop
  });

  const setPhase = (p: Phase): void => {
    if (p === phase) return;
    phase = p;
    levels = bedLevelsFor(p);
    plan = oneShotPlanFor(p);
    birds = plan.birdsMean ? new SparseScheduler(plan.birdsMean) : null;
    gull = plan.gullMean ? new SparseScheduler(plan.gullMean) : null;
    siren = plan.sirenMean ? new SparseScheduler(plan.sirenMean) : null;
    traffic = plan.trafficMean ? new SparseScheduler(plan.trafficMean) : null;
    applyLevels(BED_TC);
  };

  const scape: Soundscape = {
    setPhase,
    addEmitter: (spec, x, z, o) => addEmitter(spec, x, z, o),
    uiTick: (kind = 'a') => engine.playBuffer(UI_TICKS[kind], { gain: 0.5 }),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      engine.dispose();
      delete window.__twinAudio;
    },
  };

  // Debug/manual handle until the settings UI lands (package brief).
  window.__twinAudio = {
    get unlocked() {
      return engine.unlocked;
    },
    get muted() {
      return engine.muted;
    },
    get volume() {
      return engine.volume;
    },
    get phase() {
      return phase;
    },
    masterVolume: MASTER_VOLUME,
    toggleMute() {
      engine.setMuted(!engine.muted);
      return engine.muted;
    },
    setVolume: (v: number) => engine.setVolume(v),
    setPhase,
    uiTick: scape.uiTick,
  };

  return scape;
}

declare global {
  interface Window {
    __twinAudio?: {
      readonly unlocked: boolean;
      readonly muted: boolean;
      readonly volume: number;
      readonly phase: Phase;
      masterVolume: number;
      toggleMute(): boolean;
      setVolume(v: number): void;
      setPhase(p: Phase): void;
      uiTick(kind?: 'a' | 'b'): void;
    };
  }
}
