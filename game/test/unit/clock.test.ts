import { describe, expect, it } from 'vitest';
import { dayProgress, isForcedSleep, phaseOf } from '../../src/sim/clock';

describe('clock phases (canon: docs/02 §4.1)', () => {
  it('maps phase boundaries exactly', () => {
    expect(phaseOf(6 * 60)).toBe('MORN'); // 6:00a
    expect(phaseOf(11 * 60 - 1)).toBe('MORN');
    expect(phaseOf(11 * 60)).toBe('DAY');
    expect(phaseOf(17 * 60 - 1)).toBe('DAY');
    expect(phaseOf(17 * 60)).toBe('EVE'); // 5:00p
    expect(phaseOf(22 * 60 - 1)).toBe('EVE');
    expect(phaseOf(22 * 60)).toBe('LATE'); // 10:00p
    expect(phaseOf(23 * 60 + 59)).toBe('LATE');
    expect(phaseOf(0)).toBe('LATE'); // midnight wraps
    expect(phaseOf(3 * 60 - 1)).toBe('LATE'); // 2:59a — Patch Night is legal
  });

  it('forces sleep 3a–6a and nowhere else', () => {
    expect(isForcedSleep(3 * 60)).toBe(true);
    expect(isForcedSleep(4 * 60 + 30)).toBe(true);
    expect(isForcedSleep(6 * 60)).toBe(false);
    expect(isForcedSleep(2 * 60 + 59)).toBe(false);
    expect(isForcedSleep(12 * 60)).toBe(false);
  });

  it('day progress runs 0→1 from wake to hard sleep', () => {
    expect(dayProgress(6 * 60)).toBe(0);
    expect(dayProgress(3 * 60)).toBe(1);
    expect(dayProgress(16 * 60 + 30)).toBeCloseTo(0.5, 2);
  });

  it('handles negative and >1440 inputs', () => {
    expect(phaseOf(-60)).toBe(phaseOf(1380));
    expect(phaseOf(1440 + 400)).toBe(phaseOf(400));
  });
});
