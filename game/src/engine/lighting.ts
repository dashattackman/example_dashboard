import { Scene } from '@babylonjs/core/scene';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

/** Golden-hour "Clear summer EVE" default look (docs/01 art direction, docs/03 §5). */
export function createLightingRig(scene: Scene): { setEveningLook: () => void } {
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.diffuse = new Color3(0.75, 0.78, 0.95);
  hemi.groundColor = new Color3(0.35, 0.25, 0.2);

  const sun = new DirectionalLight('sun', new Vector3(-0.55, -0.35, 0.75), scene);
  sun.intensity = 1.35;
  sun.diffuse = new Color3(1.0, 0.72, 0.45); // low golden sun

  // Gradient skydome: inverted sphere with a procedural vertical-gradient texture.
  const sky = MeshBuilder.CreateSphere('sky', { diameter: 900, sideOrientation: 1 }, scene);
  sky.isPickable = false;
  sky.infiniteDistance = true;
  const mat = new StandardMaterial('skyMat', scene);
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  const tex = new DynamicTexture('skyTex', { width: 8, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  // Teal-dusk sky over sodium-warm horizon — the Uptown signature palette.
  grad.addColorStop(0.0, '#0e1e3a');
  grad.addColorStop(0.45, '#2a5d7c');
  grad.addColorStop(0.72, '#d98e4a');
  grad.addColorStop(0.85, '#f2b96b');
  grad.addColorStop(1.0, '#3a2b28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  tex.update(false);
  mat.emissiveTexture = tex;
  sky.material = mat;

  scene.clearColor = new Color4(0.08, 0.13, 0.24, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 120;
  scene.fogEnd = 420;
  scene.fogColor = new Color3(0.85, 0.62, 0.42);

  return { setEveningLook: () => void 0 };
}
