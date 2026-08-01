import { describe, expect, it } from 'vitest';
import {
  buildSpawnTable,
  carryPowerBetweenFights,
  createEncounter,
  demolitionRating,
  emptyStats,
  heroHitsEnemy,
  splashRating,
  swapControlled,
  updateEncounter,
  type EncounterConfig,
  type EncounterEvent,
  type Rect,
} from '../../../src/combat/encounter';
import { createEnemy } from '../../../src/combat/enemies';
import { applyDamage, createFighter, throwHeld, tryGrab, type Fighter } from '../../../src/combat/fighter';
import { makeRng } from '../../../src/combat/rng';
import { combatTuning as T } from '../../../src/combat/tuning';

const ARENA: Rect = { minX: -10, maxX: 10, minZ: -5, maxZ: 5 };

function cfg(overrides: Partial<EncounterConfig> = {}): EncounterConfig {
  return { seed: 7, tier: 1, encounterIndex: 1, arena: ARENA, ...overrides };
}

function hero(id = 'hero'): Fighter {
  return createFighter({ id, team: 'squad' });
}

describe('spawn tables (docs/02 §1.5 crowd budget, §1.6 ramp)', () => {
  it('is deterministic for a given seed', () => {
    const a = buildSpawnTable(cfg(), makeRng(123));
    const b = buildSpawnTable(cfg(), makeRng(123));
    expect(a).toEqual(b);
  });

  it('always 8–14 enemies across 2–3 waves', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const table = buildSpawnTable(cfg({ seed, tier: (1 + (seed % 4)) as 1 | 2 | 3 | 4 }), makeRng(seed));
      expect(table.length).toBeGreaterThanOrEqual(T.crowd.totalMin);
      expect(table.length).toBeLessThanOrEqual(T.crowd.totalMax);
      const maxWave = Math.max(...table.map((s) => s.wave));
      expect(maxWave).toBeGreaterThanOrEqual(1);
      expect(maxWave).toBeLessThanOrEqual(2);
    }
  });

  it('ranged and bruiser both appear within the first three encounters (§1.6)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const kinds = new Set<string>();
      for (let encounterIndex = 1; encounterIndex <= 3; encounterIndex++) {
        for (const s of buildSpawnTable(cfg({ seed, encounterIndex }), makeRng(seed * 10 + encounterIndex))) {
          kinds.add(s.kind);
        }
      }
      expect(kinds.has('ranged')).toBe(true);
      expect(kinds.has('bruiser')).toBe(true);
    }
  });

  it('tier 4 fights include a leader (§1.6)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const table = buildSpawnTable(cfg({ seed, tier: 4, encounterIndex: 40 }), makeRng(seed));
      expect(table.some((s) => s.kind === 'leader')).toBe(true);
    }
  });

  it('rubber-banding removes exactly one bruiser after two wipes (§1.6)', () => {
    const base = buildSpawnTable(cfg({ tier: 3, encounterIndex: 10, seed: 5 }), makeRng(5));
    const eased = buildSpawnTable(cfg({ tier: 3, encounterIndex: 10, seed: 5, priorWipes: 2 }), makeRng(5));
    const bruisers = (t: { kind: string }[]) => t.filter((s) => s.kind === 'bruiser').length;
    expect(bruisers(eased)).toBe(Math.max(0, bruisers(base) - 1));
    expect(eased.length).toBe(base.length); // swapped for a grunt, not deleted — invisible easing
  });

  it('machine tables carry a swarm group (5–8) and at least one scanner (§1.9)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const table = buildSpawnTable(cfg({ seed, family: 'machine', encounterIndex: 20 }), makeRng(seed));
      expect(table.filter((s) => s.kind === 'swarm').length).toBeGreaterThanOrEqual(T.civis.swarmGroupMin);
      expect(table.some((s) => s.kind === 'scanner')).toBe(true);
    }
  });
});

