// Audio smoke (headless, software GL, NO audio hardware): the soundscape must
// boot inert — zero errors, zero AudioContext — until a user gesture, and a
// gesture must not blow anything up either. Budgets stay green with audio wired.

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __twinDebug?: { fps: number; drawCalls: number; tris: number; transport: string };
    __twinAudio?: {
      readonly unlocked: boolean;
      readonly muted: boolean;
      readonly volume: number;
      readonly phase: string;
      toggleMute(): boolean;
      uiTick(kind?: 'a' | 'b'): void;
    };
  }
}

test('audio is inert before any gesture and survives one without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/?debug&phase=EVE');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__twinDebug?.drawCalls ?? 0) > 0, undefined, {
    timeout: 30_000,
  });

  // Pre-gesture: API present, locked, silent — and no fatal banner.
  const before = await page.evaluate(() => ({
    has: !!window.__twinAudio,
    unlocked: window.__twinAudio?.unlocked,
    phase: window.__twinAudio?.phase,
  }));
  expect(before.has).toBe(true);
  expect(before.unlocked).toBe(false);
  expect(before.phase).toBe('EVE');
  await expect(page.locator('#fatal-banner')).toHaveCount(0);

  // First gesture (left half = joystick territory; any pointerdown unlocks).
  await page.mouse.click(200, 200);
  await page.waitForTimeout(1200);

  // Unlock must not error even where the context can't run (no audio device).
  // We don't assert unlocked===true — headless environments vary — only that
  // nothing broke and the debug handle still answers.
  const after = await page.evaluate(() => {
    const muted1 = window.__twinAudio!.toggleMute();
    const muted2 = window.__twinAudio!.toggleMute();
    window.__twinAudio!.uiTick('a'); // must be a safe no-op or a real tick
    return { muted1, muted2, unlocked: window.__twinAudio!.unlocked };
  });
  expect(after.muted1).toBe(true);
  expect(after.muted2).toBe(false);
  await expect(page.locator('#fatal-banner')).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  // Budgets stay green with the soundscape ticking (docs/06).
  const stats = await page.evaluate(() => window.__twinDebug!);
  expect(stats.drawCalls).toBeLessThanOrEqual(120);
  expect(stats.tris).toBeLessThanOrEqual(300_000);
});
