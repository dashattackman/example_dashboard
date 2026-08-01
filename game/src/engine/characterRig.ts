// Rigged+animated character pipeline (docs/06 "Characters", CLAUDE.md asset routing:
// CC0 pack body through OUR shader pipeline — procedural primitives are placeholders).
//
// Base body: "Adventurer" from Quaternius' Ultimate Animated Character Pack (CC0 1.0,
// see public/assets/CREDITS.md). Preprocessed with gltf-transform (backpack stripped,
// brawler clip set kept, flat material colors baked to sRGB VERTEX COLORS, and all
// primitives merged into one skinned primitive) so at runtime the swap to our
// rim/ramp character material is exact: white diffuse + vertex colors, ONE draw
// call for the whole figure + one inverted-hull outline call — same budget shape
// as the Eli placeholder.
//
// API mirrors buildEli's CharacterHandle ({ root, mesh }) plus clip playback with
// cross-fade, so swapping the placeholder is a one-line change in world code LATER
// (this module deliberately does not touch main.ts / character.ts).

import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Observer } from '@babylonjs/core/Misc/observable';
// Side-effect: registers the glTF 2.0 file loader with SceneLoader.
import '@babylonjs/loaders/glTF/2.0';

import { createCharacterMaterial, PALETTE } from './materials';

// Ink outline note: the glb carries a BAKED inverted hull — a second skinned
// primitive ("AdventurerHull") whose positions were pushed along bind-pose
// normals with flipped winding at asset-process time. Runtime only paints it
// flat ink. This is deliberate: both Babylon's OutlineRenderer and a
// vertex-push material plugin shatter skinned meshes into shards under CI's
// software GL (verified in the rig harness), while a plain StandardMaterial
// on a second skinned mesh renders flawlessly. Bake > cleverness.

/** glTF animations import at Babylon's fixed 60 frames/sec timebase. */
const GLTF_FPS = 60;

export interface RigPlayOptions {
  /** Cross-fade duration in seconds (0 = hard cut). Default 0.18. */
  fade?: number;
  /** Loop the clip. Default true (set false for punches/hits/death). */
  loop?: boolean;
  /** Playback speed ratio. Default 1. */
  speed?: number;
}

export interface CharacterRigHandle {
  /** Position/rotate this — same contract as buildEli's CharacterHandle.root. */
  root: TransformNode;
  /** Primary body mesh (largest skinned mesh) — outline/material carrier. */
  mesh: Mesh;
  /** Every renderable mesh of the rig (all share the one character material). */
  meshes: Mesh[];
  /** Clip names available on this body (e.g. Idle, Walk, Run, Punch_Left…). */
  clips: string[];
  /** Play a clip, cross-fading from whatever is currently playing. */
  play(name: string, opts?: RigPlayOptions): void;
  /** Name of the clip currently winning the blend, or null before first play. */
  current(): string | null;
  /** Seconds into the current clip — advances while the mixer runs (test hook). */
  animationTime(): number;
  dispose(): void;
}

export interface LoadCharacterRigOptions {
  /** Asset URL, resolved against the page (default: the shared base body). */
  url?: string;
  /** Rig is uniformly scaled so its rest-pose height matches this (meters). */
  targetHeight?: number;
}

