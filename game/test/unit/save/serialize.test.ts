// Serializer registry: round-trip fidelity, unclaimed-section preservation,
// provider lifecycle, autosave gate. Pure TS — no IndexedDB involved.

import { describe, expect, it } from 'vitest';
import { SaveGameSchema } from '../../../src/content/schemas';
import { phaseOf, WAKE_MIN } from '../../../src/sim/clock';
import {
  clockSection,
  createAutosaveGate,
  createSaveSerializer,
  newGameSave,
  playerTransformSection,
  settingsSection,
  visitedFlagsSection,
  AUTOSAVE_TRIGGERS,
  type ClockState,
  type PlayerTransformState,
  type SettingsState,
} from '../../../src/save/serialize';
import { makeSave } from './fixtures';

describe('newGameSave', () => {
  it('is a valid v1 save starting day 1 at wake (6:00a, MORN)', () => {
    const save = newGameSave();
    expect(SaveGameSchema.safeParse(save).success).toBe(true);
    expect(save.clock).toEqual({ day: 1, minuteOfDay: WAKE_MIN });
    expect(phaseOf(save.clock.minuteOfDay)).toBe('MORN');
    expect(save.zone.segments).toHaveLength(6);
  });
});

describe('round-trip fidelity: capture → serialize → parse → restore', () => {
  it('restores the exact runtime surface through a JSON round-trip', () => {
    // "Device A": live runtime state.
    const pos: PlayerTransformState = { x: 3.5, y: 0, z: -8.25, headingRad: 2.1 };
    const clock: ClockState = { day: 4, minuteOfDay: 19 * 60 + 30 }; // 7:30p EVE
    const settings: SettingsState = { muted: true, volume: 0.35 };
    const visited = new Set(['record_store', 'lake_bde', 'gym']);

    const serA = createSaveSerializer();
    serA.registerSaveSection('player.transform', playerTransformSection(pos));
    serA.registerSaveSection('clock', clockSection(clock));
    serA.registerSaveSection('settings', settingsSection(settings));
    serA.registerSaveSection('flags.visited', visitedFlagsSection(visited));

    const snap = serA.snapshot();
    expect(SaveGameSchema.safeParse(snap).success).toBe(true);

    // Wire format: what store.ts writes / exportSave ships between devices.
    const parsed = SaveGameSchema.parse(JSON.parse(JSON.stringify(snap)));

    // "Device B": fresh runtime state, same providers.
    const pos2: PlayerTransformState = { x: 0, y: 0, z: 0, headingRad: 0 };
    const clock2: ClockState = { day: 1, minuteOfDay: WAKE_MIN };
    const settings2: SettingsState = { muted: false, volume: 1 };
    const visited2 = new Set<string>(['stale_entry']);

    const serB = createSaveSerializer();
    serB.registerSaveSection('player.transform', playerTransformSection(pos2));
    serB.registerSaveSection('clock', clockSection(clock2));
    serB.registerSaveSection('settings', settingsSection(settings2));
    serB.registerSaveSection('flags.visited', visitedFlagsSection(visited2));
    serB.restore(parsed);

    expect(pos2).toEqual(pos);
    expect(clock2).toEqual(clock);
    expect(settings2).toEqual(settings);
    expect(visited2).toEqual(visited); // stale entry cleared, all three restored
    // Phase is derived, never stored — same minute, same phase, no drift.
    expect(phaseOf(clock2.minuteOfDay)).toBe('EVE');
  });

  it('a second snapshot with unchanged state is byte-identical (determinism)', () => {
    const clock: ClockState = { day: 2, minuteOfDay: 700 };
    const ser = createSaveSerializer();
    ser.registerSaveSection('clock', clockSection(clock));
    expect(JSON.stringify(ser.snapshot())).toBe(JSON.stringify(ser.snapshot()));
  });
});

describe('scalability contract: sections nobody claimed ride through untouched', () => {
  it('preserves hero/npc/zone state across a capture cycle with only M1 providers', () => {
    const loaded = makeSave(); // has heroes.january, npcs.bee_toliver, faction rep
    const clock: ClockState = { day: 1, minuteOfDay: WAKE_MIN };
    const ser = createSaveSerializer();
    ser.registerSaveSection('clock', clockSection(clock));

    ser.restore(loaded);
    clock.day = 15; // play happens
    const snap = ser.snapshot();

    // The clock provider wrote its slice...
    expect(snap.clock.day).toBe(15);
    // ...and everything no provider owns yet survived verbatim.
    expect(snap.heroes).toEqual(loaded.heroes);
    expect(snap.npcs).toEqual(loaded.npcs);
    expect(snap.factions).toEqual(loaded.factions);
    expect(snap.zone).toEqual(loaded.zone);
    expect(snap.story).toEqual(loaded.story);
  });

  it('providers restore in registration order and can unregister', () => {
    const order: string[] = [];
    const ser = createSaveSerializer();
    const mk = (name: string) => ({
      capture: () => void order.push(`c:${name}`),
      restore: () => void order.push(`r:${name}`),
    });
    ser.registerSaveSection('a', mk('a'));
    const unregisterB = ser.registerSaveSection('b', mk('b'));
    ser.registerSaveSection('z', mk('z'));
    expect(ser.sections()).toEqual(['a', 'b', 'z']);

    ser.snapshot();
    ser.restore(newGameSave());
    expect(order).toEqual(['c:a', 'c:b', 'c:z', 'r:a', 'r:b', 'r:z']);

    unregisterB();
    expect(ser.sections()).toEqual(['a', 'z']);
  });

  it('rejects duplicate section keys', () => {
    const ser = createSaveSerializer();
    const noop = { capture: () => {}, restore: () => {} };
    ser.registerSaveSection('clock', noop);
    expect(() => ser.registerSaveSection('clock', noop)).toThrowError(/already registered/);
  });

  it('snapshot refuses to emit an invalid save (zod gate)', () => {
    const ser = createSaveSerializer();
    ser.registerSaveSection('rogue', {
      capture: (draft) => {
        draft.clock.minuteOfDay = 99999; // out of range
      },
      restore: () => {},
    });
    expect(() => ser.snapshot()).toThrowError();
  });
});

describe('autosave gate — never mid-fight, never mid-scene (docs/02 §7.3)', () => {
  it('blocks saves inside fights and scenes, including nested/overlapping', () => {
    const gate = createAutosaveGate();
    expect(gate.canSave()).toBe(true);

    gate.enterFight();
    expect(gate.canSave()).toBe(false);
    gate.enterScene(); // scene starts while the brawl winds down
    gate.exitFight();
    expect(gate.canSave()).toBe(false); // still mid-scene
    gate.exitScene();
    expect(gate.canSave()).toBe(true);

    gate.exitFight(); // stray exit never underflows into "extra credit"
    gate.enterFight();
    expect(gate.canSave()).toBe(false);
  });

  it('trigger list matches docs/02 §7.3 (incl. visibilitychange flush)', () => {
    expect(AUTOSAVE_TRIGGERS).toContain('app.background');
    expect(AUTOSAVE_TRIGGERS).toContain('sleep.completed');
    expect(AUTOSAVE_TRIGGERS).toContain('door.transition');
    expect(AUTOSAVE_TRIGGERS).toContain('zone.missionEnded');
  });
});
