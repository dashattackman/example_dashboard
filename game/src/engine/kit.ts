// Kit-of-parts scene-building facade. World modules (src/world/*) compose geometry
// through this API so `engine/` stays the ONLY module importing @babylonjs/* (docs/05).
// M2's cityGen will build on the same primitives (thin instances + merged statics are
// "the whole game" per docs/06).

import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Material } from '@babylonjs/core/Materials/material';
import type { ICanvasRenderingContext } from '@babylonjs/core/Engines/ICanvas';
import '@babylonjs/core/Meshes/thinInstanceMesh'; // side-effect: thinInstance* on Mesh

import { createEnvironmentMaterial, type EnvTextureOpts } from './materials';

/** Placement for kit meshes / thin instances. Position is the mesh center. */
export interface Xform {
  pos: [number, number, number];
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: [number, number, number];
}

/** 2D paint surface for sign/backdrop textures — world code draws, engine owns the GPU.
 *  (ICanvasRenderingContext misses a few real-canvas members like textAlign; the runtime
 *  object is a genuine 2D context, so we widen the type here once.) */
export type Canvas2D = ICanvasRenderingContext & {
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
};
export type Draw2D = (ctx: Canvas2D, w: number, h: number) => void;

export type { Mesh, TransformNode, StandardMaterial, Scene };

function apply(mesh: Mesh, xf?: Xform): Mesh {
  if (xf) {
    mesh.position.set(xf.pos[0], xf.pos[1], xf.pos[2]);
    if (xf.rotX) mesh.rotation.x = xf.rotX;
    if (xf.rotY) mesh.rotation.y = xf.rotY;
    if (xf.rotZ) mesh.rotation.z = xf.rotZ;
    if (xf.scale) mesh.scaling.set(xf.scale[0], xf.scale[1], xf.scale[2]);
  }
  return mesh;
}

export interface Kit {
  readonly scene: Scene;
  /** Graphic-novel environment material (smooth light, subtle rim). Pass
   *  `texture` for a real surface map — palette hex still owns the hue
   *  (maps are normalized; see materials.ts EnvTextureOpts). */
  envMat(
    name: string,
    hex: string,
    opts?: { emissiveHex?: string; emissiveLevel?: number; texture?: EnvTextureOpts },
  ): StandardMaterial;
  /** Unlit glow material (signs, lit glass, lamp heads, neon). */
  glowMat(name: string, hex: string, level?: number, alpha?: number): StandardMaterial;
  /** Re-tint a glow material — the lighting phase hook for neon dressing. */
  setGlow(mat: StandardMaterial, hex: string, level: number, alpha?: number): void;
  /** Bake a flat vertex color onto a part, so differently-colored parts can merge
   *  into ONE mesh under one white-diffuse material (1 draw call per module). */
  tint(mesh: Mesh, hex: string): Mesh;
  box(name: string, w: number, h: number, d: number, mat: Material, xf?: Xform): Mesh;
  cyl(
    name: string,
    opts: { h: number; d: number; dTop?: number; tess?: number },
    mat: Material,
    xf?: Xform,
  ): Mesh;
  sphere(name: string, d: number, mat: Material, xf?: Xform, segments?: number): Mesh;
  /** Single-sided quad, default facing +Z. */
  plane(name: string, w: number, h: number, mat: Material, xf?: Xform): Mesh;
  ground(name: string, w: number, d: number, mat: Material, xf?: Xform): Mesh;
  /** Merge parts into one frozen static mesh (per-material batching). */
  merge(name: string, parts: Mesh[]): Mesh;
  /** Thin-instance `mesh` at each xform; optional per-instance color hexes. */
  thin(mesh: Mesh, xfs: Xform[], colorHexes?: string[]): void;
  /** Textured quad painted via canvas 2D (signs, skyline backdrop, murals).
   *  `lit: true` runs the canvas through the graphic-novel environment material
   *  (scene-lit, rim-graded) instead of the default unlit emissive — physical
   *  painted surfaces (murals, posters, grates) belong in the lighting. */
  canvasPlane(
    name: string,
    w: number,
    h: number,
    texW: number,
    texH: number,
    draw: Draw2D,
    opts?: { fog?: boolean; alpha?: boolean; lit?: boolean },
    xf?: Xform,
  ): Mesh;
  /** Redraw a canvasPlane's texture in place (phase dressing — e.g. the skyline
   *  swaps lit/unlit windows instead of shipping a baked night texture). */
  repaint(mesh: Mesh, draw: Draw2D): void;
  /** Scale an UNLIT canvasPlane's emissive brightness (0..~1). Phase hook for
   *  window rooms / blinds / shop displays without a repaint. */
  setCanvasLevel(mesh: Mesh, level: number): void;
  /** Multiply a mesh's UVs so a tiling texture repeats in world units. Call
   *  BEFORE merge/thin. One factor per mesh: pick the dominant visible face. */
  uv(mesh: Mesh, u: number, v: number): Mesh;
  freeze(...meshes: Mesh[]): void;
}

