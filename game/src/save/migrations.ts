// save/migrations.ts — SaveGame version field + ordered migration chain.
// Pure TS, no Babylon, no DOM (docs/05 module rule 1).
//
// CONTRACT (CLAUDE.md, non-negotiable): any SaveGame schema change ships with a
// migration. Never brick a phone save. Concretely:
//   - Older versions are walked forward one step at a time (v0→v1→v2→…) and the
//     result is zod-validated against the CURRENT schema. Partial/failed
//     migration throws — it never returns a half-migrated object.
//   - A save from a FUTURE version (player opened the game on an old build after
//     playing on a newer one) is REFUSED with a clear, typed error. The bytes on
//     disk are never touched — store.ts must not overwrite or "repair" it.

import { SaveGameSchema, type SaveGame } from '../content/schemas';

/** Version this build reads and writes. Bump together with a new Migration. */
export const CURRENT_SAVE_VERSION = 1;

/** Loose shape of a not-yet-migrated save (any historical version). */
export type RawSave = Record<string, unknown>;

export interface Migration {
  readonly from: number;
  readonly to: number;
  /** Must return a NEW object at version `to`; never mutate the input. */
  readonly migrate: (raw: RawSave) => RawSave;
}

/** Thrown for saves written by a newer build. Refuse to load — never destroy. */
export class SaveFutureVersionError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly supportedVersion: number = CURRENT_SAVE_VERSION,
  ) {
    super(
      `This save was written by a newer version of Twin Cities ` +
        `(save v${foundVersion}, this build reads up to v${supportedVersion}). ` +
        `Update the app to keep playing — the save has NOT been modified.`,
    );
    this.name = 'SaveFutureVersionError';
  }
}

/** Thrown when a save cannot be walked to the current version cleanly. */
export class SaveMigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SaveMigrationError';
  }
}

// ---------------------------------------------------------------------------
// The chain. Ordered, contiguous, one step per entry.
// ---------------------------------------------------------------------------

/**
 * v0 → v1 — real example: pre-v1 dev saves named the cash wallet
 * `player.money`; v1 renamed it to `player.cash` (docs/02 §2.4 currency names).
 * Also tolerates the old `clock.minute` spelling for `clock.minuteOfDay`.
 */
function migrateV0toV1(raw: RawSave): RawSave {
  const next: RawSave = structuredClone(raw);

  const player = next['player'];
  if (player && typeof player === 'object' && 'money' in player) {
    const p = player as RawSave;
    if (p['cash'] === undefined) p['cash'] = p['money'];
    delete p['money'];
  }

  const clock = next['clock'];
  if (clock && typeof clock === 'object' && 'minute' in clock) {
    const c = clock as RawSave;
    if (c['minuteOfDay'] === undefined) c['minuteOfDay'] = c['minute'];
    delete c['minute'];
  }

  next['version'] = 1;
  return next;
}

export const MIGRATIONS: readonly Migration[] = [
  { from: 0, to: 1, migrate: migrateV0toV1 },
  // v1 → v2 stub — the pattern for the next schema change (copy, fill in, bump
  // CURRENT_SAVE_VERSION, add a fixture to test/unit/save/migrations.test.ts):
  //
  // {
  //   from: 1,
  //   to: 2,
  //   migrate: (raw) => {
  //     const next = structuredClone(raw);
  //     // ... transform renamed/moved fields, default new required fields ...
  //     next['version'] = 2;
  //     return next;
  //   },
  // },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function versionOf(raw: unknown): number {
  if (raw === null || typeof raw !== 'object') {
    throw new SaveMigrationError('Save data is not an object.');
  }
  const v = (raw as RawSave)['version'];
  // Historical dev saves predating the version field count as v0.
  if (v === undefined) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new SaveMigrationError(`Save has an invalid version field: ${String(v)}`);
  }
  return v;
}

/**
 * Walk any historical save to the current version and validate it.
 * Throws SaveFutureVersionError (newer build) or SaveMigrationError (broken
 * chain / fails schema validation). Never mutates `raw`.
 */
export function migrateToCurrent(raw: unknown): SaveGame {
  let version = versionOf(raw);
  if (version > CURRENT_SAVE_VERSION) {
    throw new SaveFutureVersionError(version);
  }

  let working = raw as RawSave;
  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new SaveMigrationError(
        `No migration registered from save v${version} — chain is broken.`,
      );
    }
    working = step.migrate(working);
    if (working['version'] !== step.to) {
      throw new SaveMigrationError(
        `Migration v${step.from}→v${step.to} produced version ${String(working['version'])}.`,
      );
    }
    version = step.to;
  }

  const parsed = SaveGameSchema.safeParse(working);
  if (!parsed.success) {
    throw new SaveMigrationError(
      `Save failed schema validation at v${version}: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
