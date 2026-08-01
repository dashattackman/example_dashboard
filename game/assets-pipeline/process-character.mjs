// Generalized Quaternius Ultimate Animated Character Pack processor — the
// process-adventurer.mjs pipeline (see that file + README for the full story,
// including the 1/100 bind-scale gotcha) parameterized for ANY pack body plus
// an OUTFIT RECOLOR pass, so one CC0 base can ship as several distinct people
// (Eli's slate/amber identity, ambient-cast palette variants).
//
//   node process-character.mjs <src.glb> <dst.glb> [options]
//     --keep Idle,Walk,Run       clips to keep (CharacterArmature| prefix stripped)
//     --strip <regex>            node/mesh subtrees to delete (e.g. backpack)
//     --recolor Mat=#hex,...     override a material's baked color. Hexes are
//                                sRGB and baked VERBATIM into vertex colors
//                                (non-overridden materials go through the
//                                linear->sRGB conversion as before).
//     --name <BodyName>          output mesh/node base name (default from dst)
//
// Or import { processCharacter } and drive it from a table (build-cast.mjs).
import { NodeIO, Primitive, getBounds } from '@gltf-transform/core';
import { resample, dedup, prune } from '@gltf-transform/functions';

const DEFAULT_KEEP = [
  'Idle', 'Idle_Neutral', 'Walk', 'Run', 'Run_Back',
  'Punch_Left', 'Punch_Right', 'Kick_Left', 'Kick_Right',
  'Roll', 'HitRecieve', 'Death',
];

const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const hexBytes = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

