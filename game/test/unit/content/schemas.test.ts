// Red-team cross-checks for the content foundation.
// Sources of truth: docs/04 for kit facts, docs/02 for economy/tuning numbers,
// sim/clock.ts for phase bounds. If a test here fails, the DATA drifted from
// the docs — fix the JSON, not the test (or escalate per docs/08).

import { describe, expect, it } from 'vitest';
import { loadContent, SaveGameSchema, upgradeNodeCost, type SaveGame } from '../../../src/content';
import { PHASE_BOUNDS } from '../../../src/sim/clock';

const content = loadContent();
const { heroes, anchor, tuning, economy } = content;

const SLICE_SIX = ['august', 'camille', 'ingrid', 'maggie', 'marisol', 'theo'];

// docs/04 control-contract lines, verbatim mapping hero -> equipped default.
const EQUIPPED_DEFAULTS: Record<string, string> = {
  marisol: 'absorb_stance',
  august: 'feedback_lash',
  ingrid: 'draw',
  theo: 'needle',
  maggie: 'set',
  camille: 'glasswork',
};

describe('content loads and validates', () => {
  it('every JSON file parses through its schema without errors', () => {
    expect(() => loadContent()).not.toThrow();
  });

  it('ships exactly the 6 slice heroes (docs/02 §10 / docs/04 vertical-slice note)', () => {
    expect(heroes.map((h) => h.id).sort()).toEqual(SLICE_SIX);
    expect(heroes.every((h) => h.slice)).toBe(true);
  });

  it('ships the Anchor as a separate, non-roster character sheet', () => {
    expect(anchor.id).toBe('anchor');
    expect(heroes.some((h) => h.id === 'anchor')).toBe(false);
  });
});

describe('hero kit shape (docs/05 sketch + docs/04 control contract)', () => {
  it.each(SLICE_SIX)('%s has exactly 3 moves + 1 signature at full-meter cost', (id) => {
    const hero = heroes.find((h) => h.id === id)!;
    expect(hero.moves).toHaveLength(3);
    expect(hero.signature.powerCost).toBe(100); // docs/02 §1.3/§1.4
    expect(hero.signature.durationSec).toBeGreaterThan(0);
  });

  it.each(Object.entries(EQUIPPED_DEFAULTS))(
    '%s fields the docs/04 equipped default (%s)',
    (id, moveId) => {
      const hero = heroes.find((h) => h.id === id)!;
      expect(hero.equippedDefault).toBe(moveId);
      expect(hero.moves.map((m) => m.id)).toContain(moveId);
    },
  );

  it('every move declares a canonical Stance/Field/Strike class (docs/02 §1.8)', () => {
    for (const hero of heroes) {
      for (const move of [...hero.moves, hero.signature]) {
        expect(['stance', 'field', 'strike']).toContain(move.class);
      }
    }
  });
});

