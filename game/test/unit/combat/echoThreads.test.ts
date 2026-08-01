import { describe, expect, it } from 'vitest';
import {
  activateFullHands,
  activeEchoes,
  aiMaintainThreads,
  attune,
  classUnlocked,
  createThreadState,
  displayedSlotCount,
  dropEcho,
  echoFidelity,
  freeSlotCount,
  fullHandsActive,
  igniteEcho,
  reservationPerThread,
  setBond,
  totalReservation,
  tryBraid,
  updateThreads,
  type BraidRecipe,
  type EchoDef,
} from '../../../src/combat/echoThreads';
import { createFighter, updateFighter, type Fighter } from '../../../src/combat/fighter';

function anchor(power = 100): Fighter {
  const f = createFighter({ id: 'anchor', team: 'squad' });
  f.power = power;
  return f;
}

function echo(id: string, hero: string, move: string, cls: EchoDef['cls'] = 'Strike'): EchoDef {
  return { id, sourceHeroId: hero, sourceMoveId: move, cls };
}

describe('slots — Slot Zero + 1 free → 3 free (docs/02 §1.8)', () => {
  it('starts at 1 free slot, displayed as 2 (Slot Zero is always lit)', () => {
    const s = createThreadState();
    expect(freeSlotCount(s)).toBe(1);
    expect(displayedSlotCount(s)).toBe(2);
    expect(s.slotZero.lit).toBe(true);
    expect(s.slotZero.hosts).toBeNull();
  });

  it('Capacity nodes 3 and 6 add free slots (displays 3 → 4)', () => {
    expect(freeSlotCount(createThreadState({ capacityNodes: 3 }))).toBe(2);
    expect(freeSlotCount(createThreadState({ capacityNodes: 6 }))).toBe(3);
    expect(displayedSlotCount(createThreadState({ capacityNodes: 7 }))).toBe(4); // capped
  });

  it('class permissions: Strike at start, Stance at node 2, Field at node 4', () => {
    const s0 = createThreadState();
    expect(classUnlocked(s0, 'Strike')).toBe(true);
    expect(classUnlocked(s0, 'Stance')).toBe(false);
    expect(classUnlocked(s0, 'Field')).toBe(false);
    expect(classUnlocked(createThreadState({ capacityNodes: 2 }), 'Stance')).toBe(true);
    expect(classUnlocked(createThreadState({ capacityNodes: 3 }), 'Field')).toBe(false);
    expect(classUnlocked(createThreadState({ capacityNodes: 4 }), 'Field')).toBe(true);
  });

  it('Slot Zero reserves ZERO regen and can never be dropped', () => {
    const s = createThreadState();
    const a = anchor();
    expect(totalReservation(s)).toBe(0); // Slot Zero alone reserves nothing
    expect(dropEcho(s, a, 'slot-zero')).toBe(false);
  });
});

describe('ignite / drop economics (docs/02 §1.8)', () => {
  it('igniting costs 20 power; dropping is free', () => {
    const s = createThreadState();
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 2);
    const res = igniteEcho(s, a, 'e1');
    expect(res.ok).toBe(true);
    expect(a.power).toBe(80);
    expect(dropEcho(s, a, 'e1')).toBe(true);
    expect(a.power).toBe(80); // drop refunds nothing, costs nothing
    expect(a.regenReservation).toBe(0);
  });

  it('refuses without power, without a free slot, or for a locked class', () => {
    const s = createThreadState();
    const a = anchor(10);
    attune(s, echo('e1', 'vex', 'payback'), 2);
    attune(s, echo('e2', 'kit', 'blackIce', 'Field'), 3);
    expect(igniteEcho(s, a, 'e1')).toEqual({ ok: false, why: 'not-enough-power' });
    a.power = 100;
    expect(igniteEcho(s, a, 'e2')).toEqual({ ok: false, why: 'class-locked' });
    expect(igniteEcho(s, a, 'e1').ok).toBe(true);
    attune(s, echo('e3', 'mara', 'stoneskin'), 2);
    expect(igniteEcho(s, a, 'e3')).toEqual({ ok: false, why: 'no-free-slot' }); // 1 free slot at start
  });

  it('attunement requires the bond-2 consent scene', () => {
    const s = createThreadState();
    expect(attune(s, echo('e1', 'vex', 'payback'), 1)).toBe(false);
    expect(attune(s, echo('e1', 'vex', 'payback'), 2)).toBe(true);
  });
});

