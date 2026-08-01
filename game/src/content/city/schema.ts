// Zod schemas for the city data layer (game/src/content/city/*.json).
// Pure TS + zod — no Babylon imports (docs/05 module rule 1).
// NOTE: docs/05 wants all content schemas gathered in content/schemas.ts; that
// file doesn't exist yet. These are authored self-contained so they can be
// re-exported from content/schemas.ts verbatim when it lands.
//
// Canon sources: docs/03-world-minneapolis.md (map figure + §2 venue table are
// authoritative), docs/05 (100m cells, 9×7 grid), docs/02 §4.1 (phase enum).

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const PHASES = ['MORN', 'DAY', 'EVE', 'LATE'] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const ColumnSchema = z.enum(COLUMNS);
export type Column = z.infer<typeof ColumnSchema>;

/** Cell ids look like "D4": column A–I (west→east), row 1–7 (north→south). */
export const CellIdSchema = z
  .string()
  .regex(/^[A-I][1-7]$/, 'cell id must be like "D4" (col A-I, row 1-7)');
export type CellId = z.infer<typeof CellIdSchema>;

export const FactionSchema = z.enum(['commons', 'ironRange', 'aldermen']);
export type Faction = z.infer<typeof FactionSchema>;

/**
 * Territorial value of a block. The Isles Trust is deliberately NOT here —
 * it is non-territorial by settled decision (CLAUDE.md, docs/03 §4): no
 * banners, no turf, no flips. 'neutral' = never flips (docs/03 §4 neutral
 * cells); 'unclaimed' = corridor filler east of Hennepin (zone overlay land).
 */
export const TerritorySchema = z.enum([
  'commons',
  'ironRange',
  'aldermen',
  'neutral',
  'unclaimed',
]);
export type Territory = z.infer<typeof TerritorySchema>;

// ---------------------------------------------------------------------------
// Streets
// ---------------------------------------------------------------------------

export const StreetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 'ns' = avenue (constant x), 'ew' = street (constant z). */
  orientation: z.enum(['ns', 'ew']),
  /** World-meters position of the centerline (x for ns, z for ew). Origin SW. */
  axisM: z.number(),
  /** Which cell boundary the centerline sits on, e.g. "G|H" or "rows 4|5". */
  boundary: z.string(),
  /** True when it carries a real Minneapolis street name. */
  real: z.boolean(),
  roadWidthM: z.number().positive(),
  sidewalkWidthM: z.number().positive(),
  notes: z.string().optional(),
});
export type Street = z.infer<typeof StreetSchema>;

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export const VenueFunctionSchema = z.enum([
  'SHOP',
  'JOB',
  'SOCIAL',
  'ROMANCE',
  'FACTION-HQ',
  'FACTION',
  'HOUSING',
  'VICE',
  'QUEST-HUB',
]);
export type VenueFunction = z.infer<typeof VenueFunctionSchema>;

/**
 * Ship status per docs/03 §2 arithmetic: 20 'full' interiors + 7 'shell'
 * (exterior + door decal + hours sign) + 4 'housing' (one re-skinned template,
 * counted separately) + 1 'micro' (#32, budgeted with non-venue interiors).
 */
export const VenueStatusSchema = z.enum(['full', 'shell', 'housing', 'micro']);
export type VenueStatus = z.infer<typeof VenueStatusSchema>;

export const HoursSchema = z.discriminatedUnion('type', [
  /** Normal open phases. */
  z.object({ type: z.literal('public'), phases: z.array(PhaseSchema).min(1) }),
  /** Shells: the hours SIGN only — interior lands post-slice. */
  z.object({ type: z.literal('sign'), phases: z.array(PhaseSchema).min(1) }),
  /**
   * Corridor venues #29–31: authored as (occupied → freed) pairs, never
   * constants (docs/03 §2 build notes). `occupied` may be empty (#31 ships
   * shuttered).
   */
  z.object({
    type: z.literal('zonePair'),
    occupied: z.array(PhaseSchema),
    freed: z.array(PhaseSchema).min(1),
  }),
  /** Housing: keyed/invited access, no public hours. */
  z.object({ type: z.literal('keyed') }),
  /** Event-driven access (Loring House parties). */
  z.object({ type: z.literal('events'), phases: z.array(PhaseSchema).min(1) }),
  /** Story-gated, unmarked (#32). */
  z.object({ type: z.literal('story') }),
]);
export type Hours = z.infer<typeof HoursSchema>;

