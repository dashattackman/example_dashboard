// M1 beauty-corner reference shots (docs/07 M1 check): EVE is the golden-hour money
// shot; LATE proves the deep-blue + neon night look; MORN guards the phase-honest
// dressing (skyline windows/signs must NOT glow at breakfast — playtest p2); DAY
// guards the high-summer grade (readable clouds, daytime skyline facades — the
// corner-polish round killed the flat-cyan orphan look).
// Geometry budgets are asserted on every shot — beauty never gets to breach docs/06.

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
  }
}

async function settleAndAssert(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
    timeout: 30_000,
  });
  // Let shaders warm, street textures stream in, and the camera rig settle.
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => window.__twinDebug!);
  expect(stats.drawCalls).toBeLessThanOrEqual(120);
  expect(stats.tris).toBeLessThanOrEqual(300_000);
}

for (const phase of ['MORN', 'DAY', 'EVE', 'LATE'] as const) {
  test(`beauty corner at ${phase}: budgets green, screenshot captured`, async ({ page }) => {
    await page.goto(`/?debug&phase=${phase}`);
    await settleAndAssert(page);
    await page.screenshot({ path: `test-results/beauty-${phase.toLowerCase()}.png` });
  });
}

// Third signature framing (docs/01: lake = cold cyan water, pale gold light):
// parked debug cam on the cross street looking west at the lake glimpse.
test('lake glimpse framing at EVE: budgets green, screenshot captured', async ({ page }) => {
  await page.goto('/?debug&phase=EVE&cam=-10,3.4,15,-120,1.5,15');
  await settleAndAssert(page);
  await page.screenshot({ path: 'test-results/beauty-lake.png' });
});

// Alive-Corner close-ups — the "existed yesterday" reads live or die at phone
// scale from these two framings (storefront glass + sidewalk-level down-avenue).
test('storefront close-up at EVE: budgets green, screenshot captured', async ({ page }) => {
  await page.goto('/?debug&phase=EVE&cam=1.2,1.6,0.8,5,1.8,5.6');
  await settleAndAssert(page);
  await page.screenshot({ path: 'test-results/beauty-close-storefront.png' });
});

test('sidewalk-level down-avenue at LATE: budgets green, screenshot captured', async ({ page }) => {
  await page.goto('/?debug&phase=LATE&cam=2.6,1.6,-12,0,3.5,60');
  await settleAndAssert(page);
  await page.screenshot({ path: 'test-results/beauty-close-sidewalk.png' });
});
