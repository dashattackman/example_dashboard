// Encounter orchestration — docs/02 §1.5 (crowd budget/waves), §1.6 (ramp,
// Splash Rating, rubber-banding), §1.9 (Demolition Rating). Pure TS; the arena
// is an abstract rect, positions are {x,z}, all randomness via injected seed.

import { content } from '../content';
import {
  clearFlagsBy,
  createEnemy,
  damageTakenMult,
  ENEMY_CONFIGS,
  hitDetainerArm,
  machineDamageMult,
  rollScrap,
  updateEnemy,
  type Civilian,
  type Enemy,
  type EnemyEvent,
  type EnemyKind,
  type EnemyWorld,
} from './enemies';
import {
  applyDamage,
  isDeliberateVerb,
  powerGainForHit,
  updateFighter,
  wallSplat,
  type DamageTags,
  type Fighter,
  type FighterEvent,
  type SquadContext,
  type Vec2,
} from './fighter';
import { makeRng, type Rng } from './rng';
import { createTokenPool, liveTokens, reapTokens, type TokenPool } from './tokens';
import { combatTuning as T } from './tuning';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Tier = 1 | 2 | 3 | 4;

export interface EncounterConfig {
  seed: number;
  tier: Tier;
  /** 1-based count of brawls this player has fought (drives the §1.6 early-ramp guarantees). */
  encounterIndex: number;
  arena: Rect;
  family?: 'human' | 'machine';
  /** Consecutive wipes on THIS encounter — 2+ triggers invisible rubber-banding (§1.6). */
  priorWipes?: number;
  civilians?: Civilian[];
  exitPoint?: Vec2;
}

export interface SpawnEntry {
  kind: EnemyKind;
  wave: number; // 0-based
}

// ---------------------------------------------------------------------------
// spawn tables (§1.5 crowd budget + §1.6 composition ramp)

/** Composition weights per tier — composition, not HP sponging, is the ramp (§1.6).
 *  Content-is-data: the weights live in content/combat.json, validated by zod. */
const TIER_WEIGHTS: Record<Tier, Partial<Record<EnemyKind, number>>> = {
  1: content.combat.spawnWeights.human.tier1,
  2: content.combat.spawnWeights.human.tier2,
  3: content.combat.spawnWeights.human.tier3,
  4: content.combat.spawnWeights.human.tier4, // tier 4: leaders + dual ranged (§1.6)
};

const MACHINE_WEIGHTS: Partial<Record<EnemyKind, number>> = content.combat.spawnWeights.machine;

function weightedKind(weights: Partial<Record<EnemyKind, number>>, rng: Rng): EnemyKind {
  const entries = Object.entries(weights) as [EnemyKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [kind, w] of entries) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  const last = entries[entries.length - 1];
  return last ? last[0] : 'grunt';
}

/**
 * Build the spawn table. Guarantees:
 * - total 8–14, waves 2–3 (§1.5);
 * - §1.6: ranged appears by encounter 2 and bruiser by encounter 3 — both within
 *   the player's first three encounters (positioning + armor are hour-one decisions);
 * - tier-4 human fights include a leader;
 * - rubber-band: priorWipes ≥ 2 removes one bruiser (§1.6, invisible, never announced).
 */
export function buildSpawnTable(cfg: EncounterConfig, rng: Rng): SpawnEntry[] {
  const family = cfg.family ?? 'human';
  const total = rng.int(T.crowd.totalMin, T.crowd.totalMax);
  const waves = rng.int(T.crowd.wavesMin, T.crowd.wavesMax);
  const kinds: EnemyKind[] = [];

  if (family === 'machine') {
    // swarm units come in groups of 5–8 (§1.9): seed one group, then fill
    const group = rng.int(T.civis.swarmGroupMin, T.civis.swarmGroupMax);
    for (let i = 0; i < Math.min(group, total); i++) kinds.push('swarm');
    while (kinds.length < total) kinds.push(weightedKind(MACHINE_WEIGHTS, rng));
    // machine fights need their force multiplier readable: ensure ≥1 scanner
    if (!kinds.includes('scanner')) kinds[kinds.length - 1] = 'scanner';
  } else {
    while (kinds.length < total) kinds.push(weightedKind(TIER_WEIGHTS[cfg.tier], rng));
    // §1.6 early guarantees
    if (cfg.encounterIndex >= T.ramp.rangedByEncounter && !kinds.includes('ranged')) kinds[0] = 'ranged';
    if (cfg.encounterIndex >= T.ramp.bruiserByEncounter && !kinds.includes('bruiser')) kinds[1] = 'bruiser';
    if (cfg.tier === 4 && !kinds.includes('leader')) kinds[0] = 'leader';
    // rubber-banding (§1.6): one fewer bruiser after two wipes
    if ((cfg.priorWipes ?? 0) >= T.rubberBand.wipesToTrigger) {
      const bi = kinds.indexOf('bruiser');
      if (bi >= 0) kinds[bi] = 'grunt';
    }
  }

  // deal into waves: front-load wave 0, keep later waves ≥2 enemies
  const table: SpawnEntry[] = [];
  const perWave = Math.floor(kinds.length / waves);
  kinds.forEach((kind, i) => {
    const wave = Math.min(waves - 1, Math.floor(i / Math.max(perWave, 1)));
    table.push({ kind, wave });
  });
  return table;
}