export const FrontageSchema = z.object({
  /** Street id the door/signage fronts (column-boundary rule, docs/03 §1). */
  street: z.string().min(1),
  /** Unique slot along that street within the cell (west→east / north→south). */
  slot: z.number().int().min(0),
});
export type Frontage = z.infer<typeof FrontageSchema>;

export const VenueSchema = z
  .object({
    num: z.number().int().min(1).max(32),
    id: z.string().min(1),
    name: z.string().min(1),
    evokes: z.string().min(1),
    /** Open string per docs/05 sketch ('bar'|'club'|'shop'|'home'|...). */
    kind: z.string().min(1),
    functions: z.array(VenueFunctionSchema),
    status: VenueStatusSchema,
    /** Primary streaming cell. */
    cell: CellIdSchema,
    /** Full cell span when the venue occupies more than one (e.g. #26 D6–D7). */
    cells: z.array(CellIdSchema).min(1).optional(),
    /** null = unmarked (#32: no sign, no map presence). */
    frontage: FrontageSchema.nullable(),
    hours: HoursSchema,
    faction: FactionSchema.optional(),
    factionRole: z.string().optional(),
    /** Designated truce ground (#22, #24) — combat disabled, never flips. */
    truce: z.boolean().optional(),
    /** Combat disabled inside (truce interiors, all HOUSING, #30, #32). */
    combatDisabled: z.boolean().optional(),
    arcCritical: z.boolean().optional(),
    /** Hidden entrance / story-revealed. */
    hidden: z.boolean().optional(),
    /** false = never appears on the in-game map or minimap (#32). */
    onMap: z.boolean(),
    notes: z.string().optional(),
  })
  .strict();
export type Venue = z.infer<typeof VenueSchema>;

// ---------------------------------------------------------------------------
// Blocks & territory
// ---------------------------------------------------------------------------

export const BlockSchema = z.object({
  id: z.string().min(1),
  column: ColumnSchema,
  /** Cell rows this block mass covers (block bands: [2,3], [4], [5], [6,7]). */
  rows: z.array(z.number().int().min(1).max(7)).min(1),
  cells: z.array(CellIdSchema).min(1),
  /** Bounding streets (ids), where applicable. */
  north: z.string().optional(),
  south: z.string().optional(),
  west: z.string().optional(),
  east: z.string().optional(),
  territory: TerritorySchema,
  /** Rogue Zone overlay sits ON TOP of territory — separate layer (docs/03 §4). */
  zoneOverlay: z.boolean().optional(),
  notes: z.string().optional(),
});
export type Block = z.infer<typeof BlockSchema>;

// ---------------------------------------------------------------------------
// Rogue Zone (overlay — NOT a faction; docs/03 §4 "read this twice")
// ---------------------------------------------------------------------------

export const GateSchema = z.object({
  id: z.enum(['GATE-A', 'GATE-B', 'GATE-C']),
  name: z.string().min(1),
  cell: CellIdSchema,
  at: z.string().min(1),
  kind: z.enum(['pedestrian', 'vehicle']),
  notes: z.string().optional(),
});
export type Gate = z.infer<typeof GateSchema>;

export const MastSchema = z.object({
  id: z.enum(['M1', 'M2', 'M3', 'M4']),
  cell: CellIdSchema,
  on: z.string().min(1),
  destroyable: z.literal(true),
});
export type Mast = z.infer<typeof MastSchema>;

export const InductionPadSchema = z.object({
  id: z.string().min(1),
  cell: CellIdSchema,
  at: z.string().min(1),
});
export type InductionPad = z.infer<typeof InductionPadSchema>;

export const ZoneSchema = z.object({
  name: z.string().min(1),
  contractor: z.string().min(1),
  /** Exact streaming cells inside the wire (docs/03 §1: H5–I7). */
  cells: z.array(CellIdSchema).min(1),
  gates: z.array(GateSchema).length(3),
  holding: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    cells: z.array(CellIdSchema).min(1),
    notes: z.string().optional(),
  }),
  masts: z.array(MastSchema).length(4),
  inductionPads: z.array(InductionPadSchema).min(1),
  perimeter: z.object({
    lightInside: z.string(),
    lightOutside: z.string(),
    rule: z.string(),
  }),
  notes: z.string().optional(),
});
export type Zone = z.infer<typeof ZoneSchema>;