describe('stamina-regen reservation (docs/02 §1.8: 25%/thread → 20% improved)', () => {
  it('one thread reserves 25%, two reserve 50% — half-speed dodges', () => {
    const s = createThreadState({ capacityNodes: 3 }); // 2 free slots
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 2);
    attune(s, echo('e2', 'mara', 'stoneskin'), 2);
    igniteEcho(s, a, 'e1');
    expect(a.regenReservation).toBeCloseTo(0.25, 5);
    igniteEcho(s, a, 'e2');
    expect(a.regenReservation).toBeCloseTo(0.5, 5);
    // and the fighter actually regens at half rate
    a.stamina = 0.4;
    a.sinceStaminaSpend = 10;
    for (let i = 0; i < 100; i++) updateFighter(a, 0.01);
    expect(a.stamina).toBeCloseTo(0.5, 2); // 0.2/s × (1−0.5) × 1s
  });

  it('Capacity improves reservation to 20% per thread', () => {
    const s = createThreadState({ capacityNodes: 5 });
    expect(reservationPerThread(s)).toBeCloseTo(0.2, 5);
  });
});

describe('echo fidelity from bond level (docs/02 §1.8)', () => {
  it('60% at bond 2, 80% at 3–4, 100% at 5', () => {
    const s = createThreadState();
    attune(s, echo('e1', 'vex', 'payback'), 2);
    expect(echoFidelity(s, 'e1')).toBeCloseTo(0.6, 5);
    setBond(s, 'vex', 3);
    expect(echoFidelity(s, 'e1')).toBeCloseTo(0.8, 5);
    setBond(s, 'vex', 4);
    expect(echoFidelity(s, 'e1')).toBeCloseTo(0.8, 5);
    setBond(s, 'vex', 5);
    expect(echoFidelity(s, 'e1')).toBeCloseTo(1.0, 5);
  });

  it('Echo Fidelity nodes push past 100%, hard-capped at 120%', () => {
    const s = createThreadState({ fidelityNodes: 7 });
    attune(s, echo('e1', 'vex', 'payback'), 2);
    setBond(s, 'vex', 5);
    expect(echoFidelity(s, 'e1')).toBeCloseTo(1.2, 5); // "truer than the original"
    setBond(s, 'vex', 2); // nodes raise the floor too
    expect(echoFidelity(s, 'e1')).toBeCloseTo(0.81, 5);
  });

  it('unknown echoes and sub-consent bonds read zero', () => {
    const s = createThreadState();
    expect(echoFidelity(s, 'nope')).toBe(0);
  });
});

describe('braids (docs/02 §1.8: composite occupies both slots, recipes are data)', () => {
  const recipes: BraidRecipe[] = [{ braidId: 'ice-payback', moveA: 'blackIce', moveB: 'payback' }];

  function braidSetup() {
    const s = createThreadState({ capacityNodes: 6, braidNodes: 1 }); // 3 free slots, Field unlocked
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 3);
    attune(s, echo('e2', 'kit', 'blackIce', 'Field'), 3);
    igniteEcho(s, a, 'e1');
    igniteEcho(s, a, 'e2');
    return { s, a };
  }

  it('braids two running echoes into one 2-slot composite (order-insensitive)', () => {
    const { s, a } = braidSetup();
    const res = tryBraid(s, 'e2', 'e1', recipes); // reversed order vs recipe row
    expect(res.ok).toBe(true);
    expect(res.braidId).toBe('ice-payback');
    expect(s.running).toHaveLength(1);
    // both slots still reserve (capacity 6 ⇒ improved 20%/thread × 2 slots)
    expect(totalReservation(s)).toBeCloseTo(0.4, 5);
    void a;
  });

  it('refuses without a Braids node, a matching recipe, or both echoes running', () => {
    const s = createThreadState({ capacityNodes: 6, braidNodes: 0 });
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 3);
    attune(s, echo('e2', 'kit', 'blackIce', 'Field'), 3);
    igniteEcho(s, a, 'e1');
    igniteEcho(s, a, 'e2');
    expect(tryBraid(s, 'e1', 'e2', recipes).ok).toBe(false); // no node
    const { s: s2 } = braidSetup();
    expect(tryBraid(s2, 'e1', 'e2', []).ok).toBe(false); // no recipe
  });
});

