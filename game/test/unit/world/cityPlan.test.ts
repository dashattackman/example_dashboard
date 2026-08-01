// City data-layer invariants. docs/03-world-minneapolis.md is authoritative
// for every number asserted here (map figure, §2 ship arithmetic, §4 turf,
// §5 spawn tables). If one of these fails, the DATA is wrong — fix uptown.json,
// never the assertion.
import { describe, expect, it } from 'vitest';
import {
  allCellIds,
  ambientDensity,
  cellAt,
  cellBounds,
  city,
  classifyPosition,
  coreBlocks,
  fullVenues,
  gateById,
  gates,
  housingVenues,
  inductionPads,
  masts,
  maxAmbientOnScreen,
  openPhases,
  openPhasesAt,
  parseCellId,
  shellVenues,
  spawnTable,
  streetById,
  territoryOf,
  venueById,
  venueByNum,
  venues,
  venuesInCell,
  weatherPopulationMultiplier,
  zoneCells,
  zonePerimeterCells,
} from '../../../src/world/cityPlan';

const PHASES = ['MORN', 'DAY', 'EVE', 'LATE'] as const;

describe('ship arithmetic (docs/03 §2, amended for the Rogue Zone arc)', () => {
  it('ships exactly 20 full interiors', () => {
    const fullNums = fullVenues()
      .map((v) => v.num)
      .sort((a, b) => a - b);
    // The canonical roster from docs/03 §2 build notes, verbatim.
    expect(fullNums).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 12, 17, 18, 21, 22, 23, 24, 25, 26, 28, 29, 30]);
  });

  it('ships exactly 7 shells', () => {
    const shellNums = shellVenues()
      .map((v) => v.num)
      .sort((a, b) => a - b);
    // Round 1's 6 shells + #31 (corridor taquería).
    expect(shellNums).toEqual([3, 10, 11, 19, 20, 27, 31]);
  });

  it('counts the housing template set (#13–16) separately from the 20', () => {
    expect(housingVenues().map((v) => v.num).sort((a, b) => a - b)).toEqual([13, 14, 15, 16]);
  });

  it('#32 is the single unmarked micro-cell, never on the map', () => {
    const micro = venues().filter((v) => v.status === 'micro');
    expect(micro.map((v) => v.num)).toEqual([32]);
    expect(micro[0]?.onMap).toBe(false);
    expect(micro[0]?.frontage).toBeNull();
  });

  it('totals 32 venues (#01–#32, each number once)', () => {
    expect(venues()).toHaveLength(32);
    const nums = new Set(venues().map((v) => v.num));
    expect(nums.size).toBe(32);
    for (let n = 1; n <= 32; n++) expect(nums.has(n)).toBe(true);
  });
});