describe('splash rating math (docs/02 §1.6: variety/juggle/throws/team — M3r2 4-factor)', () => {
  it('mash-only lands a D at ×1.0-ish — viable, never optimal', () => {
    const stats = emptyStats();
    stats.lightHits = 30;
    stats.assistHits = 0; // ally chip damage no longer buys the team factor
    const r = splashRating(stats, 10);
    expect(r.grade).toBe('D');
    expect(r.score).toBeCloseTo(0.05, 5); // only variety 1/5 × weight 1/4
    expect(r.lootMult).toBeCloseTo(1.025, 5);
  });

  it('full-kit play scores S at ×1.5', () => {
    const stats = emptyStats();
    stats.lightHits = 10;
    stats.heavyHits = 3;
    stats.powerMoves = 1;
    stats.throwImpacts = 5;
    stats.environmentalHits = 5;
    stats.juggleHits = 10;
    stats.swaps = 2;
    stats.assistHits = 2; // assist JUGGLE hits (§1.3 team juggling)
    const r = splashRating(stats, 10);
    expect(r.score).toBeCloseTo(1, 5);
    expect(r.grade).toBe('S');
    expect(r.lootMult).toBeCloseTo(T.splash.lootMultMax, 5);
  });

  it('S is reachable WITHOUT environmental hits (no props in M3 core)', () => {
    const stats = emptyStats();
    stats.lightHits = 10;
    stats.heavyHits = 4;
    stats.powerMoves = 1;
    stats.throwImpacts = 6;
    stats.juggleHits = 12;
    stats.swaps = 3;
    stats.assistHits = 3;
    const r = splashRating(stats, 10);
    // variety 4/5, juggle 1, throws 1, team 1 → 0.95
    expect(r.score).toBeCloseTo(0.95, 5);
    expect(r.grade).toBe('S');
  });

  it('grades cut at 0.2/0.4/0.6/0.8', () => {
    const mk = (juggles: number) => {
      const s = emptyStats();
      s.juggleHits = juggles;
      return splashRating(s, 10);
    };
    expect(mk(10).score).toBeCloseTo(0.25, 5); // juggle factor alone / 4 factors
    expect(mk(10).grade).toBe('C');
    expect(mk(0).grade).toBe('D');
  });

  it('Demolition Rating rewards Scanner-first discipline and zero detainments (§1.9)', () => {
    const stats = emptyStats();
    stats.lightHits = 5;
    stats.throwImpacts = 4;
    stats.chainDestructions = 2;
    stats.crushKills = 4;
    stats.scannerFirstKill = true;
    stats.detainments = 0;
    const r = demolitionRating(stats, 8);
    expect(r.score).toBeCloseTo((1 + 1 + 1 + 1 + 2 / 5) / 5, 5);
    expect(r.grade).toBe('S');
    const sloppy = { ...stats, detainments: 1, scannerFirstKill: false };
    const r2 = demolitionRating(sloppy, 8);
    expect(r2.score).toBeLessThan(r.score - 0.3);
  });
});

