import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
  }
}

test('boots to a rendering scene within budget', async ({ page }) => {
  await page.goto('/?debug');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Wait until the render loop is publishing stats.
  await page.waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
    timeout: 30_000,
  });

  const stats = await page.evaluate(() => window.__twinDebug!);
  // Geometry budgets are CI-assertable without a GPU (docs/06). FPS is not asserted here.
  expect(stats.drawCalls).toBeLessThanOrEqual(120);
  expect(stats.tris).toBeLessThanOrEqual(300_000);

  await page.screenshot({ path: 'test-results/boot.png' });
});
