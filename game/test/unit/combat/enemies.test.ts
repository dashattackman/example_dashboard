import { describe, expect, it } from 'vitest';
import {
  bulwarkBlocks,
  clearFlagsBy,
  createEnemy,
  damageTakenMult,
  ENEMY_CONFIGS,
  hitDetainerArm,
  isFlagged,
  machineDamageMult,
  rollScrap,
  updateEnemy,
  type Enemy,
  type EnemyEvent,
  type EnemyWorld,
} from '../../../src/combat/enemies';
import { createFighter, updateFighter, type Fighter, type Vec2 } from '../../../src/combat/fighter';
import { makeRng } from '../../../src/combat/rng';
import { createTokenPool, liveTokens, requestToken } from '../../../src/combat/tokens';
import { combatTuning as T } from '../../../src/combat/tuning';

function hero(pos: Vec2 = { x: 0, z: 0 }, id = 'hero'): Fighter {
  return createFighter({ id, team: 'squad', pos });
}

function world(squad: Fighter[], overrides: Partial<EnemyWorld> = {}): EnemyWorld {
  return {
    time: 0,
    rng: makeRng(42),
    tokens: createTokenPool(),
    squad,
    civilians: [],
    flags: new Map(),
    claimedCaptives: new Set<string>(),
    nextMeleeAt: 0,
    spoofBeaconActive: false,
    trafficHalt: false,
    leaderAlive: false,
    exitPoint: { x: 1000, z: 0 },
    dreadAura: false,
    ...overrides,
  };
}

function run(e: Enemy, w: EnemyWorld, seconds: number, dt = 0.05): EnemyEvent[] {
  const events: EnemyEvent[] = [];
  let t = 0;
  while (t < seconds - 1e-9) {
    w.time += dt; // scanner-flag expiry runs on world time
    updateFighter(e.fighter, dt);
    events.push(...updateEnemy(e, w, dt));
    t += dt;
  }
  return events;
}

describe('archetype configs match the docs/02 §1.5 / §1.9 tables', () => {
  it('HP multipliers are canon', () => {
    expect(ENEMY_CONFIGS.grunt.hpMult).toBe(1);
    expect(ENEMY_CONFIGS.bruiser.hpMult).toBe(4);
    expect(ENEMY_CONFIGS.ranged.hpMult).toBe(1.5);
    expect(ENEMY_CONFIGS.leader.hpMult).toBeGreaterThanOrEqual(8); // 8–12×
    expect(ENEMY_CONFIGS.leader.hpMult).toBeLessThanOrEqual(12);
    expect(ENEMY_CONFIGS.scanner.hpMult).toBe(0.75);
    expect(ENEMY_CONFIGS.detainer.hpMult).toBe(3);
    expect(ENEMY_CONFIGS.bulwark.hpMult).toBe(5);
    expect(ENEMY_CONFIGS.swarm.hpMult).toBe(0.2);
    expect(ENEMY_CONFIGS.wardenHand.hpMult).toBe(10);
  });

  it('every attack dealing >10% player HP telegraphs ≥0.6s (§1.5)', () => {
    for (const cfg of Object.values(ENEMY_CONFIGS)) {
      if (cfg.damageFracOfPlayerHp > T.telegraph.heavyHitHpFrac) {
        expect(cfg.telegraphSec, cfg.kind).toBeGreaterThanOrEqual(T.telegraph.minTelegraphSec);
      }
    }
  });

  it('machines are Fear-immune and announce; humans are neither (§1.9 quirks 3–4)', () => {
    for (const cfg of Object.values(ENEMY_CONFIGS)) {
      if (cfg.family === 'machine') {
        expect(cfg.fearImmune, cfg.kind).toBe(true);
        expect(cfg.routsUnderDread, cfg.kind).toBe(false);
        expect(cfg.announceLine, cfg.kind).toBeTruthy();
      } else {
        expect(cfg.fearImmune, cfg.kind).toBe(false);
      }
    }
  });
});