describe('Full Hands (docs/02 §1.8 signature)', () => {
  function loaded() {
    const s = createThreadState({ capacityNodes: 6 });
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 2);
    attune(s, echo('e2', 'mara', 'stoneskin'), 3);
    attune(s, echo('e3', 'kit', 'blackIce', 'Field'), 5);
    igniteEcho(s, a, 'e1'); // one running thread, power → 80
    return { s, a };
  }

  it('requires the full 100-power meter', () => {
    const { s, a } = loaded();
    expect(activateFullHands(s, a)).toBe(false); // 80 power after ignite
    a.power = 100;
    expect(activateFullHands(s, a)).toBe(true);
    expect(a.power).toBe(0);
  });

  it('runs EVERY attuned echo at full fidelity, ignoring slots and reservation', () => {
    const { s, a } = loaded();
    a.power = 100;
    activateFullHands(s, a);
    expect(fullHandsActive(s)).toBe(true);
    const active = activeEchoes(s);
    expect(active).toHaveLength(3); // all attuned, not just the 1 running
    for (const e of active) expect(e.fidelity).toBeGreaterThanOrEqual(1); // full fidelity even at bond 2
    expect(totalReservation(s)).toBe(0); // reservation ignored
    expect(a.regenReservation).toBe(0);
  });

  it('after 5 seconds every free thread drops', () => {
    const { s, a } = loaded();
    a.power = 100;
    activateFullHands(s, a);
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...updateThreads(s, a, 0.1));
    const end = events.find((e) => e.type === 'full-hands-end');
    expect(end).toBeDefined();
    expect(end && end.type === 'full-hands-end' && end.dropped).toContain('e1');
    expect(s.running).toHaveLength(0);
    expect(fullHandsActive(s)).toBe(false);
  });
});

describe('AI Anchor thread policy (docs/02 §1.8)', () => {
  it('when stamina-starved drops the highest-reservation thread first (braids first)', () => {
    const s = createThreadState({ capacityNodes: 6, braidNodes: 1 });
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 3);
    attune(s, echo('e2', 'kit', 'blackIce', 'Field'), 3);
    attune(s, echo('e3', 'mara', 'stoneskin'), 3);
    igniteEcho(s, a, 'e1');
    igniteEcho(s, a, 'e2');
    igniteEcho(s, a, 'e3');
    tryBraid(s, 'e1', 'e2', [{ braidId: 'ice-payback', moveA: 'payback', moveB: 'blackIce' }]);
    a.stamina = 0.1; // starved
    const events = aiMaintainThreads(s, a);
    expect(events.some((e) => e.type === 'drop' && e.echoId === 'ice-payback')).toBe(true);
    expect(s.running.map((t) => t.echoId)).toEqual(['e3']); // the single survives
  });

  it('never drops when stamina is healthy', () => {
    const s = createThreadState();
    const a = anchor(100);
    attune(s, echo('e1', 'vex', 'payback'), 2);
    igniteEcho(s, a, 'e1');
    a.stamina = 0.9;
    aiMaintainThreads(s, a);
    expect(s.running).toHaveLength(1);
  });
});
