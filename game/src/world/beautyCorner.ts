// The M1 beauty corner — ONE Uptown street corner, kit-of-parts, built to produce
// the golden-hour "that's the game" screenshot (docs/07 M1). Hennepin & Lagoon energy:
// brick corner record store, dive-bar blade sign, sodium streetlights, parked cars,
// boulevard trees, the skyline silhouette up the avenue and a lake glimpse west.
//
// ALIVE-CORNER WAVE (environment fidelity): real CC0 surface maps on every big
// surface (public/assets/textures — provenance in textures/CREDITS.md), street
// dressing (wires, AC units, planters, bikes, flyers, mural, alley), painted-depth
// window interiors, and a phase-honest skyline. Flat-colored boxes are dead.
//
// NO @babylonjs imports here (docs/05 module rule) — everything goes through engine/kit.
// Everything repeated is thin-instanced; everything static is merged + frozen (docs/06).
//
// World axes: +X east, +Z north. The avenue runs north (the camera vista); the cross
// street runs east-west toward the lake. Player spawns on the east sidewalk.
//
// AMBIENT-NPC CONTRACT (src/world/ambient.ts reads these lanes — keep them clear
// of props): east walk x 1.3 & 3.2, west walk x -13.0 & -14.9, storefront browser
// x 3.95 @ z 2.2..6.2, bench leaner (3.9, -3.9), jogger along z 18.2.

import type { Canvas2D, Kit, Mesh, Xform } from '../engine/kit';
import { PALETTE } from '../engine/materials';

