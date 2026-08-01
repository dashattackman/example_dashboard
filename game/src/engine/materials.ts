// Graphic-novel material library (docs/01 "Art direction", docs/06 "The graphic-novel look, cheaply").
//
// TECHNIQUE CHOICE — StandardMaterial + MaterialPluginBase, not NodeMaterial. Why:
// - A NodeMaterial graph re-implements lighting/fog/instancing/vertex-color plumbing we
//   get for free from StandardMaterial, ships a bigger JSON/JS footprint, and compiles a
//   bespoke shader per graph. The plugin injects ~15 lines into the battle-tested default
//   shader instead — one extra fresnel `pow` and a luminance quantize per fragment: near-free
//   on mobile, exactly what docs/06 prescribes ("in the base material shader ... a fresnel
//   term tinted per time-of-day").
// - Character and environment variants share ONE shader program (differences are uniforms,
//   not defines), which keeps the "≤12 live materials" budget honest and avoids extra
//   compile hitches on phones.
// - The plugin provides both GLSL and WGSL bodies, so the WebGPU path (docs/06: expected
//   HIGH-tier transport) uses Babylon's native WGSL StandardMaterial without pulling the
//   glslang/twgsl wasm transpilers — that download would blow the 8 MB first-playable rule.
//
// Rim is view-based fresnel (comic ink highlight), tinted globally per time-of-day by the
// lighting rig via setRimLook(). Ramp is a 3-step luminance quantize of the accumulated
// diffuse lighting (hue preserved) — characters get it; environment stays smooth with a
// subtle rim and gets its "ink" from value contrast (docs/01).

import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Rendering/outlineRenderer'; // side-effect: Mesh.renderOutline support

// ---------------------------------------------------------------------------
// Palette — district palettes from docs/01 ("Palette: saturated but moody").
// Hex strings so pure-TS/world code can consume them without Babylon types.
// ---------------------------------------------------------------------------

export const PALETTE = {
  uptown: {
    brick: '#8c3b2e', // warm brick red — the Uptown wall color
    brickDeep: '#6c2f26', // shadowed/plinth brick
    brickAged: '#7a4534', // secondary building tint
    teal: '#2a5d7c', // teal dusk — awnings, trim, sky mid-band
    tealDark: '#1d4457',
    sodium: '#f2a13c', // sodium-orange streetlight
    sodiumGlow: '#ffb75e',
    concrete: '#8a8578', // sidewalk slabs
    asphalt: '#2b2c31',
    trim: '#3a2a24', // window sash / cornice ink-brown
    warmWindow: '#ffca6e', // lit interior spill
  },
  lake: {
    cyan: '#3fa8c4', // cold cyan water highlights
    deepWater: '#1d5a74',
    paleGold: '#f5d78e', // low-sun path on water
  },
  club: {
    magenta: '#ff4fb8',
    violet: '#7b3fe0',
    deepRed: '#8e1f3a',
  },
  skyline: {
    silhouette: '#2b2547', // blue-violet towers (docs/01 signature image)
    silhouetteFar: '#3a3260',
    window: '#f4c877', // lit skyline windows
  },
  ink: '#10121a', // outline / darkest value
} as const;