export function createKit(scene: Scene): Kit {
  const kit: Kit = {
    scene,

    envMat: (name, hex, opts) => createEnvironmentMaterial(scene, name, hex, opts),

    glowMat: (name, hex, level = 1, alpha = 1) => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveColor = Color3.FromHexString(hex).scale(level);
      if (alpha < 1) m.alpha = alpha;
      return m;
    },

    setGlow: (mat, hex, level, alpha) => {
      mat.emissiveColor = Color3.FromHexString(hex).scale(level);
      if (alpha !== undefined) mat.alpha = alpha;
    },

    tint: (mesh, hex) => {
      const c = Color3.FromHexString(hex);
      const n = mesh.getTotalVertices();
      const data = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b, 1], i * 4);
      mesh.setVerticesData(VertexBuffer.ColorKind, data);
      return mesh;
    },

    box: (name, w, h, d, mat, xf) => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.material = mat;
      return apply(m, xf);
    },

    cyl: (name, opts, mat, xf) => {
      const m = MeshBuilder.CreateCylinder(
        name,
        {
          height: opts.h,
          diameter: opts.d,
          diameterTop: opts.dTop ?? opts.d,
          tessellation: opts.tess ?? 10,
        },
        scene,
      );
      m.material = mat;
      return apply(m, xf);
    },

    sphere: (name, d, mat, xf, segments = 10) => {
      const m = MeshBuilder.CreateSphere(name, { diameter: d, segments }, scene);
      m.material = mat;
      return apply(m, xf);
    },

    plane: (name, w, h, mat, xf) => {
      const m = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
      m.material = mat;
      return apply(m, xf);
    },

    ground: (name, w, d, mat, xf) => {
      const m = MeshBuilder.CreateGround(name, { width: w, height: d }, scene);
      m.material = mat;
      return apply(m, xf);
    },

    merge: (name, parts) => {
      const merged = Mesh.MergeMeshes(parts, true, true);
      if (!merged) throw new Error(`merge produced no mesh: ${name}`);
      merged.name = name;
      merged.freezeWorldMatrix();
      return merged;
    },

    thin: (mesh, xfs, colorHexes) => {
      const buf = new Float32Array(xfs.length * 16);
      const scale = new Vector3(1, 1, 1);
      for (let i = 0; i < xfs.length; i++) {
        const xf = xfs[i]!;
        scale.set(xf.scale?.[0] ?? 1, xf.scale?.[1] ?? 1, xf.scale?.[2] ?? 1);
        Matrix.Compose(
          scale,
          Quaternion.FromEulerAngles(xf.rotX ?? 0, xf.rotY ?? 0, xf.rotZ ?? 0),
          new Vector3(xf.pos[0], xf.pos[1], xf.pos[2]),
        ).copyToArray(buf, i * 16);
      }
      mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
      if (colorHexes) {
        const cbuf = new Float32Array(xfs.length * 4);
        for (let i = 0; i < xfs.length; i++) {
          const c = Color4.FromHexString(`${colorHexes[i % colorHexes.length]!}ff`);
          cbuf.set([c.r, c.g, c.b, 1], i * 4);
        }
        mesh.thinInstanceSetBuffer('color', cbuf, 4, true);
      }
      mesh.freezeWorldMatrix();
    },

    canvasPlane: (name, w, h, texW, texH, draw, opts, xf) => {
      const tex = new DynamicTexture(`${name}Tex`, { width: texW, height: texH }, scene, true);
      draw(tex.getContext() as Canvas2D, texW, texH);
      tex.update(); // default invertY keeps canvas orientation upright on the plane
      let m: StandardMaterial;
      if (opts?.lit) {
        // Scene-lit painted surface: canvas rides the diffuse slot of the
        // graphic-novel env material, so murals/posters sit in the lighting.
        m = createEnvironmentMaterial(scene, `${name}Mat`, '#ffffff');
        m.diffuseTexture = tex;
      } else {
        m = new StandardMaterial(`${name}Mat`, scene);
        m.disableLighting = true;
        m.diffuseColor = Color3.Black();
        m.specularColor = Color3.Black();
        m.emissiveTexture = tex;
      }
      if (opts?.alpha) {
        tex.hasAlpha = true;
        m.opacityTexture = tex;
      }
      if (opts?.fog === false) m.fogEnabled = false;
      const mesh = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
      mesh.material = m;
      return apply(mesh, xf);
    },

    repaint: (mesh, draw) => {
      const m = mesh.material as StandardMaterial;
      const tex = (m.emissiveTexture ?? m.diffuseTexture) as DynamicTexture;
      const { width, height } = tex.getSize();
      draw(tex.getContext() as Canvas2D, width, height);
      tex.update();
    },

    setCanvasLevel: (mesh, level) => {
      const m = mesh.material as StandardMaterial;
      if (m.emissiveTexture) m.emissiveTexture.level = level;
    },

    uv: (mesh, u, v) => {
      const data = mesh.getVerticesData(VertexBuffer.UVKind);
      if (data) {
        const scaled = new Float32Array(data.length);
        for (let i = 0; i < data.length; i += 2) {
          scaled[i] = data[i]! * u;
          scaled[i + 1] = data[i + 1]! * v;
        }
        mesh.setVerticesData(VertexBuffer.UVKind, scaled);
      }
      return mesh;
    },

    freeze: (...meshes) => {
      for (const m of meshes) m.freezeWorldMatrix();
    },
  };
  return kit;
}