export interface BeautyCorner {
  /** 0..1 — from the lighting look's `neon`; dresses windows/signs/lamps for dusk/night. */
  applyNeon(level: number): void;
  playerSpawn: [number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// Deterministic PRNG so lit-window patterns and car colors are stable across runs
// (screenshot diffs stay meaningful).
function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const HALF_PI = Math.PI / 2;
const TEX = 'assets/textures/';

export function buildBeautyCorner(kit: Kit): BeautyCorner {
  const rand = makeRand(0x5eed);
  const U = PALETTE.uptown;

  // --- materials -----------------------------------------------------------
  // Real surfaces: CC0 photo maps, desaturated + luma-normalized offline so the
  // district palette hexes below still own the hue (materials.ts does the tint
  // math; the plugin grade keeps it graphic-novel, not photoreal). Tiling is
  // world-scaled per mesh via kit.uv().
  const asphalt = kit.envMat('asphalt', U.asphalt, {
    texture: { url: `${TEX}asphalt.jpg` }, // tile ≈ 4m — kit.uv per roadway
  });
  const concrete = kit.envMat('concrete', U.concrete, {
    texture: { url: `${TEX}sidewalk.jpg` }, // tile = 2m slab w/ baked expansion joints
  });
  const brickA = kit.envMat('brickA', U.brick, { texture: { url: `${TEX}brick_a.jpg` } });
  const brickB = kit.envMat('brickB', U.brickAged, { texture: { url: `${TEX}brick_b.jpg` } });
  const brickDeep = kit.envMat('brickDeep', U.brickDeep, {
    texture: { url: `${TEX}brick_aged.jpg` },
  });
  // West-row masses sit in EVE shade (east facades face away from the low sun),
  // so their diffuse runs lighter than the sunlit east side to keep structure readable.
  const tealGrey = kit.envMat('tealGrey', '#50697a', { texture: { url: `${TEX}brick_grey.jpg` } });
  const brickWest = kit.envMat('brickWest', '#7d4033', {
    texture: { url: `${TEX}brick_aged.jpg` },
  });
  const warmGrey = kit.envMat('warmGrey', '#6a594a', { texture: { url: `${TEX}stucco.jpg` } });
  const woodStore = kit.envMat('woodStore', '#5c4736', { texture: { url: `${TEX}wood.jpg` } });
  const trim = kit.envMat('trim', U.trim);
  const inkMat = kit.envMat('inkMat', '#1f2126');
  const whitePaint = kit.envMat('whitePaint', '#b9b9b2');
  const yellowPaint = kit.envMat('yellowPaint', '#d8c060');
  const awningMat = kit.envMat('awningMat', U.teal);
  const darkGlass = kit.envMat('darkGlass', '#182030');
  const moduleWhite = kit.envMat('moduleWhite', '#ffffff'); // vertex/instance-colored modules
  const waterMat = kit.envMat('waterMat', PALETTE.lake.deepWater, {
    emissiveHex: '#0e2836',
    emissiveLevel: 0.6,
  });

  // Lit glass is now a translucent warm sheen OVER a painted room card (below) —
  // alpha rises with neon so day windows read as glass, night windows as light.
  const litGlass = kit.glowMat('litGlass', U.warmWindow, 0.7, 0.45);
  const shopGlass = kit.glowMat('shopGlass', '#ffd9a0', 0.8, 0.5);
  const lampHalo = kit.glowMat('lampHalo', U.sodiumGlow, 0.8, 0.5);
  const lampBulb = kit.glowMat('lampBulb', U.sodium, 0.6);
  const spill = kit.glowMat('spill', U.warmWindow, 0.5, 0.35);
  const sunPath = kit.glowMat('sunPath', PALETTE.lake.paleGold, 0.5, 0.55);

  // --- ground, streets, markings -------------------------------------------
  const base = kit.ground('lotBase', 420, 520, kit.envMat('lotBase', '#232529'), {
    pos: [0, -0.01, 100],
  });
  const avenue = kit.uv(kit.box('avenue', 10, 0.04, 240, asphalt, { pos: [-6, 0.02, 80] }), 2.5, 60);
  // Cross street runs west to the lake shore (water edge x≈-75).
  const crossSt = kit.uv(kit.box('crossSt', 150, 0.04, 10, asphalt, { pos: [5, 0.02, 15] }), 37.5, 2.5);
  kit.freeze(base, avenue, crossSt);

  // Sidewalks (0.1m curb) — non-overlapping slabs merged into one static.
  // UVs pre-scaled per slab so the baked 2m expansion-joint grid stays true
  // across the merge (top face is the read; the 0.1m sides don't matter).
  const walk = (w: number, d: number, x: number, z: number): Mesh =>
    kit.uv(kit.box('walk', w, 0.1, d, concrete, { pos: [x, 0.05, z] }), w / 2, d / 2);
  kit.merge('sidewalks', [
    walk(6, 44, 2, -18), // east, south of corner
    walk(6, 64, 2, 58), // east, north of cross street
    walk(4, 44, -14, -18), // west, south
    walk(4, 64, -14, 58), // west, north
    walk(56, 6, 12, 7), // cross-street south walk
    walk(56, 6, 12, 23), // cross-street north walk
  ]).material = concrete;

  // Lane dashes + crosswalk bars: two thin-instanced unit boxes.
  const dash = kit.box('dash', 1, 0.02, 1, yellowPaint);
  const dashXf: Xform[] = [];
  for (let z = -36; z <= 8; z += 6) dashXf.push({ pos: [-6, 0.05, z], scale: [0.14, 1, 1.9] });
  for (let z = 24; z <= 190; z += 6) dashXf.push({ pos: [-6, 0.05, z], scale: [0.14, 1, 1.9] });
  for (let x = -66; x <= -18; x += 6) dashXf.push({ pos: [x, 0.05, 15], scale: [1.9, 1, 0.14] });
  for (let x = 32; x <= 76; x += 6) dashXf.push({ pos: [x, 0.05, 15], scale: [1.9, 1, 0.14] });
  kit.thin(dash, dashXf);

  const bar = kit.box('zebra', 1, 0.02, 1, whitePaint);
  const barXf: Xform[] = [];
  for (let i = 0; i < 6; i++)
    barXf.push({ pos: [-10.3 + i * 1.7, 0.05, 16], scale: [0.7, 1, 3.0] }); // across avenue
  for (let i = 0; i < 3; i++)
    barXf.push({ pos: [2, 0.05, 11.6 + i * 1.7], scale: [3.0, 1, 0.7] }); // across cross street
  // Parking-lane ticks along the west curb where the cars sit.
  for (const z of [-24, -16.5, -9, 25.5, 32.5, 40, 47.5])
    barXf.push({ pos: [-9.35, 0.05, z], scale: [0.12, 1, 1.4] });
  kit.thin(bar, barXf);

  // --- buildings (kit-of-parts: massing + plinth + trim + instanced windows) ---
  // Brick tiles ≈ 2.5m; uv factors picked for the dominant street-facing face.
  const bldgA = kit.uv(kit.box('bldgA', 22, 11, 30, brickA, { pos: [16, 5.5, -5] }), 12, 4.4);
  const bldgB = kit.uv(kit.box('bldgB', 20, 14.5, 38, brickB, { pos: [15, 7.25, 39] }), 15, 5.8);
  const c1 = kit.uv(kit.box('c1', 13, 8, 26, tealGrey, { pos: [-19.5, 4, -13] }), 10.4, 3.2);
  // c2 splits around the cross street (gap z 10..20) so the roadway — and the lake
  // glimpse behind it — stays open instead of dead-ending into a wall.
  const c2s = kit.uv(kit.box('c2s', 13, 12.5, 9, brickWest, { pos: [-19.5, 6.25, 4.5] }), 5.2, 5);
  const c2n = kit.uv(kit.box('c2n', 13, 12.5, 9, brickWest, { pos: [-19.5, 6.25, 25.5] }), 5.2, 5);
  const c3 = kit.uv(kit.box('c3', 13, 9, 30, warmGrey, { pos: [-19.5, 4.5, 47] }), 10, 3);
  kit.freeze(bldgA, bldgB, c1, c2s, c2n, c3);

  kit.merge('plinths', [
    kit.uv(kit.box('pA', 22.4, 0.9, 30.4, brickDeep, { pos: [16, 0.45, -5] }), 20, 0.6),
    kit.uv(kit.box('pB', 20.4, 0.9, 38.4, brickDeep, { pos: [15, 0.45, 39] }), 25, 0.6),
    // West-row plinth breaks at the roadway (z 10..20).
    kit.uv(kit.box('pCs', 13.4, 0.9, 35.7, brickDeep, { pos: [-19.5, 0.45, -8.5] }), 24, 0.6),
    kit.uv(kit.box('pCn', 13.4, 0.9, 41.7, brickDeep, { pos: [-19.5, 0.45, 41.5] }), 28, 0.6),
  ]).material = brickDeep;

  kit.merge('trimset', [
    // Cornices — the roofline "ink" (strong value break against the sky).
    kit.box('coA', 23, 0.55, 31, trim, { pos: [16, 11.2, -5] }),
    kit.box('coB', 21, 0.6, 39, trim, { pos: [15, 14.75, 39] }),
    kit.box('coC1', 14, 0.5, 27, trim, { pos: [-19.5, 8.2, -13] }),
    kit.box('coC2s', 14, 0.5, 10, trim, { pos: [-19.5, 12.7, 4.5] }),
    kit.box('coC2n', 14, 0.5, 10, trim, { pos: [-19.5, 12.7, 25.5] }),
    kit.box('coC3', 14, 0.5, 31, trim, { pos: [-19.5, 9.2, 47] }),
    // Floor bands on the two hero facades.
    kit.box('bA1', 0.14, 0.32, 30.4, trim, { pos: [5, 4.3, -5] }),
    kit.box('bA2', 0.14, 0.32, 30.4, trim, { pos: [5, 7.5, -5] }),
    kit.box('bB1', 0.14, 0.32, 38.4, trim, { pos: [5, 4.1, 39] }),
    kit.box('bB2', 0.14, 0.32, 38.4, trim, { pos: [5, 7.3, 39] }),
    kit.box('bB3', 0.14, 0.32, 38.4, trim, { pos: [5, 10.5, 39] }),
  ]).material = trim;

  // Storefront woodwork — real planks now: kick panels under the display glass,
  // the dark ground-floor band south of the storefront, and the shop door.
  // Vertex tints vary the pieces under ONE textured material (1 draw call).
  kit.merge('woodfront', [
    kit.tint(kit.uv(kit.box('kick1', 0.12, 0.5, 3.4, woodStore, { pos: [4.98, 0.35, 2.2] }), 1.7, 0.25), '#ffffff'),
    kit.tint(kit.uv(kit.box('kick2', 0.12, 0.5, 3.4, woodStore, { pos: [4.98, 0.35, 6.2] }), 1.7, 0.25), '#ffffff'),
    kit.tint(kit.uv(kit.box('gfBand', 0.12, 3.6, 20, woodStore, { pos: [4.96, 1.8, -10] }), 10, 1.8), '#c8c2b8'),
    kit.tint(kit.uv(kit.box('shopDoor', 0.14, 2.5, 1.15, woodStore, { pos: [4.97, 1.35, 8.6] }), 0.6, 1.25), '#5a7078'),
  ]).material = woodStore;

  // --- windows: painted-depth interiors, not glowing stickers -----------------
  // Module: solid frame slab on the wall; in front of it (street side) a painted
  // card, then a translucent glass sheen. Lit rooms get a warm/cool interior card
  // 4.5cm behind the glass — real (if shallow) parallax + painted depth. Blinds,
  // curtains and dark panes vary the rest. Distribution is deterministic (rand).
  const frame = kit.box('winFrame', 1.1, 1.6, 0.12, trim);
  const glassLit = kit.plane('winLit', 0.88, 1.38, litGlass);
  const glassDark = kit.plane('winDark', 0.88, 1.38, darkGlass);
  const roomWarm = kit.canvasPlane('roomWarm', 0.9, 1.4, 96, 148, drawRoomWarm, { fog: true });
  const roomCool = kit.canvasPlane('roomCool', 0.9, 1.4, 96, 148, drawRoomCool, { fog: true });
  const blindsWin = kit.canvasPlane('blindsWin', 0.88, 1.38, 96, 148, drawBlinds, { fog: true });
  const curtainWin = kit.canvasPlane('curtainWin', 0.88, 1.38, 96, 148, drawCurtain, { fog: true });

  const frames: Xform[] = [];
  const litXf: Xform[] = [];
  const darkXf: Xform[] = [];
  const roomWarmXf: Xform[] = [];
  const roomCoolXf: Xform[] = [];
  const blindsXf: Xform[] = [];
  const curtainXf: Xform[] = [];
  // NOTE Babylon plane front faces -Z, so: rotY +PI/2 → faces -X (east-side facades,
  // seen from the street); rotY -PI/2 → faces +X (west row). Verified via probe shots.
  const addWindows = (
    x: number,
    rotY: number,
    floors: number[],
    z0: number,
    cols: number,
    dz: number,
    litOdds: number,
  ): void => {
    const side = rotY > 0 ? -1 : 1; // street side of the wall plane
    const gx = x + side * 0.115; // glass sits just proud of the frame slab
    const rx = x + side * 0.07; // interior card between glass and slab face
    for (const y of floors) {
      for (let i = 0; i < cols; i++) {
        const z = z0 + i * dz;
        frames.push({ pos: [x, y, z], rotY });
        if (rand() < litOdds) {
          const r = rand();
          if (r < 0.72) {
            (r < 0.5 ? roomWarmXf : roomCoolXf).push({ pos: [rx, y, z], rotY });
            litXf.push({ pos: [gx, y, z], rotY });
          } else {
            blindsXf.push({ pos: [gx, y, z], rotY });
          }
        } else {
          (rand() < 0.3 ? curtainXf : darkXf).push({ pos: [gx, y, z], rotY });
        }
      }
    }
  };
  // A's rows sit ABOVE the sign band (sign top y≈5.15; frame bottom 6.05-0.8=5.25).
  addWindows(5, HALF_PI, [6.05, 9.05], -17.5, 8, 3.3, 0.5); // A upper floors
  addWindows(5, HALF_PI, [5.0, 8.2, 11.4], 22.5, 10, 3.3, 0.45); // B
  // West row lights up harder — it carries the left third of the gate shot.
  addWindows(-13, -HALF_PI, [5.0], -24.5, 7, 3.6, 0.55); // C1
  addWindows(-13, -HALF_PI, [5.0, 8.4], 1.9, 2, 3.6, 0.55); // c2 south of the street
  addWindows(-13, -HALF_PI, [5.0, 8.4], 22.4, 2, 3.6, 0.55); // c2 north of the street
  addWindows(-13, -HALF_PI, [5.2], 33.8, 8, 3.6, 0.55); // C3
  kit.thin(frame, frames);
  // Warm variants per pane/room (instance color multiplies the glow/canvas) —
  // kills the "every window is the same yellow quad" read at LATE.
  kit.thin(glassLit, litXf, ['#ffffff', '#ffdba8', '#f5b96e', '#e2d8c0']);
  kit.thin(glassDark, darkXf);
  kit.thin(roomWarm, roomWarmXf, ['#ffffff', '#ffd9b0', '#e8c8a0', '#f5e6c8']);
  kit.thin(roomCool, roomCoolXf, ['#ffffff', '#b8d0e8', '#d8e0d0']);
  kit.thin(blindsWin, blindsXf, ['#ffffff', '#ffe0b0', '#e0cfa8']);
  kit.thin(curtainWin, curtainXf, ['#ffffff', '#d8b8a8', '#c0a8b8']);

  // --- the storefront (LAGOON RECORDS — corner of building A) ---------------
  // Display glass got the same treatment: painted shop interior card behind a
  // translucent pane — record bins and an album wall instead of a glowing sticker.
  const shopWin = kit.plane('shopWin', 3.2, 2.3, shopGlass);
  kit.thin(shopWin, [
    { pos: [4.94, 1.75, 2.2], rotY: HALF_PI },
    { pos: [4.94, 1.75, 6.2], rotY: HALF_PI },
  ]);
  const shopRoom = kit.canvasPlane('shopRoom', 3.24, 2.34, 224, 160, drawShopInterior, {
    fog: true,
  });
  kit.thin(shopRoom, [
    { pos: [4.985, 1.75, 2.2], rotY: HALF_PI },
    { pos: [4.985, 1.75, 6.2], rotY: HALF_PI },
  ]);
  kit.freeze(
    kit.box('awning', 1.9, 0.07, 8.4, awningMat, {
      pos: [4.1, 3.3, 4.2],
      rotZ: 0.3,
    }),
  );
  // Warm light spill on the sidewalk in front of the glass — night dressing.
  const spillPlane = kit.ground('spillPlane', 2.4, 7.4, spill, { pos: [3.6, 0.115, 4.2] });
  kit.freeze(spillPlane);

  const sign = kit.canvasPlane(
    'shopSign',
    8,
    1.2,
    1024,
    154,
    (ctx, w, h) => {
      ctx.fillStyle = '#101828';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = U.sodium;
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#f2e8cf';
      ctx.font = '700 86px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('LAGOON RECORDS', w / 2, h / 2 + 30);
    },
    undefined,
    // x=4.87: proud of the window glass plane (4.885) so nothing draws over the sign.
    { pos: [4.87, 4.55, 3.8], rotY: HALF_PI },
  );
  kit.freeze(sign);

  // Dive-bar blade sign on building B — the magenta/violet club-palette accent.
  const blade = kit.canvasPlane(
    'bladeSign',
    1.05,
    3.4,
    160,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2a0d22';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = PALETTE.club.violet;
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = PALETTE.club.magenta;
      ctx.font = '700 92px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < 4; i++) ctx.fillText('LOON'[i]!, w / 2, 118 + i * 112);
    },
    undefined,
    { pos: [4.35, 8.6, 21.9] }, // perpendicular blade; -Z front faces the camera vista
  );
  kit.freeze(blade);

  // --- street dressing: the stuff that proves people live here ----------------

  // Flyer board by the record store door — gig posters, lost cat, tear-tabs.
  const flyers = kit.canvasPlane('flyers', 1.5, 1.1, 192, 144, drawFlyers, { lit: true }, {
    pos: [4.93, 1.7, -1.6],
    rotY: HALF_PI,
  });
  kit.freeze(flyers);

  // Sandwich board on the walk (between the NPC lanes at x 1.3 / 3.2):
  // proper A-frame — two faces pitched toward each other, meeting at the top.
  const boardFace = kit.canvasPlane('boardFace', 0.7, 0.95, 96, 136, drawSandwich, { lit: true });
  const board2 = kit.plane('boardFace2', 0.7, 0.95, boardFace.material!);
  kit.merge('sandwichBoard', [
    apply2(boardFace, { pos: [2.06, 0.46, 5.2], rotY: HALF_PI, rotX: 0.24 }),
    apply2(board2, { pos: [2.44, 0.46, 5.2], rotY: -HALF_PI, rotX: 0.24 }),
  ]);

  // Mural on building B's blank south wall — Minneapolis-flavored, faces the
  // corner. Scene-lit (it's paint, not neon): shade at EVE, brick-dark at LATE.
  const mural = kit.canvasPlane('mural', 11, 8.5, 512, 396, drawMural, { lit: true }, {
    pos: [14.5, 7.4, 19.93],
  });
  kit.freeze(mural);

  // Graffiti tag in the alley hint (building A's south wall, above the dumpster).
  const tag = kit.canvasPlane('alleyTag', 2.4, 1.2, 256, 128, drawTag, { lit: true, alpha: true }, {
    pos: [10.5, 1.9, -20.06],
  });
  kit.freeze(tag);

  // Utility poles (west walk curbline, clear of the -13.0 NPC lane).
  const poleParts = [
    kit.tint(kit.cyl('upole', { h: 7.2, d: 0.26, tess: 8 }, moduleWhite, { pos: [0, 3.6, 0] }), '#4b3a2a'),
    kit.tint(kit.box('uarm', 1.7, 0.1, 0.12, moduleWhite, { pos: [0, 6.75, 0] }), '#3e3022'),
    kit.tint(kit.cyl('utfm', { h: 0.85, d: 0.55, tess: 8 }, moduleWhite, { pos: [0.42, 5.9, 0] }), '#4a5054'),
  ];
  const upole = kit.merge('upoleMod', poleParts);
  upole.material = moduleWhite;
  kit.thin(upole, [
    { pos: [-12.4, 0, -22] },
    { pos: [-12.4, 0, 21.5] },
    { pos: [-12.4, 0, 62] },
  ]);

  // Overhead wires: pole-to-pole runs + two sagging service drops across the
  // intersection to the east buildings — the classic "existed yesterday" sky ink.
  const wire = kit.box('wire', 0.03, 0.03, 1, inkMat);
  const wireXf: Xform[] = [];
  const wireSpan = (a: [number, number, number], b: [number, number, number], sag: number): void => {
    const mid: [number, number, number] = [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2 - sag,
      (a[2] + b[2]) / 2,
    ];
    for (const [p, q] of [
      [a, mid],
      [mid, b],
    ] as const) {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const dz = q[2] - p[2];
      const len = Math.hypot(dx, dy, dz);
      wireXf.push({
        pos: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2],
        rotY: Math.atan2(dx, dz),
        rotX: -Math.asin(dy / len),
        scale: [1, 1, len],
      });
    }
  };
  for (const ax of [-13.1, -11.7]) {
    wireSpan([ax, 6.72, -22], [ax, 6.72, 21.5], 0.5);
    wireSpan([ax, 6.72, 21.5], [ax, 6.72, 62], 0.55);
  }
  wireSpan([-12.4, 6.6, 21.5], [4.9, 9.6, 9.7], 0.9); // drop to bldg A's corner
  wireSpan([-12.4, 6.6, 21.5], [4.9, 10.4, 24.2], 0.8); // drop to bldg B
  kit.thin(wire, wireXf, ['#14161a']);

