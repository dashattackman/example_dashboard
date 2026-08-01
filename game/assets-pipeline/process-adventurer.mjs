// Process the Quaternius "Adventurer" (Ultimate Animated Character Pack, CC0)
// into the Twin Cities character base body:
//  - drop the Backpack (urban silhouette + tri budget)
//  - keep only the brawler/locomotion clips, strip "CharacterArmature|" prefixes
//  - bake each primitive's flat baseColorFactor into sRGB VERTEX COLORS (the
//    pipeline's native lane — createCharacterMaterial is white-diffuse + vertex
//    colors), drop UVs + all materials down to one white placeholder
//  - merge ALL primitives (they share one skin) into a single primitive so the
//    body renders in ONE draw call (+1 outline), like the Eli placeholder
import { NodeIO, Primitive, getBounds } from '@gltf-transform/core';
import { resample, dedup, prune } from '@gltf-transform/functions';

const [src, dst] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(src);
const root = doc.getRoot();

// 1. Backpack out.
for (const node of root.listNodes()) if (/backpack/i.test(node.getName())) node.dispose();
for (const mesh of root.listMeshes()) if (/backpack/i.test(mesh.getName())) mesh.dispose();

// 2. Brawler clip set, clean names.
const KEEP = new Set([
  'Idle', 'Idle_Neutral', 'Walk', 'Run', 'Run_Back',
  'Punch_Left', 'Punch_Right', 'Kick_Left', 'Kick_Right',
  'Roll', 'HitRecieve', 'Death',
]);
for (const anim of root.listAnimations()) {
  const short = anim.getName().replace(/^CharacterArmature\|/, '');
  if (KEEP.has(short)) anim.setName(short);
  else anim.dispose();
}

// 2.5. The source glb carries one identical Skin per mesh — dedup collapses
// them to a single shared skin so the primitive merge below is valid.
await doc.transform(dedup());

// 3. Bake flat material colors to sRGB vertex colors and collect geometry.
const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const skinnedMeshNodes = root.listNodes().filter((n) => n.getMesh() && n.getSkin());
const skin = skinnedMeshNodes[0]?.getSkin();
if (!skin) throw new Error('no skin found');

const parts = []; // {pos,nrm,col,joints,weights,indices}
for (const node of skinnedMeshNodes) {
  if (node.getSkin() !== skin) throw new Error('multiple skins — manual merge invalid');
  for (const prim of node.getMesh().listPrimitives()) {
    const mat = prim.getMaterial();
    const base = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
    const col = [srgb(base[0]), srgb(base[1]), srgb(base[2]), 1];
    const pos = prim.getAttribute('POSITION').getArray();
    const nrm = prim.getAttribute('NORMAL').getArray();
    const joints = prim.getAttribute('JOINTS_0').getArray();
    const weights = prim.getAttribute('WEIGHTS_0').getArray();
    const idx = prim.getIndices().getArray();
    parts.push({ pos, nrm, col, joints, weights, idx });
  }
}

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
  JNT.set(p.joints, v * 4); // may upcast u8 → u16
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

const mergedMesh = doc.createMesh('AdventurerBody').addPrimitive(merged);

// 4. Baked inverted-hull outline: a second skinned primitive whose POSITIONs
// are pre-pushed along bind-pose normals, with FLIPPED winding so it renders
// as an inside-out shell under normal backface culling. JOINTS/WEIGHTS/NORMAL
// accessors are shared with the body (free); only POSITION + indices are new.
// Runtime just paints it flat ink — no OutlineRenderer, no shader injection
// (both shatter on skinned meshes in the CI software-GL environment).
// CRITICAL unit note: this export keeps bind-pose POSITIONs at ~1/100 world
// scale — the skin's bone matrices scale the mesh up ~100x (classic FBX->glTF
// artifact). A push expressed in world units therefore explodes 100x after
// skinning (this is exactly why OutlineRenderer/vertex-push outlines shattered
// this rig). Derive the local->world factor and push in LOCAL units.
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
const localToWorld = worldHeight / posSpan; // ~100 for this export
const HULL_WIDTH = 0.02 / localToWorld; // 2cm in world space
console.log('worldHeight', worldHeight.toFixed(3), 'localToWorld', localToWorld.toFixed(1),
  'hullWidthLocal', HULL_WIDTH.toExponential(3));
const HPOS = new Float32Array(POS.length);
for (let k = 0; k < POS.length; k++) HPOS[k] = POS[k] + NRM[k] * HULL_WIDTH;
const HIDX = new Uint32Array(IDX.length);
for (let k = 0; k < IDX.length; k += 3) {
  HIDX[k] = IDX[k];
  HIDX[k + 1] = IDX[k + 2]; // swap → flipped winding
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
const hullMesh = doc.createMesh('AdventurerHull').addPrimitive(hullPrim);

// Replace the first skinned node's mesh; drop the other skinned nodes.
const keeper = skinnedMeshNodes[0];
keeper.setMesh(mergedMesh).setName('AdventurerBody');
const hullNode = doc.createNode('AdventurerHull').setMesh(hullMesh).setSkin(skin);
(keeper.getParentNode() ?? root.getDefaultScene()).addChild(hullNode);
for (const node of skinnedMeshNodes.slice(1)) node.dispose();

await doc.transform(resample(), dedup(), prune());
await io.write(dst, doc);

// Report.
const out = await io.read(dst);
const r = out.getRoot();
let tris = 0;
let prims = 0;
for (const mesh of r.listMeshes())
  for (const prim of mesh.listPrimitives()) {
    prims++;
    tris += prim.getIndices().getCount() / 3;
  }
console.log('clips :', r.listAnimations().map((a) => a.getName()).join(', '));
console.log('mats  :', r.listMaterials().map((m) => m.getName()).join(', '));
console.log('prims :', prims, ' tris:', Math.round(tris), ' skins:', r.listSkins().length);
console.log('joints:', r.listSkins()[0]?.listJoints().length);