describe('grunt — telegraph then strike at the §1.6 tier-1 fraction', () => {
  it('telegraphs 0.6s, then lands the tier-1 hit', () => {
    const h = hero({ x: 1, z: 0 });
    const w = world([h]);
    const g = createEnemy('grunt', { x: 0, z: 0 });
    const events = run(g, w, 1.2);
    const tele = events.find((e) => e.type === 'telegraph');
    expect(tele && tele.type === 'telegraph' && tele.durationSec).toBe(0.6);
    const strike = events.find((e) => e.type === 'strike');
    // tier-1 grunt hit = ramp.tier1GruntHitHpFrac of player max HP (§1.6; M3r2 tuned to 10%)
    expect(strike && strike.type === 'strike' && strike.damage).toBeCloseTo(100 * T.ramp.tier1GruntHitHpFrac, 5);
  });

  it('a dodging (i-framed) target is never struck', () => {
    const h = hero({ x: 1, z: 0 });
    h.iframeTimer = 60;
    const w = world([h]);
    const g = createEnemy('grunt', { x: 0, z: 0 });
    const events = run(g, w, 2);
    expect(events.some((e) => e.type === 'strike')).toBe(false);
  });

  it('a stolen token cancels the victim mid-telegraph — never 3 simultaneous strikes', () => {
    const h = hero({ x: 1, z: 0 });
    const w = world([h]);
    const g = createEnemy('grunt', { x: 0, z: 0 }, { id: 'grunt-a' });
    // enter telegraph (grabs a token immediately)
    updateFighter(g.fighter, 0.05);
    updateEnemy(g, w, 0.05);
    expect(g.mode).toBe('telegraph');
    // a higher-priority attacker steals the token mid-windup
    const grant = requestToken(w.tokens, 'grunt-b', 1);
    expect(grant.granted).toBe(true); // second slot, fine
    const steal = requestToken(w.tokens, 'leader-x', 4);
    const steal2 = requestToken(w.tokens, 'bruiser-x', 3);
    expect(steal.granted && steal2.granted).toBe(true); // both grunt tokens stolen
    const events = run(g, w, 1.5);
    expect(events.some((e) => e.type === 'strike')).toBe(false); // swing cancelled
    expect(g.mode).not.toBe('telegraph');
  });

  it('crowd discipline: 4 adjacent grunts never exceed 2 live tokens', () => {
    const h = hero({ x: 0, z: 0 });
    const w = world([h]);
    const grunts = [0, 1, 2, 3].map((i) =>
      createEnemy('grunt', { x: Math.cos(i) * 1.2, z: Math.sin(i) * 1.2 }, { id: `grunt-${i}` }),
    );
    for (let step = 0; step < 60; step++) {
      for (const g of grunts) {
        updateFighter(g.fighter, 0.05);
        updateEnemy(g, w, 0.05);
      }
      expect(liveTokens(w.tokens)).toBeLessThanOrEqual(T.tokens.maxSimultaneousAttackers);
      const telegraphing = grunts.filter((g) => g.mode === 'telegraph').length;
      expect(telegraphing).toBeLessThanOrEqual(2);
    }
  });
});

describe('ranged — keeps 8m, 0.8s shots, repositions (§1.5)', () => {
  it('fires a telegraphed 0.8s shot from range', () => {
    const h = hero({ x: 8, z: 0 });
    const w = world([h]);
    const r = createEnemy('ranged', { x: 0, z: 0 });
    const events = run(r, w, 1.5);
    const tele = events.find((e) => e.type === 'telegraph');
    expect(tele && tele.type === 'telegraph' && tele.durationSec).toBe(0.8);
    expect(events.some((e) => e.type === 'shot')).toBe(true);
  });

  it('repositions away when approached', () => {
    const h = hero({ x: 4, z: 0 });
    const w = world([h]);
    const r = createEnemy('ranged', { x: 0, z: 0 });
    const d0 = Math.hypot(r.fighter.pos.x - h.pos.x, r.fighter.pos.z - h.pos.z);
    run(r, w, 0.5);
    const d1 = Math.hypot(r.fighter.pos.x - h.pos.x, r.fighter.pos.z - h.pos.z);
    expect(d1).toBeGreaterThan(d0);
  });
});