// ---------------------------------------------------------------------------
// Ambient life (docs/03 §5)
// ---------------------------------------------------------------------------

export const DensitySchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
  who: z.string().min(1),
});
export type Density = z.infer<typeof DensitySchema>;

export const PhaseSpawnSchema = z.object({
  streets: DensitySchema,
  lakefront: DensitySchema,
  notes: z.string().optional(),
});
export type PhaseSpawn = z.infer<typeof PhaseSpawnSchema>;

const perPhase = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ MORN: v, DAY: v, EVE: v, LATE: v });

export const AmbientSchema = z.object({
  /** Mid-range Android budget: ambient NPCs on screen, patrols extra. */
  maxAmbientOnScreen: z.number().int().positive(),
  spawn: perPhase(PhaseSpawnSchema),
  weather: z.object({ rainPopulationMultiplier: z.number().min(0).max(1) }),
  zonePatrols: perPhase(z.object({ inside: z.string(), visible: z.string() })),
  traffic: z.object({
    parkedPerBlockFace: z.object({ min: z.number().int(), max: z.number().int() }),
    passingCarIntervalSec: z.object({ min: z.number().int(), max: z.number().int() }),
    greenwayBikes: z.string(),
    route6Bus: z.string(),
  }),
});
export type Ambient = z.infer<typeof AmbientSchema>;

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

export const CityPlanSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    docRef: z.string().min(1),
    grid: z.object({
      columns: z.array(ColumnSchema).length(9),
      rows: z.literal(7),
      cellSizeM: z.literal(100),
      widthM: z.literal(900),
      heightM: z.literal(700),
      /** World origin at the SW corner; +x east, +z north (engine convention). */
      origin: z.literal('southwest'),
      axes: z.object({ xEast: z.literal(true), zNorth: z.literal(true) }),
    }),
    columnSemantics: z.record(ColumnSchema, z.string()),
    streets: z.array(StreetSchema).min(1),
    greenway: z.object({
      name: z.string(),
      kind: z.literal('sunken-trench'),
      row: z.literal(1),
      cells: z.array(CellIdSchema).min(1),
      notes: z.string().optional(),
    }),
    lakefront: z.object({
      waterColumn: ColumnSchema,
      beachColumn: ColumnSchema,
      parkColumn: ColumnSchema,
      swimmable: z.literal(true),
      boats: z.literal(false),
      pier: z.object({
        columns: z.array(ColumnSchema).min(1),
        boundary: z.string(),
        worldZ: z.number(),
      }),
      features: z.array(
        z.object({ id: z.string(), cells: z.array(CellIdSchema).min(1) }),
      ),
    }),
    skyline: z.object({
      backdropOnly: z.literal(true),
      direction: z.string(),
      vistaCorner: z.string(),
      vistaAnchor: z.object({ x: z.number(), z: z.number() }),
      rule: z.string(),
    }),
    base: z.object({
      id: z.string(),
      name: z.string(),
      cells: z.array(CellIdSchema).min(1),
      frontage: FrontageSchema,
      greenwayRamp: z.literal(true),
      notes: z.string().optional(),
    }),
    garden: z.object({
      id: z.string(),
      name: z.string(),
      cell: CellIdSchema,
      gateCorner: z.string(),
      starterBeds: z.number().int(),
      rentableBeds: z.literal(true),
      shed: z.object({ enterable: z.literal(true), notes: z.string().optional() }),
      notes: z.string().optional(),
    }),
    blocks: z.array(BlockSchema).min(1),
    islesTrust: z.object({
      territorial: z.literal(false),
      liens: z.array(z.string()).min(1),
      expression: z.string(),
      notes: z.string().optional(),
    }),
    venues: z.array(VenueSchema).length(32),
    zone: ZoneSchema,
    ambient: AmbientSchema,
    densityRule: z.string(),
  })
  .strict();
export type CityPlan = z.infer<typeof CityPlanSchema>;
