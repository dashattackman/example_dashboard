// WebGPU transport validation (docs/06: "validate both paths in e2e from M1 on").
// This is the gap that let a production blue-screen through: WebGL2 CI never
// exercises WebGPU-only code paths (e.g. the WebGPUEngine extension side-effect
// imports in renderer.ts). Runs only under the `webgpu` Playwright project, which
// launches Chromium with WebGPU enabled on swiftshader Vulkan.
//
// Skip semantics (honest about what this container can prove):
// 1. No adapter/device at all → skip (env has no WebGPU).
// 2. Adapter+device OK but the tab crashes / falls back under Babylon's workload →
//    skip with reason, because in this container swiftshader's Vulkan device is lost
//    on the first real render pipeline (verified: raw WebGPU triangle renders fine,
//    a bare Babylon StandardMaterial kills the device; Babylon's device-restore path
//    then throws "shaderProcessingContext undefined"). That is an environment
//    limitation, not a game bug — but it CAN mask real regressions, so a runner with
//    a real GPU should set CI_WEBGPU_STRICT=1 to turn these skips into failures.

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
  }
}

test('boots on the WebGPU transport within budget', async ({ page }) => {
  test.skip(test.info().project.name !== 'webgpu', 'runs under the webgpu project only');
  const strict = !!process.env['CI_WEBGPU_STRICT'];

  let crashed = false;
  page.on('crash', () => {
    crashed = true;
  });

  // Env gate: raw WebGPU adapter + device (no Babylon involved).
  await page.goto('/?debug'); // plain load first — probe needs a secure-context page
  const raw = await page.evaluate(async () => {
    const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return 'no-navigator.gpu';
    try {
      const adapter = (await gpu.requestAdapter()) as {
        requestDevice(): Promise<unknown>;
      } | null;
      if (!adapter) return 'no-adapter';
      return (await adapter.requestDevice()) ? 'ok' : 'no-device';
    } catch {
      return 'no-device';
    }
  });
  test.skip(raw !== 'ok', `headless WebGPU unavailable here (${raw})`);

  // Real boot on the WebGPU transport.
  await page.goto('/?debug&webgpu');
  const booted = await page
    .waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
      timeout: 45_000,
    })
    .then(() => true)
    .catch(() => false);

  if ((crashed || !booted) && !strict) {
    test.skip(
      true,
      'WebGPU device lost under the Babylon workload in this headless env (swiftshader/Dawn ' +
        'limitation — raw WebGPU passes, first material pipeline dies). Validate on a ' +
        'real-GPU runner (CI_WEBGPU_STRICT=1) or a device.',
    );
  }
  expect(crashed, 'page crashed while booting on WebGPU').toBe(false);
  expect(booted, 'game never published debug stats on WebGPU').toBe(true);

  // The swiftshader tab can die between boot and this read — same env-skip rules.
  let stats: { fps: number; drawCalls: number; tris: number; transport: string } | null = null;
  try {
    stats = await page.evaluate(() => window.__twinDebug!);
  } catch {
    stats = null;
  }
  if (!stats && !strict) {
    test.skip(true, 'tab crashed after a healthy boot (swiftshader WebGPU env flake)');
  }
  expect(stats, 'could not read debug stats back').not.toBeNull();
  stats = stats!;
  if (stats.transport !== 'webgpu' && !strict) {
    test.skip(
      true,
      `engine fell back to ${stats.transport} despite a working adapter — treated as env ` +
        'limitation in headless CI; a real-GPU runner must fail this (CI_WEBGPU_STRICT=1).',
    );
  }
  expect(stats.transport).toBe('webgpu');
  expect(stats.drawCalls).toBeGreaterThan(0);
  expect(stats.drawCalls).toBeLessThanOrEqual(120);
  expect(stats.tris).toBeLessThanOrEqual(300_000);

  // Validation is complete; the screenshot is a bonus artifact. Swiftshader's
  // WebGPU readback can crash the tab AFTER a healthy boot — don't fail on it.
  try {
    await page.screenshot({ path: 'test-results/webgpu-boot.png' });
  } catch {
    test.info().annotations.push({
      type: 'note',
      description: 'post-validation screenshot readback crashed the swiftshader WebGPU tab',
    });
  }
});