// ---------------------------------------------------------------------------
// splash rating (§1.6) / demolition rating (§1.9)

export type Grade = 'D' | 'C' | 'B' | 'A' | 'S';

export interface SplashStats {
  lightHits: number;
  heavyHits: number;
  powerMoves: number;
  throwImpacts: number;
  environmentalHits: number;
  juggleHits: number;
  swaps: number;
  assistHits: number;
  // machine-fight (Demolition) inputs
  crushKills: number; // knockback/throw/momentum kills
  chainDestructions: number; // multi-kill events
  detainments: number; // captives lost — zero is the discipline goal
  scannerFirstKill: boolean; // first machine down was a Scanner
}

export function emptyStats(): SplashStats {
  return {
    lightHits: 0, heavyHits: 0, powerMoves: 0, throwImpacts: 0, environmentalHits: 0,
    juggleHits: 0, swaps: 0, assistHits: 0,
    crushKills: 0, chainDestructions: 0, detainments: 0, scannerFirstKill: false,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function gradeOf(score: number): Grade {
  const cuts = T.splash.gradeCuts;
  if (score >= cuts.S) return 'S';
  if (score >= cuts.A) return 'A';
  if (score >= cuts.B) return 'B';
  if (score >= cuts.C) return 'C';
  return 'D';
}

export interface RatingResult {
  score: number; // 0..1
  grade: Grade;
  /** §1.6: visibly multiplies the loot splash ×1.0–×1.5 and is printed on it. */
  lootMult: number;
}

/** Distinct verb families used (§1.6 "move variety"). Environmental counts here —
 *  until the M4 prop system lands it is the fifth family, not its own factor. */
function varietyFactor(stats: SplashStats): number {
  const kinds =
    (stats.lightHits > 0 ? 1 : 0) +
    (stats.heavyHits > 0 ? 1 : 0) +
    (stats.powerMoves > 0 ? 1 : 0) +
    (stats.throwImpacts > 0 ? 1 : 0) +
    (stats.environmentalHits > 0 ? 1 : 0);
  return kinds / 5;
}

/**
 * Splash Rating (§1.6): variety / juggle / throws / team — FOUR equal-weight
 * factors, each clamped 0..1 ([resolved M3r2]: docs/02 names the ingredients,
 * not the formula; environmental folds into variety until M4 props exist, and
 * team play counts swaps + ASSIST JUGGLE hits — §1.3's "team juggling" — so
 * ally chip damage can't buy the factor for a masher).
 * Measured anchors (pacing.test.ts): mash bot ≈0.05 → D ×1.0; skill bot ≈0.85+ → S ×1.4+.
 */
export function splashRating(stats: SplashStats, enemyCount: number): RatingResult {
  const n = Math.max(1, enemyCount);
  const variety = varietyFactor(stats);
  const juggle = clamp01(stats.juggleHits / n);
  const throws = clamp01(stats.throwImpacts / (n * T.splash.throwsPerEnemy));
  const team = clamp01((stats.swaps * 2 + stats.assistHits) / T.splash.teamPlaysFull);
  const score = (variety + juggle + throws + team) / 4;
  return { score, grade: gradeOf(score), lootMult: T.splash.lootMultMin + (T.splash.lootMultMax - T.splash.lootMultMin) * score };
}

/**
 * Demolition Rating (§1.9): the machine-fight variant — chain-destruction,
 * crush/knockback kills, Scanner-first discipline, zero detainments, variety;
 * multiplies SCRAP ×1.0–×1.5. Denominators re-derived from simulated skilled
 * play so S is reachable through what the module actually expresses (throws
 * now resolve as real projectiles — see updateEncounter).
 */
export function demolitionRating(stats: SplashStats, machineCount: number): RatingResult {
  const n = Math.max(1, machineCount);
  const chain = clamp01(stats.chainDestructions / T.splash.demolitionChainFull);
  const crush = clamp01(stats.crushKills / (n * T.splash.demolitionCrushPerEnemy));
  const scannerFirst = stats.scannerFirstKill ? 1 : 0;
  const zeroDetain = stats.detainments === 0 ? 1 : 0;
  const score = (chain + crush + scannerFirst + zeroDetain + varietyFactor(stats)) / 5;
  return { score, grade: gradeOf(score), lootMult: T.splash.lootMultMin + (T.splash.lootMultMax - T.splash.lootMultMin) * score };
}

// ---------------------------------------------------------------------------
// encounter runtime

export type EncounterStatus = 'active' | 'victory' | 'defeat';

export interface LootSplash {
  rating: RatingResult;
  scrap: number;
  fluxCells: number;
  /** rubber-band consolation (§1.6): dropped after two wipes on this encounter */
  foodPickup: boolean;
}

export type EncounterEvent =
  | FighterEvent
  | EnemyEvent
  | { type: 'wave-start'; wave: number }
  | { type: 'spawn'; id: string; kind: EnemyKind }
  | { type: 'victory'; loot: LootSplash }
  | { type: 'defeat' };

export interface Encounter {
  cfg: EncounterConfig;
  rng: Rng;
  time: number;
  status: EncounterStatus;
  squad: Fighter[];
  enemies: Enemy[];
  pending: SpawnEntry[]; // not yet spawned (later waves + on-screen overflow)
  wave: number;
  waveCount: number;
  tokens: TokenPool;
  squadCtx: SquadContext;
  stats: SplashStats;
  world: EnemyWorld;
  scrap: number;
  fluxCells: number;
  firstMachineKill: EnemyKind | null;
  controlledId: string;
  /** Per-encounter spawn counter — ids are seed-stable, never process-global. */
  spawnCounter: number;
  /** In-flight thrown bodies: victim id -> per-flight bookkeeping (§1.3 projectiles). */
  thrownFlights: Map<string, { hitIds: Set<string>; kills: number }>;
}

function spawnPos(arena: Rect, rng: Rng): Vec2 {
  // enemies enter from the arena edge (side-of-street framing)
  const x = rng.next() < 0.5 ? arena.minX + 0.5 : arena.maxX - 0.5;
  return { x, z: arena.minZ + rng.next() * (arena.maxZ - arena.minZ) };
}

export function createEncounter(cfg: EncounterConfig, squad: Fighter[]): Encounter {
  const rng = makeRng(cfg.seed);
  const table = buildSpawnTable(cfg, rng);
  const waveCount = table.reduce((m, s) => Math.max(m, s.wave), 0) + 1;
  const tokens = createTokenPool();
  const controlled = squad[0];
  const enc: Encounter = {
    cfg, rng, time: 0, status: 'active',
    squad, enemies: [], pending: [...table],
    wave: -1, waveCount, tokens,
    squadCtx: { secondWindUsed: false, standingCount: squad.length },
    stats: emptyStats(),
    world: {
      time: 0, rng, tokens, squad,
      civilians: cfg.civilians ?? [],
      flags: new Map(),
      claimedCaptives: new Set(),
      nextMeleeAt: 0,
      spoofBeaconActive: false, trafficHalt: false, leaderAlive: false,
      // exit sits ON the boundary — a carrier must be able to actually reach it
      // (an off-board exit + arena clamp pinned carriers at the wall; finding #4)
      exitPoint: cfg.exitPoint ?? { x: cfg.arena.maxX, z: (cfg.arena.minZ + cfg.arena.maxZ) / 2 },
      dreadAura: false,
    },
    scrap: 0, fluxCells: 0, firstMachineKill: null,
    controlledId: controlled ? controlled.id : '',
    spawnCounter: 0,
    thrownFlights: new Map(),
  };
  return enc;
}

function standingHeroes(enc: Encounter): number {
  return enc.squad.filter((h) => h.alive && h.state !== 'down').length;
}

function aliveEnemies(enc: Encounter): Enemy[] {
  return enc.enemies.filter((e) => e.fighter.alive && e.mode !== 'abandoned' && !e.routed && !e.gone);
}

function spawnWave(enc: Encounter, wave: number, events: EncounterEvent[]): void {
  enc.wave = wave;
  events.push({ type: 'wave-start', wave });
  releasePendingSpawns(enc, events);
}

/** Spawn from pending up to the on-screen cap (§1.5: ≤6 on screen). */
function releasePendingSpawns(enc: Encounter, events: EncounterEvent[]): void {
  const cap = T.crowd.onScreenCap;
  while (enc.pending.length > 0 && aliveEnemies(enc).length < cap) {
    const nextIdx = enc.pending.findIndex((s) => s.wave <= enc.wave);
    if (nextIdx < 0) break;
    const spec = enc.pending[nextIdx];
    if (!spec) break;
    enc.pending.splice(nextIdx, 1);
    const enemy = createEnemy(spec.kind, spawnPos(enc.cfg.arena, enc.rng), {
      tier: enc.cfg.tier,
      id: `${spec.kind}-${enc.spawnCounter++}`, // seed-stable, per-encounter
      arcSide: enc.rng.next() < 0.5 ? 1 : -1,
    });
    enc.enemies.push(enemy);
    events.push({ type: 'spawn', id: enemy.fighter.id, kind: spec.kind });
  }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clampToArena(f: Fighter, arena: Rect): boolean {
  let hitWall = false;
  if (f.pos.x < arena.minX) { f.pos.x = arena.minX; hitWall = true; }
  if (f.pos.x > arena.maxX) { f.pos.x = arena.maxX; hitWall = true; }
  if (f.pos.z < arena.minZ) { f.pos.z = arena.minZ; hitWall = true; }
  if (f.pos.z > arena.maxZ) { f.pos.z = arena.maxZ; hitWall = true; }
  return hitWall;
}

/**
 * Player-side hit: the controlled hero's attack lands on an enemy.
 * Applies bulwark shield / leader vulnerability / machine momentum + flags,
 * updates Splash stats, grants power (§1.4 table), handles scrap on kill.
 */
export function heroHitsEnemy(
  enc: Encounter,
  hero: Fighter,
  enemy: Enemy,
  baseDamage: number,
  tags: DamageTags = {},
): EncounterEvent[] {
  const events: EncounterEvent[] = [];
  if (enc.status !== 'active' || !enemy.fighter.alive) return events;

  const mult = damageTakenMult(enemy, tags, hero.pos);
  if (mult === 0) return events; // bulwark frontal block (§1.9)

  // carrying detainer: DELIBERATE verbs work the arm assembly (§1.9 — never a
  // light-mash race; heavy/power/thrown/environmental only)
  if (isDeliberateVerb(tags)) {
    const armEvents = hitDetainerArm(enemy);
    for (const ev of armEvents) {
      if (ev.type === 'grip-broken') enc.world.claimedCaptives.delete(ev.captiveId); // captive is loose again
    }
    events.push(...armEvents);
  }

  const res = applyDamage(enemy.fighter, baseDamage * mult, tags);
  events.push(...res.events);

  // stats + power economy
  if (tags.thrown) enc.stats.throwImpacts += 1;
  else if (res.wasJuggle) enc.stats.juggleHits += 1;
  else if (tags.environmental) enc.stats.environmentalHits += 1;
  else if (tags.light) enc.stats.lightHits += 1;
  else if (tags.launcher) enc.stats.heavyHits += 1;
  // team factor counts ASSIST JUGGLE hits only (§1.3 team juggling), not ally chip damage
  if (hero.team === 'squad' && hero.id !== enc.controlledId && res.wasJuggle && res.dealt > 0) {
    enc.stats.assistHits += 1;
  }
  powerGainForHit(hero, tags, res.wasJuggle);

  if (!enemy.fighter.alive) {
    onEnemyKilled(enc, enemy, tags, events);
  }
  return events;
}

function onEnemyKilled(enc: Encounter, enemy: Enemy, tags: DamageTags, events: EncounterEvent[]): void {
  reapTokens(enc.tokens, (id) => id !== enemy.fighter.id);
  // a dead scanner's paint clears immediately (§1.9 counterplay, finding #7)
  if (enemy.kind === 'scanner') clearFlagsBy(enc.world.flags, enemy.fighter.id);
  if (enemy.cfg.family === 'machine') {
    if (enc.firstMachineKill === null) {
      enc.firstMachineKill = enemy.kind;
      enc.stats.scannerFirstKill = enemy.kind === 'scanner';
    }
    if (tags.thrown || tags.momentum) enc.stats.crushKills += 1;
    const drop = rollScrap(enemy.kind, enc.rng);
    enc.scrap += drop.scrap;
    enc.fluxCells += drop.fluxCells;
  }
  // dropped captive if it died mid-carry
  if (enemy.carryTargetId !== null) {
    enc.world.claimedCaptives.delete(enemy.carryTargetId);
    events.push({ type: 'grip-broken', id: enemy.fighter.id, captiveId: enemy.carryTargetId });
    enemy.carryTargetId = null;
  }
}

/** Portrait-tap swap (§1.2) — swap is a core move; counts toward team factor. */
export function swapControlled(enc: Encounter, heroId: string): boolean {
  const hero = enc.squad.find((h) => h.id === heroId);
  if (!hero || !hero.alive || heroId === enc.controlledId) return false;
  enc.controlledId = heroId;
  enc.stats.swaps += 1;
  return true;
}

export function updateEncounter(enc: Encounter, dt: number): EncounterEvent[] {
  const events: EncounterEvent[] = [];
  if (enc.status !== 'active') return events;
  enc.time += dt;
  enc.world.time = enc.time;

  // first wave
  if (enc.wave < 0) spawnWave(enc, 0, events);

  // squad updates
  enc.squadCtx.standingCount = standingHeroes(enc);
  for (const h of enc.squad) {
    const fe = updateFighter(h, dt);
    for (const ev of fe) if (ev.type === 'power-move') enc.stats.powerMoves += 1;
    events.push(...fe);
    clampToArena(h, enc.cfg.arena);
  }

  // enemy updates
  enc.world.leaderAlive = enc.enemies.some((e) => e.kind === 'leader' && e.fighter.alive);
  for (const e of enc.enemies) {
    events.push(...updateFighter(e.fighter, dt));
    // thrown enemies hitting a wall wall-splat (§1.3)
    if (e.fighter.thrown && clampToArena(e.fighter, enc.cfg.arena)) {
      wallSplat(e.fighter);
    } else {
      clampToArena(e.fighter, enc.cfg.arena);
    }
    // thrown enemies are PROJECTILES (§1.3): resolve body-vs-enemy collisions here
    resolveThrownBody(enc, e, events);
    const enemyEvents = updateEnemy(e, enc.world, dt, enc.cfg.tier);
    for (const ev of enemyEvents) {
      events.push(ev);
      if (ev.type === 'strike' || ev.type === 'shot') {
        resolveEnemyHit(enc, e, ev.targetId, ev.damage, events);
      } else if (ev.type === 'detained') {
        enc.stats.detainments += 1;
      }
    }
  }

  // token safety: dead/gone holders never keep tokens; the cap is absolute
  reapTokens(enc.tokens, (id) => {
    const holder = enc.enemies.find((e) => e.fighter.id === id);
    return (
      holder !== undefined && holder.fighter.alive && !holder.routed && !holder.gone && holder.mode !== 'abandoned'
    );
  });
  if (liveTokens(enc.tokens) > T.tokens.maxSimultaneousAttackers) {
    throw new Error('token invariant violated'); // impossible by construction; tests lean on this
  }

  // wave flow (§1.5): next wave enters as current drops to 2
  const alive = aliveEnemies(enc).length;
  const hasPendingThisWave = enc.pending.some((s) => s.wave <= enc.wave);
  if (hasPendingThisWave) {
    releasePendingSpawns(enc, events);
  } else if (enc.wave + 1 < enc.waveCount && alive <= T.crowd.nextWaveAtRemaining) {
    spawnWave(enc, enc.wave + 1, events);
  }

  // victory / defeat
  if (aliveEnemies(enc).length === 0 && enc.pending.length === 0) {
    enc.status = 'victory';
    const machineFight = (enc.cfg.family ?? 'human') === 'machine';
    const enemyCount = enc.enemies.length;
    const rating = machineFight ? demolitionRating(enc.stats, enemyCount) : splashRating(enc.stats, enemyCount);
    events.push({
      type: 'victory',
      loot: {
        rating,
        scrap: machineFight ? Math.round(enc.scrap * rating.lootMult) : enc.scrap,
        fluxCells: enc.fluxCells,
        foodPickup: (enc.cfg.priorWipes ?? 0) >= T.rubberBand.wipesToTrigger && T.rubberBand.dropFoodPickup,
      },
    });
  } else if (standingHeroes(enc) === 0) {
    enc.status = 'defeat';
    events.push({ type: 'defeat' });
  }

  return events;
}

/**
 * Thrown-body flight resolution (§1.3: "thrown enemies are projectiles: 1.5×
 * impact damage to anything they hit, knockdown in a 1.5m radius"). Impact
 * damage = impactBaseDamage × projectileImpactMult, attributed to the thrower
 * (power meter, Splash/Demolition stats, crush kills). A flight that kills 2+
 * counts as a chain destruction (§1.9 Demolition).
 */
function resolveThrownBody(enc: Encounter, e: Enemy, events: EncounterEvent[]): void {
  const f = e.fighter;
  const flight = enc.thrownFlights.get(f.id);
  if (!f.thrown || !f.alive) {
    if (flight) {
      if (flight.kills >= 2) enc.stats.chainDestructions += 1;
      enc.thrownFlights.delete(f.id);
    }
    return;
  }
  const fl = flight ?? { hitIds: new Set<string>(), kills: 0 };
  if (!flight) enc.thrownFlights.set(f.id, fl);
  const thrower = enc.squad.find((h) => h.id === f.thrownBy);
  if (!thrower) return;
  const impact = T.throwRules.impactBaseDamage * T.throwRules.projectileImpactMult;
  for (const other of aliveEnemies(enc)) {
    if (other.fighter.id === f.id || fl.hitIds.has(other.fighter.id)) continue;
    if (dist(f.pos, other.fighter.pos) > T.throwRules.collisionRadiusM) continue;
    fl.hitIds.add(other.fighter.id);
    const wasAlive = other.fighter.alive;
    events.push(...heroHitsEnemy(enc, thrower, other, impact, { thrown: true, momentum: true }));
    if (wasAlive && !other.fighter.alive) fl.kills += 1;
    // knockdown ring around the impact (§1.3) — mass topples, leaders/wardens don't
    for (const near of aliveEnemies(enc)) {
      if (near === other || near.fighter.id === f.id) continue;
      if (near.fighter.weightClass === 'unlaunchable') continue;
      if (dist(other.fighter.pos, near.fighter.pos) <= T.throwRules.knockdownRadiusM) {
        near.fighter.state = 'down';
        near.fighter.stateTime = 0;
        near.fighter.downTimer = T.reactions.downSec;
      }
    }
    // the body itself crumples on what it hits
    const selfRes = applyDamage(f, T.throwRules.impactBaseDamage, {});
    events.push(...selfRes.events);
    if (!f.alive) {
      fl.kills += 1; // the projectile dying counts toward the chain
      break;
    }
  }
}

function resolveEnemyHit(enc: Encounter, attacker: Enemy, targetId: string, damage: number, events: EncounterEvent[]): void {
  const target = enc.squad.find((h) => h.id === targetId);
  if (!target || !target.alive) return;
  const mult = machineDamageMult(attacker, targetId, enc.world);
  // grunts fight harder while their leader stands (§1.5)
  const leaderBuff = attacker.kind === 'grunt' && enc.world.leaderAlive ? T.leaderAura.gruntDamageMult : 1;
  enc.squadCtx.standingCount = standingHeroes(enc);
  const res = applyDamage(target, damage * mult * leaderBuff, {}, enc.squadCtx);
  events.push(...res.events);
}

/** Post-fight meter carry (§1.4): power persists between fights at 50% decay. */
export function carryPowerBetweenFights(squad: Fighter[]): void {
  for (const h of squad) h.power = Math.floor(h.power * (1 - T.power.betweenFightDecay));
}

export { ENEMY_CONFIGS };