export async function processCharacter({
  src,
  dst,
  keep = DEFAULT_KEEP,
  strip,
  recolor = {},
  name,
  quiet = false,
}) {
  const bodyName = name ?? dst.replace(/^.*\//, '').replace(/\.glb$/i, '');
  const io = new NodeIO();
  const doc = await io.read(src);
  const root = doc.getRoot();

  // 1. Strip unwanted subtrees (Adventurer: the backpack).
  if (strip) {
    const re = new RegExp(strip, 'i');
    for (const node of root.listNodes()) if (re.test(node.getName())) node.dispose();
    for (const mesh of root.listMeshes()) if (re.test(mesh.getName())) mesh.dispose();
  }

  // 2. Clip prune + rename.
  const keepSet = new Set(keep);
  for (const anim of root.listAnimations()) {
    const short = anim.getName().replace(/^CharacterArmature\|/, '');
    if (keepSet.has(short)) anim.setName(short);
    else anim.dispose();
  }

  // 2.5. Collapse the per-mesh duplicate skins so the primitive merge is valid.
  await doc.transform(dedup());

  // 3. Bake flat material colors to sRGB vertex colors (recolor overrides win,
  //    verbatim — they're authored in sRGB) and collect geometry.
  const skinnedMeshNodes = root.listNodes().filter((n) => n.getMesh() && n.getSkin());
  const skin = skinnedMeshNodes[0]?.getSkin();
  if (!skin) throw new Error(`no skin found in ${src}`);

  const usedRecolors = new Set();
  const parts = [];
  for (const node of skinnedMeshNodes) {
    if (node.getSkin() !== skin) throw new Error('multiple skins — manual merge invalid');
    for (const prim of node.getMesh().listPrimitives()) {
      const mat = prim.getMaterial();
      const matName = mat ? mat.getName() : '';
      let col;
      if (matName in recolor) {
        col = hexBytes(recolor[matName]).map((b) => b / 255);
        usedRecolors.add(matName);
      } else {
        const base = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
        col = [srgb(base[0]), srgb(base[1]), srgb(base[2])];
      }
      parts.push({
        pos: prim.getAttribute('POSITION').getArray(),
        nrm: prim.getAttribute('NORMAL').getArray(),
        col: [...col, 1],
        joints: prim.getAttribute('JOINTS_0').getArray(),
        weights: prim.getAttribute('WEIGHTS_0').getArray(),
        idx: prim.getIndices().getArray(),
      });
    }
  }
  for (const matName of Object.keys(recolor))
    if (!usedRecolors.has(matName))
      throw new Error(`recolor references material "${matName}" not present in ${src}`);

  const totalVerts = parts.reduce((n, p) => n + p.pos.length / 3, 0);
  const totalIdx = parts.reduce((n, p) => n + p.idx.length, 0);
  const POS = new Float32Array(totalVerts * 3);
  const NRM = new Float32Array(totalVerts * 3);
  const COL = new Uint8Array(totalVerts * 4);
  const JNT = new Uint16Array(totalVerts * 4);
  const WGT = new Float32Array(totalVerts * 4);
  const IDX = new Uint32Array(totalIdx);
  let v = 0;
  let i = 0;
  for (const p of parts) {
    const n = p.pos.length / 3;
    POS.set(p.pos, v * 3);
    NRM.set(p.nrm, v * 3);
    WGT.set(p.weights, v * 4);
    JNT.set(p.joints, v * 4); // may upcast u8 -> u16
    for (let k = 0; k < n; k++)
      COL.set(p.col.map((c) => Math.round(c * 255)), (v + k) * 4);
    for (let k = 0; k < p.idx.length; k++) IDX[i + k] = p.idx[k] + v;
    v += n;
    i += p.idx.length;
  }

  const buffer = root.listBuffers()[0];
  const acc = (arr, type, normalized = false) =>
    doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer).setNormalized(normalized);

  const white = doc.createMaterial('CharacterVertexColor').setBaseColorFactor([1, 1, 1, 1]);
  const merged = doc.createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', acc(POS, 'VEC3'))
    .setAttribute('NORMAL', acc(NRM, 'VEC3'))
    .setAttribute('COLOR_0', acc(COL, 'VEC4', true))
    .setAttribute('JOINTS_0', acc(JNT, 'VEC4'))
    .setAttribute('WEIGHTS_0', acc(WGT, 'VEC4'))
    .setIndices(acc(IDX, 'SCALAR'))
    .setMaterial(white);
  const mergedMesh = doc.createMesh(`${bodyName}Body`).addPrimitive(merged);

  // 4. Baked inverted-hull ink outline (see process-adventurer.mjs for the full
  // rationale). CRITICAL: this pack's bind-pose POSITIONs are ~1/100 world scale
  // (bones carry a 100x scale-up) — push in LOCAL units or the hull explodes.
  const worldBounds = getBounds(root.getDefaultScene());
  const worldHeight = worldBounds.max[1] - worldBounds.min[1];
  let posSpan = 0;
  {
    const mins = [Infinity, Infinity, Infinity];
    const maxs = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < POS.length; k += 3)
      for (let a = 0; a < 3; a++) {
        mins[a] = Math.min(mins[a], POS[k + a]);
        maxs[a] = Math.max(maxs[a], POS[k + a]);
      }
    posSpan = Math.max(maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2]);
  }
  const localToWorld = worldHeight / posSpan; // ~100 for this pack's exports
  const HULL_WIDTH = 0.02 / localToWorld; // 2cm in world space
  const HPOS = new Float32Array(POS.length);
  for (let k = 0; k < POS.length; k++) HPOS[k] = POS[k] + NRM[k] * HULL_WIDTH;
  const HIDX = new Uint32Array(IDX.length);
  for (let k = 0; k < IDX.length; k += 3) {
    HIDX[k] = IDX[k];
    HIDX[k + 1] = IDX[k + 2]; // swap -> flipped winding
    HIDX[k + 2] = IDX[k + 1];
  }
  const inkMat = doc.createMaterial('InkHull').setBaseColorFactor([0, 0, 0, 1]);
  const hullPrim = doc.createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', acc(HPOS, 'VEC3'))
    .setAttribute('NORMAL', merged.getAttribute('NORMAL'))
    .setAttribute('JOINTS_0', merged.getAttribute('JOINTS_0'))
    .setAttribute('WEIGHTS_0', merged.getAttribute('WEIGHTS_0'))
    .setIndices(acc(HIDX, 'SCALAR'))
    .setMaterial(inkMat);
  const hullMesh = doc.createMesh(`${bodyName}Hull`).addPrimitive(hullPrim);

  // Replace the first skinned node's mesh; drop the other skinned nodes.
  const keeper = skinnedMeshNodes[0];
  keeper.setMesh(mergedMesh).setName(`${bodyName}Body`);
  const hullNode = doc.createNode(`${bodyName}Hull`).setMesh(hullMesh).setSkin(skin);
  (keeper.getParentNode() ?? root.getDefaultScene()).addChild(hullNode);
  for (const node of skinnedMeshNodes.slice(1)) node.dispose();

  await doc.transform(resample(), dedup(), prune());
  await io.write(dst, doc);

  // Report.
  const out = await io.read(dst);
  const r = out.getRoot();
  let tris = 0;
  for (const mesh of r.listMeshes())
    for (const prim of mesh.listPrimitives()) tris += prim.getIndices().getCount() / 3;
  const report = {
    dst,
    clips: r.listAnimations().map((a) => a.getName()),
    tris: Math.round(tris),
    joints: r.listSkins()[0]?.listJoints().length,
    localToWorld: Math.round(localToWorld),
  };
  if (!quiet)
    console.log(
      `${dst}: tris ${report.tris}, joints ${report.joints}, 1/${report.localToWorld} bind scale,` +
        ` clips [${report.clips.join(', ')}]`,
    );
  return report;
}

// --- CLI -------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, dst, ...rest] = process.argv.slice(2);
  if (!src || !dst) {
    console.error('usage: node process-character.mjs <src.glb> <dst.glb> [--keep a,b] [--strip re] [--recolor Mat=#hex,...] [--name Body]');
    process.exit(1);
  }
  const opts = { src, dst };
  for (let i = 0; i < rest.length; i += 2) {
    const val = rest[i + 1];
    if (rest[i] === '--keep') opts.keep = val.split(',');
    if (rest[i] === '--strip') opts.strip = val;
    if (rest[i] === '--name') opts.name = val;
    if (rest[i] === '--recolor')
      opts.recolor = Object.fromEntries(val.split(',').map((kv) => kv.split('=')));
  }
  await processCharacter(opts);
}
