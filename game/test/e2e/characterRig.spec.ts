import { expect, test } from '@playwright/test';

// Drives the standalone rig harness (rig.html + src/engine/rigHarness.ts) —
// the main boot path is untouched. Asserts the rigged CC0 base body loads
// through the shader pipeline, the mixer actually advances, and a cross-fade
// to a second clip takes. Geometry-only: runs on software WebGL like the rest.

interface RigTestApi {
  ready: boolean;
  error?: string;
  clips: string[];
  play(name: string): void;
  current(): string | null;
  time(): number;
}

declare global {
  interface Window {
    __rig?: RigTestApi;
  }
}

test('character rig loads, animates, and cross-fades clips', async ({ page }) => {
  await page.goto('/rig.html');

  await page.waitForFunction(
    () => window.__rig !== undefined && (window.__rig.ready || window.__rig.error !== undefined),
    undefined,
    { timeout: 45_000 },
  );
  const error = await page.evaluate(() => window.__rig!.error);
  expect(error, `rig harness reported: ${error}`).toBeUndefined();

  // The brawler clip set survived the asset pipeline.
  const clips = await page.evaluate(() => window.__rig!.clips);
  expect(clips).toEqual(
    expect.arrayContaining(['Idle', 'Walk', 'Run', 'Punch_Left', 'Kick_Left', 'HitRecieve']),
  );

  // Mixer time advances while Idle plays.
  expect(await page.evaluate(() => window.__rig!.current())).toBe('Idle');
  const t1 = await page.evaluate(() => window.__rig!.time());
  await page.waitForTimeout(800);
  const t2 = await page.evaluate(() => window.__rig!.time());
  expect(t2).toBeGreaterThan(t1);

  // Cross-fade to Run sticks and keeps advancing.
  await page.evaluate(() => window.__rig!.play('Run'));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__rig!.current())).toBe('Run');
  const t3 = await page.evaluate(() => window.__rig!.time());
  await page.waitForTimeout(500);
  const t4 = await page.evaluate(() => window.__rig!.time());
  expect(t4).toBeGreaterThan(t3);

  await page.screenshot({ path: 'test-results/characterRig.png' });
});
