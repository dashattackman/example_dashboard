// content/schemas.ts — zod schemas for ALL content types.
// SINGLE SOURCE OF TRUTH (docs/05-architecture.md "Content schemas (sketch)"):
// the sketch in docs/05 §"Content schemas" is made real here; where a doc could be
// read two ways, docs/04 wins for kit facts and docs/02 wins for economy/tuning.
// Pure TS + zod only — no Babylon, no DOM (docs/05 module rule 1).

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Content id: lowercase snake-ish, stable, referenced across files. */
export const IdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'ids are lowercase alphanumeric + _ or -');

/** Day phases — docs/02 §4.1 uses docs/03's enum verbatim; sim/clock.ts implements. */
export const PhaseSchema = z.enum(['MORN', 'DAY', 'EVE', 'LATE']);
export type PhaseName = z.infer<typeof PhaseSchema>;

/** 100m world-grid cell (docs/05 §"World: single scene + streamed cells"). */
export const CellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const NonNeg = z.number().nonnegative();
const Pct0to100 = z.number().min(0).max(100);
/** Opinion axis range — docs/02 §5.1: −100..+100. */
const OpinionAxis = z.number().min(-100).max(100);
/** [min, max] tunable range pair. */
const Range2 = z.tuple([z.number(), z.number()]);

/** Parallel doc-citation key allowed in data files (task convention). */
const Comments = z.record(z.string());

// ---------------------------------------------------------------------------
// Move — docs/05 sketch `Move`, numbers frame per docs/02 §1.2–1.4.
// ---------------------------------------------------------------------------

/**
 * Canonical move classes — Stance / Field / Strike (docs/02 §1.8, docs/04 §1.0).
 * The Anchor's echo-class permissions key off these, so every roster move
 * MUST declare one.
 */
export const MoveClassSchema = z.enum(['stance', 'field', 'strike']);

/** Move tags per docs/02 §1.3 combo vocabulary ('launcher'|'aoe'|'projectile'|...). */
export const MoveTagSchema = z.enum([
  'launcher',
  'aoe',
  'projectile',
  'single-target',
  'dash',
  'buff',
  'debuff',
  'control',
  'shield',
  'taunt',
  'heal-conversion', // Camille's Anneal ONLY — docs/04 §1 design note: no healer role
  'freeze',
  'knockdown',
  'multi-hit',
  'ally-target',
  'push',
  'counter',
  'silence',
  'burn',
  'slow',
  'stagger',
  'zone',
]);

/**
 * Move — docs/05 sketch: { id, anim, damage, staminaCost, tags, fx, upgradesTo? }.
 * Damage unit convention (docs/02 §1.3): % of one light hit — light = 100,
 * signature default = 400. Power moves spend POWER (30 tap / 60 charged),
 * not stamina (docs/02 §1.4) — staminaCost stays for kit-priced exceptions.
 * telegraphSec: windup shown to enemies/allies; docs/02 §1.5's 0.6s floor is
 * an ENEMY rule — player moves may telegraph faster.
 */
export const MoveSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  class: MoveClassSchema,
  tags: z.array(MoveTagSchema).min(1),
  anim: z.string().min(1),
  description: z.string().min(1),
  damage: NonNeg, // % of one light hit (light = 100)
  staminaCost: NonNeg, // % of stamina bar (docs/02 §1.4)
  powerCost: NonNeg, // power meter points (docs/02 §1.4: move 30, charged 60)
  telegraphSec: NonNeg,
  supportsCharge: z.boolean(), // docs/02 §1.2 POWER-hold "if the equipped move supports it"
  fx: z.string().optional(), // FxRecipe id (engine-side lookup; data stays engine-free)
  effects: z.record(z.union([z.number(), z.boolean(), z.string()])).optional(),
  upgradesTo: IdSchema.optional(),
});
export type Move = z.infer<typeof MoveSchema>;

/**
 * Signature/finisher — docs/02 §1.3: exactly ONE per hero, full meter (100),
 * 2.5s canned move, default 400% of a light hit in 4m + guaranteed knockdown.
 * docs/04 kit facts override the default per hero (January: freeze, NO damage,
 * breaks on hit; Topping Out: unconditional knockdown, longest windup) — the
 * schema keeps those overridable, tests pin the binding deviations.
 */
export const SignatureSchema = MoveSchema.extend({
  powerCost: z.literal(100), // full meter, always (docs/02 §1.3/§1.4)
  durationSec: z.number().positive(),
  radiusM: z.number().positive().optional(),
  knockdown: z.boolean(),
});
export type SignatureMove = z.infer<typeof SignatureSchema>;

// ---------------------------------------------------------------------------
// Upgrade tree — docs/02 §2.1: 3 branches × 7 nodes, cost(n) = base × 1.5^n.
// ---------------------------------------------------------------------------

/**
 * Node costs are stored EXPLICITLY (content is data — CLAUDE.md), but must
 * equal round(base × 1.5^n) for n = 0..6 with cash base 100 / flux base 7
 * (docs/02 §2.1; curve params live in tuning.json progression.tree.costCurve).
 * Tests enforce the formula so data can never drift from the curve.
 */
