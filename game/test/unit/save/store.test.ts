// IndexedDB store: atomic write + backup, corruption fallback, quota surfacing,
// import/export, refuse-future-version. Runs on fake-indexeddb — no browser.

import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSave, SaveCorruptError, SaveImportError, SaveQuotaError } from '../../../src/save/store';
import { SaveFutureVersionError } from '../../../src/save/migrations';
import { makeSave, makeV0Fixture } from './fixtures';

let dbCounter = 0;
function freshDbName(): string {
  return `test-save-${Date.now()}-${dbCounter++}`;
}

/** Raw access to a store's records, for corrupting/inspecting them in tests. */
async function rawPut(dbName: string, key: string, value: unknown): Promise<void> {
  const db = await openDB(dbName, 1);
  await db.put('saves', value, key);
  db.close();
}
async function rawGet(dbName: string, key: string): Promise<unknown> {
  const db = await openDB(dbName, 1);
  const value = await db.get('saves', key);
  db.close();
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openSave / readSave / writeSave', () => {
  it('returns null on a fresh install (no save, no backup)', async () => {
    const store = await openSave(freshDbName());
    expect(await store.readSave()).toBeNull();
    store.close();
  });

  it('round-trips a save with full fidelity', async () => {
    const store = await openSave(freshDbName());
    const save = makeSave();
    await store.writeSave(save);
    expect(await store.readSave()).toEqual(save);
    store.close();
  });

  it('keeps the previous save as backup after a second write', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    const first = makeSave();
    await store.writeSave(first);
    const second = makeSave();
    second.player.cash = 9999;
    second.clock.day = 13;
    await store.writeSave(second);

    expect(await store.readSave()).toEqual(second);
    const backup = (await rawGet(dbName, 'backup')) as { json: string };
    expect(JSON.parse(backup.json)).toEqual(first);
    store.close();
  });

  it('refuses to write an invalid save and leaves the good one on disk', async () => {
    const store = await openSave(freshDbName());
    const good = makeSave();
    await store.writeSave(good);
    const bad = makeSave();
    // Break the schema: zone must have exactly 6 segments.
    bad.zone.segments = bad.zone.segments.slice(0, 2);
    await expect(store.writeSave(bad)).rejects.toBeInstanceOf(SaveCorruptError);
    expect(await store.readSave()).toEqual(good);
    store.close();
  });

  it('migrates an old on-disk save at load (v0 record → current)', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    await rawPut(dbName, 'main', {
      json: JSON.stringify(makeV0Fixture()),
      version: 0,
      savedAt: 0,
    });
    const loaded = await store.readSave();
    expect(loaded?.version).toBe(1);
    expect(loaded?.player.cash).toBe(850);
    store.close();
  });
});

describe('corruption fallback — never lose a phone save', () => {
  it('falls back to backup when main is garbage, and repairs main', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    const first = makeSave();
    await store.writeSave(first);
    const second = makeSave();
    second.player.cash = 4242;
    await store.writeSave(second); // backup now = first

    await rawPut(dbName, 'main', { json: '{"torn write', version: 1, savedAt: 0 });

    const recovered = await store.readSave();
    expect(recovered).toEqual(first); // backup wins over nothing

    // main was repaired from the backup — next read no longer needs fallback.
    const repaired = (await rawGet(dbName, 'main')) as { json: string };
    expect(JSON.parse(repaired.json)).toEqual(first);
    store.close();
  });

  it('falls back when main is a malformed record (not even a record shape)', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    const save = makeSave();
    await store.writeSave(save);
    await store.writeSave(save); // populate backup
    await rawPut(dbName, 'main', 'not-a-record');
    expect(await store.readSave()).toEqual(save);
    store.close();
  });

  it('throws SaveCorruptError (not silence) when main AND backup are garbage', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    await rawPut(dbName, 'main', { json: '###', version: 1, savedAt: 0 });
    await rawPut(dbName, 'backup', { json: '%%%', version: 1, savedAt: 0 });
    await expect(store.readSave()).rejects.toBeInstanceOf(SaveCorruptError);
    // Never destroy: the unreadable records are still there for forensic export.
    expect(await rawGet(dbName, 'main')).toBeDefined();
    expect(await rawGet(dbName, 'backup')).toBeDefined();
    store.close();
  });
});

