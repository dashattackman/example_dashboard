// Enemy archetypes — docs/02 §1.5 (human) + §1.9 (CIVIS machine family).
// DATA-DRIVEN: behavior parameters live in ENEMY_CONFIGS; update functions read
// config, never switch on hard-coded numbers. Pure TS, deterministic (injected Rng).
//
// Machine quirks implemented (§1.9, "decisions, not waves"):
//  1. They obey traffic law — world.trafficHalt freezes machine patrols (ambush windows).
//  2. Zero self-preservation, total directive-preservation — never dodge/flee/adapt,
//     but a spoof beacon makes them abandon the fight instantly.
//  3. They announce everything, honestly — every machine telegraph carries a
//     compliance VO line: machine fights are perfect-information puzzles.
//  4. Mass, not morale — no flinch (armored), immune to Fear, momentum (throw/
//     knockback/crush) does bonus structural damage.

import { content } from '../content';
import type { Fighter, Vec2 } from './fighter';
import { applyDamage, createFighter, type DamageTags } from './fighter';
import type { Rng } from './rng';
import { holdsToken, releaseToken, requestToken, type TokenPool } from './tokens';
import { combatTuning as T } from './tuning';

/** Machine compliance VO — content-is-data: lines live in content/combat.json. */
const ANNOUNCE = content.combat.announce;

export type HumanArchetype = 'grunt' | 'bruiser' | 'ranged' | 'leader';
export type CivisUnit = 'scanner' | 'detainer' | 'bulwark' | 'swarm' | 'wardenHand';
export type EnemyKind = HumanArchetype | CivisUnit;

export interface EnemyConfig {
  kind: EnemyKind;
  family: 'human' | 'machine';
  hpMult: number; // × grunt base (§1.5 / §1.9 tables)
  moveSpeed: number; // m/s
  weightClass: 'light' | 'heavy' | 'unlaunchable';
  armored: boolean; // no flinch on lights
  /** Damage as fraction of player max HP at tier 1 (§1.6: grunt = 12%). */
  damageFracOfPlayerHp: number;
  /** §1.5: >10% player-HP attacks need ≥0.6s telegraph. Validated in tests. */
  telegraphSec: number;
  attackRangeM: number;
  preferredRangeM: number;
  cooldownSec: { min: number; max: number };
  usesMeleeToken: boolean;
  tokenPriority: number;
  fearImmune: boolean; // machines (§1.9 quirk 4)
  /** Eligible for Dread-aura rout (§9.3: human grunt-tier only). */
  routsUnderDread: boolean;
  /** Bosses don't wait in the crowd's strike queue (leader / warden-hand):
   *  exempt from tokens.globalStrikeGapSec — tier-4 heat rides on them. */
  ignoresStrikeGap?: boolean;
  scrapDrop?: { min: number; max: number };
  announceLine?: string; // §1.9 quirk 3 — filled from content/combat.json below
}

const t1 = T.reactions.playerMaxHp;

