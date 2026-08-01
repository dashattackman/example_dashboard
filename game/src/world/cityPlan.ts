// Pure-TS query layer over game/src/content/city/uptown.json — the single
// source of truth for Uptown's geography (docs/03 map figure is authoritative).
// Consumed by cityGen (M2 geometry) AND the sim (M5): NO @babylonjs imports,
// no DOM, no side effects beyond parsing the JSON once (docs/05 module rule 1).
//
// World coordinates: meters, origin at the map's SOUTHWEST corner, +x east,
// +z north (matches the engine convention used by world/beautyCorner.ts).
// The 9×7 streaming grid (docs/05: ~100m cells): columns A–I west→east,
// rows 1–7 north→south, so cell "A7" is the southwest cell (x∈[0,100),
// z∈[0,100)) and "I1" the northeast (x∈[800,900), z∈[600,700)).

import rawUptown from '../content/city/uptown.json';
import {
  CityPlanSchema,
  COLUMNS,
  type Block,
  type CityPlan,
  type Column,
  type Gate,
  type Hours,
  type InductionPad,
  type Mast,
  type Phase,
  type PhaseSpawn,
  type Street,
  type Territory,
  type Venue,
} from '../content/city/schema';

/** The parsed, schema-validated city plan. Throws at module load on bad data. */
export const city: CityPlan = CityPlanSchema.parse(rawUptown);

