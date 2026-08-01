// Procedural test character — Eli, the M1 art-target stand-in (docs/07 M1: "one
// hero-quality test character"). Composed primitives, near-realistic proportions with
// the docs/01 heroic push (shoulder width, squared jaw, upright posture). Dark jacket,
// warm amber accent. Colors are baked as vertex colors and every part merges into ONE
// mesh, so the whole figure costs 1 draw call + 1 inverted-hull outline call.
// The rigged shared base body (docs/06 "Characters") replaces this at M3.

import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import { createCharacterMaterial, enableInkOutline } from './materials';

const COLORS = {
  jacket: '#323a4c', // dark slate jacket (light enough to hold a ramp step at dusk)
  jacketDark: '#242a38',
  accent: '#c97c35', // warm amber henley + belt (the "warm accent")
  denim: '#262a33',
  boot: '#17181d',
  skin: '#8a5a3c',
  hair: '#14151a',
} as const;

export interface CharacterHandle {
  root: TransformNode;
  mesh: Mesh;
}

/** Bake a flat vertex color onto a part before merging. */
function tint(mesh: Mesh, hex: string): Mesh {
  const c = Color3.FromHexString(hex);
  const n = mesh.getTotalVertices();
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, data);
  return mesh;
}

export function buildEli(scene: Scene): CharacterHandle {
  const parts: Mesh[] = [];
  const box = (name: string, w: number, h: number, d: number, hex: string): Mesh => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    parts.push(tint(m, hex));
    return m;
  };
  const sphere = (name: string, d: number, hex: string): Mesh => {
    const m = MeshBuilder.CreateSphere(name, { diameter: d, segments: 12 }, scene);
    parts.push(tint(m, hex));
    return m;
  };
  const cyl = (name: string, h: number, dBottom: number, dTop: number, hex: string): Mesh => {
    const m = MeshBuilder.CreateCylinder(
      name,
      { height: h, diameter: dBottom, diameterTop: dTop, tessellation: 12 },
      scene,
    );
    parts.push(tint(m, hex));
    return m;
  };
  const capsule = (name: string, h: number, r: number, hex: string): Mesh => {
    const m = MeshBuilder.CreateCapsule(
      name,
      { height: h, radius: r, tessellation: 10, capSubdivisions: 4 },
      scene,
    );
    parts.push(tint(m, hex));
    return m;
  };

  // Facing +Z. Ground at y=0, crown ~2.02m — tall, but not bobblehead (docs/01).
  for (const side of [-1, 1] as const) {
    box(`boot${side}`, 0.17, 0.13, 0.3, COLORS.boot).position.set(side * 0.115, 0.065, 0.03);
    cyl(`leg${side}`, 0.82, 0.17, 0.2, COLORS.denim).position.set(side * 0.115, 0.55, 0);
    // Shoulder push — the heroic silhouette read at phone size (tucked into the
    // chest so the deltoid line is continuous, not a floating ball).
    sphere(`shoulder${side}`, 0.3, COLORS.jacket).position.set(side * 0.29, 1.7, 0);
    const arm = capsule(`arm${side}`, 0.68, 0.088, COLORS.jacket);
    arm.position.set(side * 0.36, 1.33, 0.01);
    arm.rotation.z = side * -0.09;
    cyl(`cuff${side}`, 0.07, 0.19, 0.19, COLORS.accent).position.set(side * 0.39, 1.03, 0.02);
    sphere(`hand${side}`, 0.13, COLORS.skin).position.set(side * 0.4, 0.94, 0.03);
  }

  box('hips', 0.36, 0.2, 0.22, COLORS.jacketDark).position.set(0, 1.02, 0);
  box('belt', 0.37, 0.055, 0.23, COLORS.accent).position.set(0, 1.13, 0);
  // Torso tapers up: narrow waist, wide chest (diameterTop > bottom).
  cyl('torso', 0.6, 0.37, 0.56, COLORS.jacket).position.set(0, 1.46, 0);
  // Open jacket over a warm henley — chest accent panel.
  // Accents sit PROUD of the torso surface (r≈0.245-0.25 at these heights) —
  // buried faces never rasterize, and the warm accent is the whole point.
  box('chest', 0.24, 0.34, 0.09, COLORS.accent).position.set(0, 1.47, 0.21);
  // Warm accent reads from BEHIND too (default camera rides his back): yoke band.
  box('yoke', 0.4, 0.16, 0.09, COLORS.accent).position.set(0, 1.57, -0.225);
  box('collar', 0.3, 0.09, 0.1, COLORS.jacketDark).position.set(0, 1.78, -0.07);

  cyl('neck', 0.1, 0.12, 0.12, COLORS.skin).position.set(0, 1.8, 0);
  const head = sphere('head', 0.28, COLORS.skin);
  head.position.set(0, 1.96, 0.005);
  head.scaling.set(0.96, 1.12, 1.0);
  box('jaw', 0.16, 0.08, 0.14, COLORS.skin).position.set(0, 1.87, 0.035); // squared jawline
  const hair = sphere('hair', 0.3, COLORS.hair);
  hair.position.set(0, 2.02, -0.02);
  hair.scaling.set(1.02, 0.84, 1.04);

  const mesh = Mesh.MergeMeshes(parts, true, true);
  if (!mesh) throw new Error('Eli merge failed');
  mesh.name = 'eli';

  const mat = createCharacterMaterial(scene, 'eliMat');
  mesh.material = mat;
  enableInkOutline(mesh, 0.02);

  const root = new TransformNode('eliRoot', scene);
  mesh.parent = root;

  // Blob shadow (docs/06: no dynamic shadows on BASE tier).
  const blob = MeshBuilder.CreateDisc('eliBlob', { radius: 0.46, tessellation: 20 }, scene);
  blob.rotation.x = Math.PI / 2;
  blob.position.y = 0.015;
  const blobMat = new StandardMaterial('eliBlobMat', scene);
  blobMat.disableLighting = true;
  blobMat.diffuseColor = Color3.Black();
  blobMat.emissiveColor = Color3.Black();
  blobMat.alpha = 0.38;
  blob.material = blobMat;
  blob.parent = root;

  return { root, mesh };
}
