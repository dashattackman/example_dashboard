import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  command,
  createFighter,
  powerGainForHit,
  throwHeld,
  tryGrab,
  updateFighter,
  wallSplat,
  type Fighter,
  type FighterEvent,
  type SquadContext,
} from '../../../src/combat/fighter';
import { combatTuning as T } from '../../../src/combat/tuning';

function step(f: Fighter, seconds: number, dt = 0.02): FighterEvent[] {
  const events: FighterEvent[] = [];
  let t = 0;
  while (t < seconds - 1e-9) {
    events.push(...updateFighter(f, dt));
    t += dt;
  }
  return events;
}

function hero(id = 'hero'): Fighter {
  return createFighter({ id, team: 'squad' });
}

function enemy(id = 'foe', weight: 'light' | 'heavy' | 'unlaunchable' = 'light', armored = false): Fighter {
  return createFighter({ id, team: 'enemy', weightClass: weight, armored });
}

describe('fighter FSM — light chain (docs/02 §1.3)', () => {
  it('idle → attack, emits attack-active after startup', () => {
    const f = hero();
    command(f, { type: 'light' });
    expect(f.state).toBe('attack');
    expect(f.attackPhase).toBe('startup');
    const events = step(f, 0.1);
    const active = events.find((e) => e.type === 'attack-active');
    expect(active).toBeDefined();
    expect(active && active.type === 'attack-active' && active.chainIndex).toBe(0);
  });

  it('mashing light chains through all 3 hits; third hit knocks back', () => {
    const f = hero();
    const events: FighterEvent[] = [];
    for (let i = 0; i < 60; i++) {
      command(f, { type: 'light' });
      events.push(...updateFighter(f, 0.05));
    }
    const advances = events.filter((e) => e.type === 'chain-advance');
    expect(advances.some((e) => e.type === 'chain-advance' && e.chainIndex === 1)).toBe(true);
    expect(advances.some((e) => e.type === 'chain-advance' && e.chainIndex === 2)).toBe(true);
    const third = events.find((e) => e.type === 'attack-active' && e.chainIndex === 2);
    expect(third && third.type === 'attack-active' && third.knockback).toBe(true);
  });

  it('lights are FREE — no stamina cost (§1.4)', () => {
    const f = hero();
    command(f, { type: 'light' });
    step(f, 0.5);
    expect(f.stamina).toBe(1);
  });
});

describe('input buffer — 250ms (docs/02 §1.2)', () => {
  it('a tap during recovery queues the next chain hit', () => {
    const f = hero();
    command(f, { type: 'light' });
    step(f, 0.2); // into recovery (startup .08 + active .06 + some recovery)
    expect(f.attackPhase).toBe('recovery');
    command(f, { type: 'light' }); // buffered
    const events = step(f, 0.2);
    expect(events.some((e) => e.type === 'chain-advance')).toBe(true);
    expect(f.chainIndex).toBe(1);
  });

  it('a tap buffered more than 250ms before it could resolve expires', () => {
    const f = hero();
    command(f, { type: 'light' });
    command(f, { type: 'light' }); // buffered at t≈0; hit-1 resolves at ~0.32s
    const events = step(f, 0.4);
    expect(events.some((e) => e.type === 'buffer-expired')).toBe(true);
    expect(events.some((e) => e.type === 'chain-advance')).toBe(false);
    expect(f.state).toBe('idle');
  });

  it('dodge buffered during startup executes at the cancel window', () => {
    const f = hero();
    command(f, { type: 'light' });
    command(f, { type: 'dodge', dir: { x: 1, z: 0 } }); // startup: not yet cancellable
    expect(f.state).toBe('attack');
    step(f, 0.2);
    expect(f.state).toBe('dodge');
  });
});