describe('leader — power whiff opens the 3s vulnerability window (§1.5)', () => {
  it('whiffed power → +50% damage taken for 3s', () => {
    const h = hero({ x: 1, z: 0 });
    h.iframeTimer = 60; // player reads the tell and dodges
    const w = world([h]);
    const l = createEnemy('leader', { x: 0, z: 0 });
    l.powerCooldown = 0.01;
    const events = run(l, w, 1.5);
    const power = events.find((e) => e.type === 'leader-power');
    expect(power && power.type === 'leader-power' && power.whiffed).toBe(true);
    expect(l.vulnerableTimer).toBeGreaterThan(0);
    expect(damageTakenMult(l, {}, h.pos)).toBeCloseTo(1.5, 5);
  });
});

describe('Scanner — paints targets, paint EXPIRES (§1.9)', () => {
  it('flags a squad member; machines then hit them +20% harder', () => {
    const h = hero({ x: 15, z: 0 });
    const w = world([h]);
    const s = createEnemy('scanner', { x: 0, z: 0 }, { id: 'scanner-a' });
    const events = run(s, w, 4.5, 0.1);
    expect(events.some((e) => e.type === 'flagged' && e.targetId === 'hero')).toBe(true);
    expect(isFlagged(w, 'hero')).toBe(true);
    const d = createEnemy('detainer', { x: 0, z: 0 });
    expect(machineDamageMult(d, 'hero', w)).toBeCloseTo(1.2, 5);
    const g = createEnemy('grunt', { x: 0, z: 0 });
    expect(machineDamageMult(g, 'hero', w)).toBe(1); // humans don't read the flags
  });

  it('paint expires when the scanner stops refreshing it', () => {
    const h = hero({ x: 15, z: 0 });
    const w = world([h]);
    const s = createEnemy('scanner', { x: 0, z: 0 }, { id: 'scanner-a' });
    run(s, w, 4.5, 0.1); // painted
    expect(isFlagged(w, 'hero')).toBe(true);
    s.fighter.alive = false; // dead scanners refresh nothing
    w.time += T.civis.scannerFlagDurationSec + 0.1;
    expect(isFlagged(w, 'hero')).toBe(false); // no permanent +20% debuff
  });

  it('refreshes the paint while alive — flag outlasts its base duration', () => {
    const h = hero({ x: 15, z: 0 });
    const w = world([h]);
    const s = createEnemy('scanner', { x: 0, z: 0 }, { id: 'scanner-a' });
    run(s, w, T.civis.scannerFlagDurationSec + 6, 0.1); // >> one flag duration
    expect(isFlagged(w, 'hero')).toBe(true);
  });

  it('killing the scanner clears its paint immediately (counterplay is the point)', () => {
    const h = hero({ x: 15, z: 0 });
    const w = world([h]);
    const s = createEnemy('scanner', { x: 0, z: 0 }, { id: 'scanner-a' });
    run(s, w, 4.5, 0.1);
    expect(isFlagged(w, 'hero')).toBe(true);
    clearFlagsBy(w.flags, 'scanner-a'); // encounter calls this on scanner death
    expect(isFlagged(w, 'hero')).toBe(false);
  });
});