  // Window AC units, dripping off a few upper windows (module protrudes ~0.35m).
  const acParts = [
    kit.tint(kit.box('acBody', 0.72, 0.52, 0.55, moduleWhite, { pos: [0, 0, 0] }), '#9aa0a0'),
    kit.tint(kit.box('acFace', 0.6, 0.4, 0.06, moduleWhite, { pos: [0, 0, -0.28] }), '#6e7676'),
  ];
  const ac = kit.merge('acMod', acParts);
  ac.material = moduleWhite;
  kit.thin(
    ac,
    [
      { pos: [4.82, 5.35, -14.2], rotY: HALF_PI },
      { pos: [4.82, 8.35, -7.6], rotY: HALF_PI },
      { pos: [4.82, 4.3, 25.8], rotY: HALF_PI },
      { pos: [4.82, 7.5, 42.3], rotY: HALF_PI },
      { pos: [4.82, 10.7, 32.4], rotY: HALF_PI },
      { pos: [-12.82, 7.7, 3.7], rotY: -HALF_PI },
      { pos: [-12.82, 4.4, 51.8], rotY: -HALF_PI },
    ],
    ['#ffffff', '#e8e0d0', '#d8dce0'],
  );

  // Trash cans (wall/curb side, clear of NPC lanes).
  const canParts = [
    kit.tint(kit.cyl('canBody', { h: 0.85, d: 0.6, dTop: 0.56, tess: 10 }, moduleWhite, { pos: [0, 0.43, 0] }), '#31473a'),
    kit.tint(kit.cyl('canLid', { h: 0.07, d: 0.64, tess: 10 }, moduleWhite, { pos: [0, 0.89, 0] }), '#243530'),
  ];
  const can = kit.merge('canMod', canParts);
  can.material = moduleWhite;
  kit.thin(
    can,
    [
      { pos: [4.3, 0.1, -6.5] },
      { pos: [2.5, 0.1, 24.6] },
      { pos: [-12.32, 0.1, 44] },
    ],
    ['#ffffff', '#d8d0c0', '#c8d8cc'],
  );