export async function loadCharacterRig(
  scene: Scene,
  opts: LoadCharacterRigOptions = {},
): Promise<CharacterRigHandle> {
  const url = opts.url ?? 'assets/characters/adventurer.glb';
  const slash = url.lastIndexOf('/') + 1;
  const result = await SceneLoader.ImportMeshAsync(
    '',
    url.slice(0, slash),
    url.slice(slash),
    scene,
  );

  const loadedRoot = result.meshes.find((m) => !m.parent) ?? result.meshes[0];
  if (!loadedRoot) throw new Error(`characterRig: no meshes in ${url}`);

  // --- Our shader pipeline: ONE rim/ramp material for the body (color rides
  // in vertex colors, exactly like buildEli) + flat ink on the baked hull. The
  // loader's PBR materials are discarded wholesale.
  const mat = createCharacterMaterial(scene, 'rigMat');
  const inkMat = new StandardMaterial('rigInkMat', scene);
  inkMat.disableLighting = true;
  inkMat.diffuseColor = Color3.Black();
  inkMat.specularColor = Color3.Black();
  inkMat.emissiveColor = Color3.FromHexString(PALETTE.ink);

  const meshes: Mesh[] = [];
  const oldMaterials = new Set<NonNullable<Mesh['material']>>();
  for (const m of result.meshes) {
    if (!(m instanceof Mesh) || m.getTotalVertices() === 0) continue;
    if (m.material) oldMaterials.add(m.material);
    m.material = /hull/i.test(m.name) ? inkMat : mat;
    m.isPickable = false;
    meshes.push(m);
  }
  for (const old of oldMaterials) old.dispose(false, true);
  const bodies = meshes.filter((m) => m.material === mat);
  const mesh = bodies.reduce((a, b) => (b.getTotalVertices() > a.getTotalVertices() ? b : a));

  // --- Normalize scale to hero height (docs/01 proportions; Eli stands ~2m).
  const bounds = loadedRoot.getHierarchyBoundingVectors(true);
  const height = bounds.max.y - bounds.min.y;
  const scale = (opts.targetHeight ?? 1.92) / Math.max(height, 0.01);

  const root = new TransformNode('rigRoot', scene);
  loadedRoot.scaling.scaleInPlace(scale);
  loadedRoot.parent = root;

  // Blob shadow — parity with buildEli (docs/06: no dynamic shadows on BASE tier).
  const blob = MeshBuilder.CreateDisc('rigBlob', { radius: 0.46, tessellation: 20 }, scene);
  blob.rotation.x = Math.PI / 2;
  blob.position.y = 0.015;
  blob.isPickable = false;
  const blobMat = new StandardMaterial('rigBlobMat', scene);
  blobMat.disableLighting = true;
  blobMat.diffuseColor = Color3.Black();
  blobMat.emissiveColor = Color3.Black();
  blobMat.alpha = 0.38;
  blob.material = blobMat;
  blob.parent = root;

  // --- Clip playback with cross-fade. Weights ramp on the scene's animation
  // tick; groups that fade out fully are stopped (no idle mixer cost).
  const groups = new Map<string, AnimationGroup>();
  for (const g of result.animationGroups) {
    g.stop();
    g.setWeightForAllAnimatables(0);
    groups.set(g.name, g);
  }

  interface FadeTarget {
    group: AnimationGroup;
    weight: number;
    to: 0 | 1;
    rate: number; // weight units per second
  }
  const fades: FadeTarget[] = [];
  let currentName: string | null = null;
  let currentGroup: AnimationGroup | null = null;

  const tick: Observer<Scene>['callback'] = () => {
    if (fades.length === 0) return;
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i]!;
      f.weight += (f.to === 1 ? 1 : -1) * f.rate * dt;
      if (f.to === 1 && f.weight >= 1) {
        f.weight = 1;
        fades.splice(i, 1);
      } else if (f.to === 0 && f.weight <= 0) {
        f.weight = 0;
        f.group.stop();
        fades.splice(i, 1);
      }
      f.group.setWeightForAllAnimatables(f.weight);
    }
  };
  const observer = scene.onBeforeAnimationsObservable.add(tick);

  const play = (name: string, playOpts: RigPlayOptions = {}): void => {
    const group = groups.get(name);
    if (!group) throw new Error(`characterRig: unknown clip "${name}"`);
    if (group === currentGroup && group.isPlaying) return;
    const fade = playOpts.fade ?? 0.18;
    const previous = currentGroup;
    currentGroup = group;
    currentName = name;

    group.start(playOpts.loop ?? true, playOpts.speed ?? 1);
    const enqueue = (g: AnimationGroup, to: 0 | 1, from: number): void => {
      const existing = fades.find((f) => f.group === g);
      const weight = existing ? existing.weight : from;
      if (existing) fades.splice(fades.indexOf(existing), 1);
      if (fade <= 0) {
        g.setWeightForAllAnimatables(to);
        if (to === 0) g.stop();
        return;
      }
      g.setWeightForAllAnimatables(weight);
      fades.push({ group: g, weight, to, rate: 1 / fade });
    };
    enqueue(group, 1, 0);
    if (previous && previous !== group) enqueue(previous, 0, 1);
  };

  return {
    root,
    mesh,
    meshes,
    clips: [...groups.keys()].sort(),
    play,
    current: () => currentName,
    animationTime: () => {
      const a = currentGroup?.animatables[0];
      return a ? (a.masterFrame - (currentGroup?.from ?? 0)) / GLTF_FPS : 0;
    },
    dispose: () => {
      scene.onBeforeAnimationsObservable.remove(observer);
      for (const g of groups.values()) g.dispose();
      inkMat.dispose();
      mat.dispose(false, true);
      blobMat.dispose();
      root.dispose(false, true);
    },
  };
}
