// content/index.ts — typed content loader.
// Parses + validates every content JSON through the zod schemas in schemas.ts
// at import time, with AGGREGATED error reporting: one throw lists every
// invalid file and every issue, so a content author fixes a batch, not a
// whack-a-mole. Pure TS — no Babylon, no DOM (docs/05 module rule 1).
//
// Content rule (CLAUDE.md / docs/05 module rule 2): adding a hero/venue/item
// is a JSON drop-in here — zero engine changes. import.meta.glob keeps that
// true for heroes; new top-level files get a schema + an entry below.

import type { z } from 'zod';
import {
  AnchorSchema,
  CombatContentSchema,
  EconomySchema,
  HeroSchema,
  TuningSchema,
  type Anchor,
  type CombatContent,
  type Economy,
  type Hero,
  type Tuning,
} from './schemas';

/** Everything the game consumes, fully validated and typed. */
export interface ContentBundle {
  /** Roster heroes (slice: the 6 recruitables). Sorted by id for determinism. */
  heroes: Hero[];
  /** The PC — Elias "Eli" Monroe. Not a roster hero; echo-thread kit (docs/02 §1.8). */
  anchor: Anchor;
  tuning: Tuning;
  economy: Economy;
  /** Enemy VO + spawn-composition weights (docs/02 §1.5/§1.6/§1.9) for game/src/combat. */
  combat: CombatContent;
}

// Vite/vitest resolve these globs at build time; JSON default export is the
// parsed object. eager keeps the loader synchronous (content is small).
const heroFiles = import.meta.glob('./heroes/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const rootFiles = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

interface ValidationFailure {
  file: string;
  issues: string[];
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

function validateOne<S extends z.ZodTypeAny>(
  file: string,
  schema: S,
  raw: unknown,
  failures: ValidationFailure[],
): z.infer<S> | undefined {
  const result = schema.safeParse(raw);
  if (result.success) return result.data as z.infer<S>;
  failures.push({ file, issues: formatIssues(result.error) });
  return undefined;
}

/**
 * Parse + validate all content JSON. Throws a single aggregated Error listing
 * every failing file and issue. Used at import (below) and directly by tests.
 */
export function loadContent(): ContentBundle {
  const failures: ValidationFailure[] = [];

  const heroes: Hero[] = [];
  let anchor: Anchor | undefined;

  for (const [file, raw] of Object.entries(heroFiles).sort(([a], [b]) => a.localeCompare(b))) {
    const id = (raw as { id?: unknown } | null)?.id;
    if (id === 'anchor') {
      anchor = validateOne(file, AnchorSchema, raw, failures);
    } else {
      const hero = validateOne(file, HeroSchema, raw, failures);
      if (hero) heroes.push(hero);
    }
  }
  heroes.sort((a, b) => a.id.localeCompare(b.id));

  const tuningRaw = rootFiles['./tuning.json'];
  const economyRaw = rootFiles['./economy.json'];
  const combatRaw = rootFiles['./combat.json'];
  const tuning =
    tuningRaw === undefined
      ? (failures.push({ file: './tuning.json', issues: ['file missing'] }), undefined)
      : validateOne('./tuning.json', TuningSchema, tuningRaw, failures);
  const economy =
    economyRaw === undefined
      ? (failures.push({ file: './economy.json', issues: ['file missing'] }), undefined)
      : validateOne('./economy.json', EconomySchema, economyRaw, failures);
  const combat =
    combatRaw === undefined
      ? (failures.push({ file: './combat.json', issues: ['file missing'] }), undefined)
      : validateOne('./combat.json', CombatContentSchema, combatRaw, failures);

  if (anchor === undefined && !failures.some((f) => f.file.includes('anchor'))) {
    failures.push({ file: './heroes/anchor.json', issues: ['file missing'] });
  }

  if (
    failures.length > 0 ||
    anchor === undefined ||
    tuning === undefined ||
    economy === undefined ||
    combat === undefined
  ) {
    const report = failures
      .map((f) => `  ${f.file}\n${f.issues.map((i) => `    - ${i}`).join('\n')}`)
      .join('\n');
    throw new Error(
      `Content validation failed (${failures.length} file${failures.length === 1 ? '' : 's'}):\n${report}`,
    );
  }

  return { heroes, anchor, tuning, economy, combat };
}

/**
 * Validated content, checked at import. Validation always runs (the whole
 * bundle is a handful of small JSON files and zod parsing IS how we obtain
 * typed data); in dev the aggregated error surfaces immediately on boot.
 */
export const content: ContentBundle = loadContent();

export * from './schemas';
