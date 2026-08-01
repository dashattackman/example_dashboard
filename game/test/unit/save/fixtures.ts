// Shared fixtures for the save-system unit tests.

import type { SaveGame } from '../../../src/content/schemas';
import { newGameSave } from '../../../src/save/serialize';
import type { RawSave } from '../../../src/save/migrations';

/** A populated, valid v1 save (not the empty day-1 baseline). */
export function makeSave(): SaveGame {
  const save = newGameSave();
  save.clock = { day: 12, minuteOfDay: 21 * 60 }; // day 12, 9:00p (EVE)
  save.player.cash = 850;
  save.player.flux = 14;
  save.player.rep = 120;
  save.player.repTier = 2;
  save.player.needs = { energy: 62, social: 80, hunger: 45 };
  save.player.position = { x: 4.25, y: 0, z: -11.5, headingRad: 1.5707 };
  save.settings = { muted: false, volume: 0.8 };
  save.heroes['january'] = {
    recruited: true,
    level: 6,
    xp: 240,
    bondFriendship: 3,
    bondRomance: 1,
    unlockedNodeIds: ['jan_cap_1'],
    equippedMoveId: 'jan_glaze',
    attunementConsented: true,
  };
  save.npcs['bee_toliver'] = {
    opinion: { respect: 40, attraction: 0, fear: -10, trust: 25 },
    memories: [],
    friendship: 2,
    romance: 0,
  };
  save.factions['the_commons'] = { rep: 35 };
  save.flags['visited.record_store'] = true;
  save.flags['visited.lake_bde'] = true;
  return save;
}

/** The same save as it would have been written by a pre-v1 dev build:
 *  no proper version bookkeeping conventions — `player.money` instead of
 *  `player.cash`, `clock.minute` instead of `clock.minuteOfDay`. */
export function makeV0Fixture(): RawSave {
  const raw = JSON.parse(JSON.stringify(makeSave())) as RawSave;
  raw['version'] = 0;
  const player = raw['player'] as RawSave;
  player['money'] = player['cash'];
  delete player['cash'];
  const clock = raw['clock'] as RawSave;
  clock['minute'] = clock['minuteOfDay'];
  delete clock['minuteOfDay'];
  return raw;
}
