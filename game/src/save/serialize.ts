// save/serialize.ts — snapshot/restore between runtime state and the zod
// SaveGame shape. Pure TS; no Babylon, no DOM (docs/05 module rule 1).
//
// SCALABILITY CONTRACT: this module never learns about individual systems.
// Each system plugs in a SaveSectionProvider via registerSaveSection(key, ...)
// — combat/sim/base land at M4+ without touching this file. snapshot() starts
// from the last known save, so sections nobody has claimed yet (heroes, npcs,
// zone, …) ride through capture→restore cycles UNTOUCHED instead of being
// reset. That is what makes partial adoption safe.
//
// Integration (next round wires main.ts — the 3 lines):
//   const store = await openSave();
//   const loaded = await store.readSave(); if (loaded) restore(loaded);
//   document.addEventListener('visibilitychange', () => { if (document.hidden) void store.writeSave(snapshot()); });
//
// Autosave triggers (docs/02 §7.3): sleep, fight end, zone mission end, scene
// end, room purchase, door transitions, visibilitychange flush. NEVER mid-fight
// or mid-scene — use createAutosaveGate() below to enforce that.

import { SaveGameSchema, type SaveGame } from '../content/schemas';
import { WAKE_MIN } from '../sim/clock';
import { CURRENT_SAVE_VERSION } from './migrations';

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export interface SaveSectionProvider {
  /** Write this system's slice into the draft (mutate the draft in place). */
  capture(draft: SaveGame): void;
  /** Pull this system's slice back out of a loaded save into runtime state. */
  restore(save: SaveGame): void;
}

export interface SaveSerializer {
  /** Plug a system in. Key must be unique; returns an unregister function. */
  registerSaveSection(key: string, provider: SaveSectionProvider): () => void;
  /** Last-known save + every provider's capture, zod-validated. */
  snapshot(): SaveGame;
  /** Validate, remember, and fan a loaded save out to every provider. */
  restore(save: SaveGame): void;
  /** Registered section keys, in registration (= capture/restore) order. */
  sections(): string[];
}

/** Fresh day-1 baseline — the save a brand-new install starts from. */
export function newGameSave(): SaveGame {
  return SaveGameSchema.parse({
    version: CURRENT_SAVE_VERSION,
    clock: { day: 1, minuteOfDay: WAKE_MIN }, // wake at 6:00a (sim/clock.ts)
    player: {
      cash: 0,
      flux: 0,
      materials: 0,
      scrap: 0,
      rep: 0,
      repTier: 1,
      needs: { energy: 100, social: 100, hunger: 100 },
    },
    anchor: {
      level: 1,
      xp: 0,
      unlockedNodeIds: [],
      attunedEchoMoveIds: [],
      litEchoMoveIds: [],
    },
    heroes: {},
    npcs: {},
    factions: {},
    zone: {
      segments: Array.from({ length: 6 }, () => ({
        patrolDensity: 2,
        scannerCoveragePct: 100,
        checkpoint: 'active',
      })),
      perimeterIntegrityPct: 100,
      holding: { occupancy: 0, namedNpcIds: [] },
      lastMutationDay: 0,
      mutationDeckIndex: 0,
    },
    story: { act: 1, revealStage: 0, revealLedger: {}, flags: {} },
    base: { roomSystemUnlocked: false, slots: [], followerIds: [] },
    farm: { plots: [] },
    flags: {},
  } satisfies SaveGame);
}

/** Isolated serializer instance (tests, tools). Game code uses the default
 *  instance via the module-level functions below. */
export function createSaveSerializer(baseline?: SaveGame): SaveSerializer {
  const providers = new Map<string, SaveSectionProvider>(); // insertion order
  let lastKnown: SaveGame = baseline !== undefined
    ? SaveGameSchema.parse(baseline)
    : newGameSave();

  return {
    registerSaveSection(key, provider) {
      if (providers.has(key)) {
        throw new Error(`save section "${key}" is already registered`);
      }
      providers.set(key, provider);
      return () => {
        providers.delete(key);
      };
    },

    snapshot() {
      const draft = structuredClone(lastKnown);
      draft.version = CURRENT_SAVE_VERSION;
      for (const provider of providers.values()) provider.capture(draft);
      const validated = SaveGameSchema.parse(draft); // never persist an invalid shape
      lastKnown = structuredClone(validated);
      return validated;
    },

    restore(save) {
      const validated = SaveGameSchema.parse(save);
      lastKnown = structuredClone(validated);
      for (const provider of providers.values()) provider.restore(validated);
    },

    sections() {
      return [...providers.keys()];
    },
  };
}