describe('Detainer — grab-and-carry, the 20s rescue timer (§1.9)', () => {
  function grabScenario() {
    const h = hero({ x: 30, z: 0 });
    const civ = { id: 'civ', pos: { x: 5, z: 0 }, flagged: true, detained: false };
    const w = world([h], { civilians: [civ] });
    const d = createEnemy('detainer', { x: 0, z: 0 });
    return { w, d, civ };
  }

  it('paths to the flagged NPC, grabs, and opens a 20s window', () => {
    const { w, d } = grabScenario();
    const events = run(d, w, 3, 0.1);
    const grab = events.find((e) => e.type === 'grabbed-captive');
    expect(grab && grab.type === 'grabbed-captive' && grab.rescueSec).toBe(T.civis.detainerRescueSec);
    expect(d.mode).toBe('carry');
    expect(d.rescueRemaining).toBeLessThanOrEqual(20);
  });

  it('carrying slows it 30% while it tries to LEAVE', () => {
    const { w, d } = grabScenario();
    run(d, w, 3, 0.1); // grabbed by now
    const x0 = d.fighter.pos.x;
    run(d, w, 1, 0.05);
    const moved = d.fighter.pos.x - x0;
    expect(moved).toBeCloseTo(ENEMY_CONFIGS.detainer.moveSpeed * 0.7, 1);
  });

  it('3 deliberate arm hits break the grip — a puzzle, never a DPS race', () => {
    const { w, d } = grabScenario();
    run(d, w, 3, 0.1);
    expect(hitDetainerArm(d)).toEqual([]);
    hitDetainerArm(d);
    const broken = hitDetainerArm(d);
    expect(broken.some((e) => e.type === 'grip-broken' && e.captiveId === 'civ')).toBe(true);
    expect(d.carryTargetId).toBeNull();
  });

  it('timer expiry = detainment, and the carrier is GONE — no zombie re-grabs', () => {
    const { w, d, civ } = grabScenario();
    const events = run(d, w, 25, 0.1);
    expect(events.filter((e) => e.type === 'detained').length).toBe(1);
    expect(civ.detained).toBe(true);
    expect(d.gone).toBe(true);
    // a downed squadmate appears — the departed carrier must NOT re-engage
    const h2 = createFighter({ id: 'downed', team: 'squad', pos: { ...d.fighter.pos } });
    h2.state = 'down';
    w.squad.push(h2);
    const after = run(d, w, 3, 0.1);
    expect(after.some((e) => e.type === 'grabbed-captive')).toBe(false);
    expect(d.carryTargetId).toBeNull();
  });

  it('also grabs a downed squadmate', () => {
    const h = hero({ x: 1, z: 0 });
    h.state = 'down';
    const w = world([h]);
    const d = createEnemy('detainer', { x: 0, z: 0 });
    const events = run(d, w, 1, 0.05);
    expect(events.some((e) => e.type === 'grabbed-captive' && e.captiveId === 'hero')).toBe(true);
  });
});

describe('Bulwark — frontal shield, flankable (§1.9)', () => {
  it('blocks from the front; environmental and thrown bodies bypass', () => {
    const b = createEnemy('bulwark', { x: 0, z: 0 });
    b.shieldFacing = 0; // facing +x
    expect(bulwarkBlocks(b, { x: 5, z: 0 }, {})).toBe(true);
    expect(damageTakenMult(b, {}, { x: 5, z: 0 })).toBe(0);
    expect(bulwarkBlocks(b, { x: -5, z: 0 }, {})).toBe(false); // flanked
    expect(bulwarkBlocks(b, { x: 5, z: 0 }, { thrown: true })).toBe(false);
    expect(bulwarkBlocks(b, { x: 5, z: 0 }, { environmental: true })).toBe(false);
  });

  it('momentum damage gets the machine structural bonus (§1.9 quirk 4)', () => {
    const b = createEnemy('bulwark', { x: 0, z: 0 });
    b.shieldFacing = 0;
    expect(damageTakenMult(b, { thrown: true }, { x: 5, z: 0 })).toBeCloseTo(1.5, 5);
  });

  it('shield turns at a capped rate — flanking works', () => {
    const h = hero({ x: 0, z: 6 }); // 90° off the shield
    const w = world([h]);
    const b = createEnemy('bulwark', { x: 0, z: 0 });
    b.shieldFacing = 0;
    run(b, w, 0.5);
    expect(b.shieldFacing).toBeGreaterThan(0); // tracking
    expect(b.shieldFacing).toBeLessThan(T.civis.bulwarkTurnRateRadPerSec * 0.5 + 0.05); // capped
  });
});

