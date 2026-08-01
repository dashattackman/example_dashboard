// Build the WHOLE character cast from CC0 sources: Eli's identity body plus
// the ambient-cast bodies/palette variants (src/world/ambient.ts consumers).
//
//   node assets-pipeline/build-cast.mjs            # downloads sources if absent
//
// Sources are Quaternius "Ultimate Animated Character Pack" bodies (CC0 1.0),
// fetched over the cloud asset channel that works from this container (GitHub
// raw/LFS — quaternius.com and asset CDNs are blocked; see CLAUDE.md). Cached
// in assets-pipeline/src-cache/ (gitignored). Provenance: public/assets/CREDITS.md.
import { mkdir, access, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { processCharacter } from './process-character.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, 'src-cache');
const OUT = join(here, '..', 'public', 'assets', 'characters');

// GitHub mirrors of the CC0 pack (verified same CharacterArmature rig, 62
// joints, 24 CharacterArmature|* clips — the pack's standard export).
const SM = 'https://raw.githubusercontent.com/JonathanOll/supermarket-alone/main/Assets/Models/Characters';
const SOURCES = {
  Adventurer:
    'https://media.githubusercontent.com/media/adityaagurav/OceanCleanup2/main/public/Adventurer.glb',
  Punk: `${SM}/Punk.glb`,
  Suit: `${SM}/Suit.glb`,
  Worker: `${SM}/Worker.glb`,
  // CHAR-system wave bases (same mirror; names verified with gltf-transform):
  Woman: `${SM}/Animated%20Woman.glb`, // Casual_* nodes — athletic female base
  Casual2: `${SM}/Casual%20Character.glb`, // second male base (own hair, NOT Eli's)
  Worker2: `${SM}/Worker%202.glb`, // moustache worker — the heavy/broad base (+broaden at load)
};

// Locomotion-only clip set for ambient bodies (smaller files; Eli keeps the
// full brawler set — he's the one who fights).
const AMBIENT_CLIPS = ['Idle', 'Idle_Neutral', 'Walk', 'Run'];
const BRAWLER_CLIPS = [
  'Idle', 'Idle_Neutral', 'Walk', 'Run', 'Run_Back',
  'Punch_Left', 'Punch_Right', 'Kick_Left', 'Kick_Right',
  'Roll', 'HitRecieve', 'Death',
];

/** The cast table. Recolor hexes are sRGB, baked verbatim into vertex colors.
 *  Adventurer material map: Green=jacket, LightGreen=shirt/straps, Brown=pants,
 *  Brown2=belt, Black=boots, Grey=soles. Suit: Black=suit+shoes, White=shirt.
 *  Worker: Worker_Vest=vest, Worker_Yellow=hard hat+trim, Brown_02/Brown2=pants. */
const CAST = [
  {
    // THE ANCHOR — Eli Monroe (docs/04 §1.0): dark slate jacket, warm amber
    // accent (shirt + belt), dark denim, medium-brown skin, near-black hair.
    dst: 'eli.glb', src: 'Adventurer', strip: 'backpack', keep: BRAWLER_CLIPS, name: 'Eli',
    recolor: {
      Green: '#57648f', LightGreen: '#d98a3a', Brown: '#2c3038', Brown2: '#c97c35',
      Black: '#191a20', Grey: '#272930', Skin: '#a97a5c', Hair: '#181920',
      Eyebrows: '#101014', Eye: '#0c0d10',
    },
    // The chase cam lives on his BACK: paint an amber yoke panel across the
    // upper back of the jacket (the torso is one material front+back, so this
    // is a positional band — shoulder-blade height, genuinely shoulder-spanning
    // per the model review board, back side).
    paint: [
      { hex: '#d98a3a', materials: ['Green'], height: [0.67, 0.8], back: true, halfWidth: 0.17 },
    ],
  },
  // --- ambient cast ---------------------------------------------------------
  { dst: 'punk.glb', src: 'Punk', keep: AMBIENT_CLIPS, name: 'Punk' }, // pink mohawk, as shipped
  { dst: 'suit.glb', src: 'Suit', keep: AMBIENT_CLIPS, name: 'Suit' }, // black suit, as shipped
  { dst: 'worker.glb', src: 'Worker', keep: AMBIENT_CLIPS, name: 'Worker' }, // hi-vis
  {
    // "Casual" — Suit re-dressed. Board r3: was beige-on-beige (skin #6e462c vs
    // jacket #6b5138, face invisible) — jacket went cooler sage, shirt bright.
    dst: 'casual.glb', src: 'Suit', keep: AMBIENT_CLIPS, name: 'Casual',
    recolor: { Black: '#6d7a6a', White: '#e8dec0', Hair_Blond: '#241a12', Skin: '#6e462c' },
  },
  {
    // "Skater" — Punk re-dressed AND de-mohawked (the stripPrims step: the
    // browser punk keeps the pink mohawk as its signature; two mohawks on one
    // corner read as clones). Green jacket accents, plum jacket.
    dst: 'skater.glb', src: 'Punk', keep: AMBIENT_CLIPS, name: 'Skater',
    stripPrims: ['^Punk_Head::Pink$'],
    recolor: { Pink: '#3f7d4f', Black: '#56304c', Skin: '#c99b72' },
  },
  {
    // "Vest" — Worker re-dressed: green-teal jacket (board r3: #2a5d7c washed
    // toward Eli's slate at EVE), dark cap — the bench regular.
    dst: 'vest.glb', src: 'Worker', keep: AMBIENT_CLIPS, name: 'Vest',
    recolor: {
      Worker_Vest: '#2e6b5a', Worker_Yellow: '#33323a', White: '#c7cdd4',
      Brown_02: '#3e4450', Brown2: '#2c2f38',
    },
  },
  {
    // "Jogger" — REBASED onto the female base (board r3: the Adventurer-based
    // jogger was Eli's exact head; Eli's head is now exclusive to Eli).
    // Berry top, dark leggings, bright shoes, auburn ponytail.
    dst: 'jogger.glb', src: 'Woman', keep: AMBIENT_CLIPS, name: 'Jogger',
    recolor: {
      White: '#a83a52', Orange: '#23262d', Grey: '#c8ccd2',
      Skin: '#c99b72', Hair_Blond: '#4a3018',
    },
  },
  {
    // "Heavy" — the broad-silhouette street body (Worker 2 base: moustache,
    // ballcap-shaped hat). The pack has NO true heavy mesh — ambient.ts loads
    // this one with broaden 1.24 + height 1.87 for the wide read. Rust jacket,
    // light henley, grey work pants.
    dst: 'heavy.glb', src: 'Worker2', keep: AMBIENT_CLIPS, name: 'Heavy',
    recolor: {
      Worker_Vest: '#7c3b31', Worker_Yellow: '#2e3340', LightBrown: '#cfc7b4',
      Skin: '#8f5f42', Brown: '#4a4a52', Brown2: '#33343a',
    },
  },
  {
    // "Hoodie" — second male base (Casual Character: own short hair, NOT Eli's
    // cut). Forest hoodie over dark denim.
    dst: 'hoodie.glb', src: 'Casual2', keep: AMBIENT_CLIPS, name: 'Hoodie',
    recolor: { LightBrown: '#46604f', Skin: '#7e5940', Skin_Darker: '#6a4832' },
  },
];

// --- Bake-time palette rules (board r3 item 7): fail the BUILD, not the art
// review. All checks run on FINAL baked sRGB colors, approximately AS LIT AT
// EVE (warm low sun ≈ multiply by [1.0, 0.82, 0.66] before comparing).
const EVE_LIGHT = [1.0, 0.82, 0.66];
const lit = (rgb) => rgb.map((c, i) => c * EVE_LIGHT[i]);
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
function hsv([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: mx > 0 ? d / mx : 0, v: mx };
}
const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// Eli's reserved identity colors, as lit at EVE.
const ELI_SLATE = hsv(lit(hexRgb('#57648f')));
const ELI_AMBER = hsv(lit(hexRgb('#d98a3a')));

/** Throws with a review-board-grade message on any palette rule violation. */
function assertPalette(entry, palette) {
  if (entry.dst === 'eli.glb') return; // the rules protect Eli FROM the cast
  const fail = (msg) => {
    throw new Error(`palette assert [${entry.dst}]: ${msg}`);
  };
  const skinE = palette.filter((p) => /skin/i.test(p.name)).sort((a, b) => b.verts - a.verts)[0];
  const outfit = palette.filter(
    (p) => !/skin|eye|hair|moustache/i.test(p.name) && p.verts > 300,
  );
  if (skinE) {
    // Face-skin value floor: faces must survive EVE (board: "face invisible").
    const skinLum = lum(lit(skinE.rgb));
    if (skinLum < 0.2) fail(`face skin too dark for EVE (lit lum ${skinLum.toFixed(3)} < 0.2)`);
    // Minimum skin-vs-outfit separation, but only against DOMINANT regions —
    // the outfit's main read (≥25% of outfit area). A small sleeve/trim at
    // skin value is fine (board passed worker); a whole jacket at skin value
    // is the casual.glb beige-mush failure.
    const outfitVerts = outfit.reduce((n, o) => n + o.verts, 0);
    for (const o of outfit) {
      if (o.verts < outfitVerts * 0.25) continue;
      const gap = Math.abs(skinLum - lum(lit(o.rgb)));
      const hd = hueDist(hsv(lit(skinE.rgb)).h, hsv(lit(o.rgb)).h);
      if (gap < 0.09 && hd < 40)
        fail(
          `skin (lit lum ${skinLum.toFixed(2)}) vs dominant region ${o.name} reads monochrome ` +
            `(value gap ${gap.toFixed(3)} < 0.09, hue gap ${hd.toFixed(0)}° < 40°)`,
        );
    }
  }
  // Reserved hues: nobody else wears Eli's slate or his exact amber pop.
  for (const o of outfit) {
    const c = hsv(lit(o.rgb));
    if (c.s < 0.2) continue; // greys can't collide with a hue
    if (hueDist(c.h, ELI_SLATE.h) < 20 && Math.abs(c.v - ELI_SLATE.v) < 0.2)
      fail(`${o.name} sits in Eli's reserved slate (hue ${c.h.toFixed(0)}°)`);
    if (
      hueDist(c.h, ELI_AMBER.h) < 12 &&
      Math.abs(c.s - ELI_AMBER.s) < 0.25 &&
      Math.abs(c.v - ELI_AMBER.v) < 0.15
    )
      fail(`${o.name} clones Eli's amber accent (hue ${c.h.toFixed(0)}°)`);
  }
}

async function fetchSource(name) {
  const path = join(CACHE, `${name}.glb`);
  try {
    await access(path);
    return path;
  } catch { /* download */ }
  const url = SOURCES[name];
  console.log(`fetching ${name} <- ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100_000 || buf.readUInt32LE(0) !== 0x46546c67)
    throw new Error(`${url}: not a .glb (${buf.length} bytes) — mirror moved? See README.`);
  await writeFile(path, buf);
  return path;
}

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
for (const entry of CAST) {
  const src = await fetchSource(entry.src);
  const report = await processCharacter({ ...entry, src, dst: join(OUT, entry.dst) });
  assertPalette(entry, report.palette);
}
console.log('cast build complete ->', OUT, '(palette rules green)');
