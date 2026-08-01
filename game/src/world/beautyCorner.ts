// The M1 beauty corner — ONE Uptown street corner, kit-of-parts, built to produce
// the golden-hour "that's the game" screenshot (docs/07 M1). Hennepin & Lagoon energy:
// brick corner record store, dive-bar blade sign, sodium streetlights, parked cars,
// boulevard trees, the skyline silhouette up the avenue and a lake glimpse west.
//
// NO @babylonjs imports here (docs/05 module rule) — everything goes through engine/kit.
// Everything repeated is thin-instanced; everything static is merged + frozen (docs/06).
//
// World axes: +X east, +Z north. The avenue runs north (the camera vista); the cross
// street runs east-west toward the lake. Player spawns on the east sidewalk.

import type { Kit, Mesh, Xform } from '../engine/kit';
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

export function buildBeautyCorner(kit: Kit): BeautyCorner {
  const rand = makeRand(0x5eed);
  const U = PALETTE.uptown;

  // --- materials -----------------------------------------------------------
  const asphalt = kit.envMat('asphalt', U.asphalt);
  const concrete = kit.envMat('concrete', U.concrete);
  const brickA = kit.envMat('brickA', U.brick);
  const brickB = kit.envMat('brickB', U.brickAged);
  const brickDeep = kit.envMat('brickDeep', U.brickDeep);
  // West-row masses sit in EVE shade (east facades face away from the low sun),
  // so their diffuse runs lighter than the sunlit east side to keep structure readable.
  const tealGrey = kit.envMat('tealGrey', '#50697a');
  const brickWest = kit.envMat('brickWest', '#7d4033');
  const warmGrey = kit.envMat('warmGrey', '#6a594a');
  const trim = kit.envMat('trim', U.trim);
  const inkMat = kit.envMat('inkMat', '#1f2126');
  const whitePaint = kit.envMat('whitePaint', '#b9b9b2');
  const yellowPaint = kit.envMat('yellowPaint', '#d8c060');
  const doorMat = kit.envMat('doorMat', '#24303a');
  const awningMat = kit.envMat('awningMat', U.teal);
  const hydrantMat = kit.envMat('hydrantMat', '#a33b2e');
  const darkGlass = kit.envMat('darkGlass', '#182030');
  const moduleWhite = kit.envMat('moduleWhite', '#ffffff'); // vertex/instance-colored modules
  const waterMat = kit.envMat('waterMat', PALETTE.lake.deepWater, {
    emissiveHex: '#0e2836',
    emissiveLevel: 0.6,
  });

  const litGlass = kit.glowMat('litGlass', U.warmWindow, 0.7);
  const shopGlass = kit.glowMat('shopGlass', '#ffd9a0', 0.8);
  const lampHalo = kit.glowMat('lampHalo', U.sodiumGlow, 0.8, 0.5);
  const spill = kit.glowMat('spill', U.warmWindow, 0.5, 0.35);
  const sunPath = kit.glowMat('sunPath', PALETTE.lake.paleGold, 0.5, 0.55);

  // --- ground, streets, markings -------------------------------------------
  const base = kit.ground('lotBase', 420, 520, kit.envMat('lotBase', '#232529'), {
    pos: [0, -0.01, 100],
  });
  const avenue = kit.box('avenue', 10, 0.04, 240, asphalt, { pos: [-6, 0.02, 80] });
  const crossSt = kit.box('crossSt', 180, 0.04, 10, asphalt, { pos: [-10, 0.02, 15] });
  kit.freeze(base, avenue, crossSt);

  // Sidewalks (0.1m curb) — non-overlapping slabs merged into one static.
  const walk = (w: number, d: number, x: number, z: number): Mesh =>
    kit.box('walk', w, 0.1, d, concrete, { pos: [x, 0.05, z] });
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
  for (let x = -94; x <= -18; x += 6) dashXf.push({ pos: [x, 0.05, 15], scale: [1.9, 1, 0.14] });
  for (let x = 32; x <= 76; x += 6) dashXf.push({ pos: [x, 0.05, 15], scale: [1.9, 1, 0.14] });
  kit.thin(dash, dashXf);

  const bar = kit.box('zebra', 1, 0.02, 1, whitePaint);
  const barXf: Xform[] = [];
  for (let i = 0; i < 6; i++)
    barXf.push({ pos: [-10.3 + i * 1.7, 0.05, 16], scale: [0.7, 1, 3.0] }); // across avenue
  for (let i = 0; i < 3; i++)
    barXf.push({ pos: [2, 0.05, 11.6 + i * 1.7], scale: [3.0, 1, 0.7] }); // across cross street
  kit.thin(bar, barXf);

  // --- buildings (kit-of-parts: massing + plinth + trim + instanced windows) ---
  const bldgA = kit.box('bldgA', 22, 11, 30, brickA, { pos: [16, 5.5, -5] }); // corner store
  const bldgB = kit.box('bldgB', 20, 14.5, 38, brickB, { pos: [15, 7.25, 39] });
  const c1 = kit.box('c1', 13, 8, 26, tealGrey, { pos: [-19.5, 4, -13] });
  const c2 = kit.box('c2', 13, 12.5, 28, brickWest, { pos: [-19.5, 6.25, 16] });
  const c3 = kit.box('c3', 13, 9, 30, warmGrey, { pos: [-19.5, 4.5, 47] });
  kit.freeze(bldgA, bldgB, c1, c2, c3);

  kit.merge('plinths', [
    kit.box('pA', 22.4, 0.9, 30.4, brickDeep, { pos: [16, 0.45, -5] }),
    kit.box('pB', 20.4, 0.9, 38.4, brickDeep, { pos: [15, 0.45, 39] }),
    kit.box('pC', 13.4, 0.9, 90.4, brickDeep, { pos: [-19.5, 0.45, 17] }),
  ]).material = brickDeep;

  kit.merge('trimset', [
    // Cornices — the roofline "ink" (strong value break against the sky).
    kit.box('coA', 23, 0.55, 31, trim, { pos: [16, 11.2, -5] }),
    kit.box('coB', 21, 0.6, 39, trim, { pos: [15, 14.75, 39] }),
    kit.box('coC1', 14, 0.5, 27, trim, { pos: [-19.5, 8.2, -13] }),
    kit.box('coC2', 14, 0.5, 29, trim, { pos: [-19.5, 12.7, 16] }),
    kit.box('coC3', 14, 0.5, 31, trim, { pos: [-19.5, 9.2, 47] }),
    // Floor bands on the two hero facades.
    kit.box('bA1', 0.14, 0.32, 30.4, trim, { pos: [5, 4.3, -5] }),
    kit.box('bA2', 0.14, 0.32, 30.4, trim, { pos: [5, 7.5, -5] }),
    kit.box('bB1', 0.14, 0.32, 38.4, trim, { pos: [5, 4.1, 39] }),
    kit.box('bB2', 0.14, 0.32, 38.4, trim, { pos: [5, 7.3, 39] }),
    kit.box('bB3', 0.14, 0.32, 38.4, trim, { pos: [5, 10.5, 39] }),
    // Storefront kick panels under the display glass.
    kit.box('kick1', 0.12, 0.5, 3.4, trim, { pos: [4.98, 0.35, 2.2] }),
    kit.box('kick2', 0.12, 0.5, 3.4, trim, { pos: [4.98, 0.35, 6.2] }),
    // Dark ground-floor band south of the storefront — anchors the big brick wall.
    kit.box('gfBand', 0.12, 3.6, 20, trim, { pos: [4.96, 1.8, -10] }),
  ]).material = trim;

  // Window modules: one frame + one glass, thin-instanced across every facade.
  // NOTE Babylon plane front faces -Z, so: rotY +PI/2 → faces -X (east-side facades,
  // seen from the street); rotY -PI/2 → faces +X (west row). Verified via probe shots.
  const frame = kit.box('winFrame', 1.1, 1.6, 0.12, trim);
  const glassLit = kit.plane('winLit', 0.88, 1.38, litGlass);
  const glassDark = kit.plane('winDark', 0.88, 1.38, darkGlass);
  const frames: Xform[] = [];
  const lit: Xform[] = [];
  const dark: Xform[] = [];
  const addWindows = (x: number, rotY: number, floors: number[], z0: number, cols: number, dz: number, litOdds: number): void => {
    const gx = rotY > 0 ? x - 0.115 : x + 0.115; // glass sits just proud of the frame face
    for (const y of floors) {
      for (let i = 0; i < cols; i++) {
        const z = z0 + i * dz;
        frames.push({ pos: [x, y, z], rotY });
        (rand() < litOdds ? lit : dark).push({ pos: [gx, y, z], rotY });
      }
    }
  };
  addWindows(5, HALF_PI, [5.2, 8.4], -17.5, 8, 3.3, 0.5); // A upper floors
  addWindows(5, HALF_PI, [5.0, 8.2, 11.4], 22.5, 10, 3.3, 0.45); // B
  // West row lights up harder — it carries the left third of the gate shot.
  addWindows(-13, -HALF_PI, [5.0], -24.5, 7, 3.6, 0.55); // C1
  addWindows(-13, -HALF_PI, [5.0, 8.4], 3.8, 7, 3.6, 0.55); // C2
  addWindows(-13, -HALF_PI, [5.2], 33.8, 8, 3.6, 0.55); // C3
  kit.thin(frame, frames);
  // Warm variants per pane (instance color multiplies the glow) — kills the
  // "every window is the same yellow quad" read at LATE.
  kit.thin(glassLit, lit, ['#ffffff', '#ffdba8', '#f5b96e', '#e2d8c0']);
  kit.thin(glassDark, dark);

  // --- the storefront (LAGOON RECORDS — corner of building A) ---------------
  const shopWin = kit.plane('shopWin', 3.2, 2.3, shopGlass);
  kit.thin(shopWin, [
    { pos: [4.94, 1.75, 2.2], rotY: HALF_PI },
    { pos: [4.94, 1.75, 6.2], rotY: HALF_PI },
  ]);
  kit.freeze(kit.box('shopDoor', 0.14, 2.5, 1.15, doorMat, { pos: [4.97, 1.35, 8.6] }));
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
    { pos: [4.9, 4.55, 3.8], rotY: HALF_PI },
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
  const halo = kit.sphere('halo', 0.6, lampHalo, undefined, 8);
  kit.thin(
    halo,
    lampXf.map((xf) => ({
      pos: [xf.pos[0] + (xf.rotY ? 1.5 : -1.5), 5.35, xf.pos[2]] as [number, number, number],
    })),
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
  kit.freeze(
    kit.cyl('hydrant', { h: 0.55, d: 0.3, dTop: 0.2, tess: 8 }, hydrantMat, {
      pos: [3.9, 0.38, -9],
    }),
  );
  // Bench against the wall (faces the avenue) + corner street-sign pole.
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
  ];
  kit.merge('furniture', benchParts).material = moduleWhite;

  // --- backdrop: skyline silhouette + lake glimpse ---------------------------
  const skyline = kit.canvasPlane(
    'skyline',
    460,
    95,
    1024,
    212,
    (ctx, w, h) => {
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
      // Lit windows.
      ctx.fillStyle = PALETTE.skyline.window;
      for (const [tx, tw, th] of towers) {
        for (let wy = h - th + 6; wy < h - 8; wy += 9) {
          for (let wx = tx + 4; wx < tx + tw - 4; wx += 8) {
            if (r() < 0.24) ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    },
    { alpha: true, fog: false },
    { pos: [-20, 39, 330] }, // -Z front faces the camera up the avenue
  );
  kit.freeze(skyline);

  // Lake glimpse down the cross street (west): cold water + a low-sun path.
  kit.freeze(kit.ground('lake', 150, 150, waterMat, { pos: [-185, -0.06, 20] }));
  kit.freeze(kit.ground('lakePath', 90, 7, sunPath, { pos: [-160, 0.0, 16] }));

  // --- phase dressing ---------------------------------------------------------
  const applyNeon = (level: number): void => {
    kit.setGlow(litGlass, U.warmWindow, 0.18 + 0.82 * level);
    // Caps at ~0.8 so the big display panes keep a hint of tone instead of
    // blowing out to raw white-yellow quads at LATE.
    kit.setGlow(shopGlass, '#ffd9a0', 0.3 + 0.5 * level);
    // Halos square with level so they're shy at dusk and dominant only at night.
    kit.setGlow(lampHalo, U.sodiumGlow, 0.1 + 0.9 * level * level, 0.03 + 0.45 * level * level);
    kit.setGlow(spill, U.warmWindow, 0.55 * level, 0.4 * level);
  };
  applyNeon(0.55); // EVE default

  return {
    applyNeon,
    playerSpawn: [0.9, 0.1, -5], // sidewalk, camera clear of the near lamp pole
    bounds: { minX: -13.4, maxX: 4.3, minZ: -34, maxZ: 88 },
  };
}
