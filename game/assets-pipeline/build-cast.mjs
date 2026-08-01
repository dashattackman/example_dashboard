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
const SOURCES = {
  Adventurer:
    'https://media.githubusercontent.com/media/adityaagurav/OceanCleanup2/main/public/Adventurer.glb',
  Punk: 'https://raw.githubusercontent.com/JonathanOll/supermarket-alone/main/Assets/Models/Characters/Punk.glb',
  Suit: 'https://raw.githubusercontent.com/JonathanOll/supermarket-alone/main/Assets/Models/Characters/Suit.glb',
  Worker:
    'https://raw.githubusercontent.com/JonathanOll/supermarket-alone/main/Assets/Models/Characters/Worker.glb',
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
      Black: '#191a20', Grey: '#272930', Skin: '#9d6c50', Hair: '#181920',
      Eyebrows: '#101014', Eye: '#0c0d10',
    },
  },
  // --- ambient cast ---------------------------------------------------------
  { dst: 'punk.glb', src: 'Punk', keep: AMBIENT_CLIPS, name: 'Punk' }, // pink mohawk, as shipped
  { dst: 'suit.glb', src: 'Suit', keep: AMBIENT_CLIPS, name: 'Suit' }, // black suit, as shipped
  { dst: 'worker.glb', src: 'Worker', keep: AMBIENT_CLIPS, name: 'Worker' }, // hi-vis
  {
    // "Casual" — Suit re-dressed: tan jacket, slate shirt, dark hair+skin.
    dst: 'casual.glb', src: 'Suit', keep: AMBIENT_CLIPS, name: 'Casual',
    recolor: { Black: '#6b5138', White: '#8fa3b2', Hair_Blond: '#241a12', Skin: '#6e462c' },
  },
  {
    // "Skater" — Punk re-dressed: green fade hawk, slate jacket.
    dst: 'skater.glb', src: 'Punk', keep: AMBIENT_CLIPS, name: 'Skater',
    recolor: { Pink: '#3f7d4f', Black: '#333848', Skin: '#c99b72' },
  },
  {
    // "Vest" — Worker re-dressed: teal jacket, dark cap — the bench regular.
    dst: 'vest.glb', src: 'Worker', keep: AMBIENT_CLIPS, name: 'Vest',
    recolor: {
      Worker_Vest: '#2a5d7c', Worker_Yellow: '#33323a', White: '#c7cdd4',
      Brown_02: '#3e4450', Brown2: '#2c2f38',
    },
  },
  {
    // "Jogger" — Adventurer re-dressed: berry top, pale tee, leggings, bright shoes.
    dst: 'jogger.glb', src: 'Adventurer', strip: 'backpack', keep: AMBIENT_CLIPS, name: 'Jogger',
    recolor: {
      Green: '#963148', LightGreen: '#ddd7c9', Brown: '#23262d', Brown2: '#ddd7c9',
      Black: '#c8ccd2', Grey: '#3a3e46', Skin: '#c99b72', Hair: '#4a3520',
      Eyebrows: '#2c2018', Eye: '#0c0d10',
    },
  },
];

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
  await processCharacter({ ...entry, src, dst: join(OUT, entry.dst) });
}
console.log('cast build complete ->', OUT);
