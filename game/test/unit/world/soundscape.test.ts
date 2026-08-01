// Soundscape decision logic (src/world/soundscape.ts) — the pure half: phase
// bed levels, one-shot sparseness, footstep cadence, emitter falloff. No
// WebAudio, no DOM (docs/05: logic must test without a browser).

import { describe, expect, it } from 'vitest';
import {
  bedLevelsFor,
  emitterGain,
  oneShotPlanFor,
  SparseScheduler,
  StepPattern,
  stepIntervalFor,
} from '../../../src/world/soundscape';
import type { Phase } from '../../../src/sim/clock';

const PHASES: Phase[] = ['MORN', 'DAY', 'EVE', 'LATE'];

/** Deterministic PRNG (same LCG the world modules use). */
function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('bedLevelsFor — what plays when', () => {
  it('keeps every level in 0..1 for every phase', () => {
    for (const p of PHASES) {
      for (const [k, v] of Object.entries(bedLevelsFor(p))) {
        expect(v, `${p}.${k}`).toBeGreaterThanOrEqual(0);
        expect(v, `${p}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('record-store music spills only while the store is open (DAY/EVE)', () => {
    expect(bedLevelsFor('MORN').music).toBe(0);
    expect(bedLevelsFor('DAY').music).toBeGreaterThan(0);
    expect(bedLevelsFor('EVE').music).toBeGreaterThan(0);
    expect(bedLevelsFor('LATE').music).toBe(0);
  });

  it('crickets and full neon hum are LATE-only; EVE peaks the city hum', () => {
    for (const p of ['MORN', 'DAY'] as const) {
      expect(bedLevelsFor(p).crickets).toBe(0);
      expect(bedLevelsFor(p).neon).toBe(0);
    }
    expect(bedLevelsFor('LATE').crickets).toBeGreaterThan(0);
    expect(bedLevelsFor('LATE').neon).toBe(1);
    expect(bedLevelsFor('EVE').city).toBeGreaterThan(bedLevelsFor('LATE').city);
    expect(bedLevelsFor('EVE').city).toBeGreaterThan(bedLevelsFor('MORN').city);
  });

  it('lake lap never fully dies — the shore is 70m away, not gone', () => {
    for (const p of PHASES) expect(bedLevelsFor(p).lakeLap).toBeGreaterThan(0);
  });
});

describe('oneShotPlanFor — sparse events per phase', () => {
  it('sirens are LATE-only and rare; gulls are MORN-only', () => {
    for (const p of PHASES) {
      const plan = oneShotPlanFor(p);
      if (p === 'LATE') expect(plan.sirenMean).toBeGreaterThanOrEqual(120);
      else expect(plan.sirenMean).toBeNull();
      if (p === 'MORN') expect(plan.gullMean).toBeGreaterThan(0);
      else expect(plan.gullMean).toBeNull();
    }
  });

  it('birdsong is densest at MORN and silent at LATE', () => {
    const morn = oneShotPlanFor('MORN').birdsMean!;
    const day = oneShotPlanFor('DAY').birdsMean!;
    expect(morn).toBeLessThan(day);
    expect(oneShotPlanFor('LATE').birdsMean).toBeNull();
  });

  it('distant traffic exists in every phase, thinnest at LATE', () => {
    for (const p of PHASES) expect(oneShotPlanFor(p).trafficMean).toBeGreaterThan(0);
    expect(oneShotPlanFor('LATE').trafficMean!).toBeGreaterThan(
      oneShotPlanFor('EVE').trafficMean!,
    );
  });
});

describe('stepIntervalFor — footsteps sync to gait', () => {
  it('no steps while idle, unknown, or drifting slower than 0.3 m/s', () => {
    expect(stepIntervalFor('Idle', 2)).toBeNull();
    expect(stepIntervalFor(null, 2)).toBeNull();
    expect(stepIntervalFor('Punch_Left', 2)).toBeNull();
    expect(stepIntervalFor('Walk', 0.1)).toBeNull();
  });

  it('walk at nominal 1.45 m/s lands ~2 steps/sec', () => {
    const interval = stepIntervalFor('Walk', 1.45)!;
    expect(interval).toBeGreaterThan(0.4);
    expect(interval).toBeLessThan(0.6);
  });

  it('run cadence beats walk cadence at their nominal speeds', () => {
    const walk = stepIntervalFor('Walk', 1.45)!;
    const run = stepIntervalFor('Run', 3.8)!;
    expect(run).toBeLessThan(walk);
  });

  it('cadence speeds up monotonically with ground speed', () => {
    let prev = Infinity;
    for (const v of [2.5, 3.5, 4.5, 6]) {
      const i = stepIntervalFor('Run', v)!;
      expect(i).toBeLessThanOrEqual(prev);
      prev = i;
    }
  });

  it('clamps the low end — a creeping Walk never yields a >1.2s stomp gap', () => {
    expect(stepIntervalFor('Walk', 0.31)!).toBeLessThanOrEqual(1.2);
  });
});

describe('emitterGain — distance falloff', () => {
  it('is 1 inside the reference distance and hard 0 past max', () => {
    expect(emitterGain(1, 3.5, 1.5, 30)).toBe(1);
    expect(emitterGain(3.5, 3.5, 1.5, 30)).toBe(1);
    expect(emitterGain(30, 3.5, 1.5, 30)).toBe(0);
    expect(emitterGain(200, 3.5, 1.5, 30)).toBe(0);
  });

  it('falls off monotonically between ref and max', () => {
    let prev = 1;
    for (let d = 4; d < 30; d += 2) {
      const g = emitterGain(d, 3.5, 1.5, 30);
      expect(g).toBeLessThan(prev);
      expect(g).toBeGreaterThan(0);
      prev = g;
    }
  });

  it('storefront spill: audible at the spawn point, gone up the avenue', () => {
    // Spawn (0.9,-5) → store (4.9,4.2) ≈ 10m: a clear but background presence.
    const atSpawn = emitterGain(10, 3.5, 1.5, 30);
    expect(atSpawn).toBeGreaterThan(0.1);
    expect(atSpawn).toBeLessThan(0.5);
  });
});

describe('StepPattern — footstep variant picker', () => {
  it('never repeats the same variant twice in a row and uses all variants', () => {
    const p = new StepPattern(4, makeRand(0x5eed));
    const seen = new Set<number>();
    let last = -1;
    for (let i = 0; i < 200; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      expect(v).not.toBe(last);
      last = v;
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('degenerates safely with one variant', () => {
    const p = new StepPattern(1, makeRand(1));
    expect(p.next()).toBe(0);
    expect(p.next()).toBe(0);
  });
});

describe('SparseScheduler — never a cron job', () => {
  it('fires roughly total/mean times with jitter, one per tick max', () => {
    const s = new SparseScheduler(30, makeRand(0xca57));
    let fires = 0;
    // 20 simulated minutes at 20 Hz ticks.
    for (let t = 0; t < 1200; t += 0.05) if (s.tick(0.05)) fires++;
    expect(fires).toBeGreaterThanOrEqual(1200 / 30 / 2); // ≥ half the naive rate
    expect(fires).toBeLessThanOrEqual((1200 / 30) * 2); // ≤ twice it
  });

  it('gaps between fires stay inside the 0.4x–1.6x jitter band', () => {
    const s = new SparseScheduler(10, makeRand(42));
    let t = 0;
    let lastFire: number | null = null;
    for (let i = 0; i < 200_000; i++) {
      t += 0.05;
      if (s.tick(0.05)) {
        if (lastFire !== null) {
          const gap = t - lastFire;
          expect(gap).toBeGreaterThanOrEqual(10 * 0.4 - 0.1);
          expect(gap).toBeLessThanOrEqual(10 * 1.6 + 0.1);
        }
        lastFire = t;
      }
    }
    expect(lastFire).not.toBeNull();
  });
});
