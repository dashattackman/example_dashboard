// save/store.ts — IndexedDB adapter (via `idb`). Pure TS + idb; no Babylon.
//
// Guarantees (docs/02 §7.3, docs/05 §"Save/versioning", CLAUDE.md):
//   - writeSave is atomic: the previous save is copied to the .backup key in the
//     SAME transaction that writes the new main save, and the write is verified
//     (read back + schema-parse) before we consider it landed. A failed verify
//     rolls main back from backup. A phone save is never left half-written.
//   - readSave falls back to .backup when main is corrupt (and repairs main from
//     it). A future-version save is refused loudly, NOT treated as corruption.
//   - Storage-quota errors surface as a typed SaveQuotaError for the UI to toast
//     ("storage full — free some space"); they never crash the loop and never
//     damage the existing save (the aborted transaction leaves it intact).
//   - exportSave/importSave move a save between devices as a JSON string
//     (docs/05: "Export/import save as JSON blob").
//
// Integration (next round wires main.ts — the 3 lines):
//   const store = await openSave();
//   const loaded = await store.readSave(); if (loaded) restore(loaded);
//   document.addEventListener('visibilitychange', () => { if (document.hidden) void store.writeSave(snapshot()); });

import { openDB, type IDBPDatabase } from 'idb';
import type { SaveGame } from '../content/schemas';
import { migrateToCurrent, SaveFutureVersionError } from './migrations';

const DB_NAME = 'twin-cities-save';
const DB_VERSION = 1;
const STORE = 'saves';
const KEY_MAIN = 'main';
const KEY_BACKUP = 'backup';

/** What actually sits in IndexedDB. JSON string, not a live object graph, so a
 *  torn/garbage record is detectable (parse fails) instead of silently wrong. */
interface SaveRecord {
  json: string;
  version: number;
  savedAt: number; // wall clock, for debugging only — game time lives in the save
}

export class SaveQuotaError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(
      'Could not save: this device is out of storage space. ' +
        'Your previous save is untouched — free up some space and try again.',
      options,
    );
    this.name = 'SaveQuotaError';
  }
}

export class SaveCorruptError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SaveCorruptError';
  }
}

export class SaveImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SaveImportError';
  }
}

export interface SaveStore {
  /** Load the save; falls back to backup on corruption. null = fresh install. */
  readSave(): Promise<SaveGame | null>;
  /** Atomic write with backup + verify. Throws SaveQuotaError on full storage. */
  writeSave(save: SaveGame): Promise<void>;
  /** Current save as a portable JSON string (cross-device transfer). */
  exportSave(): Promise<string>;
  /** Validate + migrate a pasted/transferred JSON string, then persist it. */
  importSave(json: string): Promise<SaveGame>;
  close(): void;
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.code === 22;
  }
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { name?: unknown }).name === 'QuotaExceededError'
  );
}

function decodeRecord(record: unknown): SaveGame {
  if (
    record === null ||
    typeof record !== 'object' ||
    typeof (record as SaveRecord).json !== 'string'
  ) {
    throw new SaveCorruptError('Save record is malformed.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse((record as SaveRecord).json);
  } catch (cause) {
    throw new SaveCorruptError('Save record is not valid JSON.', { cause });
  }
  return migrateToCurrent(raw); // may throw SaveFutureVersionError — must propagate
}

/** Open (creating on first run) the save database. `dbName` is injectable for tests. */
export async function openSave(dbName: string = DB_NAME): Promise<SaveStore> {
  const db: IDBPDatabase = await openDB(dbName, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    },
  });

  async function getRecord(key: string): Promise<unknown> {
    return db.get(STORE, key);
  }

  async function readSave(): Promise<SaveGame | null> {
    const main = await getRecord(KEY_MAIN);
    const backup = await getRecord(KEY_BACKUP);
    if (main === undefined && backup === undefined) return null;

    let mainError: unknown;
    if (main !== undefined) {
      try {
        return decodeRecord(main);
      } catch (e) {
        // A newer build's save is NOT corruption: refuse, never fall back to an
        // older snapshot behind the player's back, never touch the bytes.
        if (e instanceof SaveFutureVersionError) throw e;
        mainError = e;
      }
    }

    if (backup !== undefined) {
      try {
        const recovered = decodeRecord(backup);
        // Repair main from the good backup (best-effort — reading must succeed
        // even if the repair write can't land right now).
        try {
          await db.put(STORE, backup, KEY_MAIN);
        } catch {
          /* repair is opportunistic */
        }
        return recovered;
      } catch (e) {
        if (e instanceof SaveFutureVersionError) throw e;
        throw new SaveCorruptError(
          'Both the save and its backup are unreadable. Neither has been deleted — export the raw data before starting a new game.',
          { cause: e },
        );
      }
    }

    throw new SaveCorruptError('The save is unreadable and no backup exists yet.', {
      cause: mainError,
    });
  }

  async function writeSave(save: SaveGame): Promise<void> {
    // Serialize + re-validate BEFORE touching the database: a bug upstream must
    // never replace a good on-disk save with an invalid one.
    const json = JSON.stringify(save);
    let validated: SaveGame;
    try {
      validated = migrateToCurrent(JSON.parse(json));
    } catch (cause) {
      throw new SaveCorruptError('Refusing to write an invalid save.', { cause });
    }

    const record: SaveRecord = {
      json,
      version: validated.version,
      savedAt: Date.now(),
    };

    try {
      // One transaction: previous main -> backup, new record -> main.
      // IndexedDB aborts the whole transaction on failure, so the pair is atomic.
      const tx = db.transaction(STORE, 'readwrite');
      const prev = await tx.store.get(KEY_MAIN);
      if (prev !== undefined) await tx.store.put(prev, KEY_BACKUP);
      await tx.store.put(record, KEY_MAIN);
      await tx.done;
    } catch (e) {
      if (isQuotaError(e)) throw new SaveQuotaError({ cause: e });
      throw e;
    }

    // Verify: the write only counts once the stored bytes parse back into a
    // valid SaveGame. If verification fails, roll main back from backup.
    const stored = await getRecord(KEY_MAIN);
    try {
      decodeRecord(stored);
    } catch (cause) {
      const backup = await getRecord(KEY_BACKUP);
      if (backup !== undefined) {
        try {
          await db.put(STORE, backup, KEY_MAIN);
        } catch {
          /* backup key still holds the good save either way */
        }
      }
      throw new SaveCorruptError(
        'Save verification failed; the previous save was restored.',
        { cause },
      );
    }
  }

  async function exportSave(): Promise<string> {
    const save = await readSave();
    if (save === null) {
      throw new SaveCorruptError('Nothing to export — no save exists yet.');
    }
    return JSON.stringify(save);
  }

  async function importSave(json: string): Promise<SaveGame> {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (cause) {
      throw new SaveImportError('That is not a Twin Cities save (invalid JSON).', {
        cause,
      });
    }
    let save: SaveGame;
    try {
      save = migrateToCurrent(raw); // SaveFutureVersionError propagates untouched
    } catch (e) {
      if (e instanceof SaveFutureVersionError) throw e;
      throw new SaveImportError('That is not a valid Twin Cities save.', { cause: e });
    }
    await writeSave(save);
    return save;
  }

  return {
    readSave,
    writeSave,
    exportSave,
    importSave,
    close: () => db.close(),
  };
}
