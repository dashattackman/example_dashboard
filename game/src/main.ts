// Boot: renderer → lighting → beauty corner → Eli → controls. No @babylonjs imports
// here — everything graphical goes through src/engine/* (docs/05 module rule).

import { createRenderer } from './engine/renderer';
import { createLightingRig } from './engine/lighting';
import { CameraRig } from './engine/cameraRig';
import { attachDebug } from './engine/debug';
import { createKit } from './engine/kit';
import { createRigAnchor, loadCharacterRig } from './engine/characterRig';
import type { CharacterRigHandle } from './engine/characterRig';
import { buildBeautyCorner } from './world/beautyCorner';
import { createAmbientCast } from './world/ambient';
import type { AmbientCast } from './world/ambient';
import { createTouchControls } from './ui/joystick';
import type { Phase } from './sim/clock';

const MOVE_SPEED = 6; // m/s — placeholder run tuning until 02's table lands in tuning.json
const RUN_INPUT = 0.6; // joystick magnitude where the gait breaks into a run

// Playwright hook for the ambient-cast spec (test/e2e/ambient.spec.ts).
declare global {
  interface Window {
    __ambientTest?: {
      ready: boolean;
      count: number;
      roles: string[];
      positions(): Array<[number, number, number]>;
      skeletons(): number;
    };
  }
}

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
  const phase = phaseFromUrl();
  const look = lighting.applyPhase(phase);
  corner.applyNeon(look.neon);

  // Camera target BEFORE any await: the render loop is already running, and a
  // camera-less scene.render() throws and kills it for good (rigHarness.ts has
  // the war story). Eli's rig mounts onto this anchor once downloaded.
  const player = createRigAnchor(scene, 'playerAnchor');
  player.position.set(...corner.playerSpawn);
  const rig = new CameraRig(scene, player);

  // Controls, camera debug pose, and the perf overlay attach BEFORE any asset
  // await — input must never be dead while glbs stream in (playtest r2 m1).
  const cam = new URLSearchParams(location.search).get('cam');
  if (cam) {
    const v = cam.split(',').map(Number);
    if (v.length === 6 && v.every((n) => Number.isFinite(n))) {
      rig.setDebugPose([v[0]!, v[1]!, v[2]!], [v[3]!, v[4]!, v[5]!]);
    }
  }
  const input = createTouchControls(uiRoot);
  attachDebug(engine, scene, transport);

  // Characters land progressively: the anchor moves (and the camera follows)
  // from frame one; Eli's body and the ambient cast pop in as they arrive.
  let eli: CharacterRigHandle | null = null;
  let ambient: AmbientCast | null = null;

  const { minX, maxX, minZ, maxZ } = corner.bounds;
  let heading = 0;
  scene.onBeforeRenderObservable.add(() => {
    // engine.getDeltaTime(), NOT scene.deltaTime — the latter is declared in
    // Babylon's types but never assigned at runtime (playtest blocker B1:
    // dt locked to 16ms made walk speed frame-rate dependent).
    // Clamp at 0.25s: long hitches (tab-away, shader compile, GC) must not
    // teleport anyone, but 0.1 was so tight that ANY sub-10fps stretch ran
    // the whole world in slow motion while animations played full-rate —
    // movement and clips must integrate the SAME clock (playtest r2 M1).
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.25);
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0.12) {
      const speed = MOVE_SPEED * Math.min(mag, 1);
      const step = (speed * dt) / (mag || 1);
      player.position.x = Math.min(Math.max(player.position.x + input.x * step, minX), maxX);
      player.position.z = Math.min(Math.max(player.position.z + input.y * step, minZ), maxZ);
      const targetHeading = Math.atan2(input.x, input.y);
      let d = targetHeading - heading;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      heading += d * Math.min(12 * dt, 1);
      player.rotation.y = heading;
      // Gait: joystick magnitude picks the clip, ground speed tunes its rate
      // (cross-fades handled by the rig; same-clip calls just retune speed).
      if (mag < RUN_INPUT)
        eli?.play('Walk', { speed: Math.min(Math.max(speed / 1.45, 0.7), 1.6) });
      else eli?.play('Run', { speed: Math.min(Math.max(speed / 3.8, 0.8), 1.35) });
    } else {
      eli?.play('Idle');
    }
    ambient?.update(dt, player.position.x, player.position.z);
    rig.update(dt);
  });

  // The Anchor, rigged: Eli's identity body (slate jacket / amber accent —
  // assets-pipeline/build-cast.mjs) and the ambient cast download in PARALLEL.
  const eliP = loadCharacterRig(scene, {
    url: 'assets/characters/eli.glb',
    targetHeight: 1.92,
  }).then((r) => {
    r.root.parent = player;
    r.play('Idle');
    eli = r;
  });
  const ambientP = createAmbientCast(scene, corner, phase).then((cast) => {
    ambient = cast;
    window.__ambientTest = {
      ready: true,
      count: cast.people.length,
      roles: cast.people.map((p) => p.role),
      positions: () => cast.people.map((p) => p.position()),
      skeletons: () => scene.skeletons.length,
    };
  });
  await Promise.all([eliP, ambientP]); // load failures still surface via boot()
}

// Phone-side failures must be visible AND phoned home (device telemetry →
// /api/report → GitHub issue → readable by the build session without screenshots).
const errorLog: string[] = [];
let reported = false;

function deviceReport(kind: 'error' | 'perf'): Record<string, unknown> {
  return {
    kind,
    build: __BUILD_ID__,
    url: location.href,
    ua: navigator.userAgent,
    transport: window.__twinDebug?.transport ?? 'boot',
    stats: window.__twinDebug ?? null,
    errors: errorLog.slice(0, 5),
    ts: new Date().toISOString(),
  };
}

function phoneHome(kind: 'error' | 'perf'): void {
  // Dev/preview servers have no /api/report — skip the 404 noise entirely;
  // production (CF Pages) is the only place the endpoint exists.
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return;
  if (kind === 'error' && reported) return; // one error report per session
  if (kind === 'error') reported = true;
  const body = JSON.stringify(deviceReport(kind));
  try {
    if (!navigator.sendBeacon?.(`${import.meta.env.BASE_URL}api/report`, body)) {
      void fetch(`${import.meta.env.BASE_URL}api/report`, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(() => void 0);
    }
  } catch {
    /* telemetry must never break the game */
  }
}

function showFatal(msg: string): void {
  errorLog.push(msg);
  phoneHome('error');
  let el = document.getElementById('fatal-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal-banner';
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:999;padding:10px 14px;' +
      'background:#7a1f1f;color:#ffe;font:12px/1.4 monospace;pointer-events:auto;' +
      'white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow:auto';
    document.body.appendChild(el);
  }
  // FIRST error is the root cause — always keep it on top; later ones append.
  el.textContent =
    `TWIN CITIES error (auto-reported)\n— first/root:\n${errorLog[0]}` +
    (errorLog.length > 1 ? `\n— then (${errorLog.length - 1} more):\n${errorLog[errorLog.length - 1]}` : '');
}
window.addEventListener('error', (e) => showFatal(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack ?? e.reason)));

// One perf snapshot per session, 20s in — real-device fps without screenshots.
setTimeout(() => {
  if (errorLog.length === 0 && window.__twinDebug) phoneHome('perf');
}, 20_000);

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));
