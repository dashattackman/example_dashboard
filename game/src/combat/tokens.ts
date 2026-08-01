// Attack-token crowd system — docs/02 §1.5: "attacks in max groups of 2 at once
// (attack-token system: only 2 melee tokens live regardless of crowd size)".
// Pure TS. The pool is the ONLY authority on who may swing; enemy AI must hold
// a token before entering its telegraph, and returns it when the attack ends,
// is interrupted, or the holder dies. Invariant: holders.size <= capacity, always.

import { combatTuning as T } from './tuning';

export interface TokenPool {
  capacity: number;
  /** holderId -> priority (higher = harder to steal from). */
  holders: Map<string, number>;
}

export type TokenGrant =
  | { granted: true; stolenFrom: string | null }
  | { granted: false };

export function createTokenPool(capacity: number = T.tokens.maxSimultaneousAttackers): TokenPool {
  return { capacity, holders: new Map() };
}

export function holdsToken(pool: TokenPool, id: string): boolean {
  return pool.holders.has(id);
}

export function liveTokens(pool: TokenPool): number {
  return pool.holders.size;
}

/**
 * Request a melee token.
 * - Already holding → granted (idempotent).
 * - Free slot → granted.
 * - Pool full → steal ONLY from a holder with strictly lower priority
 *   (lowest-priority holder loses; leaders/bruisers can displace grunts,
 *   never the reverse). Otherwise denied.
 */
export function requestToken(pool: TokenPool, id: string, priority: number): TokenGrant {
  if (pool.holders.has(id)) return { granted: true, stolenFrom: null };
  if (pool.holders.size < pool.capacity) {
    pool.holders.set(id, priority);
    return { granted: true, stolenFrom: null };
  }
  // full: find the weakest holder
  let weakestId: string | null = null;
  let weakestPri = Infinity;
  for (const [hid, pri] of pool.holders) {
    if (pri < weakestPri) {
      weakestPri = pri;
      weakestId = hid;
    }
  }
  if (weakestId !== null && weakestPri < priority) {
    pool.holders.delete(weakestId);
    pool.holders.set(id, priority);
    return { granted: true, stolenFrom: weakestId };
  }
  return { granted: false };
}

/** Return a token (attack finished, interrupted, or holder died). Safe if not held. */
export function releaseToken(pool: TokenPool, id: string): void {
  pool.holders.delete(id);
}

/** Drop every token whose holder is no longer alive/eligible. */
export function reapTokens(pool: TokenPool, isEligible: (id: string) => boolean): string[] {
  const reaped: string[] = [];
  for (const hid of [...pool.holders.keys()]) {
    if (!isEligible(hid)) {
      pool.holders.delete(hid);
      reaped.push(hid);
    }
  }
  return reaped;
}
