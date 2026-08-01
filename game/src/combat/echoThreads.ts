// The Anchor's multithreading — docs/02 §1.8 (systems wrapper; what threads ARE
// is owned by docs/04 §1.0 / docs/09 §5). Pure TS, deterministic, no Babylon.
//
// Canon enforced here:
// - Slot Zero: permanently occupied, permanently lit, hosts nothing, unspendable,
//   never droppable, reserves ZERO stamina regen. The UI never explains it; this
//   module never lets anything touch it.
// - Free slots: 1 at start → 3 late (Capacity nodes 3 and 6). Displayed slots
//   read freeSlots + 1 (2 → 4).
// - Echoes are attunement echoes of bonded squadmates' moves (Stance/Field/Strike);
//   class permissions: Strike at start, Stance at Capacity node 2, Field at node 4.
// - Each running free thread reserves 25% of stamina regen (20% improved).
// - Ignite costs 20 power; drop is free and instant.
// - Fidelity = source hero's bond level through the curve 60/80/100% (bond 2 / 3–4 / 5),
//   Echo Fidelity nodes push toward the 120% cap.
// - Full Hands: 5s, every attuned echo at full fidelity, ignores slot count and
//   reservation; then every free thread drops. Costs the full 100 power.

import type { Fighter } from './fighter';
import { combatTuning as T } from './tuning';

export type EchoClass = 'Stance' | 'Field' | 'Strike';

/** An attuned echo — unlocked by the source hero's consent scene at bond 2 (§1.8). */
export interface EchoDef {
  id: string;
  sourceHeroId: string;
  sourceMoveId: string;
  cls: EchoClass;
}

/** Braid recipes are DATA rows keyed to source-move pairs (§1.8; naming/flavor owned by docs/04). */
export interface BraidRecipe {
  braidId: string;
  moveA: string; // sourceMoveId
  moveB: string; // sourceMoveId
}

export interface RunningThread {
  echoId: string;
  /** Braided composite occupies both member threads' slots (§1.8 Braids). */
  braidId: string | null;
  slots: 1 | 2;
}

export interface ThreadState {
  /** Capacity branch nodes taken (0–7). Gates slots, classes, reservation. */
  capacityNodes: number;
  /** Echo Fidelity branch nodes taken (0–7). */
  fidelityNodes: number;
  /** Braids branch nodes taken (0–7). Braiding requires ≥1 (resolved; §1.8 gives no explicit gate node). */
  braidNodes: number;
  attuned: EchoDef[];
  /** bond level per source hero id (0–5). Attunement itself implies ≥2. */
  bonds: Record<string, number>;
  running: RunningThread[];
  /** Slot Zero is represented, not modeled as a slot: it is always lit and never usable. */
  readonly slotZero: { lit: true; hosts: null };
  fullHandsTimer: number;
}

export type ThreadEvent =
  | { type: 'ignite'; echoId: string }
  | { type: 'drop'; echoId: string }
  | { type: 'braid'; braidId: string }
  | { type: 'full-hands-start' }
  | { type: 'full-hands-end'; dropped: string[] };

