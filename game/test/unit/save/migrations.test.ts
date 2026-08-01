// Migration chain: v0 fixture → current, refuse-future-version, harness checks.

import { describe, expect, it } from 'vitest';
import { SaveGameSchema } from '../../../src/content/schemas';
import {
  CURRENT_SAVE_VERSION,
  MIGRATIONS,
  migrateToCurrent,
  SaveFutureVersionError,
  SaveMigrationError,
} from '../../../src/save/migrations';
import { makeSave, makeV0Fixture } from './fixtures';

describe('migration harness', () => {
  it('chain is contiguous single steps covering v0 → current', () => {
    // Every historical version must have exactly one outgoing step, and each
    // step must move exactly one version forward — this is what lets
    // migrateToCurrent walk any old save without gaps.
    const froms = MIGRATIONS.map((m) => m.from);
    expect(new Set(froms).size).toBe(froms.length);
    for (const m of MIGRATIONS) expect(m.to).toBe(m.from + 1);
    for (let v = 0; v < CURRENT_SAVE_VERSION; v++) {
      expect(froms).toContain(v);
    }
  });
});

describe('v0 → v1 (renamed fields)', () => {
  it('migrates player.money → player.cash and clock.minute → clock.minuteOfDay', () => {
    const v0 = makeV0Fixture();
    const migrated = migrateToCurrent(v0);
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.player.cash).toBe(850);
    expect(migrated.clock.minuteOfDay).toBe(21 * 60);
    expect((migrated.player as Record<string, unknown>)['money']).toBeUndefined();
    // The migrated result satisfies the CURRENT schema, not just "looks right".
    expect(SaveGameSchema.safeParse(migrated).success).toBe(true);
  });

  it('never mutates its input', () => {
    const v0 = makeV0Fixture();
    const before = JSON.stringify(v0);
    migrateToCurrent(v0);
    expect(JSON.stringify(v0)).toBe(before);
  });

  it('treats a missing version field as v0', () => {
    const v0 = makeV0Fixture();
    delete v0['version'];
    expect(migrateToCurrent(v0).version).toBe(CURRENT_SAVE_VERSION);
  });
});

describe('current-version saves', () => {
  it('passes a valid current save straight through validation', () => {
    const save = makeSave();
    expect(migrateToCurrent(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('rejects a current-version save that fails the schema', () => {
    const bad = JSON.parse(JSON.stringify(makeSave())) as Record<string, unknown>;
    delete bad['zone'];
    expect(() => migrateToCurrent(bad)).toThrowError(SaveMigrationError);
  });
});

describe('future versions — refuse, never destroy', () => {
  it('throws SaveFutureVersionError with a clear message', () => {
    const future = { ...JSON.parse(JSON.stringify(makeSave())), version: 99 };
    let caught: unknown;
    try {
      migrateToCurrent(future);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SaveFutureVersionError);
    const err = caught as SaveFutureVersionError;
    expect(err.foundVersion).toBe(99);
    expect(err.message).toMatch(/newer version/i);
    expect(err.message).toMatch(/NOT been modified/);
  });

  it('rejects garbage version fields as migration errors, not crashes', () => {
    expect(() => migrateToCurrent(null)).toThrowError(SaveMigrationError);
    expect(() => migrateToCurrent('nope')).toThrowError(SaveMigrationError);
    expect(() => migrateToCurrent({ version: -3 })).toThrowError(SaveMigrationError);
    expect(() => migrateToCurrent({ version: 1.5 })).toThrowError(SaveMigrationError);
  });
});
