// PACING REGRESSION LOCK (M3r2, red-team round 2 finding #9).
// Seeded scripted bouts — a MASH bot (runs at nearest, spams light, never
// dodges/throws/swaps) and a SKILL bot (dodges telegraphs, launches, juggles,
// grabs+throws staggered/downed enemies, powers, swap-cycles, Scanner-first,
// carrier intercept) — drive the real encounter module at 30Hz. Driver lives
// in ./support/bots.ts.
//
// TUNED WINDOW (needs Paul's sign-off): docs/02 §1.1 says 45–90s; M3r2 tunes to
// a 30–60s SKILLED median for street tiers instead, with tier 4 allowed up to
// 90s because its spawn table includes a LEADER — §1.1 explicitly lets
// boss/leader fights run longer. Rationale for the shorter street window:
// §1.7 "one bus stop, one fight" + §1.1's own "past 2 minutes, cut enemy HP"
// both push short on phones, and the mash floor at these numbers already runs
// ~2× the skilled time — a 45–90s skilled window would put mash play well past
// the 2-minute hard ceiling.

import { describe, expect, it } from 'vitest';
import { createEncounter, type Encounter, type EncounterConfig, type Grade } from '../../../src/combat/encounter';
import { combatTuning as T } from '../../../src/combat/tuning';
import { GRADE_INDEX, makeSquad, runBout, type BoutResult } from './support/bots';

const ARENA = { minX: -12, maxX: 12, minZ: -5, maxZ: 5 };

// ---------------------------------------------------------------------------

function makeEnc(seed: number, tier: 1 | 2 | 3 | 4, encounterIndex: number, family?: 'human' | 'machine'): Encounter {
  const cfg: EncounterConfig = { seed, tier, encounterIndex, arena: ARENA, family };
  return createEncounter(cfg, makeSquad(tier));
}

