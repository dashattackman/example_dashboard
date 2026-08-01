// Entry for rig.html — the standalone character-rig review harness. Boots a
// minimal scene (renderer + EVE lighting + ground slab), loads the rigged base
// body through the shader pipeline, and exposes window.__rig for Playwright
// (test/e2e/characterRig.spec.ts) and for humans poking at clips from the
// console. Deliberately independent of main.ts — the game boot path is owned
// elsewhere and never imports this module.

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { createRenderer } from './renderer';
import { createLightingRig } from './lighting';
import { CameraRig } from './cameraRig';
import { createEnvironmentMaterial, PALETTE } from './materials';
import { loadCharacterRig, type CharacterRigHandle } from './characterRig';

interface RigTestApi {
  ready: boolean;
  error?: string;
  clips: string[];
  play(name: string): void;
  current(): string | null;
  time(): number;
}

declare global {
  interface Window {
    __rig?: RigTestApi;
    __rigHandle?: CharacterRigHandle;
  }
}

const hud = document.getElementById('rig-hud');
const api: RigTestApi = {
  ready: false,
  clips: [],
  play: () => undefined,
  current: () => null,
  time: () => 0,
};
window.__rig = api;

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const { scene } = await createRenderer(canvas);

  // Camera FIRST, synchronously — createRenderer's loop is already running, and
  // a camera-less scene.render() throws, which permanently kills Babylon's
  // render loop (the next frame is queued after the render call). Everything
  // below may await freely once this exists.
  const camTarget = new TransformNode('rigCamTarget', scene);
  const cam = new CameraRig(scene, camTarget);
  // Three-quarter front framing, slightly low — the attachment read.
  cam.setDebugPose([1.7, 1.5, 2.9], [0, 1.05, 0]);

  createLightingRig(scene); // defaults to EVE — the golden-hour money look

  const ground = MeshBuilder.CreateGround('rigGround', { width: 30, height: 30 }, scene);
  ground.material = createEnvironmentMaterial(scene, 'rigGroundMat', PALETTE.uptown.concrete);

  // `?glb=<url>` lets art review A/B alternate bodies without a rebuild.
  const override = new URLSearchParams(location.search).get('glb');
  const rig = await loadCharacterRig(scene, override ? { url: override } : {});
  window.__rigHandle = rig;

  rig.play('Idle');
  api.clips = rig.clips;
  api.play = (name) => rig.play(name);
  api.current = () => rig.current();

  // Monotonic mixer-time probe: rig.animationTime() is clip-local and WRAPS on
  // loop (Idle is ~1.7s), so the spec can't compare two raw samples. Accumulate
  // wrap-aware deltas instead — a dead mixer accumulates exactly 0.
  let mixerSeconds = 0;
  let lastClip: string | null = null;
  let lastT = 0;
  scene.onBeforeRenderObservable.add(() => {
    const clip = rig.current();
    const t = rig.animationTime();
    if (clip === lastClip && t >= lastT) mixerSeconds += t - lastT;
    else if (clip === lastClip && t < lastT) mixerSeconds += t; // looped past 0
    lastClip = clip;
    lastT = t;
  });
  api.time = () => mixerSeconds;
  api.ready = true;

  if (hud) {
    scene.onAfterRenderObservable.add(() => {
      hud.textContent =
        `clip: ${rig.current() ?? '-'}  t=${rig.animationTime().toFixed(2)}s\n` +
        `clips: ${rig.clips.join(' ')}\n` +
        `try: __rig.play('Punch_Left')`;
    });
  }
}

boot().catch((err: unknown) => {
  api.error = err instanceof Error ? err.message : String(err);
  if (hud) hud.textContent = `RIG LOAD FAILED: ${api.error}`;
});