  // Bike rack row along the avenue curb + two locked bikes.
  const rackParts = [
    kit.tint(kit.cyl('rackL1', { h: 0.72, d: 0.06, tess: 8 }, moduleWhite, { pos: [0, 0.36, -0.35] }), '#5a6068'),
    kit.tint(kit.cyl('rackL2', { h: 0.72, d: 0.06, tess: 8 }, moduleWhite, { pos: [0, 0.36, 0.35] }), '#5a6068'),
    kit.tint(kit.cyl('rackTop', { h: 0.76, d: 0.06, tess: 8 }, moduleWhite, { pos: [0, 0.72, 0], rotX: HALF_PI }), '#5a6068'),
  ];
  const rack = kit.merge('rackMod', rackParts);
  rack.material = moduleWhite;
  kit.thin(rack, [
    { pos: [0.1, 0.1, -7.6] },
    { pos: [0.1, 0.1, -6.1] },
    { pos: [0.1, 0.1, -4.6] },
  ]);
  const bikeParts = [
    // wheels: thin cylinders, axis along x (rotZ) so the wheel plane faces ±x
    kit.tint(kit.cyl('bw1', { h: 0.045, d: 0.62, tess: 12 }, moduleWhite, { pos: [0, 0.31, -0.5], rotZ: HALF_PI }), '#17181d'),
    kit.tint(kit.cyl('bw2', { h: 0.045, d: 0.62, tess: 12 }, moduleWhite, { pos: [0, 0.31, 0.5], rotZ: HALF_PI }), '#17181d'),
    // frame: two diagonals + seat/head tubes, chunky box-art
    kit.tint(kit.box('bf1', 0.05, 0.05, 0.78, moduleWhite, { pos: [0, 0.58, 0], rotX: 0.32 }), '#8a3a30'),
    kit.tint(kit.box('bf2', 0.05, 0.45, 0.05, moduleWhite, { pos: [0, 0.62, -0.42], rotX: -0.25 }), '#8a3a30'),
    kit.tint(kit.box('bf3', 0.05, 0.4, 0.05, moduleWhite, { pos: [0, 0.66, 0.44], rotX: 0.2 }), '#8a3a30'),
    kit.tint(kit.box('bbar', 0.34, 0.045, 0.045, moduleWhite, { pos: [0, 0.92, 0.48] }), '#2a2c30'),
    kit.tint(kit.box('bseat', 0.14, 0.05, 0.22, moduleWhite, { pos: [0, 0.86, -0.44] }), '#1f2126'),
  ];
  const bike = kit.merge('bikeMod', bikeParts);
  bike.material = moduleWhite;
  kit.thin(
    bike,
    [
      { pos: [0.38, 0.1, -7.55], rotZ: 0.1, rotY: 0.12 },
      { pos: [-0.2, 0.1, -6.0], rotZ: -0.12, rotY: -3.05 },
    ],
    ['#ffffff', '#a8c0d8'],
  );

  // Planters with late-season flowers (marigold orange / aster purple pops).
  const planterParts = [
    kit.tint(kit.box('plBox', 0.9, 0.45, 0.9, moduleWhite, { pos: [0, 0.22, 0] }), '#5a4a3c'),
    kit.tint(kit.box('plSoil', 0.78, 0.06, 0.78, moduleWhite, { pos: [0, 0.46, 0] }), '#2a2018'),
    kit.tint(kit.sphere('plBush', 0.55, moduleWhite, { pos: [0, 0.62, 0] }, 6), '#3d5a34'),
    kit.tint(kit.sphere('plBush2', 0.4, moduleWhite, { pos: [0.22, 0.58, 0.18] }, 6), '#4a6a3c'),
    kit.tint(kit.sphere('plFlwA', 0.2, moduleWhite, { pos: [-0.16, 0.76, -0.1] }, 6), '#d88a2e'),
    kit.tint(kit.sphere('plFlwB', 0.16, moduleWhite, { pos: [0.2, 0.78, 0.14] }, 6), '#8a5aa8'),
    kit.tint(kit.sphere('plFlwC', 0.14, moduleWhite, { pos: [0.02, 0.82, 0.22] }, 6), '#c4522e'),
  ];
  const planter = kit.merge('planterMod', planterParts);
  planter.material = moduleWhite;
  kit.thin(
    planter,
    [
      { pos: [4.45, 0.1, -0.3], rotY: 0.3 },
      { pos: [4.45, 0.1, 6.95], rotY: 1.8 },
      { pos: [0.2, 0.1, 24.8], rotY: 4.1 },
      { pos: [-12.3, 0.1, 33], rotY: 2.4, scale: [0.9, 0.9, 0.9] },
    ],
    ['#ffffff', '#e8ddc8', '#d8e0d0', '#e0d0c0'],
  );

