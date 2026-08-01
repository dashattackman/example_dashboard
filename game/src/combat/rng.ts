// Seedable RNG — the ONLY randomness source combat logic may use.
// Determinism rule (docs/05 testing + M3 brief): no Math.random(), no Date.now()
// anywhere in game/src/combat/. Everything advances via update(dt) + injected Rng.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
}

/** mulberry32 — tiny, fast, good-enough distribution, fully deterministic. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('Rng.pick on empty array');
      const v = arr[Math.floor(next() * arr.length)];
      return v as T;
    },
  };
}