export const ENEMY_CONFIGS: Record<EnemyKind, EnemyConfig> = {
  // --- human (§1.5) ---
  grunt: {
    kind: 'grunt', family: 'human', hpMult: 1, moveSpeed: 3.5, weightClass: 'light', armored: false,
    damageFracOfPlayerHp: T.ramp.tier1GruntHitHpFrac, // 12% (§1.6)
    telegraphSec: 0.6, attackRangeM: 1.5, preferredRangeM: 1.5,
    cooldownSec: { min: 9, max: 11 }, usesMeleeToken: true, tokenPriority: 1,
    fearImmune: false, routsUnderDread: true,
  },
  bruiser: {
    kind: 'bruiser', family: 'human', hpMult: 4, moveSpeed: 2.2, weightClass: 'heavy', armored: true,
    damageFracOfPlayerHp: 0.2, telegraphSec: 0.8, attackRangeM: 1.8, preferredRangeM: 1.8,
    cooldownSec: { min: 7, max: 9 }, usesMeleeToken: true, tokenPriority: 3,
    fearImmune: false, routsUnderDread: false,
  },
  ranged: {
    kind: 'ranged', family: 'human', hpMult: 1.5, moveSpeed: 3, weightClass: 'light', armored: false,
    damageFracOfPlayerHp: 0.08, telegraphSec: 0.8, // §1.5: telegraphed 0.8s shots
    attackRangeM: 12, preferredRangeM: 8, // §1.5: keeps 8m
    cooldownSec: { min: 7, max: 9 }, usesMeleeToken: false, tokenPriority: 0,
    fearImmune: false, routsUnderDread: false,
  },
  leader: {
    kind: 'leader', family: 'human', hpMult: 8, // §1.5: 8–12×, low end (fight-length budget §1.1)
    moveSpeed: 2.8, weightClass: 'unlaunchable', armored: true,
    damageFracOfPlayerHp: 0.22, telegraphSec: 1, attackRangeM: 2, preferredRangeM: 2,
    cooldownSec: { min: 5, max: 6.5 }, usesMeleeToken: true, tokenPriority: 4,
    fearImmune: false, routsUnderDread: false, ignoresStrikeGap: true,
  },
  // --- CIVIS (§1.9) ---
  scanner: {
    kind: 'scanner', family: 'machine', hpMult: 0.75, moveSpeed: 3, weightClass: 'light', armored: true,
    damageFracOfPlayerHp: 0, telegraphSec: 0, attackRangeM: 0, preferredRangeM: 12, // hangs back, fragile
    cooldownSec: { min: 3, max: 4 }, usesMeleeToken: false, tokenPriority: 0,
    fearImmune: true, routsUnderDread: false, scrapDrop: T.civis.scrapPerUnit,
    announceLine: ANNOUNCE.scanner,
  },
  detainer: {
    kind: 'detainer', family: 'machine', hpMult: 3, moveSpeed: 3.2, weightClass: 'heavy', armored: true,
    damageFracOfPlayerHp: 0.15, telegraphSec: 0.7, attackRangeM: 1.6, preferredRangeM: 1.6,
    cooldownSec: { min: 5, max: 6.5 }, usesMeleeToken: true, tokenPriority: 2,
    fearImmune: true, routsUnderDread: false, scrapDrop: T.civis.scrapPerUnit,
    announceLine: ANNOUNCE.detainer,
  },
  bulwark: {
    kind: 'bulwark', family: 'machine', hpMult: 5, moveSpeed: 1.8, weightClass: 'heavy', armored: true,
    damageFracOfPlayerHp: 0.15, telegraphSec: 0.7, attackRangeM: 2, preferredRangeM: 2,
    cooldownSec: { min: 5.5, max: 7 }, usesMeleeToken: true, tokenPriority: 3,
    fearImmune: true, routsUnderDread: false, scrapDrop: T.civis.scrapPerUnit,
    announceLine: ANNOUNCE.bulwark,
  },
  swarm: {
    kind: 'swarm', family: 'machine', hpMult: 0.2, moveSpeed: 5, weightClass: 'light', armored: false,
    damageFracOfPlayerHp: 0.04, telegraphSec: 0.5, // ≤10% dmg → sub-0.6s telegraph is legal (§1.5 floor is for >10%)
    attackRangeM: 6, preferredRangeM: 5,
    cooldownSec: { min: 3.5, max: 5 }, usesMeleeToken: false, tokenPriority: 0, // dive attacks, not melee-token queue
    fearImmune: true, routsUnderDread: false, scrapDrop: { min: 1, max: 1 },
    announceLine: ANNOUNCE.swarm,
  },
  wardenHand: {
    kind: 'wardenHand', family: 'machine', hpMult: 10, moveSpeed: 2.4, weightClass: 'unlaunchable', armored: true,
    damageFracOfPlayerHp: 0.25, telegraphSec: 0.9, attackRangeM: 3, preferredRangeM: 3,
    cooldownSec: { min: 4.5, max: 5.5 }, usesMeleeToken: true, tokenPriority: 4,
    fearImmune: true, routsUnderDread: false, ignoresStrikeGap: true, scrapDrop: T.civis.wardenScrap,
    announceLine: ANNOUNCE.wardenHand,
  },
};

export type EnemyMode =
  | 'approach'
  | 'strafe'
  | 'telegraph'
  | 'recover'
  | 'reposition'
  | 'carry' // detainer with a captive
  | 'halted' // machine obeying traffic law
  | 'abandoned'; // machine directive pulled it away (spoof beacon)