  // Storm drains at the gutters (flat lit decals) + painted no-parking curb.
  const drain = kit.canvasPlane('drain', 0.95, 0.5, 96, 48, drawDrain, { lit: true });
  kit.thin(drain, [
    { pos: [-1.55, 0.045, 6.4], rotX: HALF_PI },
    { pos: [1.2, 0.045, 10.65], rotX: HALF_PI, rotY: HALF_PI },
  ]);

  // Alley hint south of building A: dumpster, leaning pallet, boxes.
  const alleyParts = [
    kit.tint(kit.box('dumpBody', 1.9, 1.05, 1.0, moduleWhite, { pos: [9, 0.72, -21.6] }), '#3a5244'),
    kit.tint(kit.box('dumpLid', 1.95, 0.07, 1.05, moduleWhite, { pos: [9, 1.3, -21.62], rotX: -0.14 }), '#2e4438'),
    kit.tint(kit.box('dumpFoot', 1.7, 0.2, 0.85, moduleWhite, { pos: [9, 0.1, -21.6] }), '#243028'),
    kit.tint(kit.box('pallet', 0.9, 1.1, 0.09, moduleWhite, { pos: [6.4, 0.62, -20.4], rotX: -0.18 }), '#6a5638'),
    kit.tint(kit.box('crate1', 0.55, 0.4, 0.45, moduleWhite, { pos: [11.3, 0.3, -20.9], rotY: 0.4 }), '#8a7048'),
    kit.tint(kit.box('crate2', 0.45, 0.35, 0.4, moduleWhite, { pos: [11.1, 0.68, -20.95], rotY: 0.15 }), '#7a6440'),
  ];
  const alley = kit.merge('alley', alleyParts);
  alley.material = moduleWhite;

  // --- streetlights (sodium) -------------------------------------------------
  // Module: pole + arm + head shell merged (ink), halo as a thin-instanced glow sphere.
  const lampParts = [
    kit.tint(kit.cyl('pole', { h: 5.6, d: 0.14, tess: 8 }, inkMat, { pos: [0, 2.8, 0] }), '#1f2126'),
    kit.tint(
      kit.cyl('arm', { h: 1.6, d: 0.09, tess: 8 }, inkMat, { pos: [-0.8, 5.5, 0], rotZ: HALF_PI }),
      '#1f2126',
    ),
    kit.tint(kit.box('head', 0.6, 0.16, 0.26, inkMat, { pos: [-1.5, 5.42, 0] }), '#1f2126'),
  ];
  const lamp = kit.merge('lamp', lampParts);
  lamp.material = moduleWhite;
  const lampXf: Xform[] = [
    { pos: [-0.7, 0, -13] }, // just behind the default camera — frames the left edge
    { pos: [-0.7, 0, 7] },
    { pos: [-11.3, 0, 26], rotY: Math.PI },
  ];
  kit.thin(lamp, lampXf);
  // Lamp glow = bright bulb plate tight under the head + a small soft halo AROUND it
  // (halo centered on the head, not floating below — the "orb" read is gone).
  const headOffsets = lampXf.map(
    (xf) => [xf.pos[0] + (xf.rotY ? 1.5 : -1.5), xf.pos[2]] as const,
  );
  const bulb = kit.box('bulb', 0.44, 0.05, 0.18, lampBulb);
  kit.thin(
    bulb,
    headOffsets.map(([x, z]) => ({ pos: [x, 5.33, z] as [number, number, number] })),
  );
  const halo = kit.sphere('halo', 0.42, lampHalo, undefined, 8);
  kit.thin(
    halo,
    headOffsets.map(([x, z]) => ({ pos: [x, 5.4, z] as [number, number, number] })),
  );

  // --- parked cars (box-art, vertex-tinted parts, per-instance paint) --------
  const carParts = [
    kit.tint(kit.box('carBody', 1.75, 0.52, 4.1, moduleWhite, { pos: [0, 0.56, 0] }), '#e8e8e8'),
    kit.tint(kit.box('carCab', 1.58, 0.44, 2.0, moduleWhite, { pos: [0, 1.02, -0.15] }), '#7d94a8'),
    ...[-1, 1].flatMap((sx) =>
      [-1.3, 1.3].map((wz) =>
        kit.tint(
          kit.cyl('wheel', { h: 0.2, d: 0.62, tess: 10 }, moduleWhite, {
            pos: [sx * 0.85, 0.31, wz],
            rotZ: HALF_PI,
          }),
          '#17181d',
        ),
      ),
    ),
  ];
  const car = kit.merge('car', carParts);
  car.material = moduleWhite;
  kit.thin(
    car,
    [
      { pos: [-10.4, 0, -20], rotY: 0.02 },
      { pos: [-10.4, 0, -13], rotY: -0.015 },
      { pos: [-10.4, 0, 29], rotY: 0.01 },
      { pos: [-10.4, 0, 36], rotY: 0.03 },
      { pos: [-10.4, 0, 44], rotY: -0.02 },
      { pos: [-1.7, 0, 47], rotY: Math.PI + 0.02 },
    ],
    ['#7c8894', '#8a5344', '#42596b', '#54524a', '#96938a', '#5c3a44'],
  );

  // --- boulevard trees (late summer) -----------------------------------------
  const treeParts = [
    kit.tint(kit.cyl('trunk', { h: 2.8, d: 0.24, tess: 8 }, moduleWhite, { pos: [0, 1.4, 0] }), '#3a2d22'),
    kit.tint(kit.sphere('can1', 2.7, moduleWhite, { pos: [0, 3.5, 0] }, 8), '#2f4a38'),
    kit.tint(kit.sphere('can2', 2.0, moduleWhite, { pos: [0.35, 4.4, 0.2] }, 8), '#39543c'),
  ];
  const tree = kit.merge('tree', treeParts);
  tree.material = moduleWhite;
  kit.thin(
    tree,
    [
      { pos: [3.6, 0.1, -30], rotY: 1.1 },
      { pos: [3.6, 0.1, -16], rotY: 2.6, scale: [1.1, 1.15, 1.1] },
      { pos: [3.6, 0.1, 34], rotY: 0.4 },
      { pos: [3.6, 0.1, 48], rotY: 4.2, scale: [0.9, 0.95, 0.9] },
      { pos: [-13.6, 0.1, -24], rotY: 3.3 },
      { pos: [-13.6, 0.1, 40], rotY: 5.1, scale: [1.05, 1.2, 1.05] },
      { pos: [-13.6, 0.1, 62], rotY: 0.9 },
    ],
    ['#ffffff', '#e8f0dd', '#d8e4c8', '#f0e6d0'],
  );