export const UpgradeNodeSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  effect: z.string().min(1),
  costCash: z.number().int().positive(),
  costFlux: z.number().int().positive(),
  /** Signature-Evolution branches: 3 evolution nodes + 4 modifier nodes (docs/02 §2.1). */
  evolution: z.boolean().optional(),
  /** docs/04 control contract: core moves 2 & 3 unlock at Signature-Evolution nodes. */
  unlocksMoveId: IdSchema.optional(),
});
export type UpgradeNode = z.infer<typeof UpgradeNodeSchema>;

export const UpgradeBranchSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  theme: z.string().min(1),
  nodes: z.array(UpgradeNodeSchema).length(7), // docs/02 §2.1: 7 nodes per branch
});
export type UpgradeBranch = z.infer<typeof UpgradeBranchSchema>;

export const UpgradeTreeSchema = z.object({
  branches: z.array(UpgradeBranchSchema).length(3), // docs/02 §2.1: 3 branches
});
export type UpgradeTree = z.infer<typeof UpgradeTreeSchema>;

// ---------------------------------------------------------------------------
// Hero — docs/05 sketch `Hero`; kit facts owned by docs/04.
// ---------------------------------------------------------------------------

/** Romance flags — docs/04 §1 romance legend (fixed PC: every flag points at Eli). */
export const RomanceFlagsSchema = z.object({
  /** Romanceable by the player. Oriented-away and friendship-only ⇒ false. */
  open: z.boolean(),
  orientation: z.enum(['any', 'men', 'women', 'none']),
  /** Demands monogamy — the gossip system enforces it (docs/02 §5.5). */
  exclusive: z.boolean(),
  /** Slice romance-style spread label (docs/04 §1 vertical-slice note). */
  style: z.enum([
    'exclusive-jealous',
    'slow-burn',
    'oriented-exclusive',
    'skittish-open',
    'friendship-only',
    'non-exclusive-primacy',
    'non-exclusive-absolute',
    'exclusive',
    'demisexual-slow-burn',
    'jealous-in-denial',
  ]),
  notes: z.string().optional(),
});
export type RomanceFlags = z.infer<typeof RomanceFlagsSchema>;

export const PersonalitySchema = z.object({
  summary: z.string().min(1),
  traits: z.array(z.string().min(1)).min(1),
});

/**
 * Hero — docs/05 sketch: { id, name, alias, kit, moves: Move[3], signature,
 * upgradeTree, personality, scheduleId, recruitQuestId, arc }.
 * Control contract (docs/04 §1, binding): ONE equipped core move by default
 * (equippedDefault), the other two unlock at Signature-Evolution nodes.
 */
export const HeroSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    alias: z.string().min(1),
    age: z.number().int().min(21), // tone bible hard line: adults only
    slice: z.boolean(), // docs/02 §10: 6 of 10 heroes ship in-slice
    role: z.string().min(1), // slice role spread (docs/04 §1)
    kit: z.object({
      name: z.string().min(1),
      description: z.string().min(1),
    }),
    moves: z.array(MoveSchema).length(3), // docs/05 sketch: Move[3]
    signature: SignatureSchema, // exactly ONE signature/finisher (docs/02 §1.3)
    equippedDefault: IdSchema, // docs/04 control contract line, per hero
    upgradeTree: UpgradeTreeSchema,
    personality: PersonalitySchema,
    romance: RomanceFlagsSchema,
    recruitHook: z.string().min(1), // docs/04 "Recruitment" per hero
    /** Binding differentiation rules quoted from docs/04 (red-team checklist). */
    differentiation: z.array(z.string().min(1)).optional(),
    scheduleId: IdSchema.optional(),
    recruitQuestId: IdSchema.optional(),
  })
  .superRefine((hero, ctx) => {
    const ids = hero.moves.map((m) => m.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate move ids', path: ['moves'] });
    }
    if (!ids.includes(hero.equippedDefault)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `equippedDefault "${hero.equippedDefault}" is not one of this hero's moves`,
        path: ['equippedDefault'],
      });
    }
    if (ids.includes(hero.signature.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'signature id collides with a core move id',
        path: ['signature', 'id'],
      });
    }
  });
export type Hero = z.infer<typeof HeroSchema>;

// ---------------------------------------------------------------------------
// The Anchor — docs/02 §1.8 (systems wrapper) + docs/04 §1.0 (canon).
// His kit is echo-threads, not an innate move list; his "tree" keeps the
// 21-node/cost-curve chassis with branches Capacity / Echo Fidelity / Braids.
// Binding numbers are LITERALS — the schema itself is the canon check.
// ---------------------------------------------------------------------------