export function hexToColor3(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

// ---------------------------------------------------------------------------
// Global time-of-day rim look (set by the lighting rig, read by every plugin
// instance at bind time — no registry bookkeeping needed).
// ---------------------------------------------------------------------------

const globalRim = { color: new Color3(1.0, 0.81, 0.54), intensity: 1.0 };
// View-aligned character fill (the "photographer's bounce card"): lifts
// camera-facing surfaces so faces read when the phase key is behind the
// character (EVE backlight turned Eli's face into a black smudge at phone
// scale). Characters only — environment materials keep fillStrength 0 so the
// value structure that IS the environment's ink stays untouched.
const globalFill = { color: new Color3(0.56, 0.64, 0.78), intensity: 0.0 };

/** Tint every graphic-novel material's rim light — and the view-aligned
 *  character fill — called by lighting.ts per phase. */
export function setRimLook(
  hex: string,
  intensity: number,
  fillHex?: string,
  fillIntensity?: number,
): void {
  globalRim.color.copyFrom(Color3.FromHexString(hex));
  globalRim.intensity = intensity;
  if (fillHex !== undefined) globalFill.color.copyFrom(Color3.FromHexString(fillHex));
  if (fillIntensity !== undefined) globalFill.intensity = fillIntensity;
}

// ---------------------------------------------------------------------------
// The plugin
// ---------------------------------------------------------------------------

class GraphicNovelDefines extends MaterialDefines {
  GRAPHICNOVEL = false;
}

export interface GraphicNovelOptions {
  /** Per-material rim multiplier on the global time-of-day rim intensity. */
  rimStrength: number;
  /** Fresnel exponent — higher = tighter rim. */
  rimPower: number;
  /** 0 = smooth lighting (environment); >=2 = N-step toon ramp (characters). */
  rampSteps: number;
  /** Lift for the shadow band so ramped shadows never crush to black. */
  shadowFloor: number;
  /** Per-material multiplier on the global view-aligned fill (characters 1,
   *  environment 0 — see globalFill above). Default 0. */
  fillStrength?: number;
}

export class GraphicNovelPlugin extends MaterialPluginBase {
  private readonly _opts: GraphicNovelOptions;

  constructor(material: Material, opts: GraphicNovelOptions) {
    super(material, 'GraphicNovel', 200, new GraphicNovelDefines());
    this._opts = opts;
    this._enable(true);
  }

  override getClassName(): string {
    return 'GraphicNovelPlugin';
  }

  override isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines['GRAPHICNOVEL'] = true;
  }

  override getUniforms(): {
    ubo: Array<{ name: string; size: number; type: string }>;
    fragment: string;
  } {
    return {
      ubo: [
        // x: rim intensity, y: rim power, z: ramp steps, w: shadow floor
        { name: 'tcParams', size: 4, type: 'vec4' },
        { name: 'tcRimColor', size: 3, type: 'vec3' },
        // rgb: fill color, w: fill intensity (global × per-material strength)
        { name: 'tcFill', size: 4, type: 'vec4' },
      ],
      // Declaration used only on the non-UBO (WebGL1-style) fallback path.
      fragment: `#ifdef GRAPHICNOVEL
        uniform vec4 tcParams;
        uniform vec3 tcRimColor;
        uniform vec4 tcFill;
      #endif`,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    const o = this._opts;
    uniformBuffer.updateFloat4(
      'tcParams',
      o.rimStrength * globalRim.intensity,
      o.rimPower,
      o.rampSteps,
      o.shadowFloor,
    );
    uniformBuffer.updateColor3('tcRimColor', globalRim.color);
    uniformBuffer.updateFloat4(
      'tcFill',
      globalFill.color.r,
      globalFill.color.g,
      globalFill.color.b,
      globalFill.intensity * (o.fillStrength ?? 0),
    );
  }

  override getCustomCode(
    shaderType: string,
    shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL,
  ): { [pointName: string]: string } | null {
    if (shaderType !== 'fragment') return null;

    // Injected at CUSTOM_FRAGMENT_BEFORE_FOG: `color`, `diffuseBase`, `diffuseColor`,
    // `emissiveColor`, `baseColor`, `baseAmbientColor`, `finalSpecular`, `normalW`
    // and `viewDirectionW` are all in scope in the default shader (both languages),
    // and fog is applied after us so the rim recedes correctly with distance.
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_FRAGMENT_BEFORE_FOG: `#ifdef GRAPHICNOVEL
{
  let tcSteps = uniforms.tcParams.z;
  if (tcSteps > 0.5) {
    let tcL = dot(diffuseBase, vec3f(0.299, 0.587, 0.114));
    var tcQ = floor(min(tcL, 0.999) * tcSteps) / max(tcSteps - 1.0, 1.0);
    tcQ = max(mix(tcQ, tcL, 0.18), uniforms.tcParams.w);
    let tcBase = diffuseBase * (tcQ / max(tcL, 0.03));
    color = vec4f(
      clamp(tcBase * diffuseColor + emissiveColor + uniforms.vAmbientColor, vec3f(0.0), vec3f(1.0))
        * baseColor.rgb * baseAmbientColor + finalSpecular,
      color.a);
  }
  let tcFacing = clamp(dot(normalize(viewDirectionW), normalW), 0.0, 1.0);
  let tcFr = pow(1.0 - tcFacing, uniforms.tcParams.y);
  color = vec4f(color.rgb + uniforms.tcRimColor.rgb * (uniforms.tcParams.x * tcFr), color.a);
  // View-aligned fill: shadow-only catchlight on camera-facing surfaces
  // (faces stay readable under backlight; highlights are protected).
  if (uniforms.tcFill.w > 0.0) {
    let tcLc = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
    color = vec4f(
      color.rgb
        + uniforms.tcFill.rgb
          * (uniforms.tcFill.w * tcFacing * tcFacing * clamp(1.0 - tcLc * 1.4, 0.0, 1.0)),
      color.a);
  }
}
#endif`,
      };
    }

    return {
      CUSTOM_FRAGMENT_BEFORE_FOG: `#ifdef GRAPHICNOVEL
{
  float tcSteps = tcParams.z;
  if (tcSteps > 0.5) {
    float tcL = dot(diffuseBase, vec3(0.299, 0.587, 0.114));
    float tcQ = floor(min(tcL, 0.999) * tcSteps) / max(tcSteps - 1.0, 1.0);
    tcQ = max(mix(tcQ, tcL, 0.18), tcParams.w);
    vec3 tcBase = diffuseBase * (tcQ / max(tcL, 0.03));
    color.rgb = clamp(tcBase * diffuseColor + emissiveColor + vAmbientColor, 0.0, 1.0)
      * baseColor.rgb * baseAmbientColor + finalSpecular;
  }
  float tcFacing = clamp(dot(normalize(viewDirectionW), normalW), 0.0, 1.0);
  float tcFr = pow(1.0 - tcFacing, tcParams.y);
  color.rgb += tcRimColor * (tcParams.x * tcFr);
  // View-aligned fill: shadow-only catchlight on camera-facing surfaces
  // (faces stay readable under backlight; highlights are protected).
  if (tcFill.w > 0.0) {
    float tcLc = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb += tcFill.rgb * (tcFill.w * tcFacing * tcFacing * clamp(1.0 - tcLc * 1.4, 0.0, 1.0));
  }
}
#endif`,
    };
  }
}