  // --- street furniture --------------------------------------------------------
  // Hydrant: body + bonnet cap + side nozzles so it doesn't read as a traffic cone.
  const hydrantParts = [
    kit.tint(kit.cyl('hyBody', { h: 0.5, d: 0.3, dTop: 0.26, tess: 8 }, moduleWhite, { pos: [3.9, 0.35, -9] }), '#a33b2e'),
    kit.tint(kit.sphere('hyCap', 0.22, moduleWhite, { pos: [3.9, 0.64, -9] }, 8), '#7d2b22'),
    kit.tint(kit.cyl('hyNozL', { h: 0.14, d: 0.12, tess: 8 }, moduleWhite, { pos: [3.72, 0.42, -9], rotZ: HALF_PI }), '#7d2b22'),
    kit.tint(kit.cyl('hyNozR', { h: 0.14, d: 0.12, tess: 8 }, moduleWhite, { pos: [4.08, 0.42, -9], rotZ: HALF_PI }), '#7d2b22'),
  ];
  kit.merge('hydrant', hydrantParts).material = moduleWhite;
  // Bench against the wall (faces the avenue) + corner street-sign pole
  // + the painted no-parking curb by the hydrant.
  const benchParts = [
    kit.tint(kit.box('seat', 0.5, 0.09, 1.8, moduleWhite, { pos: [4.5, 0.55, -3.4] }), '#4a3b2c'),
    kit.tint(kit.box('back', 0.08, 0.5, 1.8, moduleWhite, { pos: [4.72, 0.92, -3.4] }), '#4a3b2c'),
    kit.tint(kit.box('legF', 0.45, 0.55, 0.08, moduleWhite, { pos: [4.5, 0.28, -4.15] }), '#23262c'),
    kit.tint(kit.box('legB', 0.45, 0.55, 0.08, moduleWhite, { pos: [4.5, 0.28, -2.65] }), '#23262c'),
    kit.tint(kit.cyl('signPole', { h: 3.1, d: 0.07, tess: 6 }, moduleWhite, { pos: [2.9, 1.55, 8.9] }), '#2c2f35'),
    kit.tint(kit.box('signPlate1', 0.85, 0.2, 0.03, moduleWhite, { pos: [2.9, 2.85, 8.9] }), '#1f6b3a'),
    kit.tint(
      kit.box('signPlate2', 0.03, 0.2, 0.85, moduleWhite, { pos: [2.9, 2.62, 8.9] }),
      '#1f6b3a',
    ),
    kit.tint(kit.box('curbPaint', 0.28, 0.115, 5.5, moduleWhite, { pos: [-0.88, 0.062, -9] }), '#c9a53a'),
  ];
  kit.merge('furniture', benchParts).material = moduleWhite;