export interface Civilian {
  id: string;
  pos: Vec2;
  flagged: boolean;
  detained: boolean;
}

/** A Scanner's paint on a squad target — EXPIRES, and clears when the painter
 *  dies (§1.9 counterplay: "kill first, always" has to actually remove the debuff). */
export interface FlagMark {
  expiresAt: number; // world time
  by: string; // scanner fighter id
}

/** The slice of world state enemy behaviors read. Encounter owns and feeds it. */
export interface EnemyWorld {
  time: number;
  rng: Rng;
  tokens: TokenPool;
  squad: Fighter[];
  civilians: Civilian[];
  /** Squad-target Scanner paint (combat +20% flags). Civilian registry flags live on Civilian.flagged. */
  flags: Map<string, FlagMark>;
  /** Captives currently held by SOME Detainer — one carrier per captive, ever.
   *  Grab adds; grip-break/carrier-death remove (encounter wires the removals). */
  claimedCaptives: Set<string>;
  /** Global melee-pacing gate (readable crowds, §1.5): next world time any melee
   *  telegraph may START. Mutated by updateMelee; init 0. */
  nextMeleeAt: number;
  spoofBeaconActive: boolean; // §1.9 quirk 2 exploit (workshop craft)
  trafficHalt: boolean; // §1.9 quirk 1 window
  leaderAlive: boolean;
  exitPoint: Vec2; // where Detainers try to LEAVE — must sit ON the arena boundary
  /** §9.3 Dread aura: human grunt-tier may rout on sight. */
  dreadAura: boolean;
}

/** Is this target currently painted (unexpired flag)? */
export function isFlagged(world: Pick<EnemyWorld, 'flags' | 'time'>, id: string): boolean {
  const mark = world.flags.get(id);
  return mark !== undefined && mark.expiresAt > world.time;
}

/** Painter died → its paint clears (encounter calls on scanner death). */
export function clearFlagsBy(flags: Map<string, FlagMark>, scannerId: string): void {
  for (const [id, mark] of [...flags]) {
    if (mark.by === scannerId) flags.delete(id);
  }
}

export interface Enemy {
  fighter: Fighter;
  kind: EnemyKind;
  cfg: EnemyConfig;
  mode: EnemyMode;
  modeTime: number;
  cooldown: number;
  targetId: string | null;
  routed: boolean;
  /** Permanently out of the fight (left with a captive / walked off to a beacon). */
  gone: boolean;
  /** Approach-arc curve side (±1) — seeded at spawn, never derived from id text. */
  arcSide: 1 | -1;
  // detainer
  carryTargetId: string | null;
  rescueRemaining: number; // §1.9: 20s rescue timer
  gripHits: number;
  // scanner
  flagCooldown: number;
  // bulwark
  shieldFacing: number; // radians
  // leader / warden
  powerCooldown: number;
  powerInFlight: boolean; // leader signature telegraphing right now
  vulnerableTimer: number; // §1.5: +50% damage 3s after power whiff
  announcedHalt: boolean;
}

export type EnemyEvent =
  | { type: 'telegraph'; id: string; kind: EnemyKind; durationSec: number; announce: string | null }
  | { type: 'strike'; id: string; targetId: string; damage: number; tags: DamageTags }
  | { type: 'shot'; id: string; targetId: string; damage: number }
  | { type: 'flagged'; id: string; targetId: string }
  | { type: 'grabbed-captive'; id: string; captiveId: string; rescueSec: number }
  | { type: 'grip-broken'; id: string; captiveId: string }
  | { type: 'detained'; id: string; captiveId: string }
  | { type: 'leader-power'; id: string; whiffed: boolean }
  | { type: 'halted'; id: string }
  | { type: 'abandoned'; id: string }
  | { type: 'routed'; id: string };

/**
 * Determinism rule: NO module-global state. Callers (encounter) supply ids from
 * their own seeded counters and the arc side from their seeded RNG — the same
 * seed must replay identically regardless of process history.
 */