export const AnchorKitSchema = z.object({
  type: z.literal('multithread'),
  /** Slot Zero — docs/04 §1.0 binding: permanently occupied, permanently lit,
   *  hosts nothing, reserves ZERO regen, never explained by UI (docs/02 §1.8). */
  slotZero: z.object({
    locked: z.literal(true),
    lit: z.literal(true),
    hostsEchoes: z.literal(false),
    reservesRegenPct: z.literal(0),
    uiExplains: z.literal(false),
  }),
  /** Slot Zero + 1 free at start → Slot Zero + 3 free late (displays 2 → 4). */
  freeSlots: z.object({ start: z.literal(1), late: z.literal(3) }),
  displaySlots: z.object({ start: z.literal(2), late: z.literal(4) }),
  /** Each running FREE thread reserves stamina regen: 25% → 20% via Capacity. */
  reservationPct: z.object({ base: z.literal(25), upgraded: z.literal(20) }),
  ignitionPowerCost: z.literal(20), // docs/02 §1.8: igniting costs 20 power
  dropCost: z.literal(0), // dropping is free and instant
  /** Thread palette: POWER-hold ≥300ms, 0.3× time, max 4s (docs/02 §1.8). */
  palette: z.object({
    holdMs: z.literal(300),
    timeScale: z.literal(0.3),
    maxSec: z.literal(4),
  }),
  /** Class permissions by Capacity node index (1-based): Strike at start (0),
   *  Stance at node 2, Field at node 4 (docs/02 §1.8 Capacity branch). */
  echoClassUnlockNode: z.object({
    strike: z.literal(0),
    stance: z.literal(2),
    field: z.literal(4),
  }),
  /** Echo fidelity = source hero's bond level through the curve:
   *  60/80/100% at bond 2 / 3–4 / 5; tree pushes cap to 120% (docs/02 §1.8). */
  fidelityPct: z.object({
    bond2: z.literal(60),
    bond3to4: z.literal(80),
    bond5: z.literal(100),
    cap: z.literal(120),
  }),
});

