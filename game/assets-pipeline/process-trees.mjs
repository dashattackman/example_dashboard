// Street-tree prop pipeline (corner-polish wave). The sphere-stack boulevard
// trees died in ART arbitration (2 consecutive failures against real brick —
// CLAUDE.md asset routing), so real low-poly CC0 trees come through the same
// treatment as the character cast: CC0 source → palette-baked vertex colors →
// ONE merged primitive → our graphic-novel material at runtime.
//
//   node assets-pipeline/process-trees.mjs        # downloads sources if absent
//
// Sources: "CommonTree" 1/3/4 from Quaternius' **Lowpoly Nature / Ultimate
// Nature** pack family (CC0 1.0) — flat-color FBX2glTF exports on the pack's
// standard Brown/Green/DarkGreen material set. quaternius.com and asset CDNs
// are blocked from this container; files come over the cloud asset channel
// (GitHub raw — see CLAUDE.md) from the public `flo-bit/tiny-planets` mirror
// (public/lowpoly_nature/*, self-contained .gltf with data-URI buffers; the
// same pack files also mirror under castle-engine's `data/quaternius/nature/`,
// which triangulates provenance). Cached in assets-pipeline/src-cache/.
// Provenance + license notes: public/assets/CREDITS.md.
//
// Output is NOT glb: each tree becomes a compact JSON vertex payload
// (public/assets/props/*.json — positions/normals/colors/indices, base64)
// consumed by kit.prop(). Rationale: props are static unskinned geometry, so
// shipping pre-converted LEFT-HANDED, world-scaled, palette-baked vertex data
// keeps the runtime path deterministic (no glTF __root__ handedness bake, no
// loader variance under CI's software GL) and buildable synchronously into a
// thin-instanced Mesh.
import { mkdir, access, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, 'src-cache');
const OUT = join(here, '..', 'public', 'assets', 'props');

const MIRROR =
  'https://raw.githubusercontent.com/flo-bit/tiny-planets/main/public/lowpoly_nature';

/** Late-summer Uptown palette for the pack's standard nature materials —
 *  hexes are sRGB, baked VERBATIM into vertex colors (the character-pipeline
 *  recolor contract). Canopy greens sit near the old sphere-tree values so the
 *  EVE grade keeps reading the same; bark leans warm against the teal dusk. */
const RECOLOR = {
  // Round 2 values: the first bake (#41573a/#2e4531) washed pale sage under
  // the full DAY/EVE key + hemisphere — a 7m crown catches far more sun-facing
  // area than the planter bushes these hexes were matched to. Canopy runs
  // darker + greener so the LIT read lands on the late-summer palette.
  Brown: '#3f2e1f', // bark
  Green: '#324a2a', // sunny canopy mass
  DarkGreen: '#223618', // shadow canopy mass
};

/** name → { src file, target height (m) }. CommonTree_1 is the fullest crown
 *  (hero/garden); _3/_4 are lighter silhouettes for the boulevard rhythm. */
const TREES = [
  { dst: 'tree_a.json', src: 'CommonTree_1.gltf', height: 7.4 },
  { dst: 'tree_b.json', src: 'CommonTree_3.gltf', height: 6.6 },
  { dst: 'tree_c.json', src: 'CommonTree_4.gltf', height: 6.2 },
];

const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexBytes = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

