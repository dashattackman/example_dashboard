import { Scene } from '@babylonjs/core/scene';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

export interface DebugStats {
  fps: number;
  drawCalls: number;
  tris: number;
  transport: string;
}

declare global {
  interface Window {
    __twinDebug?: DebugStats;
  }
}

/** `?debug` perf overlay (docs/06 — keep it honest). Also always publishes
 *  window.__twinDebug so Playwright can assert budgets headlessly. */
export function attachDebug(
  engine: AbstractEngine,
  scene: Scene,
  transport: string,
): void {
  const inst = new SceneInstrumentation(scene);
  inst.captureRenderTargetsRenderTime = false;

  const visible = new URLSearchParams(location.search).has('debug');
  let el: HTMLDivElement | null = null;
  if (visible) {
    el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:99;padding:6px 10px;' +
      'background:rgba(10,14,26,.8);color:#9fd8ff;font:12px/1.5 monospace;' +
      'border-radius:6px;pointer-events:none;white-space:pre';
    document.getElementById('ui-root')?.appendChild(el);
  }

  let acc = 0;
  scene.onAfterRenderObservable.add(() => {
    const stats: DebugStats = {
      fps: Math.round(engine.getFps()),
      drawCalls: inst.drawCallsCounter.current,
      tris: Math.round(scene.getActiveIndices() / 3),
      transport,
    };
    window.__twinDebug = stats;
    acc += scene.deltaTime ?? 16;
    if (el && acc > 250) {
      acc = 0;
      el.textContent =
        `fps ${stats.fps}  ${stats.transport}\n` +
        `draw ${stats.drawCalls}/120\n` +
        `tris ${(stats.tris / 1000).toFixed(1)}k/300k`;
    }
  });
}