export const AnchorSchema = z
  .object({
    id: z.literal('anchor'),
    name: z.string().min(1),
    alias: z.string().min(1),
    age: z.number().int().min(21),
    slice: z.literal(true), // the PC is always fielded (docs/02 §1.1)
    role: z.string().min(1),
    kit: AnchorKitSchema,
    /** "Full Hands" — 5s, every attuned echo at full fidelity, then free
     *  threads drop; standard 100-power cost (docs/02 §1.8, canon name). */
    signature: SignatureSchema,
    upgradeTree: UpgradeTreeSchema,
    personality: PersonalitySchema,
    /** No innate moves and no romance flags: he's the player — every flag in
     *  docs/04 points AT him. */
    aiRules: z.array(z.string().min(1)), // docs/02 §1.8 AI-Anchor rules
  })
  .superRefine((anchor, ctx) => {
    const branchIds = anchor.upgradeTree.branches.map((b) => b.id);
    const expected = ['capacity', 'echo_fidelity', 'braids']; // docs/02 §1.8 branch table
    if (JSON.stringify(branchIds) !== JSON.stringify(expected)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Anchor branches must be ${expected.join('/')} in order (docs/02 §1.8), got ${branchIds.join('/')}`,
        path: ['upgradeTree', 'branches'],
      });
    }
    if (anchor.signature.durationSec !== 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Full Hands runs 5 seconds (docs/02 §1.8 / appendix)',
        path: ['signature', 'durationSec'],
      });
    }
  });
export type Anchor = z.infer<typeof AnchorSchema>;

// ---------------------------------------------------------------------------
// NPC — docs/05 sketch `Npc`; tiers per docs/05 §"NPC sim"; dials docs/04 §4.
// ---------------------------------------------------------------------------

/** Schedule waypoint: where they are during a phase (docs/05 sim/npc.ts). */
export const WaypointSchema = z
  .object({
    phase: PhaseSchema,
    venueId: IdSchema.optional(),
    cell: CellSchema.optional(),
    activity: z.string().optional(),
  })
  .refine((w) => w.venueId !== undefined || w.cell !== undefined, {
    message: 'waypoint needs a venueId or a cell',
  });
export type Waypoint = z.infer<typeof WaypointSchema>;

/** Personality dials 0–100 — docs/04 §4 (WARMTH/BOLDNESS/CHATTINESS/MISCHIEF). */
export const DialsSchema = z.object({
  warmth: Pct0to100,
  boldness: Pct0to100,
  chattiness: Pct0to100,
  mischief: Pct0to100,
});

export const NpcSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    /** Tier 1 = named/full sim (~40 in slice); Tier 2 = ambient archetype (docs/05). */
    tier: z.union([z.literal(1), z.literal(2)]),
    archetypeId: IdSchema.optional(),
    age: z.number().int().min(21), // docs/04 §4 tone hardening: 21+ floor, binding
    dials: DialsSchema,
    schedule: z.array(WaypointSchema),
    factionId: IdSchema.optional(),
    romanceable: z.boolean(),
    home: IdSchema, // VenueId
  })
  .superRefine((npc, ctx) => {
    if (npc.tier === 2 && npc.archetypeId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tier-2 (ambient) NPCs are archetype-built (docs/04 §4)',
        path: ['archetypeId'],
      });
    }
  });
export type Npc = z.infer<typeof NpcSchema>;

// ---------------------------------------------------------------------------
// Venue — docs/05 sketch `Venue`; hours by phase per docs/02 §4.1.
// ---------------------------------------------------------------------------

export const VenueKindSchema = z.enum([
  'bar',
  'club',
  'diner',
  'restaurant',
  'shop',
  'market',
  'coop',
  'gym',
  'arena',
  'studio',
  'barbershop',
  'records',
  'music-venue',
  'home',
  'warehouse',
  'park',
  'beach',
  'other',
]);

export const PropPlacementSchema = z.object({
  propId: IdSchema,
  x: z.number(),
  y: z.number(),
  rotDeg: z.number().optional(),
});

export const VenueSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  kind: VenueKindSchema,
  cell: CellSchema,
  /** Open flags per phase — docs/02 §4.1: "co-op grocery in MORN, gym in DAY,
   *  restaurants in EVE, clubs LATE-only". */
  hours: z.object({
    MORN: z.boolean(),
    DAY: z.boolean(),
    EVE: z.boolean(),
    LATE: z.boolean(),
  }),
  /** SOCIAL/ROMANCE tags drive the LATE 4× clock dilation (docs/02 §4.1). */
  tags: z.array(z.enum(['SOCIAL', 'ROMANCE'])).optional(),
  /** Interior shell vs full interior — docs/03 §2 arithmetic (20 full in-slice). */
  fullInterior: z.boolean(),
  layoutRecipe: IdSchema.optional(), // InteriorRecipe id (docs/05 sketch)
  props: z.array(PropPlacementSchema),
  staff: z.array(IdSchema), // NpcIds
  factionId: IdSchema.optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

// ---------------------------------------------------------------------------
// Items & crops — docs/02 §2.4 (currencies), §3.3 (loops), §4.2 (farming).
// ---------------------------------------------------------------------------

export const ItemKindSchema = z.enum([
  'gift',
  'consumable',
  'dish', // cooked — docs/02 §4.2: buffs + date gifts (3× store-gift bond XP)
  'gear_mod', // workshop crafts, incl. bot-tech lane (docs/02 §3.2/§3.3)
  'material',
  'seed',
  'cosmetic',
]);

export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  kind: ItemKindSchema,
  priceCash: NonNeg,
  description: z.string().optional(),
  /** Crafted in the workshop scrap lane (docs/02 §3.3) rather than bought. */
  craftedWithScrap: z.number().int().nonnegative().optional(),
  effects: z.record(z.union([z.number(), z.boolean(), z.string()])).optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const CropSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    /** flux crops: greenhouse-only, 3 tiers (docs/02 §4.2); produce: both sites. */
    lane: z.enum(['flux', 'produce']),
    tier: z.number().int().min(1).max(3).optional(),
    site: z.enum(['greenhouse', 'garden', 'both']),
    growDays: z.number().int().positive(), // in-game days, advanced on sleep tick
    yieldAmount: z.number().int().positive(), // flux points or produce units
    seedCostCash: NonNeg,
    sellPriceCash: NonNeg.optional(),
    /** tier 2–3 flux seeds are rep/story gated (docs/02 §4.2). */
    gate: z.string().optional(),
  })
  .superRefine((crop, ctx) => {
    if (crop.lane === 'flux') {
      if (crop.tier === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'flux crops carry a tier (docs/02 §4.2)', path: ['tier'] });
      }
      if (crop.site !== 'greenhouse') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'flux crops are greenhouse-only (docs/02 §4.2)', path: ['site'] });
      }
    }
  });
export type Crop = z.infer<typeof CropSchema>;

// ---------------------------------------------------------------------------
// Memory & opinion — docs/05 sketch `MemoryEvent`/`Opinion`;
// tag registry + decay/juice classes per docs/04 §5–6, math owned by docs/02 §5.5.
// ---------------------------------------------------------------------------

export const OpinionSchema = z.object({
  respect: OpinionAxis,
  attraction: OpinionAxis,
  fear: OpinionAxis,
  trust: OpinionAxis,
});
export type Opinion = z.infer<typeof OpinionSchema>;

/** Decay classes from the docs/04 §5 memory-tag registry column. */
export const DecayClassSchema = z.enum(['fast', 'medium', 'slow', 'very_slow', 'seasonal', 'never']);

/** Juice classes: docs/04 §6 spread ranks + grief/context handling (docs/04 §6
 *  chain 7 — corridor fear gets NO juice multiplier; protected element). */
export const JuiceClassSchema = z.enum([
  'romance',
  'fight',
  'betrayal',
  'generosity',
  'weirdness',
  'grief',
  'context',
]);

export const MemoryEventSchema = z.object({
  /** Tag from the docs/04 §5 registry (e.g. 'you_saved_their_shop'). */
  type: z.string().min(1),
  actors: z.array(IdSchema).min(1),
  venueId: IdSchema.optional(),
  tick: z.number().int().nonnegative(),
  salience: z.number().min(0).max(1),
  decayClass: DecayClassSchema,
  juiceClass: JuiceClassSchema,
  /** Gossip fidelity 0..1 (docs/04 §6); inferred-provenance items are capped. */
  fidelity: z.number().min(0).max(1).optional(),
  provenance: z.enum(['witnessed', 'inferred', 'broadcast']).optional(),
});
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

// ---------------------------------------------------------------------------
// SaveGame v1 — docs/05 sketch `SaveGame` + §"Save/versioning";
// zone state per docs/02 §8.1; story/reveal ledger per docs/02 §8.5/§9.2.
// Any schema change here ships with a migration (CLAUDE.md, non-negotiable).
// ---------------------------------------------------------------------------

export const RevealVerbSchema = z.enum(['face_it', 'bury_it']);

/** Zone segment state — docs/02 §8.1 table (6 segments in the slice). */
export const ZoneSegmentSchema = z.object({
  patrolDensity: z.number().int().min(0).max(3),
  scannerCoveragePct: Pct0to100,
  checkpoint: z.enum(['active', 'disabled']),
});

export const ZoneStateSchema = z.object({
  segments: z.array(ZoneSegmentSchema).length(6), // docs/02 §8.1: 6 map segments
  perimeterIntegrityPct: Pct0to100,
  holding: z.object({
    occupancy: z.number().int().nonnegative(),
    /** Named NPCs listed first, by name — docs/02 §8.1. */
    namedNpcIds: z.array(IdSchema),
  }),
  /** In-game day of the last firmware mutation tick (docs/02 §8.3). */
  lastMutationDay: z.number().int().nonnegative(),
  mutationDeckIndex: z.number().int().nonnegative(),
});

/** Reveal ledger — docs/02 §8.5: verbs at Stages 1/2/3/5; Stage 4 records the
 *  chosen opening, not a verb (it has no bury-it — docs/09 §5). */
export const RevealLedgerSchema = z.object({
  stage1: RevealVerbSchema.optional(),
  stage2: RevealVerbSchema.optional(),
  stage3: RevealVerbSchema.optional(),
  stage4Opening: z.string().optional(),
  stage5: RevealVerbSchema.optional(),
});

export const StoryStateSchema = z.object({
  act: z.number().int().min(1).max(3),
  revealStage: z.number().int().min(0).max(5), // 0 = nothing surfaced yet
  revealLedger: RevealLedgerSchema,
  flags: z.record(z.boolean()),
});

const BondLevel = z.number().int().min(0).max(5); // docs/02 §5.2: tracks 0–5
const HeroLevel = z.number().int().min(1).max(30); // docs/02 §2.2: levels 1–30

export const HeroSaveSchema = z.object({
  recruited: z.boolean(),
  level: HeroLevel,
  xp: NonNeg,
  bondFriendship: BondLevel,
  bondRomance: BondLevel,
  unlockedNodeIds: z.array(IdSchema),
  equippedMoveId: IdSchema.optional(),
  /** Attunement consent scene fired at bond 2 (docs/02 §1.8). */
  attunementConsented: z.boolean(),
});

export const RoomTypeSchema = z.enum([
  'train_room',
  'flux_greenhouse',
  'workshop',
  'lounge',
  'private_quarters',
]); // docs/02 §3.2 room table

export const SaveGameSchema = z.object({
  version: z.literal(1),
  clock: z.object({
    day: z.number().int().min(1),
    minuteOfDay: z.number().int().min(0).max(1439),
  }),
  player: z.object({
    cash: NonNeg,
    flux: NonNeg,
    materials: NonNeg,
    scrap: NonNeg,
    rep: NonNeg,
    repTier: z.number().int().min(1).max(5), // docs/02 §2.3: 1-indexed, tier 1 = 0 rep
    needs: z.object({ energy: Pct0to100, social: Pct0to100, hunger: Pct0to100 }),
  }),
  anchor: z.object({
    level: HeroLevel,
    xp: NonNeg,
    unlockedNodeIds: z.array(IdSchema),
    /** Move ids of attuned echoes (source heroes' core moves). */
    attunedEchoMoveIds: z.array(IdSchema),
    litEchoMoveIds: z.array(IdSchema),
  }),
  heroes: z.record(IdSchema, HeroSaveSchema),
  npcs: z.record(
    IdSchema,
    z.object({
      opinion: OpinionSchema,
      memories: z.array(MemoryEventSchema),
      friendship: BondLevel,
      romance: BondLevel,
      promoted: z.boolean().optional(),
    }),
  ),
  factions: z.record(IdSchema, z.object({ rep: z.number() })),
  zone: ZoneStateSchema,
  story: StoryStateSchema,
  base: z.object({
    roomSystemUnlocked: z.boolean(), // ~30-min story beat (docs/02 §3.1)
    slots: z
      .array(
        z.object({
          slotIndex: z.number().int().min(0).max(7), // 8 fixed slots (docs/02 §3.1)
          roomType: RoomTypeSchema.optional(),
          level: z.number().int().min(0).max(3),
          staffedByFollowerId: IdSchema.optional(),
        }),
      )
      .max(8),
    followerIds: z.array(IdSchema).max(8), // slice follower cap (docs/02 §3.4)
  }),
  farm: z.object({
    plots: z.array(
      z.object({
        site: z.enum(['greenhouse', 'garden']),
        cropId: IdSchema.optional(),
        plantedOnDay: z.number().int().min(1).optional(),
        wateredToday: z.boolean(),
      }),
    ),
  }),
  flags: z.record(z.union([z.boolean(), z.number(), z.string()])),
});
export type SaveGame = z.infer<typeof SaveGameSchema>;

// ---------------------------------------------------------------------------
// Tuning — every content-shaped number from docs/02's tuning appendix.
// tuning.json is validated against this; _comments carries doc citations.
// ---------------------------------------------------------------------------

export const TuningSchema = z.object({
  _comments: Comments.optional(),
  clock: z.object({
    dayRealMinutes: z.number().positive(), // docs/02 §4.1: 20
    hourRealSeconds: z.number().positive(), // docs/02 §4.1: 50
    /** Must mirror sim/clock.ts PHASE_BOUNDS exactly (tested). */
    phaseBounds: z.object({
      MORN: z.object({ startMin: z.number(), endMin: z.number() }),
      DAY: z.object({ startMin: z.number(), endMin: z.number() }),
      EVE: z.object({ startMin: z.number(), endMin: z.number() }),
      LATE: z.object({ startMin: z.number(), endMin: z.number() }), // ends 3a (1620, wraps)
    }),
    hardSleepMin: z.number(), // 3:00a = 180
    wakeMin: z.number(), // 6:00a = 360
    /** LATE runs 4× slower inside SOCIAL/ROMANCE venues ⇒ timeScale 0.25. */
    lateVenueTimeScale: z.number().positive().max(1),
    lateVenueTags: z.array(z.enum(['SOCIAL', 'ROMANCE'])),
  }),
  combat: z.object({
    fightLengthTargetSec: Range2,
    bossFightHardCapSec: z.number(),
    inputBufferMs: z.number(),
    joystickDeadZonePct: z.number(),
    holdThresholdMs: z.number(),
    autoFacing: z.object({ coneDeg: z.number(), snapRangeM: z.number() }),
    lightHitDamage: z.number(), // damage unit anchor: light = 100
    lightChainHits: z.number(),
    launcher: z.object({
      popHeightM: z.number(),
      juggleAirtimeSec: z.number(),
      bruiserLaunchersNeeded: z.number(),
      bruiserLaunchWindowSec: z.number(),
    }),
    juggle: z.object({ damageBonusPct: z.number(), powerMeterMult: z.number() }),
    throw: z.object({
      distanceM: z.number(),
      impactDamageMult: z.number(),
      knockdownRadiusM: z.number(),
      wallSplatStunSec: z.number(),
    }),
    environmental: z.object({ propsPerArena: Range2, materialDropBonusPct: z.number() }),
    signature: z.object({
      durationSec: z.number(),
      damagePctOfLight: z.number(),
      radiusM: z.number(),
      timeDilation: z.object({ scale: z.number(), sec: z.number() }),
      assistRangeM: z.number(),
    }),
    stamina: z.object({
      regenPctPerSec: z.number(),
      regenDelaySec: z.number(),
      hitInterruptSec: z.number(),
      dodgeCostPct: z.number(),
      throwCostPct: z.number(),
      heavyCostPct: z.number(),
    }),
    power: z.object({
      perLightHit: z.number(),
      perJuggleHit: z.number(),
      perThrowImpact: z.number(),
      perHpLostPoint: z.number(),
      moveCost: z.number(),
      chargedCost: z.number(),
      signatureCost: z.number(),
      betweenFightDecayPct: z.number(),
      benchedGainPct: z.number(),
    }),
    secondWind: z.object({
      surviveAtHp: z.number(),
      invulnSec: z.number(),
      perBrawl: z.number(),
      lastStandingOnly: z.boolean(),
    }),
    enemies: z.object({
      hpMult: z.object({
        grunt: z.number(),
        bruiser: z.number(),
        ranged: z.number(),
        leaderMin: z.number(),
        leaderMax: z.number(),
      }),
      meleeAttackTokens: z.number(),
      rangedKeepDistanceM: z.number(),
      rangedShotTelegraphSec: z.number(),
      leaderWhiffVulnPct: z.number(),
      leaderWhiffVulnSec: z.number(),
      telegraphMinSecOver10PctHp: z.number(),
      crowdTotal: Range2,
      onScreenCap: z.number(),
      waves: Range2,
      nextWaveAtRemaining: z.number(),
      gruntHitPctOfPlayerMaxHp: z.number(),
      perTierScalingCap: z.object({ hpPct: z.number(), damagePct: z.number() }),
    }),
    splashRating: z.object({ multMin: z.number(), multMax: z.number() }),
    rubberBand: z.object({
      wipesToTrigger: z.number(),
      removeBruisers: z.number(),
      dropFoodPickup: z.boolean(),
    }),
  }),
  machines: z.object({
    hpMult: z.object({
      scanner: z.number(),
      detainer: z.number(),
      bulwark: z.number(),
      swarmDrone: z.number(),
      wardenHand: z.number(),
    }),
    flaggedTargetBonusDamagePct: z.number(),
    detainer: z.object({ rescueTimerSec: z.number(), carrySlowPct: z.number() }),
    swarmGroupSize: Range2,
    scrapPerUnit: Range2,
    wardenHandDrops: z.object({
      fluxContainmentCells: z.number(),
      scrap: Range2,
      capPerMission: z.number(),
    }),
    demolitionRating: z.object({ multMin: z.number(), multMax: z.number() }),
    fearImmune: z.boolean(), // docs/02 §1.9 quirk 4
  }),
  /** Anchor knobs from the appendix — MUST equal heroes/anchor.json kit (tested). */
  anchor: z.object({
    freeSlotsStart: z.number(),
    freeSlotsLate: z.number(),
    displaySlotsStart: z.number(),
    displaySlotsLate: z.number(),
    reservationPctBase: z.number(),
    reservationPctUpgraded: z.number(),
    slotZeroReservationPct: z.number(),
    ignitionPowerCost: z.number(),
    dropCost: z.number(),
    palette: z.object({ holdMs: z.number(), timeScale: z.number(), maxSec: z.number() }),
    fidelityPct: z.object({
      bond2: z.number(),
      bond3to4: z.number(),
      bond5: z.number(),
      cap: z.number(),
    }),
    fullHands: z.object({ durationSec: z.number(), powerCost: z.number() }),
  }),
  progression: z.object({
    tree: z.object({
      branches: z.number(),
      nodesPerBranch: z.number(),
      costCurve: z.object({
        cashBase: z.number(),
        fluxBase: z.number(),
        growth: z.number(),
        rounding: z.literal('round'),
      }),
    }),
    respec: z.object({
      utility: z.literal('free'),
      powerAndSignatureFluxRefundPct: z.number(),
    }),
    levels: z.object({
      cap: z.number(),
      nodeTierGates: z.object({
        nodes1to2: z.number(),
        nodes3to4: z.number(),
        nodes5to7: z.number(),
      }),
    }),
    combatXpSharePct: z.object({
      controlled: z.number(),
      aiAllies: z.number(),
      benched: z.number(),
    }),
    repTierThresholds: z.array(z.number()).length(5), // docs/02 §2.3
  }),
  relationships: z.object({
    opinionAxisRange: Range2,
    trackLevelRange: Range2,
    gates: z.object({
      romanceConfession: z.object({ attraction: z.number(), trust: z.number() }),
      intimidation: z.object({ fear: z.number(), trustCostOnUse: z.boolean() }),
      dreadAura: z.object({ fearDistrictSample: z.number() }),
    }),
    giftBondXpSoftCapPerNpcPerDay: z.number(),
    needs: z.object({
      buffThreshold: z.number(),
      buffs: z.object({
        energyStaminaRegenPct: z.number(),
        socialBondXpPct: z.number(),
        hungerMaxHpPct: z.number(),
      }),
    }),
    gossip: z.object({
      juiceMult: z.object({
        romanceBetrayal: z.number(),
        fights: z.number(),
        factionBetrayal: z.number(),
        generosity: z.number(),
        weirdness: z.number(),
        corridorFear: z.literal(1), // PROTECTED: no juice multiplier on corridor fear
      }),
      typicalSaturationDays: z.number(),
    }),
  }),
  zone: z.object({
    segments: z.literal(6), // docs/02 §8.1
    patrolDensityRange: Range2,
    blind: z.object({
      coverageReductionPct: z.number(),
      windowDays: z.number(),
      relayRebuildDays: z.number(),
    }),
    mutation: z.object({
      cadenceDays: z.number(),
      comedicDeckSize: z.number(),
      storyMutations: z.number(),
      storyPullConsumesCycle: z.boolean(),
    }),
    reveal: z.object({
      stages: z.literal(5), // canon: FIVE stages (docs/09 §5, docs/02 §9.2)
      injectedItems: z.object({
        stages: z.array(z.number()),
        fidelity: z.number(),
        hopsPerSleep: z.number(),
        decayMult: z.number(),
      }),
      stage2LeakFidelity: z.number(),
    }),
    siege: z.object({ sliceCount: z.number(), hardCapSec: z.number() }),
  }),
  base: z.object({
    roomSlotsAtUnlock: z.number(),
    roomSlotsRepTier2: z.number(),
    roomSlotsRepTier3: z.number(),
    roomSlotsRepTier4: z.number(),
    noDuplicateRoomTypes: z.boolean(),
    followerRosterCap: z.number(),
    followerMissionRealHours: Range2,
    followerPartySize: Range2,
  }),
  farm: z.object({
    dailyUpkeepBudgetSec: z.number(),
    fluxPlotCap: z.literal(4), // hard cap at every greenhouse level (docs/02 §3.2)
    gardenFreeBeds: z.number(),
    cropsPauseWhenUnwatered: z.boolean(), // no crop death (docs/02 §4.2)
  }),
  save: z.object({ sizeBudgetMB: z.number(), rollingBackups: z.number() }),
});
export type Tuning = z.infer<typeof TuningSchema>;

// ---------------------------------------------------------------------------
// Economy — docs/02 §2.4, §3.2–3.3, §5.3, §6 (income/sink table).
// ---------------------------------------------------------------------------

export const EconomySchema = z.object({
  _comments: Comments.optional(),
  income: z.object({
    midGamePerRealHour: z.object({ cash: z.number(), flux: z.number() }), // §6.2
    rep: z.object({ brawl: Range2, storyBeat: Range2, bondMilestone: z.number() }), // §2.3
    factionJobCash: Range2, // §3.3
    business: z.object({
      cashPerInGameDay: z.number(),
      accrualCapDays: z.number(),
      firstCutCandidate: z.boolean(), // docs/02 §10 / CLAUDE.md scope
    }),
    brawlLoot: z.object({
      materialsPerEnemy: Range2,
      environmentalKillBonusPct: z.number(),
      leaderFluxDrop: Range2,
    }),
    scrap: z.object({ perMachineUnit: Range2, salePriceCash: z.number() }), // §1.9/§3.3
    fluxParityRule: z.string(), // §2.4 parity rule, stated
  }),
  sinks: z.object({
    upgradeNode: z.object({
      curveRef: z.string(), // points at tuning.progression.tree.costCurve
      nodeCashRange: Range2,
      nodeFluxRange: Range2,
    }),
    rooms: z.object({
      train_room: z.object({ buildAndUpgradeCash: z.array(z.number()).length(3) }),
      flux_greenhouse: z.object({ buildAndUpgradeCash: z.array(z.number()).length(3) }),
      workshop: z.object({
        buildAndUpgradeCash: z.array(z.number()).length(3),
        transmuteMaterialsPerFlux: z.number(), // Lv3, lossy 10:1 (§3.2)
      }),
      lounge: z.object({ buildAndUpgradeCash: z.array(z.number()).length(3) }),
      private_quarters: z.object({
        buildAndUpgradeCash: z.array(z.number().nullable()).length(3), // Lv3 is story
      }),
    }),
    dates: z.object({ costCash: Range2, lengthRealMin: Range2 }), // §5.3
    gearModCashApprox: z.number(), // §6.2
  }),
  rules: z.object({
    /** §6.2 hard rule: price modifiers do NOT stack — single worst wins. */
    priceModifierStacking: z.literal('worst-single-wins'),
    nextPurchaseHorizonMin: z.number(),
    everySinkHasTwoPaths: z.boolean(), // anti-grind guarantee 1
    premiumCurrency: z.literal(false), // "No premium currency. No energy system. Ever."
    energySystem: z.literal(false),
  }),
  crops: z.array(CropSchema),
  items: z.array(ItemSchema),
});
export type Economy = z.infer<typeof EconomySchema>;

// ---------------------------------------------------------------------------
// Combat content — combat.json (docs/02 §1.5/§1.6/§1.9).
// Content-is-data rule: enemy VO lines and spawn-composition weights are data,
// not code — game/src/combat reads them from here, never hard-codes them.
// ---------------------------------------------------------------------------

export const EnemyKindSchema = z.enum([
  'grunt',
  'bruiser',
  'ranged',
  'leader',
  'scanner',
  'detainer',
  'bulwark',
  'swarm',
  'wardenHand',
]);
export type EnemyKindName = z.infer<typeof EnemyKindSchema>;

/** Weighted composition row: kind -> relative spawn weight (must be > 0). */
const SpawnWeightsSchema = z.record(EnemyKindSchema, z.number().positive());

export const CombatContentSchema = z
  .object({
    /** §1.9 quirk 3 — compliance VO per machine unit; machines announce everything. */
    announce: z.object({
      scanner: z.string().min(1),
      detainer: z.string().min(1),
      bulwark: z.string().min(1),
      swarm: z.string().min(1),
      wardenHand: z.string().min(1),
    }),
    /** §1.6 — composition (not HP sponging) is the difficulty ramp. */
    spawnWeights: z.object({
      human: z.object({
        tier1: SpawnWeightsSchema,
        tier2: SpawnWeightsSchema,
        tier3: SpawnWeightsSchema,
        tier4: SpawnWeightsSchema,
      }),
      machine: SpawnWeightsSchema,
    }),
  })
  .extend({ _comments: Comments.optional() });
export type CombatContent = z.infer<typeof CombatContentSchema>;

// ---------------------------------------------------------------------------
// Cost-curve helper — exported so tests and tools share ONE formula (§2.1).
// ---------------------------------------------------------------------------

/** cost(n) = round(base × 1.5^n), n = 0..6 within a branch (docs/02 §2.1). */
export function upgradeNodeCost(base: number, nodeIndex: number, growth = 1.5): number {
  return Math.round(base * Math.pow(growth, nodeIndex));
}