  // --- backdrop: skyline silhouette + lake glimpse ---------------------------
  // The tower layout is deterministic (seeded) so the lit/unlit repaint in
  // applyNeon changes ONLY the windows — playtest p2's baked-night-skyline-at-MORN
  // bug dies here.
  const drawSkyline = (ctx: Canvas2D, w: number, h: number, litWindows: boolean): void => {
    ctx.clearRect(0, 0, w, h);
    const r = makeRand(0xa11ce);
    // Far layer.
    ctx.fillStyle = PALETTE.skyline.silhouetteFar;
    for (let x = 0; x < w; x += 30 + r() * 40) {
      const bh = h * (0.25 + r() * 0.35);
      ctx.fillRect(x, h - bh, 24 + r() * 36, bh);
    }
    // Near layer with lit windows.
    ctx.fillStyle = PALETTE.skyline.silhouette;
    const towers: Array<[number, number, number]> = [];
    for (let x = 6; x < w - 40; x += 44 + r() * 52) {
      const bw = 26 + r() * 42;
      const bh = h * (0.35 + r() * 0.45);
      towers.push([x, bw, bh]);
      ctx.fillRect(x, h - bh, bw, bh);
    }
    // The IDS-ish tallest slab + a Foshay-ish spire — signature reads (docs/01).
    ctx.fillRect(w * 0.52, h * 0.08, 64, h * 0.92);
    towers.push([w * 0.52, 64, h * 0.92]);
    ctx.fillRect(w * 0.4, h * 0.3, 16, h * 0.7);
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.3);
    ctx.lineTo(w * 0.4 + 8, h * 0.18);
    ctx.lineTo(w * 0.4 + 16, h * 0.3);
    ctx.fill();
    // Lit windows (skipped in day phases — the towers hold the silhouette alone).
    if (litWindows) {
      ctx.fillStyle = PALETTE.skyline.window;
      for (const [tx, tw, th] of towers) {
        for (let wy = h - th + 6; wy < h - 8; wy += 9) {
          for (let wx = tx + 4; wx < tx + tw - 4; wx += 8) {
            if (r() < 0.24) ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
  };
  const skyline = kit.canvasPlane(
    'skyline',
    460,
    95,
    1024,
    212,
    (ctx, w, h) => drawSkyline(ctx, w, h, true),
    { alpha: true, fog: false },
    { pos: [-20, 39, 330] }, // -Z front faces the camera up the avenue
  );
  kit.freeze(skyline);

  // Ground haze band across the avenue at distance — cheap aerial depth the
  // linear fog can't localize. Repainted per phase from applyNeon.
  const haze = kit.canvasPlane(
    'haze',
    100,
    15,
    128,
    64,
    (ctx, w, h) => drawHaze(ctx, w, h, 0.55),
    { alpha: true, fog: false },
    { pos: [-6, 6.2, 218] },
  );
  kit.freeze(haze);

  // Lake glimpse down the cross street (west): cold water + a low-sun path.
  // Water sits ABOVE the lot base (y -0.01) — it was previously buried under it —
  // with a concrete shore lip where the roadway ends (x≈-75..-70).
  kit.freeze(kit.ground('lake', 150, 150, waterMat, { pos: [-150, 0.01, 20] }));
  kit.freeze(kit.ground('lakePath', 70, 6, sunPath, { pos: [-112, 0.025, 15] }));
  kit.freeze(kit.uv(kit.box('shore', 5, 0.1, 150, concrete, { pos: [-72.5, 0.05, 20] }), 2.5, 75));

  // --- phase dressing ---------------------------------------------------------
  let skylineLit = true;
  const applyNeon = (level: number): void => {
    // Same 0.8 cap as the shop panes — no raw-quad blowout up close at LATE.
    // Alpha rises with neon: day windows read as glass, night windows as light.
    kit.setGlow(litGlass, U.warmWindow, 0.18 + 0.62 * level, 0.28 + 0.3 * level);
    kit.setGlow(shopGlass, '#ffd9a0', 0.3 + 0.5 * level, 0.32 + 0.28 * level);
    // Painted interiors dim with daylight (a lamp fighting the sun loses).
    kit.setCanvasLevel(roomWarm, 0.18 + 0.82 * level);
    kit.setCanvasLevel(roomCool, 0.14 + 0.66 * level);
    kit.setCanvasLevel(blindsWin, 0.14 + 0.8 * level);
    kit.setCanvasLevel(curtainWin, 0.08 + 0.38 * level);
    kit.setCanvasLevel(shopRoom, 0.3 + 0.7 * level);
    // Halos square with level so they're shy at dusk and dominant only at night;
    // the bulb plate carries the "lamp is ON" read, the halo just softens it.
    kit.setGlow(lampBulb, U.sodium, 0.25 + 0.75 * level);
    kit.setGlow(lampHalo, U.sodiumGlow, 0.1 + 0.7 * level * level, 0.02 + 0.3 * level * level);
    kit.setGlow(spill, U.warmWindow, 0.55 * level, 0.4 * level);
    // Signs stop glowing in daylight (the playtest "always-on neon" tell):
    // painted-sign read by day, tube glow after dusk.
    kit.setCanvasLevel(sign, 0.55 + 0.45 * level);
    kit.setCanvasLevel(blade, 0.25 + 0.75 * level);
    // Skyline windows follow the phase (lit only when the city would be) —
    // repaint only on the lit/unlit flip, not per call.
    const lit = level > 0.15;
    if (lit !== skylineLit) {
      skylineLit = lit;
      kit.repaint(skyline, (ctx, w, h) => drawSkyline(ctx, w, h, lit));
    }
    kit.repaint(haze, (ctx, w, h) => drawHaze(ctx, w, h, level));
  };
  applyNeon(0.55); // EVE default

  return {
    applyNeon,
    playerSpawn: [0.9, 0.1, -5], // sidewalk, camera clear of the near lamp pole
    // minX reaches west along the cross street so the lake glimpse is walkable
    // (M1 has no collision — the west row can be clipped through; fine until M2).
    bounds: { minX: -60, maxX: 4.3, minZ: -34, maxZ: 88 },
  };
}

// ---------------------------------------------------------------------------
// Canvas painters — every "someone lives here" texture, deterministic, no
// trademarks (docs/01 controversy contract §5 spirit applies to brands too).
// ---------------------------------------------------------------------------

/** Re-apply an Xform to an already-built mesh (for one-off merge parts). */
function apply2(mesh: Mesh, xf: Xform): Mesh {
  mesh.position.set(xf.pos[0], xf.pos[1], xf.pos[2]);
  if (xf.rotX) mesh.rotation.x = xf.rotX;
  if (xf.rotY) mesh.rotation.y = xf.rotY;
  if (xf.rotZ) mesh.rotation.z = xf.rotZ;
  if (xf.scale) mesh.scaling.set(xf.scale[0], xf.scale[1], xf.scale[2]);
  return mesh;
}

/** Warm lived-in room: back wall, lamp pool, sofa + frame silhouettes, curtains. */
function drawRoomWarm(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#0a0705';
  ctx.fillRect(0, 0, w, h);
  // back wall (painted depth: inset, low)
  ctx.fillStyle = '#b06a30';
  ctx.fillRect(w * 0.13, h * 0.3, w * 0.74, h * 0.62);
  ctx.fillStyle = '#8a4e22';
  ctx.fillRect(w * 0.13, h * 0.3, w * 0.74, h * 0.08); // ceiling shadow line
  // lamp pool
  const g = ctx.createRadialGradient(w * 0.68, h * 0.42, 2, w * 0.68, h * 0.42, w * 0.34);
  g.addColorStop(0, 'rgba(255,220,150,0.95)');
  g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // picture frame + sofa back silhouette
  ctx.fillStyle = '#5a3416';
  ctx.fillRect(w * 0.24, h * 0.4, w * 0.18, h * 0.16);
  ctx.fillStyle = '#2a1608';
  ctx.fillRect(w * 0.13, h * 0.72, w * 0.5, h * 0.2);
  // side curtains
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(0, 0, w * 0.11, h);
  ctx.fillRect(w * 0.89, 0, w * 0.11, h);
}

/** Cool room: TV flicker against a slate wall, plant silhouette. */
function drawRoomCool(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#31404e';
  ctx.fillRect(w * 0.12, h * 0.28, w * 0.76, h * 0.64);
  const g = ctx.createRadialGradient(w * 0.42, h * 0.58, 2, w * 0.42, h * 0.58, w * 0.4);
  g.addColorStop(0, 'rgba(140,200,235,0.9)');
  g.addColorStop(1, 'rgba(140,200,235,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#10161c'; // the TV itself
  ctx.fillRect(w * 0.32, h * 0.5, w * 0.22, h * 0.16);
  ctx.fillStyle = '#0c1410'; // plant
  ctx.beginPath();
  ctx.arc(w * 0.76, h * 0.62, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.73, h * 0.66, w * 0.06, h * 0.24);
  ctx.fillStyle = '#141a20';
  ctx.fillRect(0, 0, w * 0.1, h);
  ctx.fillRect(w * 0.9, 0, w * 0.1, h);
}

/** Blinds down, light on behind — slats with one bent low slat. */
function drawBlinds(ctx: Canvas2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f0b868');
  g.addColorStop(1, '#a87838');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#463421';
  const slat = h / 13;
  for (let y = 0; y < h - slat; y += slat) ctx.fillRect(0, y, w, slat * 0.62);
  // one askew slat near the bottom — the imperfection that sells it
  ctx.save();
  ctx.translate(w / 2, h * 0.86);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#3a2b1a';
  ctx.fillRect(-w / 2, -slat * 0.3, w, slat * 0.62);
  ctx.restore();
}

/** Curtains drawn, thin warm slit between them. */
function drawCurtain(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#150d0a';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(w * 0.4, 0, w * 0.6, 0);
  g.addColorStop(0, 'rgba(190,110,50,0)');
  g.addColorStop(0.5, 'rgba(220,140,70,0.85)');
  g.addColorStop(1, 'rgba(190,110,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(w * 0.38, 0, w * 0.24, h);
  ctx.fillStyle = '#3a1d22';
  ctx.fillRect(0, 0, w * 0.42, h);
  ctx.fillRect(w * 0.58, 0, w * 0.42, h);
  ctx.strokeStyle = '#4e2a30';
  ctx.lineWidth = 3;
  for (const fx of [0.1, 0.2, 0.31, 0.69, 0.8, 0.9]) {
    ctx.beginPath();
    ctx.moveTo(w * fx, 0);
    ctx.lineTo(w * (fx + 0.02), h);
    ctx.stroke();
  }
}

/** LAGOON RECORDS interior: album wall, bins, hanging bulbs. */
function drawShopInterior(ctx: Canvas2D, w: number, h: number): void {
  const r = makeRandLocal(0xd15c5);
  ctx.fillStyle = '#241206';
  ctx.fillRect(0, 0, w, h);
  // back wall with album grid
  ctx.fillStyle = '#4e2c14';
  ctx.fillRect(w * 0.06, h * 0.12, w * 0.88, h * 0.5);
  const palette = ['#c46a3a', '#3f7a8c', '#b8a04e', '#7a3a52', '#4e6a48', '#2a3c5c'];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 9; gx++) {
      if (r() < 0.85) {
        ctx.fillStyle = palette[Math.floor(r() * palette.length)]!;
        ctx.fillRect(w * (0.09 + gx * 0.095), h * (0.16 + gy * 0.15), w * 0.075, h * 0.11);
      }
    }
  }
  // record bins (two rows, tilted sleeves)
  ctx.fillStyle = '#38200e';
  ctx.fillRect(w * 0.04, h * 0.66, w * 0.92, h * 0.3);
  for (let i = 0; i < 14; i++) {
    ctx.save();
    ctx.translate(w * (0.08 + i * 0.065), h * 0.82);
    ctx.rotate(-0.18 + r() * 0.12);
    ctx.fillStyle = palette[Math.floor(r() * palette.length)]!;
    ctx.fillRect(-w * 0.025, -h * 0.12, w * 0.05, h * 0.24);
    ctx.restore();
  }
  // hanging bulbs
  for (const bx of [0.3, 0.7]) {
    ctx.strokeStyle = '#140a04';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * bx, 0);
    ctx.lineTo(w * bx, h * 0.1);
    ctx.stroke();
    const g = ctx.createRadialGradient(w * bx, h * 0.13, 1, w * bx, h * 0.13, w * 0.09);
    g.addColorStop(0, 'rgba(255,225,160,1)');
    g.addColorStop(1, 'rgba(255,225,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(w * (bx - 0.1), 0, w * 0.2, h * 0.3);
  }
}

/** Flyer board: cork, taped gig posters, lost-cat sheet with tear tabs. */
function drawFlyers(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#4e3820';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  const poster = (
    x: number,
    y: number,
    pw: number,
    ph: number,
    rot: number,
    bg: string,
    lines: string[],
    ink: string,
  ): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = bg;
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(ph * 0.2)}px system-ui, sans-serif`;
    lines.forEach((t, i) => ctx.fillText(t, 0, -ph / 2 + ph * 0.3 + i * ph * 0.26));
    ctx.restore();
  };
  poster(w * 0.22, h * 0.32, w * 0.3, h * 0.46, -0.06, '#e8dcc0', ['SHOW', 'FRI @', 'the LOON'], '#8e1f3a');
  poster(w * 0.55, h * 0.28, w * 0.26, h * 0.38, 0.05, '#c8d8d0', ['LOST', 'CAT'], '#22303a');
  poster(w * 0.82, h * 0.38, w * 0.24, h * 0.5, -0.03, '#d8c8a8', ['DRUMMER', 'WANTED', 'has van?'], '#3a2a1a');
  poster(w * 0.32, h * 0.74, w * 0.34, h * 0.34, 0.04, '#e0d0e8', ['YARD SALE', 'SAT — 9a'], '#40284e');
  // tear tabs under the lost-cat sheet
  ctx.fillStyle = '#c8d8d0';
  for (let i = 0; i < 6; i++) {
    if (i === 2) continue; // one tab already taken — someone cares
    ctx.fillRect(w * (0.45 + i * 0.038), h * 0.5, w * 0.028, h * 0.12);
  }
}

/** Sandwich board: chalk special. */
function drawSandwich(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#5c4a30';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e2024';
  ctx.fillRect(w * 0.08, h * 0.07, w * 0.84, h * 0.86);
  ctx.fillStyle = '#e8e4d8';
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(h * 0.14)}px Georgia, serif`;
  ctx.fillText('USED', w / 2, h * 0.28);
  ctx.fillText('VINYL', w / 2, h * 0.45);
  ctx.font = `700 ${Math.round(h * 0.18)}px Georgia, serif`;
  ctx.fillStyle = '#f2a13c';
  ctx.fillText('½ OFF', w / 2, h * 0.66);
  ctx.strokeStyle = '#e8e4d8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.8);
  ctx.lineTo(w * 0.62, h * 0.8);
  ctx.lineTo(w * 0.56, h * 0.74);
  ctx.moveTo(w * 0.62, h * 0.8);
  ctx.lineTo(w * 0.56, h * 0.86);
  ctx.stroke();
}

/** The mural: loon on the lake under a sodium sun, UPTOWN lettering. Flat
 *  comic shapes in district palette — reads at 60m, no trademarks. */
function drawMural(ctx: Canvas2D, w: number, h: number): void {
  // field
  ctx.fillStyle = '#1d4457';
  ctx.fillRect(0, 0, w, h);
  // sun + rays
  ctx.fillStyle = '#f2a13c';
  ctx.beginPath();
  ctx.arc(w * 0.26, h * 0.3, h * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,161,60,0.5)';
  ctx.lineWidth = 7;
  for (let i = 0; i < 9; i++) {
    const a = -0.6 + i * 0.26;
    ctx.beginPath();
    ctx.moveTo(w * 0.26 + Math.cos(a) * h * 0.2, h * 0.3 + Math.sin(a) * h * 0.2);
    ctx.lineTo(w * 0.26 + Math.cos(a) * h * 0.3, h * 0.3 + Math.sin(a) * h * 0.3);
    ctx.stroke();
  }
  // skyline silhouettes
  ctx.fillStyle = '#2b2547';
  for (const [bx, bw, bh] of [
    [0.52, 0.07, 0.3],
    [0.6, 0.05, 0.42],
    [0.66, 0.09, 0.34],
    [0.76, 0.05, 0.26],
  ] as const) {
    ctx.fillRect(w * bx, h * (0.62 - bh), w * bw, h * bh);
  }
  // lake band + waves
  ctx.fillStyle = '#3fa8c4';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = '#1d5a74';
  ctx.lineWidth = 6;
  for (const wy of [0.72, 0.82]) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 8) {
      const y = h * wy + (x / (w / 8)) % 2 * 6 - 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.quadraticCurveTo(x - w / 16, y - 8, x, y);
    }
    ctx.stroke();
  }
  // the loon
  ctx.fillStyle = '#10121a';
  ctx.beginPath(); // body
  ctx.ellipse(w * 0.42, h * 0.74, w * 0.13, h * 0.09, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // neck + head
  ctx.ellipse(w * 0.32, h * 0.62, w * 0.025, h * 0.1, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.315, h * 0.54, w * 0.035, h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // beak
  ctx.moveTo(w * 0.28, h * 0.54);
  ctx.lineTo(w * 0.24, h * 0.555);
  ctx.lineTo(w * 0.285, h * 0.565);
  ctx.fill();
  ctx.fillStyle = '#f2e8cf'; // neck ring
  ctx.fillRect(w * 0.302, h * 0.6, w * 0.032, h * 0.022);
  // back speckles
  for (let sx = 0; sx < 12; sx++) {
    for (let sy = 0; sy < 3; sy++) {
      ctx.fillRect(w * (0.36 + sx * 0.012), h * (0.7 + sy * 0.025), w * 0.005, h * 0.01);
    }
  }
  ctx.fillStyle = '#8e1f3a'; // the red eye
  ctx.fillRect(w * 0.318, h * 0.535, w * 0.008, h * 0.012);
  // lettering
  ctx.fillStyle = '#f2e8cf';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(h * 0.17)}px system-ui, sans-serif`;
  ctx.save();
  ctx.translate(w * 0.62, h * 0.22);
  ctx.rotate(-0.03);
  ctx.fillText('UPTOWN', 0, 0);
  ctx.restore();
  ctx.font = `600 ${Math.round(h * 0.05)}px Georgia, serif`;
  ctx.fillStyle = 'rgba(242,232,207,0.75)';
  ctx.fillText('greetings from the lakes', w * 0.62, h * 0.3);
  // paint drips off the letters
  ctx.fillStyle = 'rgba(242,232,207,0.28)';
  for (const dx of [0.5, 0.57, 0.68, 0.74]) {
    ctx.fillRect(w * dx, h * 0.24, 3, h * (0.05 + (dx * 100) % 3 * 0.02));
  }
}

/** Alley tag — "OPE!" in bubble letters (peak Minnesota apology-graffiti). */
function drawTag(ctx: Canvas2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.05);
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(h * 0.62)}px system-ui, sans-serif`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#2a1030';
  ctx.strokeText('OPE!', 0, h * 0.2);
  ctx.fillStyle = '#3fa8c4';
  ctx.fillText('OPE!', 0, h * 0.2);
  ctx.fillStyle = 'rgba(255,79,184,0.85)';
  ctx.font = `700 ${Math.round(h * 0.16)}px system-ui, sans-serif`;
  ctx.fillText('sorry', w * 0.3, h * 0.36);
  ctx.restore();
}

