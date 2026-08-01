import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import '@babylonjs/core/Materials/Textures/Loaders'; // side-effect loaders

import { createRenderer } from './engine/renderer';
import { createLightingRig } from './engine/lighting';
import { CameraRig } from './engine/cameraRig';
import { attachDebug } from './engine/debug';
import { createTouchControls } from './ui/joystick';

const MOVE_SPEED = 6; // m/s — placeholder walk tuning until 02's table lands in tuning.json

async function boot(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  const { engine, scene, transport } = await createRenderer(canvas);

  createLightingRig(scene);

  // Ground: 240m plaza with a subtle grid — stand-in until M2's cityGen streets.
  const ground = MeshBuilder.CreateGround('ground', { width: 240, height: 240 }, scene);
  const groundMat = new StandardMaterial('groundMat', scene);
  const gtex = new DynamicTexture('gridTex', { width: 256, height: 256 }, scene, false);
  const g = gtex.getContext();
  g.fillStyle = '#3d3a45';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4a4757';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  gtex.update(false);
  gtex.uScale = 60;
  gtex.vScale = 60;
  groundMat.diffuseTexture = gtex;
  groundMat.specularColor = new Color3(0.05, 0.05, 0.06);
  ground.material = groundMat;
  ground.freezeWorldMatrix();

  // Placeholder skyline silhouette to frame (docs/01: frame the skyline often).
  const skyline = MeshBuilder.CreateBox('skyline', { width: 180, height: 40, depth: 4 }, scene);
  skyline.position.set(0, 20, 200);
  const skyMat = new StandardMaterial('skylineMat', scene);
  skyMat.diffuseColor = new Color3(0.12, 0.1, 0.22);
  skyMat.emissiveColor = new Color3(0.1, 0.08, 0.2);
  skyline.material = skyMat;
  skyline.freezeWorldMatrix();

  // Player: capsule stand-in for Eli.
  const player = new TransformNode('player', scene);
  const body = MeshBuilder.CreateCapsule('playerBody', { height: 1.8, radius: 0.35 }, scene);
  body.parent = player;
  body.position.y = 0.9;
  const bodyMat = new StandardMaterial('playerMat', scene);
  bodyMat.diffuseColor = new Color3(0.85, 0.3, 0.2);
  bodyMat.emissiveColor = new Color3(0.12, 0.03, 0.02);
  body.material = bodyMat;

  const rig = new CameraRig(scene, player);
  const input = createTouchControls(uiRoot);
  attachDebug(engine, scene, transport);

  let heading = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min((scene.deltaTime ?? 16) / 1000, 0.1);
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0.12) {
      const move = new Vector3(input.x, 0, input.y).normalize().scaleInPlace(
        MOVE_SPEED * Math.min(mag, 1) * dt,
      );
      player.position.addInPlace(move);
      // Clamp to the M0 plaza.
      player.position.x = Scalar.Clamp(player.position.x, -115, 115);
      player.position.z = Scalar.Clamp(player.position.z, -115, 115);
      const targetHeading = Math.atan2(move.x, move.z);
      let d = targetHeading - heading;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      heading += d * Math.min(12 * dt, 1);
      player.rotation.y = heading;
    }
    rig.update(dt);
  });
}

void boot();