describe('venue placement on the 9×7 grid', () => {
  it('every venue cell (primary + span) is inside the grid', () => {
    for (const v of venues()) {
      for (const cell of v.cells ?? [v.cell]) {
        expect(parseCellId(cell), `${v.id} cell ${cell}`).not.toBeNull();
      }
    }
  });

  it('a venue span always contains its primary cell', () => {
    for (const v of venues()) {
      if (v.cells) expect(v.cells, v.id).toContain(v.cell);
    }
  });

  it('venuesInCell is the exact inverse of venue cell assignments', () => {
    for (const v of venues()) {
      for (const cell of v.cells ?? [v.cell]) {
        expect(venuesInCell(cell).map((x) => x.id), cell).toContain(v.id);
      }
    }
    // And nothing extra: total memberships match.
    const memberships = allCellIds().reduce((n, c) => n + venuesInCell(c).length, 0);
    const expected = venues().reduce((n, v) => n + (v.cells ?? [v.cell]).length, 0);
    expect(memberships).toBe(expected);
  });

  it('no two venues share a frontage slot (cell + street + slot unique)', () => {
    const seen = new Set<string>();
    for (const v of venues()) {
      if (v.frontage === null) continue;
      expect(streetById(v.frontage.street), `${v.id} fronts unknown street`).toBeDefined();
      const key = `${v.cell}:${v.frontage.street}:${v.frontage.slot}`;
      expect(seen.has(key), `duplicate frontage ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('spot-checks the figure: worked examples from docs/03 §1', () => {
    expect(venueByNum(26)?.cells).toEqual(['D6', 'D7']); // col D, row 6–7, on W 31st
    expect(venueByNum(25)?.cell).toBe('F5'); // Lake St W between Humboldt & Holmes
    expect(venueByNum(23)?.cell).toBe('F5'); // Holmes & Lake corner
    expect(venueByNum(30)?.cell).toBe('H5'); // panadería, inside the wire
    expect(venueByNum(29)?.cell).toBe('I5'); // mercado, corridor anchor
    expect(city.base.cells).toEqual(['D2', 'D3']); // Irving between 28th & Lagoon
    expect(city.garden.cell).toBe('D5'); // plots gate at Irving & Lake
  });
});

describe('hours (phase enum MORN/DAY/EVE/LATE, docs/02 §4.1)', () => {
  it('every full-interior venue is open in at least one phase', () => {
    for (const v of fullVenues()) {
      expect(openPhases(v).length, `${v.id} has no open phase`).toBeGreaterThan(0);
    }
  });

  it('corridor venues #29–31 are authored as occupied→freed pairs, not constants', () => {
    for (const num of [29, 30, 31]) {
      const v = venueByNum(num);
      expect(v?.hours.type, `#${num}`).toBe('zonePair');
    }
    // The world visibly thanks you: freed hours are a strict superset.
    const mercado = venueByNum(29)!;
    expect(openPhasesAt(mercado, 'freed')).toContain('LATE');
    expect(openPhasesAt(mercado, 'occupied')).not.toContain('LATE');
    // #30: MORN–DAY under occupation, MORN–EVE freed; no 4am phase exists.
    const panaderia = venueByNum(30)!;
    expect(openPhasesAt(panaderia, 'occupied')).toEqual(['MORN', 'DAY']);
    expect(openPhasesAt(panaderia, 'freed')).toEqual(['MORN', 'DAY', 'EVE']);
    // #31 ships shuttered.
    expect(openPhasesAt(venueByNum(31)!, 'occupied')).toEqual([]);
  });

  it('truce interiors and family/sanctuary cells have combat disabled', () => {
    for (const num of [22, 24, 30, 32]) {
      expect(venueByNum(num)?.combatDisabled, `#${num}`).toBe(true);
    }
    for (const v of housingVenues()) {
      expect(v.combatDisabled, v.id).toBe(true); // FIGHT disabled in all HOUSING
    }
  });
});

describe('territory layer (docs/03 §4 — 3 territorial factions, Trust holds paper only)', () => {
  it('covers all 16 core street blocks with exactly one territorial value', () => {
    const core = coreBlocks();
    expect(core).toHaveLength(16); // 4 columns (D–G) × 4 block bands
    for (const b of core) {
      expect(['commons', 'ironRange', 'aldermen', 'neutral']).toContain(b.territory);
    }
  });

  it('all three factions hold turf; neutral is exactly the base + garden blocks', () => {
    const byTerritory = new Map<string, string[]>();
    for (const b of coreBlocks()) {
      byTerritory.set(b.territory, [...(byTerritory.get(b.territory) ?? []), b.id]);
    }
    expect(byTerritory.get('commons')?.length).toBeGreaterThan(0);
    expect(byTerritory.get('ironRange')?.length).toBeGreaterThan(0);
    expect(byTerritory.get('aldermen')?.length).toBeGreaterThan(0);
    expect(byTerritory.get('neutral')?.sort()).toEqual(['D-lake', 'D-n28th']);
  });

  it('the Isles Trust appears in zero territorial assignments', () => {
    expect(city.islesTrust.territorial).toBe(false);
    for (const b of city.blocks) {
      expect(b.territory.toLowerCase()).not.toContain('isles');
      expect(b.territory.toLowerCase()).not.toContain('trust');
    }
    // Liens reference real blocks in all three territories — paper, not corners.
    const blockIds = new Set(city.blocks.map((b) => b.id));
    for (const lien of city.islesTrust.liens) expect(blockIds.has(lien), lien).toBe(true);
  });

  it('territoryOf resolves every core cell (D–G, rows 2–7) to a single value', () => {
    for (const col of ['D', 'E', 'F', 'G']) {
      for (let row = 2; row <= 7; row++) {
        const t = territoryOf(`${col}${row}`);
        expect(['commons', 'ironRange', 'aldermen', 'neutral'], `${col}${row}`).toContain(t);
      }
    }
  });

  it('band semantics: water west, Commons lakefront, Iron Range trench, unclaimed corridor', () => {
    expect(territoryOf('A4')).toBe('water');
    expect(territoryOf('B3')).toBe('commons'); // beach + path
    expect(territoryOf('C6')).toBe('commons'); // parkway band
    expect(territoryOf('D1')).toBe('ironRange'); // Greenway trench
    expect(territoryOf('H3')).toBe('unclaimed'); // corridor filler
    expect(territoryOf('Z9')).toBeNull();
  });
});

describe('CIVIS Rogue Zone (overlay — cells per the docs/03 figure)', () => {
  it('occupies exactly cells H5–I7', () => {
    expect([...zoneCells()].sort()).toEqual(['H5', 'H6', 'H7', 'I5', 'I6', 'I7']);
  });

  it('zone blocks carry the overlay flag, not a territory', () => {
    for (const id of zoneCells()) {
      expect(territoryOf(id), id).toBe('unclaimed');
    }
    const overlayCells = city.blocks.filter((b) => b.zoneOverlay).flatMap((b) => b.cells);
    expect(overlayCells.sort()).toEqual(['H5', 'H6', 'H7', 'I5', 'I6', 'I7']);
  });

  it('all three gates sit on zone perimeter cells', () => {
    const perimeter = new Set(zonePerimeterCells());
    expect(gates()).toHaveLength(3);
    for (const g of gates()) expect(perimeter.has(g.cell), g.id).toBe(true);
  });

  it('gates match the doc: A at Lake/Hennepin, B on W 31st, C at the east edge', () => {
    expect(gateById('GATE-A')?.cell).toBe('H5');
    expect(gateById('GATE-A')?.kind).toBe('pedestrian');
    expect(gateById('GATE-B')?.cell).toBe('H7');
    expect(gateById('GATE-C')?.cell).toBe('I5');
    expect(gateById('GATE-C')?.kind).toBe('vehicle'); // Detainer convoys exit here
  });

  it('a 2×3 zone footprint is all perimeter (every cell touches the wire)', () => {
    expect(zonePerimeterCells().sort()).toEqual([...zoneCells()].sort());
  });

  it('masts M1–M4 and induction pads sit inside the zone, per the doc', () => {
    const zone = new Set(zoneCells());
    expect(masts()).toHaveLength(4);
    for (const m of masts()) expect(zone.has(m.cell), m.id).toBe(true);
    // The Ramp: commandeered structure, cells H6–H7, M1 on its roof.
    expect(city.zone.holding.cells).toEqual(['H6', 'H7']);
    expect(masts().find((m) => m.id === 'M1')?.cell).toBe('H6');
    // Two-bay pad cluster inside the Ramp + one street pad by GATE-C.
    const pads = inductionPads();
    expect(pads).toHaveLength(3);
    expect(pads.filter((p) => city.zone.holding.cells.includes(p.cell))).toHaveLength(2);
    expect(pads.filter((p) => p.cell === gateById('GATE-C')?.cell)).toHaveLength(1);
  });
});

describe('grid + streets (9×7 cells of 100m, origin SW, +x east, +z north)', () => {
  it('cellAt maps corners and interior points', () => {
    expect(cellAt(0, 0)?.id).toBe('A7'); // southwest corner
    expect(cellAt(899, 699)?.id).toBe('I1'); // northeast corner
    expect(cellAt(450, 450)?.id).toBe('E3');
    expect(cellAt(750, 250)?.id).toBe('H5'); // inside the wire
    expect(cellAt(-1, 0)).toBeNull();
    expect(cellAt(900, 0)).toBeNull();
    expect(cellAt(0, 700)).toBeNull();
  });

  it('cellBounds round-trips through cellAt for all 63 cells', () => {
    const ids = allCellIds();
    expect(ids).toHaveLength(63);
    for (const id of ids) {
      const b = cellBounds(id);
      expect(b, id).not.toBeNull();
      const center = cellAt((b!.minX + b!.maxX) / 2, (b!.minZ + b!.maxZ) / 2);
      expect(center?.id).toBe(id);
    }
  });

  it('encodes the real street grid on the right boundaries', () => {
    expect(streetById('hennepin')?.axisM).toBe(700); // G|H
    expect(streetById('james')?.axisM).toBe(300); // C|D
    expect(streetById('lakeStW')?.axisM).toBe(300); // rows 4|5
    expect(streetById('w28th')?.axisM).toBe(600); // rows 1|2
    expect(streetById('w31st')?.axisM).toBe(0); // row 7 is the W 31st edge
    const ns = city.streets.filter((s) => s.orientation === 'ns').map((s) => s.id);
    expect(ns).toEqual(['bdeMakaSkaPkwy', 'james', 'irving', 'humboldt', 'holmes', 'hennepin']);
    // Girard/Fremont/Emerson/Dupont never appear west of Hennepin (docs/03 §1).
    for (const banned of ['girard', 'fremont', 'emerson', 'dupont']) {
      expect(city.streets.some((s) => s.id.toLowerCase().includes(banned))).toBe(false);
    }
  });

  it('classifies street / sidewalk / block / bands', () => {
    expect(classifyPosition(700, 350)).toBe('street'); // Hennepin centerline
    expect(classifyPosition(707.5, 350)).toBe('sidewalk'); // Hennepin east walk
    expect(classifyPosition(450, 450)).toBe('block'); // mid-block, E3
    expect(classifyPosition(50, 350)).toBe('water'); // column A
    expect(classifyPosition(150, 550)).toBe('beach'); // column B
    expect(classifyPosition(250, 250)).toBe('park'); // column C parkway band
    expect(classifyPosition(450, 650)).toBe('greenway'); // row 1 trench
    expect(classifyPosition(-5, 100)).toBe('offMap');
  });
});

describe('ambient spawn tables (docs/03 §5, per visible block)', () => {
  it('has a row for every phase with sane ranges', () => {
    for (const phase of PHASES) {
      const t = spawnTable(phase);
      expect(t.streets.min).toBeLessThanOrEqual(t.streets.max);
      expect(t.lakefront.min).toBeLessThanOrEqual(t.lakefront.max);
    }
  });

  it('matches the doc table exactly', () => {
    expect(ambientDensity('MORN', 'streets')).toEqual({ min: 4, max: 6 });
    expect(ambientDensity('MORN', 'lakefront')).toEqual({ min: 6, max: 8 });
    expect(ambientDensity('DAY', 'streets')).toEqual({ min: 6, max: 10 });
    expect(ambientDensity('DAY', 'lakefront')).toEqual({ min: 8, max: 12 });
    expect(ambientDensity('EVE', 'streets')).toEqual({ min: 8, max: 12 });
    expect(ambientDensity('EVE', 'lakefront')).toEqual({ min: 6, max: 8 });
    expect(ambientDensity('LATE', 'streets')).toEqual({ min: 3, max: 6 });
    expect(ambientDensity('LATE', 'lakefront')).toEqual({ min: 1, max: 2 });
  });

  it('respects the mid-range Android budget and rain rule', () => {
    expect(maxAmbientOnScreen()).toBe(12);
    for (const phase of PHASES) {
      const t = spawnTable(phase);
      expect(t.streets.max).toBeLessThanOrEqual(12);
      expect(t.lakefront.max).toBeLessThanOrEqual(12);
    }
    expect(weatherPopulationMultiplier('rain')).toBe(0.5);
    expect(weatherPopulationMultiplier('clear')).toBe(1);
  });
});

describe('cross-checks against other canon', () => {
  it('venueById/venueByNum agree', () => {
    expect(venueById('hotdishHouse')?.num).toBe(7);
    expect(venueByNum(7)?.id).toBe('hotdishHouse');
    expect(venueById('nope')).toBeUndefined();
  });

  it('Farhia’s (#28) and Ope’s (#17) are distinct stores on the same Lagoon block', () => {
    const farhia = venueByNum(28)!;
    const ope = venueByNum(17)!;
    expect(farhia.id).not.toBe(ope.id);
    expect(farhia.cell).toBe(ope.cell); // D4, two doors apart
    expect(farhia.frontage?.street).toBe('lagoon');
    expect(farhia.frontage?.slot).not.toBe(ope.frontage?.slot);
  });

  it('the base is not a venue and owns the only greenway ramp', () => {
    expect(venues().some((v) => v.id === city.base.id)).toBe(false);
    expect(city.base.greenwayRamp).toBe(true);
  });

  it('the skyline vista anchors at the Hennepin/Lagoon corner', () => {
    expect(city.skyline.vistaAnchor).toEqual({ x: 700, z: 400 });
    expect(city.skyline.backdropOnly).toBe(true);
  });
});