describe('dodge — i-frames + stamina (docs/02 §1.4)', () => {
  it('costs 25% stamina and grants i-frames', () => {
    const f = hero();
    command(f, { type: 'dodge', dir: { x: 1, z: 0 } });
    expect(f.state).toBe('dodge');
    expect(f.stamina).toBeCloseTo(0.75, 5);
    const res = applyDamage(f, 50);
    expect(res.dealt).toBe(0); // i-frames
    expect(f.hp).toBe(f.maxHp);
  });

  it('fails without stamina — never a free defensive tool', () => {
    const f = hero();
    f.stamina = 0.1;
    command(f, { type: 'dodge', dir: { x: 1, z: 0 } });
    expect(f.state).toBe('idle');
    expect(f.stamina).toBeCloseTo(0.1, 5);
  });

  it('each hit cancels into dodge during recovery (§1.3)', () => {
    const f = hero();
    command(f, { type: 'light' });
    step(f, 0.16);
    expect(f.attackPhase).toBe('recovery');
    command(f, { type: 'dodge', dir: { x: 0, z: 1 } });
    expect(f.state).toBe('dodge'); // immediate cancel
  });
});

describe('stamina regen (docs/02 §1.4: 20%/s after 1s; hits lock 1.5s)', () => {
  it('waits 1s after spending, then regens 20%/s', () => {
    const f = hero();
    command(f, { type: 'dodge', dir: { x: 1, z: 0 } }); // 0.75 left
    step(f, 0.9);
    expect(f.stamina).toBeCloseTo(0.75, 2); // still inside the delay
    step(f, 1.0);
    expect(f.stamina).toBeGreaterThan(0.9); // ~0.75 + 0.2*0.9
  });

  it('getting hit interrupts regen for 1.5s', () => {
    const f = hero();
    f.stamina = 0.5;
    f.sinceStaminaSpend = 10;
    applyDamage(f, 5);
    expect(f.regenLock).toBeCloseTo(T.stamina.hitRegenLockSec, 5);
    step(f, 1.0);
    expect(f.stamina).toBeCloseTo(0.5, 2); // locked
    step(f, 1.0);
    expect(f.stamina).toBeGreaterThan(0.55); // lock expired at 1.5s
  });

  it('echo-thread reservation slows regen (§1.8: two threads = half speed)', () => {
    const f = hero();
    f.stamina = 0.4;
    f.sinceStaminaSpend = 10;
    f.regenReservation = 0.5;
    step(f, 1.0, 0.01);
    expect(f.stamina).toBeCloseTo(0.5, 2); // 0.2/s × 0.5 reservation
  });
});

describe('launcher & juggle rules (docs/02 §1.3)', () => {
  it('launches a grunt-weight enemy: 1.2s airtime, then down', () => {
    const e = enemy();
    const res = applyDamage(e, 18, { launcher: true });
    expect(res.events.some((ev) => ev.type === 'launched')).toBe(true);
    expect(e.state).toBe('launch');
    expect(e.airTimer).toBeCloseTo(T.launcher.juggleAirtimeSec, 5);
    step(e, 0.2);
    expect(e.state).toBe('juggle');
    step(e, 1.25);
    expect(e.state).toBe('down');
  });

  it('juggle hits deal +25% and do NOT extend the 1.2s window', () => {
    const e = enemy();
    applyDamage(e, 10, { launcher: true });
    step(e, 0.2);
    const air = e.airTimer;
    const res = applyDamage(e, 10);
    expect(res.wasJuggle).toBe(true);
    expect(res.dealt).toBeCloseTo(12.5, 5);
    expect(e.airTimer).toBeCloseTo(air, 5);
  });

  it('bruisers (heavy) need 2 launchers within 3s — one does nothing', () => {
    const e = enemy('bruiser', 'heavy', true);
    applyDamage(e, 18, { launcher: true });
    expect(e.state).toBe('idle'); // armored, no pop
    step(e, 1.0);
    const res = applyDamage(e, 18, { launcher: true });
    expect(res.events.some((ev) => ev.type === 'launched')).toBe(true); // heavy launch
  });

  it('two launchers spaced past the 3s window do not heavy-launch', () => {
    const e = enemy('bruiser', 'heavy', true);
    applyDamage(e, 18, { launcher: true });
    step(e, 3.2);
    const res = applyDamage(e, 18, { launcher: true });
    expect(res.events.some((ev) => ev.type === 'launched')).toBe(false);
  });

  it('leaders can never be launched, only staggered', () => {
    const e = enemy('leader', 'unlaunchable', true);
    for (let i = 0; i < 5; i++) {
      const res = applyDamage(e, 18, { launcher: true });
      expect(res.events.some((ev) => ev.type === 'launched')).toBe(false);
      expect(res.events.some((ev) => ev.type === 'staggered')).toBe(true);
      step(e, 0.1);
    }
  });

  it('armored enemies take damage from lights but never flinch (§1.5)', () => {
    const e = enemy('bruiser', 'heavy', true);
    const res = applyDamage(e, 10, { light: true });
    expect(res.dealt).toBe(10);
    expect(e.state).toBe('idle');
  });
});

