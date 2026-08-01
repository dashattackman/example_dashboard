// The ONLY layer that may import @babylonjs/* (docs/05 module rule).
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
// WebGPUEngine ships its optional features as side-effect extension modules; without
// these, the first DynamicTexture update / alpha-blended material THROWS at runtime on
// the WebGPU path only — WebGL2 CI never sees it (the production blue-screen).
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

export interface RendererHandle {
  engine: AbstractEngine;
  scene: Scene;
  transport: 'webgpu' | 'webgl2';
}

/** WebGPU auto where available (docs/06 flip-back criterion met: clean pass on
 *  Paul's device 2026-08-01, plus a real WebGPU transport pass in CI). WebGL2 is
 *  the universal fallback and can be forced via `?webgl2`. */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererHandle> {
  let engine: AbstractEngine | null = null;
  let transport: 'webgpu' | 'webgl2' = 'webgl2';

  const forceWebGl2 = new URLSearchParams(location.search).has('webgl2');
  if (!forceWebGl2 && navigator.gpu) {
    try {
      const gpu = new WebGPUEngine(canvas, { antialias: true });
      await gpu.initAsync();
      engine = gpu;
      transport = 'webgpu';
    } catch {
      engine = null; // software/CI environments advertise navigator.gpu but fail init
    }
  }
  if (!engine) {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: false }, false);
  }

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.08, 0.13, 0.24, 1);

  const onResize = () => engine!.resize();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    // Battery respect (docs/06): stop the loop when backgrounded.
    if (document.hidden) engine!.stopRenderLoop();
    else engine!.runRenderLoop(() => scene.render());
  });

  engine.runRenderLoop(() => scene.render());
  return { engine, scene, transport };
}