describe('upgrade trees (docs/02 §2.1)', () => {
  const everyone = [...heroes.map((h) => ({ id: h.id, tree: h.upgradeTree })), { id: 'anchor', tree: anchor.upgradeTree }];

  it.each(everyone.map((e) => [e.id, e] as const))('%s tree is 3 branches x 7 nodes', (_, e) => {
    expect(e.tree.branches).toHaveLength(3);
    for (const branch of e.tree.branches) expect(branch.nodes).toHaveLength(7);
  });

  it('every node cost matches cost(n) = round(base x 1.5^n), cash 100 / flux 7', () => {
    const { cashBase, fluxBase, growth } = tuning.progression.tree.costCurve;
    expect(cashBase).toBe(100);
    expect(fluxBase).toBe(7);
    expect(growth).toBe(1.5);
    for (const e of everyone) {
      for (const branch of e.tree.branches) {
        branch.nodes.forEach((node, n) => {
          expect(node.costCash, `${e.id}/${branch.id} node ${n}`).toBe(upgradeNodeCost(cashBase, n, growth));
          expect(node.costFlux, `${e.id}/${branch.id} node ${n}`).toBe(upgradeNodeCost(fluxBase, n, growth));
        });
      }
    }
  });

  it('branch totals land on the docs/02 §2.1 stated sums (~3,217 cash; node 7 = 1,139 + 80)', () => {
    const branch = heroes[0]!.upgradeTree.branches[0]!;
    const cashSum = branch.nodes.reduce((s, n) => s + n.costCash, 0);
    expect(cashSum).toBe(3217); // doc: "≈3,217 cash per branch"
    expect(branch.nodes[6]!.costCash).toBe(1139);
    expect(branch.nodes[6]!.costFlux).toBe(80);
    // FLAGGED docs-conflict note: per-node rounding sums flux to 226/branch
    // (678/tree) vs the doc prose's "≈225/≈676" (unrounded 224.7/674.2).
    const fluxSum = branch.nodes.reduce((s, n) => s + n.costFlux, 0);
    expect(fluxSum).toBe(226);
  });

  it('roster Signature-Evolution branches: 3 evolution nodes, poster at node 7, and the two locked core moves unlock here (docs/04 control contract)', () => {
    for (const hero of heroes) {
      const sig = hero.upgradeTree.branches[2]!;
      const evolutions = sig.nodes.filter((n) => n.evolution === true);
      expect(evolutions, hero.id).toHaveLength(3); // docs/02 §2.1
      expect(sig.nodes[6]!.evolution, `${hero.id} node 7 is the poster version`).toBe(true);
      const unlocked = sig.nodes.map((n) => n.unlocksMoveId).filter((x): x is string => x !== undefined);
      const lockedMoves = hero.moves.map((m) => m.id).filter((m) => m !== hero.equippedDefault);
      expect(unlocked.sort()).toEqual(lockedMoves.sort());
    }
  });
});

