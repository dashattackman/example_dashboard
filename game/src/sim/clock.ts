// Pure-TS game clock. No Babylon imports allowed here (see docs/05).
// Canon (docs/02 §4.1, CLAUDE.md): phases MORN/DAY/EVE/LATE, hard sleep at 3a,
// day resumes 6a. One in-game day ≈ 20 real minutes (tuning.json owns the knob later).

export type Phase = 'MORN' | 'DAY' | 'EVE' | 'LATE';

export const PHASE_BOUNDS = {
  MORN: { startMin: 6 * 60, endMin: 11 * 60 }, // 6:00a – 11:00a
  DAY: { startMin: 11 * 60, endMin: 17 * 60 }, // 11:00a – 5:00p
  EVE: { startMin: 17 * 60, endMin: 22 * 60 }, // 5:00p – 10:00p
  LATE: { startMin: 22 * 60, endMin: 27 * 60 }, // 10:00p – 3:00a (wraps midnight)
} as const;

export const HARD_SLEEP_MIN = 3 * 60; // 3:00a
export const WAKE_MIN = 6 * 60; // 6:00a

/** Phase for a minute-of-day in [0, 1440). Minutes in [3a, 6a) are forced sleep;
 *  callers should never render them, but we map them to MORN for safety. */
export function phaseOf(minuteOfDay: number): Phase {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  if (m >= PHASE_BOUNDS.MORN.startMin && m < PHASE_BOUNDS.MORN.endMin) return 'MORN';
  if (m >= PHASE_BOUNDS.DAY.startMin && m < PHASE_BOUNDS.DAY.endMin) return 'DAY';
  if (m >= PHASE_BOUNDS.EVE.startMin && m < PHASE_BOUNDS.EVE.endMin) return 'EVE';
  if (m >= PHASE_BOUNDS.LATE.startMin || m < HARD_SLEEP_MIN) return 'LATE';
  return 'MORN'; // 3a–6a: forced-sleep window
}

export function isForcedSleep(minuteOfDay: number): boolean {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  return m >= HARD_SLEEP_MIN && m < WAKE_MIN;
}

/** Normalized sun position 0..1 across the waking day (6a → 3a), for the lighting rig. */
export function dayProgress(minuteOfDay: number): number {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  const wakingLen = 21 * 60; // 6a to 3a
  const sinceWake = m >= WAKE_MIN ? m - WAKE_MIN : m + 1440 - WAKE_MIN;
  return Math.min(sinceWake / wakingLen, 1);
}