export function createThreadState(init?: Partial<Pick<ThreadState, 'capacityNodes' | 'fidelityNodes' | 'braidNodes'>>): ThreadState {
  return {
    capacityNodes: init?.capacityNodes ?? 0,
    fidelityNodes: init?.fidelityNodes ?? 0,
    braidNodes: init?.braidNodes ?? 0,
    attuned: [],
    bonds: {},
    running: [],
    slotZero: { lit: true, hosts: null },
    fullHandsTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// slots & permissions (§1.8 Capacity branch)

export function freeSlotCount(s: ThreadState): number {
  let slots = T.threads.freeSlotsStart;
  if (s.capacityNodes >= T.threads.capacityNodeForSlot2) slots += 1;
  if (s.capacityNodes >= T.threads.capacityNodeForSlot3) slots += 1;
  return Math.min(slots, T.threads.freeSlotsMax);
}

/** What the UI shows: Slot Zero + free slots (2 → 4, §1.8). */
export function displayedSlotCount(s: ThreadState): number {
  return freeSlotCount(s) + 1;
}

export function classUnlocked(s: ThreadState, cls: EchoClass): boolean {
  switch (cls) {
    case 'Strike':
      return true; // at start
    case 'Stance':
      return s.capacityNodes >= T.threads.stanceUnlockNode;
    case 'Field':
      return s.capacityNodes >= T.threads.fieldUnlockNode;
  }
}

export function usedSlots(s: ThreadState): number {
  return s.running.reduce((n, t) => n + t.slots, 0);
}

/** §1.8: per-free-thread stamina-regen reservation; Slot Zero reserves none. */
export function reservationPerThread(s: ThreadState): number {
  return s.capacityNodes >= T.threads.reservationImprovementNode
    ? T.threads.reservationImproved
    : T.threads.reservationPerThread;
}

/** Total regen fraction reserved right now. Full Hands ignores reservation (§1.8). */
export function totalReservation(s: ThreadState): number {
  if (s.fullHandsTimer > 0) return 0;
  return Math.min(1, usedSlots(s) * reservationPerThread(s));
}

// ---------------------------------------------------------------------------
// attunement & fidelity (§1.8 Echo Fidelity branch)

/** Attune an echo: the source hero consented at bond 2 (authored scene). */
export function attune(s: ThreadState, echo: EchoDef, bondLevel: number): boolean {
  if (bondLevel < 2) return false; // consent scene IS bond 2; no echo below it
  if (s.attuned.some((e) => e.id === echo.id)) return true;
  s.attuned.push(echo);
  s.bonds[echo.sourceHeroId] = bondLevel;
  return true;
}

export function setBond(s: ThreadState, heroId: string, bondLevel: number): void {
  s.bonds[heroId] = bondLevel;
}

/**
 * Echo strength (§1.8): 60% of the source move's numbers at bond 2, 80% at 3–4,
 * 100% at 5; Echo Fidelity nodes add +3%/node (resolved), hard-capped at 120%.
 * "Bond XP feeds combat twice" — this is the second spigot.
 */
export function echoFidelity(s: ThreadState, echoId: string): number {
  const echo = s.attuned.find((e) => e.id === echoId);
  if (!echo) return 0;
  const bond = s.bonds[echo.sourceHeroId] ?? 0;
  if (bond < 2) return 0;
  const curve = T.threads.fidelityByBond;
  const base = bond >= 5 ? curve[5] : bond >= 3 ? curve[3] : curve[2];
  return Math.min(T.threads.fidelityHardCap, base + s.fidelityNodes * T.threads.fidelityPerNode);
}

// ---------------------------------------------------------------------------
// ignite / drop / braid

export type IgniteFailure = 'unknown-echo' | 'class-locked' | 'no-free-slot' | 'not-enough-power' | 'already-running';

export function igniteEcho(s: ThreadState, anchor: Fighter, echoId: string): { ok: true; events: ThreadEvent[] } | { ok: false; why: IgniteFailure } {
  const echo = s.attuned.find((e) => e.id === echoId);
  if (!echo) return { ok: false, why: 'unknown-echo' };
  if (s.running.some((t) => t.echoId === echoId)) return { ok: false, why: 'already-running' };
  if (!classUnlocked(s, echo.cls)) return { ok: false, why: 'class-locked' };
  if (usedSlots(s) + 1 > freeSlotCount(s)) return { ok: false, why: 'no-free-slot' };
  if (anchor.power < T.threads.igniteCostPower) return { ok: false, why: 'not-enough-power' };
  anchor.power -= T.threads.igniteCostPower; // §1.8: thread uptime competes with his signature
  s.running.push({ echoId, braidId: null, slots: 1 });
  syncReservation(s, anchor);
  return { ok: true, events: [{ type: 'ignite', echoId }] };
}

/** Dropping is free and instant (§1.8). Slot Zero can never be dropped — it is not a running thread. */
export function dropEcho(s: ThreadState, anchor: Fighter, echoId: string): boolean {
  const idx = s.running.findIndex((t) => t.echoId === echoId || t.braidId === echoId);
  if (idx < 0) return false;
  s.running.splice(idx, 1);
  syncReservation(s, anchor);
  return true;
}

/**
 * Braid two RUNNING echoes into one composite occupying both slots (§1.8).
 * Recipes are data rows keyed to source-move pairs, order-insensitive.
 */
export function tryBraid(s: ThreadState, echoIdA: string, echoIdB: string, recipes: readonly BraidRecipe[]): { ok: boolean; braidId?: string } {
  if (s.braidNodes < 1) return { ok: false };
  const a = s.attuned.find((e) => e.id === echoIdA);
  const b = s.attuned.find((e) => e.id === echoIdB);
  if (!a || !b) return { ok: false };
  const runA = s.running.find((t) => t.echoId === echoIdA && t.braidId === null);
  const runB = s.running.find((t) => t.echoId === echoIdB && t.braidId === null);
  if (!runA || !runB) return { ok: false };
  const recipe = recipes.find(
    (r) =>
      (r.moveA === a.sourceMoveId && r.moveB === b.sourceMoveId) ||
      (r.moveA === b.sourceMoveId && r.moveB === a.sourceMoveId),
  );
  if (!recipe) return { ok: false };
  s.running = s.running.filter((t) => t !== runA && t !== runB);
  s.running.push({ echoId: recipe.braidId, braidId: recipe.braidId, slots: 2 });
  return { ok: true, braidId: recipe.braidId };
}

// ---------------------------------------------------------------------------
// Full Hands (§1.8 signature)

export function activateFullHands(s: ThreadState, anchor: Fighter): boolean {
  if (anchor.power < T.threads.fullHandsCost) return false; // full meter only
  anchor.power -= T.threads.fullHandsCost;
  s.fullHandsTimer = T.threads.fullHandsDurationSec;
  syncReservation(s, anchor);
  return true;
}

export function fullHandsActive(s: ThreadState): boolean {
  return s.fullHandsTimer > 0;
}

/** During Full Hands EVERY attuned echo runs at once at full fidelity (min 100%,
 *  or higher if Echo Fidelity nodes push past it), ignoring slots + reservation. */
export function activeEchoes(s: ThreadState): { echoId: string; fidelity: number }[] {
  if (fullHandsActive(s)) {
    return s.attuned.map((e) => ({ echoId: e.id, fidelity: Math.max(1, echoFidelity(s, e.id)) }));
  }
  return s.running.map((t) => ({ echoId: t.echoId, fidelity: t.braidId ? 1 : echoFidelity(s, t.echoId) }));
}

// ---------------------------------------------------------------------------
// per-frame update + AI policy

function syncReservation(s: ThreadState, anchor: Fighter): void {
  anchor.regenReservation = totalReservation(s);
}

/** Advance thread timers; call every frame with the Anchor's Fighter. */
export function updateThreads(s: ThreadState, anchor: Fighter, dt: number): ThreadEvent[] {
  const events: ThreadEvent[] = [];
  if (s.fullHandsTimer > 0) {
    s.fullHandsTimer -= dt;
    if (s.fullHandsTimer <= 0) {
      s.fullHandsTimer = 0;
      // "then every free thread drops" (§1.8)
      const dropped = s.running.map((t) => t.echoId);
      s.running = [];
      events.push({ type: 'full-hands-end', dropped });
    }
  }
  syncReservation(s, anchor);
  return events;
}

/**
 * §1.8 AI rules when a roster hero is controlled: the AI Anchor keeps echoes
 * running, never lights new ones, and when stamina-starved drops the
 * highest-reservation echo first (braids reserve 2 slots' worth, so they go first).
 */
export function aiMaintainThreads(s: ThreadState, anchor: Fighter): ThreadEvent[] {
  const events: ThreadEvent[] = [];
  if (fullHandsActive(s)) return events;
  if (anchor.stamina < T.threads.aiStarvedStaminaFrac && s.running.length > 0) {
    const highest = [...s.running].sort((x, y) => y.slots - x.slots)[0];
    if (highest) {
      dropEcho(s, anchor, highest.echoId);
      events.push({ type: 'drop', echoId: highest.echoId });
    }
  }
  syncReservation(s, anchor);
  return events;
}