describe('machine literal-mindedness quirks (§1.9)', () => {
  it('quirk 1: machines halt for traffic law; humans never do', () => {
    const h = hero({ x: 1, z: 0 });
    const w = world([h], { trafficHalt: true });
    const d = createEnemy('detainer', { x: 0, z: 0 });
    const events = run(d, w, 1);
    expect(events.some((e) => e.type === 'halted')).toBe(true);
    expect(events.some((e) => e.type === 'telegraph' || e.type === 'strike')).toBe(false);
    const g = createEnemy('grunt', { x: 0, z: 0 });
    const humanEvents = run(g, w, 1.2);
    expect(humanEvents.some((e) => e.type === 'telegraph')).toBe(true); // grunts don't care
    // light turns: machine resumes (run past the global crowd strike gap)
    w.trafficHalt = false;
    const resumed = run(d, w, T.tokens.globalStrikeGapSec + 2);
    expect(resumed.some((e) => e.type === 'telegraph')).toBe(true);
  });

  it('quirk 2: a spoof beacon walks the machine off the fight', () => {
    const h = hero({ x: 1, z: 0 });
    const w = world([h], { spoofBeaconActive: true });
    const b = createEnemy('bulwark', { x: 0, z: 0 });
    const x0 = b.fighter.pos.x;
    const events = run(b, w, 1);
    expect(events.some((e) => e.type === 'abandoned')).toBe(true);
    expect(b.fighter.pos.x).toBeGreaterThan(x0); // marching toward the exit, not the player
  });

  it('quirk 3: every machine telegraph announces itself; human telegraphs do not', () => {
    const h = hero({ x: 1, z: 0 });
    const wm = world([h]);
    const d = createEnemy('detainer', { x: 0.5, z: 0 });
    const machineTele = run(d, wm, 1).find((e) => e.type === 'telegraph');
    expect(machineTele && machineTele.type === 'telegraph' && machineTele.announce).toBeTruthy();
    const wh = world([hero({ x: 1, z: 0 })]);
    const g = createEnemy('grunt', { x: 0.5, z: 0 });
    const humanTele = run(g, wh, 1).find((e) => e.type === 'telegraph');
    expect(humanTele && humanTele.type === 'telegraph' && humanTele.announce).toBeNull();
  });

  it('quirk 4 corollary: Dread aura routs human grunts, never machines (§9.3)', () => {
    const h = hero({ x: 10, z: 0 });
    const w = world([h], { dreadAura: true });
    const g = createEnemy('grunt', { x: 0, z: 0 });
    const gruntEvents = run(g, w, 20, 0.02);
    expect(gruntEvents.some((e) => e.type === 'routed')).toBe(true);
    const s = createEnemy('swarm', { x: 0, z: 0 });
    const machineEvents = run(s, world([h], { dreadAura: true }), 20, 0.02);
    expect(machineEvents.some((e) => e.type === 'routed')).toBe(false);
  });
});

describe('scrap drops (§1.9)', () => {
  it('machines drop 2–5 scrap; Warden-hand 12–20 + 5 flux cells; humans none', () => {
    const rng = makeRng(9);
    for (let i = 0; i < 50; i++) {
      const d = rollScrap('detainer', rng);
      expect(d.scrap).toBeGreaterThanOrEqual(2);
      expect(d.scrap).toBeLessThanOrEqual(5);
      expect(d.fluxCells).toBe(0);
      const wd = rollScrap('wardenHand', rng);
      expect(wd.scrap).toBeGreaterThanOrEqual(12);
      expect(wd.scrap).toBeLessThanOrEqual(20);
      expect(wd.fluxCells).toBe(5);
    }
    expect(rollScrap('grunt', rng)).toEqual({ scrap: 0, fluxCells: 0 });
  });
});
