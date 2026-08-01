// Alive Corner — ambient cast spec: the corner is inhabited (walkers actually
// walk, the cast spawns per phase) and stays inside every docs/06 hard budget:
// ≤14 animated skeletons, ≤120 draw calls, ≤300k tris. Geometry-only asserts —
// runs on CI software WebGL like the rest of the suite.

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
    __ambientTest?: {
      ready: boolean;
      count: number;
      roles: string[];
      positions(): Array<[number, number, number]>;
      skeletons(): number;
    };
  }
}

test('ambient cast at EVE: inhabited, moving, budgets green', async ({ page }) => {
  await page.goto('/?debug&phase=EVE');
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.waitForFunction(() => window.__ambientTest?.ready === true, undefined, {
    timeout: 45_000,
  });
  await page.waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
    timeout: 30_000,
  });

  // The cast spawned: walkers + bench sitter + storefront browser (+ jogger at
  // EVE), within the 5-8 ambient bodies the wave calls for.
  const roles = await page.evaluate(() => window.__ambientTest!.roles);
  expect(roles.length).toBeGreaterThanOrEqual(5);
  expect(roles.length).toBeLessThanOrEqual(8);
  expect(roles.filter((r) => r === 'walker').length).toBeGreaterThanOrEqual(4);
  expect(roles).toContain('sitter');
  expect(roles).toContain('browser');
  expect(roles).toContain('jogger'); // EVE is a jogger phase

  // Walkers WALK: every walker's position changes over 3 seconds.
  const before = await page.evaluate(() => window.__ambientTest!.positions());
  await page.waitForTimeout(3_000);
  const after = await page.evaluate(() => window.__ambientTest!.positions());
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] !== 'walker' && roles[i] !== 'jogger') continue;
    const [bx, , bz] = before[i]!;
    const [ax, , az] = after[i]!;
    const moved = Math.hypot(ax - bx, az - bz);
    expect(moved, `${roles[i]} #${i} should move (moved ${moved.toFixed(3)}m)`).toBeGreaterThan(0.5);
  }

  // Hard budgets (docs/06): skeletons incl. Eli, draws, tris.
  const skeletons = await page.evaluate(() => window.__ambientTest!.skeletons());
  expect(skeletons).toBeLessThanOrEqual(14);

  await page.waitForTimeout(500); // let stats settle post-movement sampling
  const stats = await page.evaluate(() => window.__twinDebug!);
  expect(stats.drawCalls).toBeLessThanOrEqual(120);
  expect(stats.tris).toBeLessThanOrEqual(300_000);

  await page.screenshot({ path: 'test-results/ambient-eve.png' });
});