function detainerEnc(seed: number): Encounter {
  const cfg: EncounterConfig = {
    seed, tier: 2, encounterIndex: 10, arena: ARENA, family: 'machine',
    civilians: [{ id: 'lola', pos: { x: -8, z: 0 }, flagged: true, detained: false }],
  };
  const enc = createEncounter(cfg, makeSquad(2));
  return enc;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const SEEDS9 = Array.from({ length: 9 }, (_, i) => 1000 + i * 7);
const SEEDS10 = Array.from({ length: 10 }, (_, i) => 2000 + i * 13);

describe('pacing regression — seeded bouts (docs/02 §1.1/§1.6/§1.7; M3r2 window 30–60s skilled)', () => {
  // shared measurement pass (computed once; vitest runs the file in one worker)
  const skillByTier = new Map<number, BoutResult[]>();
  for (const tier of [1, 2, 3, 4] as const) {
    skillByTier.set(tier, SEEDS9.map((s) => runBout(makeEnc(s, tier, 10), 'skill')));
  }
  const mashT1 = SEEDS9.map((s) => runBout(makeEnc(s, 1, 10), 'mash'));
  const mashT2 = SEEDS9.map((s) => runBout(makeEnc(s, 2, 10), 'mash'));
  const skillT4 = SEEDS10.map((s) => runBout(makeEnc(s, 4, 10), 'skill'));

  const line = (name: string, rs: BoutResult[]) => {
    const wins = rs.filter((r) => r.status === 'victory');
    return (
      `${name}: med=${median(rs.map((r) => r.timeSec)).toFixed(1)}s ` +
      `win=${wins.length}/${rs.length} defeat=${rs.filter((r) => r.status === 'defeat').length} ` +
      `grades=${rs.map((r) => r.grade).join('')} dmg=${Math.round(rs.reduce((s, r) => s + r.dmgTaken, 0) / rs.length)}`
    );
  };
  console.log('[pacing]', line('mash  t1', mashT1));
  console.log('[pacing]', line('mash  t2', mashT2));
  for (const tier of [1, 2, 3, 4] as const) {
    console.log('[pacing]', line(`skill t${tier}`, skillByTier.get(tier) ?? []));
  }
  console.log('[pacing]', line('skill t4 (defeat-rate sample)', skillT4));

  it('skilled median clear: 30–60s at street tiers 1–3; tier 4 ≤90s (leader in the mix — §1.1 lets boss/leader fights run longer)', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const rs = (skillByTier.get(tier) ?? []).filter((r) => r.status === 'victory');
      expect(rs.length, `tier ${tier} needs wins to measure`).toBeGreaterThanOrEqual(5);
      const med = median(rs.map((r) => r.timeSec));
      expect(med, `tier ${tier} skilled median`).toBeGreaterThanOrEqual(T.fightLengthTargetSec.min);
      const ceiling = tier === 4 ? 90 : T.fightLengthTargetSec.max;
      expect(med, `tier ${tier} skilled median`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('mastery is ≥2× faster than mash (t1 CLEAR medians), and mash still WINS at t1', () => {
    // "clear speed" compares CLEARS — tier 1 is the cell where the mash floor
    // reliably wins (§1.7); at t2+ mash increasingly wipes, so its runs there
    // aren't clears to compare against (reported in the console line above).
    const skillMed1 = median((skillByTier.get(1) ?? []).map((r) => r.timeSec));
    const mashWins1 = mashT1.filter((r) => r.status === 'victory');
    const mashMed1 = median(mashWins1.map((r) => r.timeSec));
    console.log('[pacing] mastery ratio (t1 clears):', (mashMed1 / skillMed1).toFixed(2));
    expect(mashMed1 / skillMed1).toBeGreaterThanOrEqual(2);
    // §1.7: mash stays viable — it wins tier 1, just slowly and for D-grade loot
    expect(mashWins1.length).toBeGreaterThanOrEqual(6);
  });

  it('skill splash grade separates from mash by ≥2 grades (medians)', () => {
    const gi = (rs: BoutResult[]) =>
      median(rs.filter((r) => r.grade !== '-').map((r) => GRADE_INDEX[r.grade as Grade]));
    const skillIdx = gi(skillByTier.get(2) ?? []);
    const mashIdx = gi(mashT2.filter((r) => r.status === 'victory'));
    console.log('[pacing] grade medians: skill t2 =', skillIdx, ' mash t2 =', mashIdx);
    expect(skillIdx - mashIdx).toBeGreaterThanOrEqual(2);
  });

  it('tier-4 skilled defeat rate lands in ~20–40% (wipe wall fixed, stakes kept)', () => {
    const combined = [...(skillByTier.get(4) ?? []), ...skillT4]; // 19 seeded runs
    const defeats = combined.filter((r) => r.status === 'defeat').length;
    console.log('[pacing] t4 skilled defeats:', defeats, '/', combined.length);
    expect(defeats / combined.length).toBeGreaterThanOrEqual(0.2);
    expect(defeats / combined.length).toBeLessThanOrEqual(0.4);
  });
});

describe('detainer scenario — the rescue decision is real (docs/02 §1.9)', () => {
  const mashRuns = SEEDS10.map((s) => runBout(detainerEnc(s), 'mash', { maxSec: 120 }));
  const interceptRuns = SEEDS10.map((s) => runBout(detainerEnc(s), 'skill', { intercept: true, maxSec: 120 }));
  console.log(
    '[pacing] detainer: mash saved',
    mashRuns.filter((r) => r.civilianSaved).length,
    '/10; intercept saved',
    interceptRuns.filter((r) => r.civilianSaved).length,
    '/10',
    interceptRuns.map((r, i) => `${SEEDS10[i]}:${r.civilianSaved ? 'S' : 'X'}/${r.status}/${r.timeSec.toFixed(0)}s`).join(' '),
  );

  it('mash alone loses the civilian ≥50% of runs', () => {
    expect(mashRuns.filter((r) => !r.civilianSaved).length).toBeGreaterThanOrEqual(5);
  });

  it('deliberate intercept saves the civilian ≥90% of runs', () => {
    expect(interceptRuns.filter((r) => r.civilianSaved).length).toBeGreaterThanOrEqual(9);
  });
});

describe('echo-thread squeeze — reservation must bite (finding #10)', () => {
  const SEEDS6 = Array.from({ length: 6 }, (_, i) => 3000 + i * 11);
  const rs0 = SEEDS6.map((s) => runBout(makeEnc(s, 2, 10), 'skill', { reservation: 0, noSwap: true }));
  const rs3 = SEEDS6.map((s) => runBout(makeEnc(s, 2, 10), 'skill', { reservation: 0.75, noSwap: true }));
  const denied0 = rs0.reduce((s, r) => s + r.dodgeDenied, 0);
  const denied3 = rs3.reduce((s, r) => s + r.dodgeDenied, 0);
  const dmg0 = rs0.reduce((s, r) => s + r.dmgTaken, 0) / rs0.length;
  const dmg3 = rs3.reduce((s, r) => s + r.dmgTaken, 0) / rs3.length;
  console.log(
    `[pacing] squeeze: 0 threads → denied=${denied0} dmg=${dmg0.toFixed(0)} | 3 threads (75%) → denied=${denied3} dmg=${dmg3.toFixed(0)}`,
  );

  it('3 running threads starve dodges and cost real HP vs 0 threads', () => {
    expect(denied3).toBeGreaterThan(denied0);
    expect(dmg3).toBeGreaterThan(dmg0);
  });
});