/** The game's serializer. */
const defaultSerializer = createSaveSerializer();

export function registerSaveSection(
  key: string,
  provider: SaveSectionProvider,
): () => void {
  return defaultSerializer.registerSaveSection(key, provider);
}
export function snapshot(): SaveGame {
  return defaultSerializer.snapshot();
}
export function restore(save: SaveGame): void {
  defaultSerializer.restore(save);
}
export function registeredSections(): string[] {
  return defaultSerializer.sections();
}

// ---------------------------------------------------------------------------
// Built-in providers for the current (M1) runtime surface. Each takes a LIVE
// mutable state object owned by the caller — capture reads it, restore writes
// it. main.ts (next round) creates the state objects and registers these.
// ---------------------------------------------------------------------------

export interface PlayerTransformState {
  x: number;
  y: number;
  z: number;
  headingRad: number;
}

/** Player world transform → SaveGame.player.position (additive v1 field). */
export function playerTransformSection(
  state: PlayerTransformState,
): SaveSectionProvider {
  return {
    capture(draft) {
      draft.player.position = {
        x: state.x,
        y: state.y,
        z: state.z,
        headingRad: state.headingRad,
      };
    },
    restore(save) {
      if (save.player.position) Object.assign(state, save.player.position);
    },
  };
}

export interface ClockState {
  day: number;
  minuteOfDay: number;
}

/** Game clock → SaveGame.clock. Phase is NOT stored: derive it at runtime via
 *  sim/clock.phaseOf(minuteOfDay) — one source of truth, no drift. Real-world
 *  timestamps belong ONLY to follower missions (docs/02 §7.3), never here. */
export function clockSection(state: ClockState): SaveSectionProvider {
  return {
    capture(draft) {
      draft.clock = { day: state.day, minuteOfDay: state.minuteOfDay };
    },
    restore(save) {
      state.day = save.clock.day;
      state.minuteOfDay = save.clock.minuteOfDay;
    },
  };
}

export interface SettingsState {
  muted: boolean;
  volume: number; // 0..1
}

/** Device settings → SaveGame.settings (additive v1 field). */
export function settingsSection(state: SettingsState): SaveSectionProvider {
  return {
    capture(draft) {
      draft.settings = { muted: state.muted, volume: state.volume };
    },
    restore(save) {
      if (save.settings) {
        state.muted = save.settings.muted;
        state.volume = save.settings.volume;
      }
    },
  };
}

const VISITED_PREFIX = 'visited.';

/** Visited-place flags → SaveGame.flags["visited.<id>"] = true. */
export function visitedFlagsSection(visited: Set<string>): SaveSectionProvider {
  return {
    capture(draft) {
      for (const id of visited) draft.flags[`${VISITED_PREFIX}${id}`] = true;
    },
    restore(save) {
      visited.clear();
      for (const [key, value] of Object.entries(save.flags)) {
        if (key.startsWith(VISITED_PREFIX) && value === true) {
          visited.add(key.slice(VISITED_PREFIX.length));
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Autosave gate — docs/02 §7.3: NEVER save mid-fight or mid-scene. A killed
// tab resumes at the pre-fight/pre-scene checkpoint (fights are ≤90s; losing
// one is losing nothing). The wiring round guards every autosave trigger —
// including the visibilitychange flush — behind gate.canSave().
// ---------------------------------------------------------------------------

/** Event-bus topics that should trigger an autosave (docs/02 §7.3). */
export const AUTOSAVE_TRIGGERS = [
  'sleep.completed',
  'brawl.ended', // fight END — the gate blocks anything mid-fight
  'zone.missionEnded', // success or abort; zone state writes atomically with the save
  'scene.ended',
  'base.roomPurchased',
  'door.transition', // entering/leaving a building
  'app.background', // visibilitychange → flush immediately
] as const;

export interface AutosaveGate {
  enterFight(): void;
  exitFight(): void;
  enterScene(): void;
  exitScene(): void;
  /** True when it is legal to write a save right now. */
  canSave(): boolean;
}

export function createAutosaveGate(): AutosaveGate {
  let fights = 0;
  let scenes = 0;
  return {
    enterFight: () => void fights++,
    exitFight: () => void (fights = Math.max(0, fights - 1)),
    enterScene: () => void scenes++,
    exitScene: () => void (scenes = Math.max(0, scenes - 1)),
    canSave: () => fights === 0 && scenes === 0,
  };
}