describe('encounter runtime (§1.5 waves, victory/defeat)', () => {
  it('runs to VICTORY: waves overlap, on-screen cap holds, loot splash prints a rating', () => {
    const h = hero();
    const enc = createEncounter(cfg({ seed: 11, encounterIndex: 5, tier: 2 }), [h]);
    const all: EncounterEvent[] = [];
    let guard = 0;
    while (enc.status === 'active' && guard++ < 2000) {
      all.push(...updateEncounter(enc, 0.05));
      const onScreen = enc.enemies.filter((e) => e.fighter.alive && !e.routed && e.mode !== 'abandoned').length;
      expect(onScreen).toBeLessThanOrEqual(T.crowd.onScreenCap);
      for (const e of enc.enemies) {
        if (e.fighter.alive) all.push(...heroHitsEnemy(enc, h, e, 9999, { light: true }));
      }
    }
    expect(enc.status).toBe('victory');
    const waves = all.filter((e) => e.type === 'wave-start');
    expect(waves.length).toBe(enc.waveCount);
    expect(waves.length).toBeGreaterThanOrEqual(2);
    const spawns = all.filter((e) => e.type === 'spawn');
    expect(spawns.length).toBeGreaterThanOrEqual(T.crowd.totalMin);
    expect(spawns.length).toBe(enc.enemies.length);
    const victory = all.find((e) => e.type === 'victory');
    expect(victory && victory.type === 'victory' && victory.loot.rating.grade).toBeDefined();
  });

  it('runs to DEFEAT when the squad drops — second wind fires exactly once on the way', () => {
    const h = hero();
    const enc = createEncounter(cfg({ seed: 3 }), [h]);
    const all: EncounterEvent[] = [];
    let guard = 0;
    while (enc.status === 'active' && guard++ < 6000) {
      all.push(...updateEncounter(enc, 0.05)); // hero never fights back
    }
    expect(enc.status).toBe('defeat');
    expect(all.filter((e) => e.type === 'second-wind').length).toBe(1);
    expect(all.some((e) => e.type === 'defeat')).toBe(true);
    expect(enc.squadCtx.secondWindUsed).toBe(true);
  });

  it('thrown enemies that meet the arena wall get wall-splatted (§1.3: 2s stun)', () => {
    const h = hero();
    const enc = createEncounter(cfg({ seed: 11 }), [h]);
    updateEncounter(enc, 0.05); // spawn wave 0
    const victim = enc.enemies[0];
    expect(victim).toBeDefined();
    if (!victim) return;
    victim.fighter.pos = { x: ARENA.maxX - 0.5, z: 0 };
    h.pos = { x: ARENA.maxX - 1, z: 0 };
    applyDamage(victim.fighter, 1, { light: true }); // stun to make grabbable
    expect(tryGrab(h, victim.fighter)).toBe(true);
    expect(throwHeld(h, victim.fighter, { x: 1, z: 0 })).not.toBeNull();
    updateEncounter(enc, 0.05);
    updateEncounter(enc, 0.05);
    expect(victim.fighter.state).toBe('hit');
    expect(victim.fighter.stunTimer).toBeGreaterThan(1.5);
  });

  it('hero hits feed splash stats and the power meter (§1.4 table)', () => {
    const h = hero();
    const enc = createEncounter(cfg({ seed: 11 }), [h]);
    updateEncounter(enc, 0.05);
    const grunt = enc.enemies.find((e) => e.kind === 'grunt');
    expect(grunt).toBeDefined();
    if (!grunt) return;
    heroHitsEnemy(enc, h, grunt, 5, { light: true });
    expect(enc.stats.lightHits).toBe(1);
    expect(h.power).toBe(T.power.perLightHit);
    heroHitsEnemy(enc, h, grunt, 5, { launcher: true }); // pops
    updateEncounter(enc, 0.2);
    heroHitsEnemy(enc, h, grunt, 5, { light: true }); // airborne → juggle
    expect(enc.stats.juggleHits).toBe(1);
    // light (1) + launcher counted as light-rate (1) + juggle hit (3) = 5
    expect(h.power).toBe(5);
  });

  it('bulwark shield blocks player damage from the front; thrown bodies smash through', () => {
    const h = hero();
    const enc = createEncounter(cfg({ seed: 11 }), [h]);
    updateEncounter(enc, 0.05);
    const bulwark = createEnemy('bulwark', { x: 0, z: 0 });
    bulwark.shieldFacing = 0;
    enc.enemies.push(bulwark);
    h.pos = { x: 3, z: 0 }; // dead ahead of the shield
    const hp0 = bulwark.fighter.hp;
    heroHitsEnemy(enc, h, bulwark, 20, { light: true });
    expect(bulwark.fighter.hp).toBe(hp0); // blocked
    heroHitsEnemy(enc, h, bulwark, 20, { thrown: true });
    expect(bulwark.fighter.hp).toBeCloseTo(hp0 - 20 * 1.5, 5); // bypass + momentum bonus
  });

  it('swap is a core move: counts toward team factor, refuses dead heroes', () => {
    const h1 = hero('h1');
    const h2 = hero('h2');
    const enc = createEncounter(cfg(), [h1, h2]);
    expect(swapControlled(enc, 'h2')).toBe(true);
    expect(enc.controlledId).toBe('h2');
    expect(enc.stats.swaps).toBe(1);
    h1.alive = false;
    expect(swapControlled(enc, 'h1')).toBe(false);
  });

  it('power persists between fights at 50% decay (§1.4)', () => {
    const h = hero();
    h.power = 80;
    carryPowerBetweenFights([h]);
    expect(h.power).toBe(40);
  });

  it('DETERMINISM: same seed twice → byte-identical event streams and positions', () => {
    const mk = () => createEncounter(cfg({ seed: 424242, tier: 2, encounterIndex: 6 }), [hero()]);
    const a = mk();
    const b = mk();
    const evA: string[] = [];
    const evB: string[] = [];
    for (let i = 0; i < 900; i++) {
      evA.push(...updateEncounter(a, 1 / 30).map((e) => JSON.stringify(e)));
      evB.push(...updateEncounter(b, 1 / 30).map((e) => JSON.stringify(e)));
    }
    expect(evA).toEqual(evB);
    const snap = (enc: typeof a) =>
      enc.enemies.map((e) => `${e.fighter.id}:${e.fighter.pos.x.toFixed(9)},${e.fighter.pos.z.toFixed(9)}:${e.mode}`);
    expect(snap(a)).toEqual(snap(b));
  });

  it('a carrying Detainer reaches the ON-BOUNDARY exit; detainment fires exactly once, carrier goes inert', () => {
    const civ = { id: 'civ', pos: { x: 8, z: 0 }, flagged: true, detained: false };
    const enc = createEncounter(cfg({ seed: 4, family: 'machine', civilians: [civ] }), [hero()]);
    const h = enc.squad[0];
    if (h) h.pos = { x: -9, z: 0 }; // hero watches, does nothing
    enc.pending = [{ kind: 'detainer', wave: 0 }];
    let grabbed = 0;
    let detained = 0;
    for (let i = 0; i < 30 * 60 && enc.status === 'active'; i++) {
      for (const ev of updateEncounter(enc, 1 / 30)) {
        if (ev.type === 'grabbed-captive') grabbed += 1;
        if (ev.type === 'detained') detained += 1;
      }
    }
    expect(grabbed).toBe(1);
    expect(detained).toBe(1); // fires once — no double-count, no wall-pinned carrier
    expect(civ.detained).toBe(true);
    const carrier = enc.enemies.find((e) => e.kind === 'detainer');
    expect(carrier?.gone).toBe(true);
    expect(enc.stats.detainments).toBe(1);
  });
});
