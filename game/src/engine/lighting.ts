// Phase-driven time-of-day rig (docs/01 "Lighting is the star", docs/06 look-cheaply).
// Four authored looks keyed to the sim clock's phases (MORN/DAY/EVE/LATE). Each look
// owns sun angle/color, hemisphere, linear fog, the skydome gradient, and the global
// rim tint pushed into the graphic-novel materials. EVE is the money shot: low golden
// sun, teal dusk sky, sodium horizon. LATE is deep blue ambient + neon-ready emissives
// (the look's `neon` level drives sign/window/lamp dressing in world code).

import { Scene } from '@babylonjs/core/scene';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

import { PHASE_BOUNDS, dayProgress, phaseOf, type Phase } from '../sim/clock';
import { setRimLook } from './materials';

export interface PhaseLook {
  /** Direction sunlight travels (sun sits at -dir). */
  sunDir: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: { color: string; start: number; end: number };
  /** Vertical gradient, top (0) to horizon-ish (1). */
  skyStops: Array<[number, string]>;
  clear: string;
  rim: { color: string; intensity: number };
  /** 0..1 — how hard signs / lit windows / lamps glow in this phase. */
  neon: number;
  /** Procedural cloud layer painted into the skydome (docs/01: "gradient +
   *  procedural cloud skydome"). `drift` = dome u-revolutions per second. */
  clouds: {
    style: 'wisps' | 'cumulus' | 'streaks';
    /** Cloud body / underside-accent colors — authored per phase like the sky. */
    body: string;
    accent: string;
    opacity: number;
    drift: number;
    stars?: boolean;
  };
}

// World axes: +X east, +Z north (the beauty-corner vista looks north up the avenue).
export const LOOKS: Record<Phase, PhaseLook> = {
  MORN: {
    sunDir: [-0.75, -0.32, 0.18], // low sun in the east — long cool morning light
    sunColor: '#ffd9a8',
    sunIntensity: 1.15,
    hemiSky: '#b8c8e8',
    hemiGround: '#6b5a4c',
    hemiIntensity: 0.52,
    fog: { color: '#d8e2ee', start: 130, end: 460 },
    skyStops: [
      [0, '#4a72ae'],
      [0.5, '#9fbeda'],
      [0.78, '#f2d5a8'],
      [0.9, '#f2c48c'],
      [1, '#8a7a6a'],
    ],
    clear: '#4a72ae',
    rim: { color: '#ffe7c2', intensity: 0.5 },
    neon: 0,
    // High thin morning wisps, barely-pink off the low sun.
    clouds: { style: 'wisps', body: '#f6e4cc', accent: '#ffd2a8', opacity: 0.4, drift: 0.0022 },
  },
  DAY: {
    sunDir: [-0.3, -0.88, 0.28], // high summer sun
    sunColor: '#fff2dd',
    sunIntensity: 1.25,
    hemiSky: '#9fb8d8',
    hemiGround: '#5a5148',
    hemiIntensity: 0.6,
    fog: { color: '#bccfe2', start: 150, end: 520 },
    skyStops: [
      [0, '#2e6cb8'],
      [0.6, '#7fb0dd'],
      [0.86, '#c8dff0'],
      [1, '#9fb4c4'],
    ],
    clear: '#2e6cb8',
    rim: { color: '#eef4ff', intensity: 0.32 },
    neon: 0,
    clouds: { style: 'cumulus', body: '#f4f8fc', accent: '#9fb0c0', opacity: 0.85, drift: 0.0025 },
  },
  EVE: {
    // Golden hour — sun low in the west, ahead-left of the default camera so
    // characters pick up a hot back-rim and east-side brick glows warm.
    sunDir: [0.78, -0.24, -0.4],
    sunColor: '#ffb473',
    sunIntensity: 1.35,
    hemiSky: '#7286c2',
    hemiGround: '#5a4030', // warm street bounce — golden hour lives in the fill too
    hemiIntensity: 0.55,
    fog: { color: '#bd8b60', start: 110, end: 430 }, // a touch tealward off pure sodium
    skyStops: [
      // The Uptown signature: teal dusk over a sodium-gold horizon (docs/01).
      // Dome calibration (verified via shots): equator v≈0.5 sits at the horizon and
      // the gate-shot frame sees v≈0.40-0.55 — teal fills that band, sodium hugs the
      // rooflines at 0.52-0.58, ground-brown below.
      [0, '#0e2038'],
      [0.3, '#20506c'], // upper blend stays teal so the whole framed band reads teal
      [0.425, '#2f6486'],
      [0.458, '#e8a050'], // sodium rim right above the skyline's top edge
      [0.478, '#f2b96b'],
      [0.52, '#b06a38'],
      [0.6, '#3a2b28'],
      [1, '#241d18'],
    ],
    clear: '#16233f',
    rim: { color: '#ffcf8a', intensity: 1.0 },
    neon: 0.55,
    // The money-shot clouds: violet-grey cumulus catching sodium on the belly.
    clouds: { style: 'cumulus', body: '#6e5a80', accent: '#f2b06b', opacity: 0.7, drift: 0.0018 },
  },
  LATE: {
    sunDir: [0.3, -0.72, -0.5], // moon-ish key, barely there
    sunColor: '#93aee0',
    sunIntensity: 0.32,
    hemiSky: '#31447c', // deep blue ambient (docs/01 night)
    hemiGround: '#161d33',
    hemiIntensity: 0.52,
    fog: { color: '#0d1430', start: 80, end: 340 },
    skyStops: [
      // Same dome calibration as EVE: violet city-glow rides just above the horizon.
      [0, '#05070f'],
      [0.3, '#0d1530'],
      [0.42, '#232a55'],
      [0.47, '#41295c'], // violet city-glow clears the rooftops
      [0.55, '#1a1030'],
      [1, '#0d0a1a'],
    ],
    clear: '#05070f',
    rim: { color: '#8fb4ff', intensity: 0.85 },
    neon: 1,
    // Thin high cirrus over stars — motion keeps LATE alive without light.
    clouds: { style: 'streaks', body: '#3a426e', accent: '#232a55', opacity: 0.5, drift: 0.0008, stars: true },
  },
};