describe('throws (docs/02 §1.3)', () => {
  it('grab requires a stunned target; throw costs 20% stamina and makes a projectile', () => {
    const a = hero();
    const e = enemy();
    expect(tryGrab(a, e)).toBe(false); // not stunned
    applyDamage(e, 5, { light: true }); // hit-stun
    expect(tryGrab(a, e)).toBe(true);
    expect(a.state).toBe('grab');
    expect(e.state).toBe('grab');
    const body = throwHeld(a, e, { x: 1, z: 0 });
    expect(body).not.toBeNull();
    expect(body?.impactMult).toBe(1.5);
    expect(body?.distanceM).toBe(4);
    expect(body?.knockdownRadiusM).toBe(1.5);
    expect(a.stamina).toBeCloseTo(0.8, 5);
    step(e, 0.5);
    expect(e.state).toBe('down'); // landed
  });

  it('wall splat stuns for 2s', () => {
    const e = enemy();
    wallSplat(e);
    expect(e.state).toBe('hit');
    expect(e.stunTimer).toBeCloseTo(2, 5);
  });

  it('power gain follows the §1.4 table: 1 light / 3 juggle / 4 throw impact', () => {
    const a = hero();
    expect(powerGainForHit(a, { light: true }, false)).toBe(1);
    expect(powerGainForHit(a, {}, true)).toBe(3);
    expect(powerGainForHit(a, { thrown: true }, false)).toBe(4);
    expect(a.power).toBe(8);
  });
});

describe('second wind — EXACT rule (docs/02 §1.4)', () => {
  function ctx(standing: number, used = false): SquadContext {
    return { secondWindUsed: used, standingCount: standing };
  }

  it('last standing hero survives a lethal hit at 1 HP with 2s invulnerability', () => {
    const f = hero();
    const squad = ctx(1);
    const res = applyDamage(f, 500, {}, squad);
    expect(res.events.some((e) => e.type === 'second-wind')).toBe(true);
    expect(f.hp).toBe(1);
    expect(f.alive).toBe(true);
    expect(f.iframeTimer).toBeCloseTo(2, 5);
    expect(squad.secondWindUsed).toBe(true);
  });

  it('does NOT trigger when another hero is standing', () => {
    const f = hero();
    const res = applyDamage(f, 500, {}, ctx(2));
    expect(res.events.some((e) => e.type === 'ko')).toBe(true);
    expect(f.alive).toBe(false);
  });

  it('only once per brawl — second lethal hit after invuln kills', () => {
    const f = hero();
    const squad = ctx(1);
    applyDamage(f, 500, {}, squad);
    step(f, 2.1); // invuln expires
    const res = applyDamage(f, 5, {}, { ...squad, standingCount: 1 });
    expect(res.events.some((e) => e.type === 'ko')).toBe(true);
  });

  it('boundary: dropping TO exactly 1 HP does not consume it; below 1 does', () => {
    const f = hero();
    f.hp = 10;
    const squad = ctx(1);
    applyDamage(f, 9, {}, squad); // 10-9 = 1, not < 1
    expect(squad.secondWindUsed).toBe(false);
    expect(f.hp).toBe(1);
    applyDamage(f, 0.5, {}, squad); // 1-0.5 < 1 → triggers
    expect(squad.secondWindUsed).toBe(true);
    expect(f.hp).toBe(1);
  });

  it('is invulnerability, not a heal — no HP restored, hits during it do nothing', () => {
    const f = hero();
    const squad = ctx(1);
    applyDamage(f, 500, {}, squad);
    const res = applyDamage(f, 500, {}, squad);
    expect(res.dealt).toBe(0);
    expect(f.hp).toBe(1);
  });
});