// ---------------------------------------------------------------------------
// Material factories
// ---------------------------------------------------------------------------

/** Rim+ramp character material: 3-step toon ramp, bold time-of-day rim.
 *  Diffuse stays white — characters carry color in vertex colors so one merged
 *  mesh (one draw call + one outline call) renders a whole multi-color figure. */
export function createCharacterMaterial(scene: Scene, name: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = Color3.Black(); // smooth spec reads greasy on a toon ramp
  mat.emissiveColor = Color3.Black();
  new GraphicNovelPlugin(mat, {
    rimStrength: 1.0,
    rimPower: 2.4,
    rampSteps: 3,
    shadowFloor: 0.3, // shadow band stays readable — ink lives in the outline, not black fill
    fillStrength: 1.0, // characters take the per-phase view-aligned catchlight
  });
  return mat;
}

/** Surface texture reference for environment materials. Shipped street maps
 *  (public/assets/textures, see assets-pipeline/process-street-textures.mjs)
 *  are desaturated + normalized to mean luma ~0.55, so the palette hex keeps
 *  owning the color: final ≈ texture(≈0.55 grey-ish) × (palette / 0.55). */
export interface EnvTextureOpts {
  url: string;
  uScale?: number;
  vScale?: number;
}

/** Mean luminance the texture pipeline normalizes shipped maps to. */
const TEX_MEAN_LUMA = 0.55;

/** Environment variant: smooth lighting, subtle rim, strong value contrast
 *  (the environment's "ink" is value structure, not outlines — docs/01). */
export function createEnvironmentMaterial(
  scene: Scene,
  name: string,
  baseHex: string,
  opts?: {
    emissiveHex?: string;
    emissiveLevel?: number;
    rimStrength?: number;
    texture?: EnvTextureOpts;
  },
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(baseHex);
  if (opts?.texture) {
    const tex = new Texture(opts.texture.url, scene);
    tex.uScale = opts.texture.uScale ?? 1;
    tex.vScale = opts.texture.vScale ?? 1;
    mat.diffuseTexture = tex;
    // Lift the tint so texture × tint lands back on the palette value.
    mat.diffuseColor.scaleInPlace(1 / TEX_MEAN_LUMA);
  }
  mat.specularColor = Color3.Black();
  if (opts?.emissiveHex) {
    mat.emissiveColor = Color3.FromHexString(opts.emissiveHex).scale(opts.emissiveLevel ?? 1);
  }
  new GraphicNovelPlugin(mat, {
    rimStrength: opts?.rimStrength ?? 0.22,
    rimPower: 3.2,
    rampSteps: 0,
    shadowFloor: 0,
  });
  return mat;
}

/** Inverted-hull ink outline — Babylon's OutlineRenderer re-renders the mesh
 *  pushed along its normals (the classic inverted hull): +1 draw call per mesh,
 *  zero fill-rate post cost. Characters and hero props ONLY (docs/06). */
export function enableInkOutline(mesh: Mesh, width = 0.02, hex: string = PALETTE.ink): void {
  mesh.renderOutline = true;
  mesh.outlineWidth = width;
  mesh.outlineColor = Color3.FromHexString(hex);
}