export interface LightingRig {
  /** Apply a phase look wholesale. Returns the look so callers can dress neon. */
  applyPhase(phase: Phase): PhaseLook;
  /** Drive from the sim clock: swaps looks on phase change, drifts the sun within one. */
  update(minuteOfDay: number): void;
  currentPhase(): Phase;
}

export function createLightingRig(scene: Scene): LightingRig {
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -0.3, 0.7), scene);

  // Gradient + cloud skydome — inverted sphere, redrawn (512x256) on phase change.
  // The gradient is horizontally uniform, so animating the texture's uOffset
  // drifts ONLY the clouds around the dome: motion for one uniform per frame,
  // zero extra draw calls, no repaints (docs/01 "skies do heavy lifting").
  const sky = MeshBuilder.CreateSphere('sky', { diameter: 900, sideOrientation: 1 }, scene);
  sky.isPickable = false;
  sky.infiniteDistance = true;
  const skyMat = new StandardMaterial('skyMat', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  // The dome sits beyond fogEnd — with fog on, the whole gradient washes to fog
  // color and the EVE teal band can never reach the screen. Sky paints itself.
  skyMat.fogEnabled = false;
  const SKY_W = 512;
  const SKY_H = 256;
  const skyTex = new DynamicTexture('skyTex', { width: SKY_W, height: SKY_H }, scene, false);
  skyMat.emissiveTexture = skyTex;
  sky.material = skyMat;

  scene.fogMode = Scene.FOGMODE_LINEAR;

  let phase: Phase = 'EVE';
  let cloudDrift = 0;

  // Deterministic PRNG — cloud layouts stay stable across runs (screenshot diffs).
  const makeRand = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  const rgba = (hex: string, a: number): string => {
    const c = Color3.FromHexString(hex);
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
  };

  /** Clouds live in the y 24..116 band (horizon sits at y≈128 — dome v0.5).
   *  Everything paints at x and x±SKY_W so the dome's u-seam never shows. */
  const paintClouds = (ctx: ReturnType<DynamicTexture['getContext']>, look: PhaseLook): void => {
    const { style, body, accent, opacity, stars } = look.clouds;
    const r = makeRand(0xc10d5);
    const blob = (x: number, y: number, rad: number, color: string, squash: number): void => {
      for (const dx of [0, -SKY_W, SKY_W]) {
        const g = ctx.createRadialGradient(x + dx, y / squash, 0, x + dx, y / squash, rad);
        g.addColorStop(0, color);
        g.addColorStop(1, rgba(body, 0));
        ctx.save();
        ctx.scale(1, squash);
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - rad, y / squash - rad, rad * 2, rad * 2);
        ctx.restore();
      }
    };
    if (stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 70; i++) {
        const sx = r() * SKY_W;
        const sy = 6 + r() * 100;
        ctx.globalAlpha = 0.25 + r() * 0.6;
        ctx.fillRect(sx, sy, r() < 0.15 ? 2 : 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (style === 'cumulus') {
      // Soft stacked puffs with a lit accent along the belly. The band hugs the
      // 70..118 range — low enough that the street framings actually SEE them
      // over the rooflines (horizon = 128; verified via gate/lake shots).
      for (let i = 0; i < 8; i++) {
        const cx = r() * SKY_W;
        const cy = 80 + r() * 40;
        const puffs = 5 + Math.floor(r() * 3);
        for (let p = 0; p < puffs; p++) {
          const px = cx + (r() - 0.5) * 74;
          const py = cy + (r() - 0.5) * 14;
          blob(px, py, 16 + r() * 20, rgba(body, opacity * (0.55 + r() * 0.35)), 0.55);
        }
        for (let p = 0; p < 3; p++) {
          blob(cx + (r() - 0.5) * 56, cy + 12, 10 + r() * 9, rgba(accent, opacity * 0.55), 0.4);
        }
      }
      // A couple of small far puffs right on the horizon band for depth.
      for (let i = 0; i < 4; i++) {
        blob(r() * SKY_W, 116 + r() * 6, 8 + r() * 6, rgba(body, opacity * 0.4), 0.4);
      }
    } else if (style === 'wisps') {
      for (let i = 0; i < 10; i++) {
        const cx = r() * SKY_W;
        const cy = 66 + r() * 56;
        blob(cx, cy, 34 + r() * 36, rgba(i % 3 ? body : accent, opacity * (0.6 + r() * 0.4)), 0.14);
      }
    } else {
      // streaks — long thin cirrus bands.
      for (let i = 0; i < 6; i++) {
        const cx = r() * SKY_W;
        const cy = 56 + r() * 64;
        blob(cx, cy, 48 + r() * 46, rgba(i % 2 ? body : accent, opacity * (0.55 + r() * 0.35)), 0.09);
      }
    }
  };

  const paintSky = (look: PhaseLook): void => {
    const ctx = skyTex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, SKY_H);
    for (const [pos, hex] of look.skyStops) grad.addColorStop(pos, hex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SKY_W, SKY_H);
    paintClouds(ctx, look);
    skyTex.update(false);
  };

  // Cloud drift — the one always-on scene animation the sky owns.
  scene.onBeforeRenderObservable.add(() => {
    if (cloudDrift > 0) {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      skyTex.uOffset = (skyTex.uOffset + cloudDrift * dt) % 1;
    }
  });

  const applyPhase = (p: Phase): PhaseLook => {
    phase = p;
    const look = LOOKS[p];
    sun.direction = Vector3.FromArray(look.sunDir).normalize();
    sun.diffuse = Color3.FromHexString(look.sunColor);
    sun.intensity = look.sunIntensity;
    hemi.diffuse = Color3.FromHexString(look.hemiSky);
    hemi.groundColor = Color3.FromHexString(look.hemiGround);
    hemi.intensity = look.hemiIntensity;
    scene.fogColor = Color3.FromHexString(look.fog.color);
    scene.fogStart = look.fog.start;
    scene.fogEnd = look.fog.end;
    scene.clearColor = Color4.FromHexString(`${look.clear}ff`);
    paintSky(look);
    cloudDrift = look.clouds.drift;
    setRimLook(look.rim.color, look.rim.intensity);
    return look;
  };

  applyPhase('EVE'); // docs/01: late-summer golden hour is the slice default.

  return {
    applyPhase,
    update: (minuteOfDay: number) => {
      const p = phaseOf(minuteOfDay);
      if (p !== phase) applyPhase(p);
      // Subtle intra-phase sun drift so light isn't frozen: swing azimuth a few
      // degrees across the phase (dayProgress keeps it monotonic over the day).
      const b = PHASE_BOUNDS[p];
      const m = ((minuteOfDay % 1440) + 1440) % 1440;
      const mm = m < b.startMin ? m + 1440 : m; // LATE wraps midnight
      const t = Math.min(Math.max((mm - b.startMin) / (b.endMin - b.startMin), 0), 1);
      const drift = (t - 0.5) * 0.22; // azimuth swing across the phase
      const sink = 1 - 0.2 * dayProgress(minuteOfDay); // sun rides lower as the day runs
      const base = LOOKS[p].sunDir;
      const cos = Math.cos(drift);
      const sin = Math.sin(drift);
      sun.direction.set(
        base[0] * cos - base[2] * sin,
        base[1] * sink,
        base[0] * sin + base[2] * cos,
      );
      sun.direction.normalize();
    },
    currentPhase: () => phase,
  };
}