/** Storm drain grate decal. */
function drawDrain(ctx: Canvas2D, w: number, h: number): void {
  ctx.fillStyle = '#191a1c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2e2f33';
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.fillStyle = '#050506';
  const slots = 6;
  for (let i = 0; i < slots; i++) {
    ctx.fillRect(w * (0.08 + i * 0.15), h * 0.22, w * 0.09, h * 0.62);
  }
  ctx.fillStyle = '#3a3b40';
  ctx.fillRect(w * 0.02, h * 0.42, w * 0.03, h * 0.16);
  ctx.fillRect(w * 0.95, h * 0.42, w * 0.03, h * 0.16);
}

/** Distance haze band: color slides day→sodium→violet with the neon level. */
function drawHaze(ctx: Canvas2D, w: number, h: number, level: number): void {
  ctx.clearRect(0, 0, w, h);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
    [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const day: [number, number, number] = [168, 184, 200];
  const eve: [number, number, number] = [224, 149, 106];
  const late: [number, number, number] = [74, 58, 122];
  const c = level <= 0.55 ? mix(day, eve, level / 0.55) : mix(eve, late, (level - 0.55) / 0.45);
  const aMax = 0.16 + 0.3 * level;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
  g.addColorStop(0.7, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${aMax})`);
  g.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${aMax * 0.8})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Local PRNG for painters (module-scope twin of the builder's makeRand).
function makeRandLocal(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
