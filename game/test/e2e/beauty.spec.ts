// M1 beauty-corner reference shots (docs/07 M1 check): EVE is the golden-hour money
// shot; LATE proves the deep-blue + neon night look. Geometry budgets are asserted
// on every shot — beauty never gets to breach docs/06.

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
  }
}

for (const phase of ['EVE', 'LATE'] as const) {
  test(`beauty corner at ${phase}: budgets green, screenshot captured`, async ({ page }) => {
    await page.goto(`/?debug&phase=${phase}`);
    await expect(page.locator('#game-canvas')).toBeVisible();

    await page.waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
      timeout: 30_000,
    });
    // Let shaders warm and the camera rig settle before framing the shot.
    await page.waitForTimeout(1200);

    const stats = await page.evaluate(() => window.__twinDebug!);
    expect(stats.drawCalls).toBeLessThanOrEqual(120);
    expect(stats.tris).toBeLessThanOrEqual(300_000);

    await page.screenshot({ path: `test-results/beauty-${phase.toLowerCase()}.png` });
  });
}