export function createEnemy(
  kind: EnemyKind,
  pos: Vec2,
  opts?: { tier?: number; id?: string; arcSide?: 1 | -1 },
): Enemy {
  const cfg = ENEMY_CONFIGS[kind];
  const tier = opts?.tier ?? 1;
  // §1.6: numeric scaling capped at +15% HP / +20% damage per rep tier past tier 1
  const hpScale = 1 + T.ramp.hpPerTier * (tier - 1);
  const fighter = createFighter({
    id: opts?.id ?? kind,
    team: 'enemy',
    pos,
    maxHp: Math.round(T.reactions.gruntBaseHp * cfg.hpMult * hpScale),
    moveSpeed: cfg.moveSpeed,
    weightClass: cfg.weightClass,
    armored: cfg.armored,
  });
  return {
    fighter, kind, cfg,
    mode: 'approach', modeTime: 0,
    cooldown: 0, targetId: null, routed: false, gone: false,
    arcSide: opts?.arcSide ?? 1,
    carryTargetId: null, rescueRemaining: 0, gripHits: 0,
    flagCooldown: T.civis.scannerFlagIntervalSec,
    shieldFacing: 0,
    powerCooldown: 6, powerInFlight: false, vulnerableTimer: 0,
    announcedHalt: false,
  };
}

/** Attack damage for this enemy at a rep tier (§1.6 damage cap per tier). */
export function enemyDamage(e: Enemy, tier: number): number {
  return t1 * e.cfg.damageFracOfPlayerHp * (1 + T.ramp.dmgPerTier * (tier - 1));
}

// ---------------------------------------------------------------------------
// geometry helpers

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function towards(from: Vec2, to: Vec2): Vec2 {
  const d = dist(from, to);
  if (d < 1e-6) return { x: 1, z: 0 };
  return { x: (to.x - from.x) / d, z: (to.z - from.z) / d };
}

function moveBy(f: Fighter, dir: Vec2, speed: number, dt: number): void {
  f.pos.x += dir.x * speed * dt;
  f.pos.z += dir.z * speed * dt;
  f.facing = Math.atan2(dir.z, dir.x);
}

