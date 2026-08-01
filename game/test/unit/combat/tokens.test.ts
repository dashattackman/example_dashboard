import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../src/combat/rng';
import {
  createTokenPool,
  holdsToken,
  liveTokens,
  reapTokens,
  releaseToken,
  requestToken,
} from '../../../src/combat/tokens';

describe('attack tokens — max 2 simultaneous attackers (docs/02 §1.5)', () => {
  it('grants at most 2 tokens regardless of crowd size', () => {
    const pool = createTokenPool();
    expect(requestToken(pool, 'g1', 1).granted).toBe(true);
    expect(requestToken(pool, 'g2', 1).granted).toBe(true);
    expect(requestToken(pool, 'g3', 1).granted).toBe(false);
    expect(requestToken(pool, 'g4', 1).granted).toBe(false);
    expect(liveTokens(pool)).toBe(2);
  });

  it('is idempotent for a holder re-requesting', () => {
    const pool = createTokenPool();
    requestToken(pool, 'g1', 1);
    const again = requestToken(pool, 'g1', 1);
    expect(again.granted).toBe(true);
    expect(liveTokens(pool)).toBe(1);
  });

  it('higher priority steals from the lowest-priority holder — never equal priority', () => {
    const pool = createTokenPool();
    requestToken(pool, 'g1', 1);
    requestToken(pool, 'g2', 1);
    const bruiser = requestToken(pool, 'bruiser', 3);
    expect(bruiser.granted).toBe(true);
    expect(bruiser.granted && bruiser.stolenFrom).toBe('g1');
    expect(holdsToken(pool, 'g1')).toBe(false);
    // equal priority cannot steal back
    expect(requestToken(pool, 'g3', 1).granted).toBe(false);
    // and a grunt can never displace the bruiser
    releaseToken(pool, 'g2');
    requestToken(pool, 'g3', 1);
    expect(requestToken(pool, 'g4', 1).granted).toBe(false);
    expect(liveTokens(pool)).toBe(2);
  });

  it('released and reaped tokens free slots', () => {
    const pool = createTokenPool();
    requestToken(pool, 'a', 1);
    requestToken(pool, 'b', 1);
    releaseToken(pool, 'a');
    expect(requestToken(pool, 'c', 1).granted).toBe(true);
    const reaped = reapTokens(pool, (id) => id !== 'b'); // b died
    expect(reaped).toEqual(['b']);
    expect(liveTokens(pool)).toBe(1);
  });

  it('INVARIANT: never more than 2 holders across 2000 random ops', () => {
    const pool = createTokenPool();
    const rng = makeRng(1337);
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let i = 0; i < 2000; i++) {
      const id = rng.pick(ids);
      const op = rng.next();
      if (op < 0.5) requestToken(pool, id, rng.int(1, 4));
      else if (op < 0.8) releaseToken(pool, id);
      else reapTokens(pool, (h) => h !== id);
      expect(liveTokens(pool)).toBeLessThanOrEqual(2);
    }
  });
});