/** Validate any raw JSON as a city plan (dev hot-reload, tests, future districts). */
export function loadCityPlan(raw: unknown): CityPlan {
  return CityPlanSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export const CELL_SIZE_M = city.grid.cellSizeM;
export const GRID_COLS = city.grid.columns.length;
export const GRID_ROWS = city.grid.rows;
export const WORLD_WIDTH_M = city.grid.widthM;
export const WORLD_HEIGHT_M = city.grid.heightM;

export interface CellRef {
  id: string;
  col: Column;
  /** 0-based column index, west→east (A=0 … I=8). */
  colIndex: number;
  /** 1-based row, north→south per the docs/03 figure ruler. */
  row: number;
}

export function cellIdOf(colIndex: number, row: number): string | null {
  const col = COLUMNS[colIndex];
  if (col === undefined || row < 1 || row > GRID_ROWS) return null;
  return `${col}${row}`;
}

export function parseCellId(id: string): CellRef | null {
  if (!/^[A-I][1-7]$/.test(id)) return null;
  const col = id[0] as Column;
  const row = Number(id[1]);
  return { id, col, colIndex: COLUMNS.indexOf(col), row };
}

/** Streaming cell containing world position (x, z), or null when off-map. */
export function cellAt(x: number, z: number): CellRef | null {
  if (x < 0 || x >= WORLD_WIDTH_M || z < 0 || z >= WORLD_HEIGHT_M) return null;
  const colIndex = Math.floor(x / CELL_SIZE_M);
  const row = GRID_ROWS - Math.floor(z / CELL_SIZE_M); // z north ⇒ row 1 at top
  const id = cellIdOf(colIndex, row);
  return id === null ? null : { id, col: COLUMNS[colIndex] as Column, colIndex, row };
}

/** World-space AABB of a cell (meters, origin SW). */
export function cellBounds(
  id: string,
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  const ref = parseCellId(id);
  if (ref === null) return null;
  const minX = ref.colIndex * CELL_SIZE_M;
  const minZ = (GRID_ROWS - ref.row) * CELL_SIZE_M;
  return { minX, maxX: minX + CELL_SIZE_M, minZ, maxZ: minZ + CELL_SIZE_M };
}

export function allCellIds(): string[] {
  const out: string[] = [];
  for (const col of COLUMNS) for (let r = 1; r <= GRID_ROWS; r++) out.push(`${col}${r}`);
  return out;
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

const venueByIdMap = new Map<string, Venue>(city.venues.map((v) => [v.id, v]));
const venueByNumMap = new Map<number, Venue>(city.venues.map((v) => [v.num, v]));
const venuesByCellMap = new Map<string, Venue[]>();
for (const v of city.venues) {
  for (const cell of v.cells ?? [v.cell]) {
    const list = venuesByCellMap.get(cell);
    if (list === undefined) venuesByCellMap.set(cell, [v]);
    else list.push(v);
  }
}

export function venues(): readonly Venue[] {
  return city.venues;
}

export function venueById(id: string): Venue | undefined {
  return venueByIdMap.get(id);
}

export function venueByNum(num: number): Venue | undefined {
  return venueByNumMap.get(num);
}

/** Venues whose footprint touches the cell (primary cell or span). */
export function venuesInCell(cellId: string): readonly Venue[] {
  return venuesByCellMap.get(cellId) ?? [];
}

export function fullVenues(): Venue[] {
  return city.venues.filter((v) => v.status === 'full');
}

export function shellVenues(): Venue[] {
  return city.venues.filter((v) => v.status === 'shell');
}

export function housingVenues(): Venue[] {
  return city.venues.filter((v) => v.status === 'housing');
}

/**
 * Every phase a venue can be open in ANY state: zone-pair hours contribute
 * occupied ∪ freed; keyed/story venues have no public phases.
 */
export function openPhases(venue: Venue): Phase[] {
  const h: Hours = venue.hours;
  switch (h.type) {
    case 'public':
    case 'sign':
    case 'events':
      return [...h.phases];
    case 'zonePair':
      return [...new Set<Phase>([...h.occupied, ...h.freed])];
    case 'keyed':
    case 'story':
      return [];
  }
}

/** Open phases for a corridor venue at a given zone state (others are constant). */
export function openPhasesAt(venue: Venue, zoneState: 'occupied' | 'freed'): Phase[] {
  const h: Hours = venue.hours;
  if (h.type === 'zonePair') return [...(zoneState === 'occupied' ? h.occupied : h.freed)];
  return openPhases(venue);
}

// ---------------------------------------------------------------------------
// Blocks & territory
// ---------------------------------------------------------------------------

const blockByCellMap = new Map<string, Block>();
for (const b of city.blocks) for (const cell of b.cells) blockByCellMap.set(cell, b);

export function blocks(): readonly Block[] {
  return city.blocks;
}

/** The 4×4 street-block core: columns D–G between the Greenway and W 31st. */
export function coreBlocks(): Block[] {
  return city.blocks.filter((b) => b.column >= 'D' && b.column <= 'G');
}

export function blockOf(cellId: string): Block | undefined {
  return blockByCellMap.get(cellId);
}

/**
 * Territorial layer for a cell — flip tech ships for exactly 3 factions
 * (docs/03 §4); the Rogue Zone is a separate overlay, never a territory.
 * Column A is open water ('water'); beach/park bands are Commons lakefront
 * turf; the Greenway trench row is Iron Range turf; corridor blocks east of
 * Hennepin are 'unclaimed'.
 */
export function territoryOf(cellId: string): Territory | 'water' | null {
  const ref = parseCellId(cellId);
  if (ref === null) return null;
  if (ref.col === city.lakefront.waterColumn) return 'water';
  if (ref.row === 1) {
    // Greenway trench (C1–I1) is Iron Range turf; B1 is beach (Commons).
    return city.greenway.cells.includes(cellId) ? 'ironRange' : 'commons';
  }
  if (ref.col === city.lakefront.beachColumn || ref.col === city.lakefront.parkColumn) {
    return 'commons'; // lakefront band: parkway, beach, pier (docs/03 §4)
  }
  const block = blockByCellMap.get(cellId);
  return block?.territory ?? 'unclaimed';
}

// ---------------------------------------------------------------------------
// Rogue Zone accessors (overlay state model lives in sim/zone.ts — docs/02)
// ---------------------------------------------------------------------------

export function zoneCells(): readonly string[] {
  return city.zone.cells;
}

const zoneCellSet = new Set(city.zone.cells);

export function isZoneCell(cellId: string): boolean {
  return zoneCellSet.has(cellId);
}

/** Zone cells with at least one 4-neighbor outside the zone (or off-map). */
export function zonePerimeterCells(): string[] {
  const out: string[] = [];
  for (const id of city.zone.cells) {
    const ref = parseCellId(id);
    if (ref === null) continue;
    const neighbors = [
      cellIdOf(ref.colIndex - 1, ref.row),
      cellIdOf(ref.colIndex + 1, ref.row),
      cellIdOf(ref.colIndex, ref.row - 1),
      cellIdOf(ref.colIndex, ref.row + 1),
    ];
    if (neighbors.some((n) => n === null || !zoneCellSet.has(n))) out.push(id);
  }
  return out;
}

export function gates(): readonly Gate[] {
  return city.zone.gates;
}

export function gateById(id: Gate['id']): Gate | undefined {
  return city.zone.gates.find((g) => g.id === id);
}

export function masts(): readonly Mast[] {
  return city.zone.masts;
}

export function inductionPads(): readonly InductionPad[] {
  return city.zone.inductionPads;
}

export function holdingStructure(): CityPlan['zone']['holding'] {
  return city.zone.holding;
}

// ---------------------------------------------------------------------------
// Street grid queries
// ---------------------------------------------------------------------------

export function streets(): readonly Street[] {
  return city.streets;
}

const streetByIdMap = new Map<string, Street>(city.streets.map((s) => [s.id, s]));

export function streetById(id: string): Street | undefined {
  return streetByIdMap.get(id);
}

export interface StreetHit {
  street: Street;
  part: 'road' | 'sidewalk';
  /** Meters from the street centerline. */
  distanceM: number;
}

/** Nearest street whose road or sidewalk band contains (x, z), or null. */
export function streetAt(x: number, z: number): StreetHit | null {
  let best: StreetHit | null = null;
  for (const s of city.streets) {
    const d = Math.abs((s.orientation === 'ns' ? x : z) - s.axisM);
    const half = s.roadWidthM / 2;
    const part: 'road' | 'sidewalk' | null =
      d <= half ? 'road' : d <= half + s.sidewalkWidthM ? 'sidewalk' : null;
    if (part === null) continue;
    if (best === null || d < best.distanceM) best = { street: s, part, distanceM: d };
  }
  return best;
}

export type GroundKind =
  | 'offMap'
  | 'street'
  | 'sidewalk'
  | 'water'
  | 'beach'
  | 'park'
  | 'greenway'
  | 'block';

/**
 * What the ground at (x, z) is: street/sidewalk win over band semantics
 * (the parkway crosses the park band); then water (col A), beach (B),
 * park (C), Greenway trench (row 1), else block interior.
 */
export function classifyPosition(x: number, z: number): GroundKind {
  const cell = cellAt(x, z);
  if (cell === null) return 'offMap';
  const hit = streetAt(x, z);
  if (hit !== null) return hit.part === 'road' ? 'street' : 'sidewalk';
  if (cell.col === city.lakefront.waterColumn) return 'water';
  if (cell.col === city.lakefront.beachColumn) return 'beach';
  if (city.greenway.cells.includes(cell.id)) return 'greenway';
  if (cell.col === city.lakefront.parkColumn) return 'park';
  return 'block';
}

export function isOnStreet(x: number, z: number): boolean {
  return classifyPosition(x, z) === 'street';
}

export function isOnSidewalk(x: number, z: number): boolean {
  return classifyPosition(x, z) === 'sidewalk';
}

export function isInBlock(x: number, z: number): boolean {
  return classifyPosition(x, z) === 'block';
}

// ---------------------------------------------------------------------------
// Ambient spawn-table hooks (docs/03 §5) — the sim's per-phase density source
// ---------------------------------------------------------------------------

export type SpawnArea = 'streets' | 'lakefront';

export function spawnTable(phase: Phase): PhaseSpawn {
  return city.ambient.spawn[phase];
}

/** Per-visible-block ambient NPC density range for a phase and area. */
export function ambientDensity(phase: Phase, area: SpawnArea): { min: number; max: number } {
  const d = city.ambient.spawn[phase][area];
  return { min: d.min, max: d.max };
}

/** Hard cap: ambient NPCs on screen (patrols budgeted separately). */
export function maxAmbientOnScreen(): number {
  return city.ambient.maxAmbientOnScreen;
}

/** Population multiplier for a weather state (rain halves it; docs/03 §5). */
export function weatherPopulationMultiplier(weather: 'clear' | 'rain' | 'snow'): number {
  return weather === 'rain' ? city.ambient.weather.rainPopulationMultiplier : 1;
}

/** CIVIS patrol flavor for a phase (inside the wire / visible from our streets). */
export function zonePatrolsAt(phase: Phase): { inside: string; visible: string } {
  return city.ambient.zonePatrols[phase];
}