describe('future-version saves — refuse to load, never touch', () => {
  it('readSave surfaces SaveFutureVersionError and does not fall back or modify', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    const older = makeSave();
    await store.writeSave(older);
    await store.writeSave(older); // backup = older (valid v1)

    const futureRecord = {
      json: JSON.stringify({ ...makeSave(), version: 7 }),
      version: 7,
      savedAt: 0,
    };
    await rawPut(dbName, 'main', futureRecord);

    // Refused loudly — NOT silently replaced by the older backup.
    await expect(store.readSave()).rejects.toBeInstanceOf(SaveFutureVersionError);
    // Bytes untouched.
    expect(await rawGet(dbName, 'main')).toEqual(futureRecord);
    store.close();
  });

  it('importSave refuses a future-version blob', async () => {
    const store = await openSave(freshDbName());
    const blob = JSON.stringify({ ...makeSave(), version: 12 });
    await expect(store.importSave(blob)).rejects.toBeInstanceOf(SaveFutureVersionError);
    expect(await store.readSave()).toBeNull(); // nothing was written
    store.close();
  });
});

describe('quota exceeded — surface, do not crash, do not damage', () => {
  it('writeSave throws SaveQuotaError and the previous save survives', async () => {
    const dbName = freshDbName();
    const store = await openSave(dbName);
    const good = makeSave();
    await store.writeSave(good);

    const proto = (globalThis.IDBObjectStore as { prototype: IDBObjectStore }).prototype;
    const spy = vi.spyOn(proto, 'put').mockImplementation(() => {
      throw new DOMException('device full', 'QuotaExceededError');
    });
    await expect(store.writeSave(makeSave())).rejects.toBeInstanceOf(SaveQuotaError);
    spy.mockRestore();

    expect(await store.readSave()).toEqual(good);
    store.close();
  });

  it('SaveQuotaError carries a player-facing message', () => {
    const err = new SaveQuotaError();
    expect(err.message).toMatch(/out of storage/i);
    expect(err.message).toMatch(/previous save is untouched/i);
  });
});

describe('export / import — cross-device transfer', () => {
  it('round-trips through a JSON string into a different device (db)', async () => {
    const storeA = await openSave(freshDbName());
    const save = makeSave();
    await storeA.writeSave(save);
    const blob = await storeA.exportSave();
    storeA.close();

    const storeB = await openSave(freshDbName());
    const imported = await storeB.importSave(blob);
    expect(imported).toEqual(save);
    expect(await storeB.readSave()).toEqual(save);
    storeB.close();
  });

  it('importSave migrates old-version blobs (v0 export → v1 on this device)', async () => {
    const store = await openSave(freshDbName());
    const imported = await store.importSave(JSON.stringify(makeV0Fixture()));
    expect(imported.version).toBe(1);
    expect(imported.player.cash).toBe(850);
    store.close();
  });

  it('importSave rejects non-JSON and non-save JSON with SaveImportError', async () => {
    const store = await openSave(freshDbName());
    await expect(store.importSave('definitely not json')).rejects.toBeInstanceOf(SaveImportError);
    await expect(store.importSave('{"hello":"world"}')).rejects.toBeInstanceOf(SaveImportError);
    expect(await store.readSave()).toBeNull();
    store.close();
  });

  it('exportSave with no save on disk throws instead of exporting nothing', async () => {
    const store = await openSave(freshDbName());
    await expect(store.exportSave()).rejects.toBeInstanceOf(SaveCorruptError);
    store.close();
  });
});