async function fetchSource(file) {
  const path = join(CACHE, file);
  try {
    await access(path);
    return path;
  } catch {
    /* download */
  }
  const url = `${MIRROR}/${file}`;
  console.log(`fetching ${file} <- ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  // Integrity: must parse as glTF JSON with the pack's FBX2glTF signature and
  // self-contained buffers (mirror moved / LFS pointer → neither holds).
  const json = JSON.parse(text);
  if (!json.asset?.generator?.startsWith('FBX2glTF'))
    throw new Error(`${url}: unexpected generator "${json.asset?.generator}" — mirror moved?`);
  if (!json.buffers?.every((b) => b.uri?.startsWith('data:')))
    throw new Error(`${url}: buffers not self-contained — mirror moved?`);
  await writeFile(path, text);
  return path;
}

// --- minimal mat4 helpers (column-major, glTF convention) -------------------
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const xfPoint = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
const xfDir = (m, x, y, z) => {
  const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
const worldMatrix = (node) => {
  let m = node.getMatrix();
  let p = node.getParentNode ? node.getParentNode() : null;
  while (p) {
    m = mul(p.getMatrix(), m);
    p = p.getParentNode ? p.getParentNode() : null;
  }
  return m;
};

export async function processTree({ src, dst, height }) {
  const io = new NodeIO();
  const doc = await io.read(src);
  const root = doc.getRoot();

  // Collect primitives with their nodes' world transforms baked in.
  const parts = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = worldMatrix(node);
    for (const prim of mesh.listPrimitives()) {
      const matName = prim.getMaterial()?.getName() ?? '';
      if (!(matName in RECOLOR))
        throw new Error(`${src}: unexpected material "${matName}" — not the pack export?`);
      parts.push({
        m,
        col: hexBytes(RECOLOR[matName]),
        pos: prim.getAttribute('POSITION').getArray(),
        nrm: prim.getAttribute('NORMAL').getArray(),
        idx: prim.getIndices().getArray(),
      });
    }
  }
  if (parts.length === 0) throw new Error(`${src}: no mesh primitives`);

  // Merge: world-transform → normalize height/base → RH→LH (negate z, flip
  // winding). Base sits at y=0, trunk on the local origin.
  const totalVerts = parts.reduce((n, p) => n + p.pos.length / 3, 0);
  const totalIdx = parts.reduce((n, p) => n + p.idx.length, 0);
  const POS = new Float32Array(totalVerts * 3);
  const NRM = new Float32Array(totalVerts * 3);
  const COL = new Uint8Array(totalVerts * 4);
  const IDX = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let v0 = 0;
  let i0 = 0;
  for (const p of parts) {
    const n = p.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = xfPoint(p.m, p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
      POS.set([x, y, z], (v0 + i) * 3);
      const [nx, ny, nz] = xfDir(p.m, p.nrm[i * 3], p.nrm[i * 3 + 1], p.nrm[i * 3 + 2]);
      NRM.set([nx, ny, nz], (v0 + i) * 3);
      COL.set([...p.col, 255], (v0 + i) * 4);
    }
    for (let i = 0; i < p.idx.length; i += 3) {
      // flip winding for the LH conversion below
      IDX[i0 + i] = v0 + p.idx[i];
      IDX[i0 + i + 1] = v0 + p.idx[i + 2];
      IDX[i0 + i + 2] = v0 + p.idx[i + 1];
    }
    v0 += n;
    i0 += p.idx.length;
  }

  // Bounds → uniform scale to target height, base to y=0, centered in x/z.
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < totalVerts; i++)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], POS[i * 3 + a]);
      max[a] = Math.max(max[a], POS[i * 3 + a]);
    }
  const s = height / (max[1] - min[1]);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  for (let i = 0; i < totalVerts; i++) {
    POS[i * 3] = (POS[i * 3] - cx) * s;
    POS[i * 3 + 1] = (POS[i * 3 + 1] - min[1]) * s;
    POS[i * 3 + 2] = -((POS[i * 3 + 2] - cz) * s); // RH→LH
    NRM[i * 3 + 2] = -NRM[i * 3 + 2];
  }

  const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');
  const payload = {
    name: dst.replace(/^.*\//, '').replace(/\.json$/, ''),
    tris: totalIdx / 3,
    height,
    index16: IDX instanceof Uint16Array,
    positions: b64(POS),
    normals: b64(NRM),
    colors: b64(COL),
    indices: b64(IDX),
  };
  await writeFile(dst, JSON.stringify(payload));
  console.log(
    `${dst}: ${totalVerts} verts, ${totalIdx / 3} tris, ${height}m, ${JSON.stringify(payload).length} bytes`,
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  await mkdir(CACHE, { recursive: true });
  await mkdir(OUT, { recursive: true });
  for (const t of TREES) {
    const src = await fetchSource(t.src);
    await processTree({ ...t, src, dst: join(OUT, t.dst) });
  }
  console.log('tree props ->', OUT);
}