describe('no duplicate ids anywhere', () => {
  it('hero ids, move/signature ids, and node ids are globally unique', () => {
    const ids: string[] = [];
    for (const hero of heroes) {
      ids.push(hero.id);
      ids.push(...hero.moves.map((m) => m.id));
      ids.push(hero.signature.id);
      for (const b of hero.upgradeTree.branches) {
        ids.push(b.id, ...b.nodes.map((n) => n.id));
      }
    }
    ids.push(anchor.id, anchor.signature.id);
    for (const b of anchor.upgradeTree.branches) ids.push(b.id, ...b.nodes.map((n) => n.id));
    ids.push(...economy.crops.map((c) => c.id), ...economy.items.map((i) => i.id));
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});

describe('binding kit differentiation (docs/04 wins over docs/02 defaults)', () => {
  it("Ingrid's January: freeze, NO damage, breaks on hit, no knockdown (docs/04 §1.4)", () => {
    const january = heroes.find((h) => h.id === 'ingrid')!.signature;
    expect(january.damage).toBe(0);
    expect(january.knockdown).toBe(false);
    expect(january.effects?.['freeze']).toBe(true);
    expect(january.effects?.['freezeBreaksOnHit']).toBe(true);
  });

  it("Maggie's Topping Out: unconditional knockdown with the LONGEST windup in the game (docs/04 §1.6)", () => {
    const maggie = heroes.find((h) => h.id === 'maggie')!;
    const toppingOut = maggie.signature;
    expect(toppingOut.knockdown).toBe(true);
    expect(toppingOut.effects?.['unconditionalKnockdown']).toBe(true);
    const allOtherTelegraphs = [
      ...heroes.flatMap((h) => [...h.moves, ...(h.id === 'maggie' ? [] : [h.signature])]),
      ...heroes.filter((h) => h.id === 'maggie').flatMap((h) => h.moves),
      anchor.signature,
    ].map((m) => m.telegraphSec);
    for (const t of allOtherTelegraphs) expect(toppingOut.telegraphSec).toBeGreaterThan(t);
  });

  it("Camille's Anneal is the ONLY heal in the game, and it's a conversion (docs/04 design note)", () => {
    const healers = heroes.flatMap((h) =>
      [...h.moves, h.signature].filter((m) => m.tags.includes('heal-conversion')),
    );
    expect(healers.map((m) => m.id)).toEqual(['anneal']);
    expect(healers[0]!.effects?.['convertDamageToDelayedHealPct']).toBe(50);
    expect(healers[0]!.damage).toBe(0);
  });

  it('romance flags carry the slice spread (docs/04 §1): Ingrid oriented-away, Maggie friendship-only', () => {
    const byId = Object.fromEntries(heroes.map((h) => [h.id, h.romance]));
    expect(byId['marisol']!.style).toBe('exclusive-jealous');
    expect(byId['august']!.style).toBe('slow-burn');
    expect(byId['ingrid']!).toMatchObject({ open: false, orientation: 'women', style: 'oriented-exclusive' });
    expect(byId['theo']!.style).toBe('skittish-open');
    expect(byId['maggie']!).toMatchObject({ open: false, style: 'friendship-only' });
    expect(byId['camille']!).toMatchObject({ open: true, exclusive: false, style: 'non-exclusive-primacy' });
  });
});

describe('the Anchor (docs/02 §1.8 / docs/04 §1.0, canon)', () => {
  it('branches are Capacity / Echo Fidelity / Braids, in order', () => {
    expect(anchor.upgradeTree.branches.map((b) => b.id)).toEqual(['capacity', 'echo_fidelity', 'braids']);
  });

  it('Slot Zero is locked, lit, hosts nothing, reserves zero regen, unexplained (protected)', () => {
    expect(anchor.kit.slotZero).toEqual({
      locked: true,
      lit: true,
      hostsEchoes: false,
      reservesRegenPct: 0,
      uiExplains: false,
    });
  });

  it('slots read Slot Zero + 1 free at start -> + 3 free late (displays 2 -> 4)', () => {
    expect(anchor.kit.freeSlots).toEqual({ start: 1, late: 3 });
    expect(anchor.kit.displaySlots).toEqual({ start: 2, late: 4 });
  });

  it('Full Hands: 5s, full meter, drops free threads after', () => {
    expect(anchor.signature.id).toBe('full_hands');
    expect(anchor.signature.durationSec).toBe(5);
    expect(anchor.signature.powerCost).toBe(100);
    expect(anchor.signature.effects?.['dropsFreeThreadsAfter']).toBe(true);
  });

  it('tuning.anchor mirrors heroes/anchor.json kit exactly — no drift between files', () => {
    expect(tuning.anchor.freeSlotsStart).toBe(anchor.kit.freeSlots.start);
    expect(tuning.anchor.freeSlotsLate).toBe(anchor.kit.freeSlots.late);
    expect(tuning.anchor.displaySlotsStart).toBe(anchor.kit.displaySlots.start);
    expect(tuning.anchor.displaySlotsLate).toBe(anchor.kit.displaySlots.late);
    expect(tuning.anchor.reservationPctBase).toBe(anchor.kit.reservationPct.base);
    expect(tuning.anchor.reservationPctUpgraded).toBe(anchor.kit.reservationPct.upgraded);
    expect(tuning.anchor.slotZeroReservationPct).toBe(anchor.kit.slotZero.reservesRegenPct);
    expect(tuning.anchor.ignitionPowerCost).toBe(anchor.kit.ignitionPowerCost);
    expect(tuning.anchor.dropCost).toBe(anchor.kit.dropCost);
    expect(tuning.anchor.palette).toEqual(anchor.kit.palette);
    expect(tuning.anchor.fidelityPct).toEqual(anchor.kit.fidelityPct);
    expect(tuning.anchor.fullHands.durationSec).toBe(anchor.signature.durationSec);
    expect(tuning.anchor.fullHands.powerCost).toBe(anchor.signature.powerCost);
  });
});

describe('tuning.json vs the codebase and the docs/02 appendix', () => {
  it('phase bounds match sim/clock.ts PHASE_BOUNDS exactly', () => {
    expect(tuning.clock.phaseBounds).toEqual(PHASE_BOUNDS);
  });

  it('LATE ends 3a (forced sleep) and runs 4x slower in SOCIAL/ROMANCE venues', () => {
    expect(tuning.clock.phaseBounds.LATE.endMin).toBe(27 * 60); // 3:00a, wrapped
    expect(tuning.clock.hardSleepMin).toBe(3 * 60);
    expect(tuning.clock.lateVenueTimeScale).toBe(0.25); // 4x slower
    expect(tuning.clock.lateVenueTags.sort()).toEqual(['ROMANCE', 'SOCIAL']);
  });

  it('headline appendix numbers survive transcription', () => {
    expect(tuning.clock.dayRealMinutes).toBe(20);
    expect(tuning.combat.fightLengthTargetSec).toEqual([45, 90]);
    expect(tuning.combat.inputBufferMs).toBe(250);
    expect(tuning.combat.enemies.meleeAttackTokens).toBe(2);
    expect(tuning.combat.enemies.onScreenCap).toBe(6);
    expect(tuning.combat.enemies.gruntHitPctOfPlayerMaxHp).toBe(12);
    expect(tuning.combat.enemies.perTierScalingCap).toEqual({ hpPct: 15, damagePct: 20 });
    expect(tuning.machines.detainer.rescueTimerSec).toBe(20);
    expect(tuning.machines.scrapPerUnit).toEqual([2, 5]);
    expect(tuning.progression.repTierThresholds).toEqual([0, 500, 1500, 3500, 7000]);
    expect(tuning.zone.segments).toBe(6);
    expect(tuning.zone.mutation.cadenceDays).toBe(3);
    expect(tuning.zone.mutation.comedicDeckSize).toBe(12);
    expect(tuning.zone.reveal.stages).toBe(5);
    expect(tuning.zone.siege.sliceCount).toBe(2);
    expect(tuning.farm.fluxPlotCap).toBe(4);
    expect(tuning.farm.dailyUpkeepBudgetSec).toBe(60);
    expect(tuning.save.sizeBudgetMB).toBe(2);
  });

  it('PROTECTED: corridor fear gets no gossip juice multiplier', () => {
    expect(tuning.relationships.gossip.juiceMult.corridorFear).toBe(1);
  });
});

describe('economy.json vs docs/02', () => {
  it('room build/upgrade table matches §3.2', () => {
    const rooms = economy.sinks.rooms;
    expect(rooms.train_room.buildAndUpgradeCash).toEqual([800, 2000, 5000]);
    expect(rooms.flux_greenhouse.buildAndUpgradeCash).toEqual([1000, 2500, 6000]);
    expect(rooms.workshop.buildAndUpgradeCash).toEqual([600, 1800, 4500]);
    expect(rooms.workshop.transmuteMaterialsPerFlux).toBe(10);
    expect(rooms.lounge.buildAndUpgradeCash).toEqual([500, 1500, 4000]);
    expect(rooms.private_quarters.buildAndUpgradeCash).toEqual([700, 2000, null]); // Lv3 is story
  });

  it('flux crops are greenhouse-only, tiers grow 2/4/7 days and yield 8/20/45 (§4.2)', () => {
    const flux = economy.crops.filter((c) => c.lane === 'flux').sort((a, b) => a.tier! - b.tier!);
    expect(flux.map((c) => c.growDays)).toEqual([2, 4, 7]);
    expect(flux.map((c) => c.yieldAmount)).toEqual([8, 20, 45]);
    expect(flux.every((c) => c.site === 'greenhouse')).toBe(true);
    expect(flux.slice(1).every((c) => c.gate !== undefined)).toBe(true); // tier 2-3 gated
  });

  it('income table matches §2.3/§3.3/§6.2', () => {
    expect(economy.income.midGamePerRealHour).toEqual({ cash: 1500, flux: 60 });
    expect(economy.income.scrap.salePriceCash).toBe(5);
    expect(economy.income.business).toMatchObject({ cashPerInGameDay: 150, accrualCapDays: 2 });
    expect(economy.income.rep.bondMilestone).toBe(25);
    expect(economy.rules.priceModifierStacking).toBe('worst-single-wins');
    expect(economy.rules.premiumCurrency).toBe(false);
    expect(economy.rules.energySystem).toBe(false);
  });
});

describe('SaveGame v1 (docs/05 sketch; zone per docs/02 §8.1, ledger per §8.5)', () => {
  const minimalSave: SaveGame = {
    version: 1,
    clock: { day: 1, minuteOfDay: 360 },
    player: {
      cash: 0,
      flux: 0,
      materials: 0,
      scrap: 0,
      rep: 0,
      repTier: 1,
      needs: { energy: 100, social: 50, hunger: 60 },
    },
    anchor: { level: 1, xp: 0, unlockedNodeIds: [], attunedEchoMoveIds: [], litEchoMoveIds: [] },
    heroes: {
      marisol: {
        recruited: false,
        level: 1,
        xp: 0,
        bondFriendship: 0,
        bondRomance: 0,
        unlockedNodeIds: [],
        equippedMoveId: 'absorb_stance',
        attunementConsented: false,
      },
    },
    npcs: {
      moe: {
        opinion: { respect: 10, attraction: 0, fear: 0, trust: 5 },
        memories: [
          {
            type: 'witnessed_your_generosity',
            actors: ['player'],
            tick: 42,
            salience: 0.8,
            decayClass: 'very_slow',
            juiceClass: 'generosity',
          },
        ],
        friendship: 1,
        romance: 0,
      },
    },
    factions: { commons: { rep: 0 } },
    zone: {
      segments: Array.from({ length: 6 }, () => ({
        patrolDensity: 2,
        scannerCoveragePct: 80,
        checkpoint: 'active' as const,
      })),
      perimeterIntegrityPct: 100,
      holding: { occupancy: 0, namedNpcIds: [] },
      lastMutationDay: 0,
      mutationDeckIndex: 0,
    },
    story: { act: 1, revealStage: 0, revealLedger: {}, flags: {} },
    base: {
      roomSystemUnlocked: false,
      slots: [{ slotIndex: 0, level: 0 }],
      followerIds: [],
    },
    farm: { plots: [{ site: 'greenhouse', wateredToday: false }] },
    flags: {},
  };

  it('accepts a minimal new-game save', () => {
    expect(SaveGameSchema.safeParse(minimalSave).success).toBe(true);
  });

  it('rejects the wrong version (migrations are mandatory — CLAUDE.md)', () => {
    expect(SaveGameSchema.safeParse({ ...minimalSave, version: 2 }).success).toBe(false);
  });

  it('rejects a zone with the wrong segment count (docs/02 §8.1: six)', () => {
    const bad = { ...minimalSave, zone: { ...minimalSave.zone, segments: minimalSave.zone.segments.slice(0, 5) } };
    expect(SaveGameSchema.safeParse(bad).success).toBe(false);
  });

  it('reveal ledger takes verbs at 1/2/3/5 and an opening (not a verb) at stage 4 (docs/02 §8.5)', () => {
    const withLedger = {
      ...minimalSave,
      story: {
        act: 2,
        revealStage: 4,
        revealLedger: { stage1: 'face_it', stage2: 'bury_it', stage3: 'face_it', stage4Opening: 'the_rink' },
        flags: {},
      },
    };
    expect(SaveGameSchema.safeParse(withLedger).success).toBe(true);
    const badVerbAt4 = {
      ...withLedger,
      story: { ...withLedger.story, revealLedger: { ...withLedger.story.revealLedger, stage4Opening: 1 } },
    };
    expect(SaveGameSchema.safeParse(badVerbAt4).success).toBe(false);
  });
});
