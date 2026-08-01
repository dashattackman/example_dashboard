// Boot: renderer → lighting → beauty corner → Eli → controls. No @babylonjs imports
// here — everything graphical goes through src/engine/* (docs/05 module rule).

import { createRenderer } from './engine/renderer';
import { createLightingRig } from './engine/lighting';
import { CameraRig } from './engine/cameraRig';
import { attachDebug } from './engine/debug';
import { createKit } from './engine/kit';
import { buildEli } from './engine/character';
import { buildBeautyCorner } from './world/beautyCorner';
import { createTouchControls } from './ui/joystick';
import type { Phase } from './sim/clock';

const MOVE_SPEED = 6; // m/s — placeholder walk tuning until 02's table lands in tuning.json

/** M1: phase is picked via `?phase=` for art review and the Playwright beauty spec.
 *  The sim clock drives `rig.update(minute)` from M4's frozen clock API onward. */
function phaseFromUrl(): Phase {
  const p = new URLSearchParams(location.search).get('phase');
  return p === 'MORN' || p === 'DAY' || p === 'EVE' || p === 'LATE' ? p : 'EVE';
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  const { engine, scene, transport } = await createRenderer(canvas);

  const lighting = createLightingRig(scene);
  const kit = createKit(scene);
  const corner = buildBeautyCorner(kit);
  const look = lighting.applyPhase(phaseFromUrl());
  corner.applyNeon(look.neon);

  const eli = buildEli(scene);
  eli.root.position.set(...corner.playerSpawn);

  const rig = new CameraRig(scene, eli.root);
  const cam = new URLSearchParams(location.search).get('cam');
  if (cam) {
    const v = cam.split(',').map(Number);
    if (v.length === 6 && v.every((n) => Number.isFinite(n))) {
      rig.setDebugPose([v[0]!, v[1]!, v[2]!], [v[3]!, v[4]!, v[5]!]);
    }
  }
  const input = createTouchControls(uiRoot);
  attachDebug(engine, scene, transport);

  const { minX, maxX, minZ, maxZ } = corner.bounds;
  let heading = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min((scene.deltaTime ?? 16) / 1000, 0.1);
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0.12) {
      const step = (MOVE_SPEED * Math.min(mag, 1) * dt) / (mag || 1);
      eli.root.position.x = Math.min(Math.max(eli.root.position.x + input.x * step, minX), maxX);
      eli.root.position.z = Math.min(Math.max(eli.root.position.z + input.y * step, minZ), maxZ);
      const targetHeading = Math.atan2(input.x, input.y);
      let d = targetHeading - heading;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      heading += d * Math.min(12 * dt, 1);
      eli.root.rotation.y = heading;
    }
    rig.update(dt);
  });
}

// Phone-side failures must be visible, not a silent blue screen.
function showFatal(msg: string): void {
  let el = document.getElementById('fatal-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal-banner';
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:999;padding:10px 14px;' +
      'background:#7a1f1f;color:#ffe;font:12px/1.4 monospace;pointer-events:auto;' +
      'white-space:pre-wrap;word-break:break-word';
    document.body.appendChild(el);
  }
  el.textContent = `TWIN CITIES error — screenshot this:\n${msg}`;
}
window.addEventListener('error', (e) => showFatal(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack ?? e.reason)));

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));