function nearestStanding(squad: Fighter[], pos: Vec2): Fighter | null {
  let best: Fighter | null = null;
  let bestD = Infinity;
  for (const h of squad) {
    if (!h.alive || h.state === 'down') continue;
    const d = dist(pos, h.pos);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// incoming-damage modifiers

/**
 * Damage multiplier for hits ON this enemy.
 * - Leader post-whiff vulnerability: ×1.5 for 3s (§1.5).
 * - Machine momentum bonus: knockback/throw/crush structural damage (§1.9 quirk 4).
 * - Bulwark frontal shield: 0 from the front unless environmental/thrown (§1.9).
 */
export function damageTakenMult(e: Enemy, tags: DamageTags, attackerPos: Vec2): number {
  if (e.kind === 'bulwark' && bulwarkBlocks(e, attackerPos, tags)) return 0;
  let mult = 1;
  if (e.vulnerableTimer > 0) mult *= 1 + T.leaderAura.powerWhiffDamageTakenBonus;
  if (e.cfg.family === 'machine' && (tags.momentum || tags.thrown || tags.environmental)) {
    mult *= 1 + T.civis.momentumStructuralBonus;
  }
  return mult;
}

/** §1.9: frontal shield — immune from the front; environmental attacks and thrown bodies bypass. */
export function bulwarkBlocks(e: Enemy, attackerPos: Vec2, tags: DamageTags): boolean {
  if (e.kind !== 'bulwark') return false;
  if (tags.environmental || tags.thrown) return false;
  const toAttacker = towards(e.fighter.pos, attackerPos);
  const angle = Math.atan2(toAttacker.z, toAttacker.x);
  let diff = angle - e.shieldFacing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const halfArc = ((T.civis.bulwarkShieldArcDeg / 2) * Math.PI) / 180;
  return Math.abs(diff) <= halfArc;
}

/** Hits on a carrying Detainer strike the arm assembly and loosen the grip (§1.9). */
export function hitDetainerArm(e: Enemy): EnemyEvent[] {
  if (e.kind !== 'detainer' || e.mode !== 'carry' || e.carryTargetId === null) return [];
  e.gripHits += 1;
  if (e.gripHits >= T.civis.detainerGripHits) {
    const captiveId = e.carryTargetId;
    e.carryTargetId = null;
    e.gripHits = 0;
    e.rescueRemaining = 0;
    e.mode = 'recover';
    e.modeTime = 0;
    e.cooldown = 2;
    return [{ type: 'grip-broken', id: e.fighter.id, captiveId }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// behavior update

export function updateEnemy(e: Enemy, world: EnemyWorld, dt: number, tier = 1): EnemyEvent[] {
  const events: EnemyEvent[] = [];
  const f = e.fighter;
  e.modeTime += dt;
  e.cooldown = Math.max(0, e.cooldown - dt);
  e.vulnerableTimer = Math.max(0, e.vulnerableTimer - dt);

  if (!f.alive || e.routed || e.gone) {
    releaseToken(world.tokens, f.id);
    return events;
  }

  // interrupted (hit/launched/thrown/held): give the token back immediately
  if (f.state !== 'idle' && f.state !== 'move') {
    if (e.mode === 'telegraph') {
      e.mode = 'approach';
      e.modeTime = 0;
      e.powerInFlight = false;
      releaseToken(world.tokens, f.id);
    }
    return events;
  }

  // --- §9.3 Dread aura: human grunt-tier may rout on sight; machines don't care ---
  if (world.dreadAura && e.cfg.routsUnderDread && !e.cfg.fearImmune && world.rng.next() < 0.02) {
    e.routed = true;
    releaseToken(world.tokens, f.id);
    events.push({ type: 'routed', id: f.id });
    return events;
  }

  if (e.cfg.family === 'machine') {
    // --- quirk 2: directive-preservation — spoof beacon walks the patrol away ---
    if (world.spoofBeaconActive) {
      if (e.mode !== 'abandoned') {
        e.mode = 'abandoned';
        e.modeTime = 0;
        releaseToken(world.tokens, f.id);
        events.push({ type: 'abandoned', id: f.id });
      }
      moveBy(f, towards(f.pos, world.exitPoint), e.cfg.moveSpeed, dt);
      if (dist(f.pos, world.exitPoint) < 1) e.gone = true; // walked off the board
      return events;
    }
    // an abandoned unit whose beacon dropped mid-walk re-acquires its directive
    if (e.mode === 'abandoned') {
      e.mode = 'approach';
      e.modeTime = 0;
    }
    // --- quirk 1: traffic law — halt at signals (carrying Detainers keep leaving) ---
    if (world.trafficHalt && e.mode !== 'carry') {
      if (e.mode !== 'halted') {
        e.mode = 'halted';
        e.modeTime = 0;
        releaseToken(world.tokens, f.id);
        events.push({ type: 'halted', id: f.id });
      }
      return events;
    }
    if (e.mode === 'halted') {
      e.mode = 'approach';
      e.modeTime = 0;
    }
  }

  switch (e.kind) {
    case 'scanner':
      updateScanner(e, world, dt, events);
      break;
    case 'detainer':
      updateDetainer(e, world, dt, tier, events);
      break;
    case 'ranged':
      updateRanged(e, world, dt, tier, events);
      break;
    case 'swarm':
      updateSwarm(e, world, dt, tier, events);
      break;
    default:
      updateMelee(e, world, dt, tier, events);
      break;
  }

  // bulwark shield tracks the nearest threat at a limited turn rate (flankable)
  if (e.kind === 'bulwark') {
    const target = nearestStanding(world.squad, f.pos);
    if (target) {
      const want = Math.atan2(target.pos.z - f.pos.z, target.pos.x - f.pos.x);
      let diff = want - e.shieldFacing;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const maxTurn = T.civis.bulwarkTurnRateRadPerSec * dt;
      e.shieldFacing += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }
  }

  return events;
}

/** Generic melee flow (grunt / bruiser / leader / bulwark / wardenHand / detainer-pre-grab). */
function updateMelee(e: Enemy, world: EnemyWorld, dt: number, tier: number, events: EnemyEvent[]): void {
  const f = e.fighter;
  const target = nearestStanding(world.squad, f.pos);
  if (!target) return;
  e.targetId = target.id;
  const d = dist(f.pos, target.pos);

  // leader signature power (§1.5): fires on its own clock, big tell
  if (e.kind === 'leader') {
    e.powerCooldown -= dt;
    if (e.powerCooldown <= 0 && e.mode !== 'telegraph') {
      e.mode = 'telegraph';
      e.modeTime = 0;
      e.targetId = target.id;
      e.powerCooldown = 8 + world.rng.next() * 3;
      e.powerInFlight = true;
      events.push({ type: 'telegraph', id: f.id, kind: e.kind, durationSec: 1, announce: null });
      return;
    }
  }

  switch (e.mode) {
    case 'approach': {
      if (d > e.cfg.attackRangeM) {
        // approach in arcs (§1.5): tangential bias so grunts curve in, not beeline;
        // side comes from spawn-time seeded RNG (determinism rule — never from id text)
        const dir = towards(f.pos, target.pos);
        const side = e.arcSide;
        const arc = { x: dir.x - side * dir.z * 0.4, z: dir.z + side * dir.x * 0.4 };
        moveBy(f, towards({ x: 0, z: 0 }, arc), e.cfg.moveSpeed, dt);
        return;
      }
      const gapGated = e.cfg.usesMeleeToken && !e.cfg.ignoresStrikeGap && world.time < world.nextMeleeAt;
      if (e.cooldown > 0 || gapGated) {
        e.mode = 'strafe';
        e.modeTime = 0;
        return;
      }
      const grant = e.cfg.usesMeleeToken
        ? requestToken(world.tokens, f.id, e.cfg.tokenPriority)
        : ({ granted: true, stolenFrom: null } as const);
      if (grant.granted) {
        if (e.cfg.usesMeleeToken && !e.cfg.ignoresStrikeGap) world.nextMeleeAt = world.time + T.tokens.globalStrikeGapSec;
        e.mode = 'telegraph';
        e.modeTime = 0;
        events.push({
          type: 'telegraph', id: f.id, kind: e.kind, durationSec: e.cfg.telegraphSec,
          announce: e.cfg.family === 'machine' ? (e.cfg.announceLine ?? null) : null,
        });
      } else {
        e.mode = 'strafe';
        e.modeTime = 0;
      }
      return;
    }
    case 'strafe': {
      // circle at range, waiting for a token or cooldown
      const dir = towards(f.pos, target.pos);
      const tangent = { x: -dir.z, z: dir.x };
      moveBy(f, tangent, e.cfg.moveSpeed * 0.5, dt);
      if (e.modeTime > 0.6) {
        e.mode = 'approach';
        e.modeTime = 0;
      }
      return;
    }
    case 'telegraph': {
      // a stolen token cancels the swing MID-TELEGRAPH — the cap on simultaneous
      // strikes is absolute, not just on entry (red-team finding #5).
      // Leader signature powers are not melee-token swings and are exempt.
      if (e.cfg.usesMeleeToken && !e.powerInFlight && !holdsToken(world.tokens, f.id)) {
        e.mode = 'approach';
        e.modeTime = 0;
        e.powerInFlight = false;
        return;
      }
      const isLeaderPower = e.kind === 'leader' && e.powerInFlight;
      const teleLen = isLeaderPower ? 1 : e.cfg.telegraphSec;
      if (e.modeTime < teleLen) return;
      // resolve
      const inRange = dist(f.pos, target.pos) <= e.cfg.attackRangeM + 0.5;
      const dodged = target.iframeTimer > 0;
      if (isLeaderPower) {
        const whiffed = !inRange || dodged;
        if (whiffed) e.vulnerableTimer = T.leaderAura.powerWhiffVulnerableSec; // §1.5: +50% dmg taken 3s
        else events.push({ type: 'strike', id: f.id, targetId: target.id, damage: enemyDamage(e, tier) * 1.5, tags: {} });
        events.push({ type: 'leader-power', id: f.id, whiffed });
        e.powerInFlight = false;
      } else if (inRange && !dodged) {
        events.push({ type: 'strike', id: f.id, targetId: target.id, damage: enemyDamage(e, tier), tags: {} });
      }
      if (e.cfg.usesMeleeToken) releaseToken(world.tokens, f.id);
      e.mode = 'recover';
      e.modeTime = 0;
      e.cooldown = e.cfg.cooldownSec.min + world.rng.next() * (e.cfg.cooldownSec.max - e.cfg.cooldownSec.min);
      // detainer: a landed strike on a downed hero transitions to carry (handled by encounter via tryStartCarry)
      return;
    }
    case 'recover': {
      if (e.modeTime > 0.4) {
        e.mode = 'approach';
        e.modeTime = 0;
      }
      return;
    }
    default:
      e.mode = 'approach';
      e.modeTime = 0;
  }
}

/** Ranged (§1.5): keeps 8m, telegraphed 0.8s shots, repositions when approached. */
function updateRanged(e: Enemy, world: EnemyWorld, dt: number, tier: number, events: EnemyEvent[]): void {
  const f = e.fighter;
  const target = nearestStanding(world.squad, f.pos);
  if (!target) return;
  const d = dist(f.pos, target.pos);

  if (e.mode === 'telegraph') {
    if (e.modeTime >= e.cfg.telegraphSec) {
      if (target.iframeTimer <= 0 && d <= e.cfg.attackRangeM) {
        events.push({ type: 'shot', id: f.id, targetId: target.id, damage: enemyDamage(e, tier) });
      }
      e.mode = 'recover';
      e.modeTime = 0;
      e.cooldown = e.cfg.cooldownSec.min + world.rng.next() * (e.cfg.cooldownSec.max - e.cfg.cooldownSec.min);
    }
    return;
  }
  if (d < e.cfg.preferredRangeM - 2) {
    // approached → reposition away
    e.mode = 'reposition';
    const away = towards(target.pos, f.pos);
    moveBy(f, away, e.cfg.moveSpeed, dt);
    return;
  }
  if (e.mode === 'reposition') {
    e.mode = 'approach';
    e.modeTime = 0;
  }
  if (d > e.cfg.attackRangeM) {
    moveBy(f, towards(f.pos, target.pos), e.cfg.moveSpeed, dt);
    return;
  }
  if (e.cooldown <= 0) {
    e.mode = 'telegraph';
    e.modeTime = 0;
    events.push({ type: 'telegraph', id: f.id, kind: e.kind, durationSec: e.cfg.telegraphSec, announce: null });
  }
}

/** Scanner (§1.9): hangs back, paints targets — +20% damage from machines,
 *  Detainers path to them. Paint EXPIRES (8s) and is refreshed while the
 *  scanner lives; killing the scanner clears its paint (encounter wires that).
 *  "Kill first, always" is real counterplay, not a permanent debuff. */
function updateScanner(e: Enemy, world: EnemyWorld, dt: number, events: EnemyEvent[]): void {
  const f = e.fighter;
  const target = nearestStanding(world.squad, f.pos);
  if (target) {
    const d = dist(f.pos, target.pos);
    if (d < e.cfg.preferredRangeM) moveBy(f, towards(target.pos, f.pos), e.cfg.moveSpeed, dt); // back away
  }
  e.flagCooldown -= dt;
  if (e.flagCooldown <= 0) {
    // paint (or refresh) the nearest standing squad member, else register-flag a civilian
    const civTarget = world.civilians.find((c) => !c.flagged && !c.detained);
    if (target) {
      const fresh = !isFlagged(world, target.id);
      world.flags.set(target.id, { expiresAt: world.time + T.civis.scannerFlagDurationSec, by: f.id });
      if (fresh) events.push({ type: 'flagged', id: f.id, targetId: target.id });
    } else if (civTarget) {
      civTarget.flagged = true;
      events.push({ type: 'flagged', id: f.id, targetId: civTarget.id });
    }
    e.flagCooldown = T.civis.scannerFlagIntervalSec;
  }
}

/** Detainer (§1.9): grabs a flagged NPC or downed squadmate and tries to LEAVE.
 *  20s rescue timer, never a DPS race; carrying slows it 30%. */
function updateDetainer(e: Enemy, world: EnemyWorld, dt: number, tier: number, events: EnemyEvent[]): void {
  const f = e.fighter;

  if (e.mode === 'carry' && e.carryTargetId !== null) {
    e.rescueRemaining -= dt;
    const speed = e.cfg.moveSpeed * (1 - T.civis.detainerCarrySlow);
    moveBy(f, towards(f.pos, world.exitPoint), speed, dt);
    const atExit = dist(f.pos, world.exitPoint) < 1;
    if (e.rescueRemaining <= 0 || atExit) {
      const captiveId = e.carryTargetId;
      const civ = world.civilians.find((c) => c.id === captiveId);
      if (civ) civ.detained = true;
      e.carryTargetId = null;
      e.gone = true; // it LEAVES with the captive — permanently out, never re-engages
      releaseToken(world.tokens, f.id);
      events.push({ type: 'detained', id: f.id, captiveId });
    }
    return;
  }

  // pick a directive target: flagged civilian first, then a downed squadmate.
  // Skip anyone another Detainer already carries — one carrier per captive.
  const civ = world.civilians.find((c) => c.flagged && !c.detained && !world.claimedCaptives.has(c.id));
  const downedHero = world.squad.find((h) => (h.state === 'down' || !h.alive) && !world.claimedCaptives.has(h.id));
  const captivePos = civ ? civ.pos : downedHero ? downedHero.pos : null;

  if (captivePos !== null) {
    const d = dist(f.pos, captivePos);
    if (d > 1) {
      moveBy(f, towards(f.pos, captivePos), e.cfg.moveSpeed, dt);
      return;
    }
    // grab-and-carry begins; the 20s rescue window opens
    const captiveId = civ ? civ.id : (downedHero as Fighter).id;
    e.carryTargetId = captiveId;
    world.claimedCaptives.add(captiveId);
    e.gripHits = 0;
    e.rescueRemaining = T.civis.detainerRescueSec;
    e.mode = 'carry';
    e.modeTime = 0;
    events.push({ type: 'grabbed-captive', id: f.id, captiveId, rescueSec: T.civis.detainerRescueSec });
    return;
  }
  // no directive target → ordinary token melee
  updateMelee(e, world, dt, tier, events);
}

/** Swarm drone (§1.9): telegraphed dive attacks, dodge practice, satisfying pops. */
function updateSwarm(e: Enemy, world: EnemyWorld, dt: number, tier: number, events: EnemyEvent[]): void {
  const f = e.fighter;
  const target = nearestStanding(world.squad, f.pos);
  if (!target) return;
  const d = dist(f.pos, target.pos);

  if (e.mode === 'telegraph') {
    if (e.modeTime >= e.cfg.telegraphSec) {
      // dive through the target point
      if (target.iframeTimer <= 0 && dist(f.pos, target.pos) <= e.cfg.attackRangeM) {
        events.push({ type: 'strike', id: f.id, targetId: target.id, damage: enemyDamage(e, tier), tags: {} });
      }
      e.mode = 'recover';
      e.modeTime = 0;
      e.cooldown = e.cfg.cooldownSec.min + world.rng.next() * (e.cfg.cooldownSec.max - e.cfg.cooldownSec.min);
    }
    return;
  }
  if (e.mode === 'recover') {
    if (e.modeTime > 0.5) {
      e.mode = 'approach';
      e.modeTime = 0;
    }
    return;
  }
  if (d > e.cfg.attackRangeM) {
    moveBy(f, towards(f.pos, target.pos), e.cfg.moveSpeed, dt);
    return;
  }
  if (e.cooldown <= 0) {
    e.mode = 'telegraph';
    e.modeTime = 0;
    events.push({
      type: 'telegraph', id: f.id, kind: e.kind, durationSec: e.cfg.telegraphSec,
      announce: e.cfg.announceLine ?? null,
    });
  }
}

/** Scrap drop roll (§1.9: 2–5/unit; Warden-hand 12–20 + 5 flux cells). */
export function rollScrap(kind: EnemyKind, rng: Rng): { scrap: number; fluxCells: number } {
  const cfg = ENEMY_CONFIGS[kind];
  if (!cfg.scrapDrop) return { scrap: 0, fluxCells: 0 };
  const scrap = rng.int(cfg.scrapDrop.min, cfg.scrapDrop.max);
  return { scrap, fluxCells: kind === 'wardenHand' ? T.civis.wardenFluxCells : 0 };
}

/** Apply a strike/shot to a squad target, honoring Scanner flags (§1.9: flagged
 *  targets take +20% damage FROM MACHINES — only while the paint is live). */
export function machineDamageMult(
  attacker: Enemy,
  targetId: string,
  world: Pick<EnemyWorld, 'flags' | 'time'>,
): number {
  if (attacker.cfg.family === 'machine' && isFlagged(world, targetId)) return 1 + T.civis.scannerFlagDamageBonus;
  return 1;
}

export { applyDamage };
