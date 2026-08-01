// Fighter FSM — pure TS, no Babylon (docs/05 module rule 1). Rendering reads this
// state later; nothing here reads rendering. All time advances via update(dt);
// the fighter carries its own fight clock (f.clock) so logic is deterministic.
//
// Canon: docs/02 §1.3 (combo/launcher/juggle/throw), §1.4 (meters + second wind),
// §1.2 (250ms input buffer). Numbers come from combatTuning only.

import { combatTuning as T } from './tuning';

export interface Vec2 {
  x: number;
  z: number;
}

export type Team = 'squad' | 'enemy';

/** Launch behavior per docs/02 §1.3: light = pops on one launcher; heavy = needs
 *  2 launchers within 3s ("heavy launch"); unlaunchable = leaders, stagger only. */
export type WeightClass = 'light' | 'heavy' | 'unlaunchable';

export type FighterStateName =
  | 'idle'
  | 'move'
  | 'attack'
  | 'hit'
  | 'launch' // rising after a launcher pop
  | 'juggle' // airborne juggle window
  | 'down'
  | 'grab' // holder (holdingId set) or victim (heldById set)
  | 'dodge';

export type AttackKind = 'light' | 'heavy' | 'power';
export type AttackPhase = 'startup' | 'active' | 'recovery';

export type FighterCommand =
  | { type: 'light' }
  | { type: 'heavy' }
  | { type: 'dodge'; dir: Vec2 }
  | { type: 'power' };

export interface Fighter {
  id: string;
  team: Team;
  pos: Vec2;
  facing: number; // radians, 0 = +x
  moveSpeed: number; // m/s
  maxHp: number;
  hp: number;
  alive: boolean;
  stamina: number; // 0..1
  power: number; // 0..100
  weightClass: WeightClass;
  /** No flinch on light hits (bruisers §1.5; machines §1.9 quirk 4). */
  armored: boolean;
  state: FighterStateName;
  stateTime: number;
  clock: number; // per-fight clock, seconds
  // -- attack sub-state --
  attackKind: AttackKind | null;
  attackPhase: AttackPhase;
  chainIndex: number; // 0..2 within the light chain
  // -- input buffer (§1.2: 250ms) --
  buffered: FighterCommand | null;
  bufferedAt: number;
  // -- stamina bookkeeping (§1.4) --
  sinceStaminaSpend: number;
  regenLock: number; // hit-interrupt lock, counts down
  /** Fraction of stamina regen reserved by running echo threads (§1.8). 0 for everyone but the Anchor. */
  regenReservation: number;
  // -- air / launch (§1.3) --
  airTimer: number;
  launcherTouches: number[]; // clock times of launcher hits (heavy-launch window)
  thrown: boolean;
  throwDir: Vec2;
  throwTimer: number;
  // -- reactions --
  stunTimer: number; // hit-stun / wall-splat stun; grabbable while > 0
  downTimer: number;
  iframeTimer: number; // dodge i-frames + second-wind invulnerability
  // -- grabs --
  holdingId: string | null;
  heldById: string | null;
  dodgeDir: Vec2;
}

export type FighterEvent =
  | { type: 'attack-active'; id: string; kind: AttackKind; chainIndex: number; damage: number; knockback: boolean }
  | { type: 'chain-advance'; id: string; chainIndex: number }
  | { type: 'buffer-expired'; id: string }
  | { type: 'dodge'; id: string }
  | { type: 'launched'; id: string }
  | { type: 'staggered'; id: string }
  | { type: 'juggle-hit'; id: string; damage: number }
  | { type: 'second-wind'; id: string }
  | { type: 'ko'; id: string }
  | { type: 'grab'; id: string; targetId: string }
  | { type: 'thrown'; id: string; byId: string }
  | { type: 'power-move'; id: string };

/** Squad-scoped bookkeeping. Second wind is once per BRAWL (§1.4), not per hero. */
export interface SquadContext {
  secondWindUsed: boolean;
  /** Standing squad heroes BEFORE this damage is applied. */
  standingCount: number;
}

export interface DamageTags {
  light?: boolean;
  launcher?: boolean;
  thrown?: boolean;
  environmental?: boolean;
  /** Machine-fight momentum bonus applies to these (§1.9 quirk 4) — set by encounter. */
  momentum?: boolean;
}

export interface FighterInit {
  id: string;
  team: Team;
  pos?: Vec2;
  facing?: number;
  maxHp?: number;
  moveSpeed?: number;
  weightClass?: WeightClass;
  armored?: boolean;
}

export function createFighter(init: FighterInit): Fighter {
  return {
    id: init.id,
    team: init.team,
    pos: init.pos ?? { x: 0, z: 0 },
    facing: init.facing ?? 0,
    moveSpeed: init.moveSpeed ?? 4,
    maxHp: init.maxHp ?? T.reactions.playerMaxHp,
    hp: init.maxHp ?? T.reactions.playerMaxHp,
    alive: true,
    stamina: 1,
    power: 0,
    weightClass: init.weightClass ?? 'light',
    armored: init.armored ?? false,
    state: 'idle',
    stateTime: 0,
    clock: 0,
    attackKind: null,
    attackPhase: 'startup',
    chainIndex: 0,
    buffered: null,
    bufferedAt: 0,
    sinceStaminaSpend: Infinity,
    regenLock: 0,
    regenReservation: 0,
    airTimer: 0,
    launcherTouches: [],
    thrown: false,
    throwDir: { x: 1, z: 0 },
    throwTimer: 0,
    stunTimer: 0,
    downTimer: 0,
    iframeTimer: 0,
    holdingId: null,
    heldById: null,
    dodgeDir: { x: 1, z: 0 },
  };
}

// ---------------------------------------------------------------------------
// helpers

function norm(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  return len < 1e-6 ? { x: 1, z: 0 } : { x: v.x / len, z: v.z / len };
}

function canAct(f: Fighter): boolean {
  return f.alive && (f.state === 'idle' || f.state === 'move') && f.stunTimer <= 0 && f.heldById === null;
}

/** §1.3 "each hit cancels into dodge or power" — cancel window opens once the
 *  hit's active frames are done (recovery), never during startup/active. */
function inCancelWindow(f: Fighter): boolean {
  return f.state === 'attack' && f.attackPhase === 'recovery';
}

function spendStamina(f: Fighter, cost: number): boolean {
  if (f.stamina < cost) return false;
  f.stamina -= cost;
  f.sinceStaminaSpend = 0;
  return true;
}

function lightTiming(chainIndex: number): { startup: number; recovery: number; damage: number } {
  const c = T.lightChain;
  return {
    startup: c.startupSec[chainIndex] ?? 0.08,
    recovery: c.recoverySec[chainIndex] ?? 0.18,
    damage: c.damage[chainIndex] ?? 10,
  };
}

function startAttack(f: Fighter, kind: AttackKind, chainIndex: number): void {
  f.state = 'attack';
  f.stateTime = 0;
  f.attackKind = kind;
  f.attackPhase = 'startup';
  f.chainIndex = chainIndex;
}

// ---------------------------------------------------------------------------
// commands (buffered per §1.2: taps buffer 250ms; a tap during a combo queues the next hit)

export function command(f: Fighter, cmd: FighterCommand): void {
  if (!f.alive) return;
  switch (cmd.type) {
    case 'light':
      if (canAct(f)) {
        startAttack(f, 'light', 0);
        return;
      }
      break;
    case 'heavy':
      if (canAct(f)) {
        if (spendStamina(f, T.launcher.staminaCost)) startAttack(f, 'heavy', 0);
        return; // insufficient stamina = no-op, never a buffered surprise
      }
      break;
    case 'dodge':
      if (canAct(f) || inCancelWindow(f)) {
        tryDodge(f, cmd.dir);
        return;
      }
      break;
    case 'power':
      if (canAct(f) || inCancelWindow(f)) {
        tryPower(f);
        return;
      }
      break;
  }
  // not actionable now → buffer it (overwrites older buffer; newest intent wins)
  f.buffered = cmd;
  f.bufferedAt = f.clock;
}

function tryDodge(f: Fighter, dir: Vec2): boolean {
  if (!spendStamina(f, T.dodge.staminaCost)) return false;
  f.state = 'dodge';
  f.stateTime = 0;
  f.attackKind = null;
  f.dodgeDir = norm(dir);
  f.iframeTimer = Math.max(f.iframeTimer, T.dodge.iframeSec);
  return true;
}

function tryPower(f: Fighter): boolean {
  if (f.power < T.power.moveCost) return false;
  f.power -= T.power.moveCost;
  // Power moves proper are data-driven (powers.ts, M4); the FSM slot behaves
  // like a single-hit attack so cancel/buffer rules are real now.
  startAttack(f, 'power', 0);
  return true;
}

/** Movement intent; only applies in idle/move. dir=null stops. */
export function setMoveInput(f: Fighter, dir: Vec2 | null): void {
  if (!canAct(f)) return;
  if (dir === null || (dir.x === 0 && dir.z === 0)) {
    f.state = 'idle';
    return;
  }
  const d = norm(dir);
  f.state = 'move';
  f.dodgeDir = d; // reuse as current move dir
  f.facing = Math.atan2(d.z, d.x);
}

// ---------------------------------------------------------------------------
// grabs & throws (§1.3)

/** Grab requires a stunned/grabbable target (§1.2 context override, §1.3). */
export function tryGrab(attacker: Fighter, target: Fighter): boolean {
  if (!canAct(attacker) || !target.alive) return false;
  const grabbable = target.stunTimer > 0 || target.state === 'hit';
  if (!grabbable) return false;
  attacker.state = 'grab';
  attacker.stateTime = 0;
  attacker.holdingId = target.id;
  target.state = 'grab';
  target.stateTime = 0;
  target.heldById = attacker.id;
  return true;
}

export interface ThrownBody {
  targetId: string;
  dir: Vec2;
  distanceM: number;
  flightSec: number;
  /** §1.3: thrown enemies are projectiles — 1.5× impact damage, 1.5m knockdown radius. */
  impactMult: number;
  knockdownRadiusM: number;
}

/** Throw the held target in stick direction. Costs 20% stamina (§1.4). */
export function throwHeld(attacker: Fighter, target: Fighter, dir: Vec2): ThrownBody | null {
  if (attacker.holdingId !== target.id || target.heldById !== attacker.id) return null;
  if (!spendStamina(attacker, T.throwRules.staminaCost)) return null;
  attacker.holdingId = null;
  attacker.state = 'idle';
  attacker.stateTime = 0;
  target.heldById = null;
  target.thrown = true;
  target.throwDir = norm(dir);
  target.throwTimer = T.throwRules.flightSec;
  target.state = 'launch';
  target.stateTime = 0;
  return {
    targetId: target.id,
    dir: target.throwDir,
    distanceM: T.throwRules.distanceM,
    flightSec: T.throwRules.flightSec,
    impactMult: T.throwRules.projectileImpactMult,
    knockdownRadiusM: T.throwRules.knockdownRadiusM,
  };
}

/** Wall-splat: encounter calls this when a thrown body meets an arena wall (§1.3). */
export function wallSplat(target: Fighter): void {
  target.thrown = false;
  target.throwTimer = 0;
  target.state = 'hit';
  target.stateTime = 0;
  target.stunTimer = T.throwRules.wallSplatStunSec;
}

// ---------------------------------------------------------------------------
// damage

export interface DamageResult {
  dealt: number;
  wasJuggle: boolean;
  events: FighterEvent[];
}

function isAirborne(f: Fighter): boolean {
  return f.state === 'launch' || f.state === 'juggle';
}

/**
 * Apply damage. Handles: dodge/second-wind i-frames, juggle bonus (+25% §1.3),
 * armor (no flinch on lights §1.5), launcher weight rules (§1.3), and the
 * EXACT second-wind rule (§1.4): when the LAST STANDING hero would drop below
 * 1 HP they survive at 1 HP with 2s invulnerability — once per brawl, no heal,
 * no other trigger conditions.
 */
export function applyDamage(target: Fighter, amount: number, tags: DamageTags = {}, squad?: SquadContext): DamageResult {
  const events: FighterEvent[] = [];
  if (!target.alive || target.iframeTimer > 0) return { dealt: 0, wasJuggle: false, events };

  const wasJuggle = isAirborne(target) && !target.thrown;
  let dealt = amount;
  if (wasJuggle) {
    dealt *= 1 + T.juggle.damageBonus;
    events.push({ type: 'juggle-hit', id: target.id, damage: dealt });
  }

  // --- second wind (squad only, exact rule §1.4) ---
  if (
    target.team === 'squad' &&
    squad !== undefined &&
    !squad.secondWindUsed &&
    squad.standingCount === 1 &&
    target.hp - dealt < 1
  ) {
    target.hp = 1;
    target.iframeTimer = T.secondWind.invulnSec;
    squad.secondWindUsed = true;
    events.push({ type: 'second-wind', id: target.id });
    // still interrupts regen (§1.4: getting hit interrupts stamina regen 1.5s)
    target.regenLock = T.stamina.hitRegenLockSec;
    return { dealt, wasJuggle, events };
  }

  target.hp -= dealt;
  target.regenLock = T.stamina.hitRegenLockSec;
  // power from taking damage (§1.4: 0.5 / point of HP lost)
  target.power = Math.min(T.power.max, target.power + dealt * T.power.perHpLostTaken);

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.state = 'down';
    target.stateTime = 0;
    target.holdingId = null;
    target.heldById = null;
    events.push({ type: 'ko', id: target.id });
    return { dealt, wasJuggle, events };
  }

  // --- reaction ---
  if (tags.launcher) {
    applyLauncher(target, events);
  } else if (wasJuggle) {
    // stays airborne; airTimer unchanged (fixed 1.2s window — juggle hits do not extend it)
  } else if (tags.light && target.armored) {
    // §1.5 bruiser / §1.9 machines: no flinch on lights — damage only
  } else if (!isAirborne(target)) {
    target.state = 'hit';
    target.stateTime = 0;
    target.stunTimer = Math.max(target.stunTimer, T.reactions.hitStunSec);
    target.attackKind = null;
    target.buffered = null;
  }
  return { dealt, wasJuggle, events };
}

/** Launcher weight rules, §1.3. */
function applyLauncher(target: Fighter, events: FighterEvent[]): void {
  switch (target.weightClass) {
    case 'light':
      launch(target, events);
      break;
    case 'heavy': {
      target.launcherTouches.push(target.clock);
      const windowStart = target.clock - T.launcher.heavyLaunchWindowSec;
      target.launcherTouches = target.launcherTouches.filter((t) => t >= windowStart);
      if (target.launcherTouches.length >= T.launcher.heavyLaunchHits) {
        target.launcherTouches = [];
        launch(target, events); // "heavy launch"
      }
      break;
    }
    case 'unlaunchable':
      // leaders: staggered, never launched
      target.state = 'hit';
      target.stateTime = 0;
      target.stunTimer = Math.max(target.stunTimer, T.launcher.leaderStaggerSec);
      events.push({ type: 'staggered', id: target.id });
      break;
  }
}

function launch(target: Fighter, events: FighterEvent[]): void {
  target.state = 'launch';
  target.stateTime = 0;
  target.airTimer = T.launcher.juggleAirtimeSec;
  target.thrown = false;
  events.push({ type: 'launched', id: target.id });
}

/** Power gain for the ATTACKER when a hit lands (§1.4 table — table wins:
 *  1/light, 3/juggle hit, 4/throw impact). */
export function powerGainForHit(attacker: Fighter, tags: DamageTags, wasJuggle: boolean): number {
  let gain = 0;
  if (tags.thrown) gain = T.power.perThrowImpact;
  else if (wasJuggle) gain = T.power.perJuggleHit;
  else gain = T.power.perLightHit;
  attacker.power = Math.min(T.power.max, attacker.power + gain);
  return gain;
}

// ---------------------------------------------------------------------------
// update

export function updateFighter(f: Fighter, dt: number): FighterEvent[] {
  const events: FighterEvent[] = [];
  f.clock += dt;
  f.stateTime += dt;
  f.iframeTimer = Math.max(0, f.iframeTimer - dt);
  f.stunTimer = Math.max(0, f.stunTimer - dt);
  f.regenLock = Math.max(0, f.regenLock - dt);
  f.sinceStaminaSpend += dt;

  // stamina regen (§1.4): 20%/s after 1s of not spending; hit locks it 1.5s;
  // echo threads reserve a fraction of the REGEN RATE (§1.8), not the bar.
  if (f.alive && f.sinceStaminaSpend >= T.stamina.regenDelaySec && f.regenLock <= 0 && f.stamina < 1) {
    const rate = T.stamina.regenPerSec * (1 - f.regenReservation);
    f.stamina = Math.min(1, f.stamina + rate * dt);
  }

  // expire stale buffer (§1.2: 250ms)
  if (f.buffered !== null && f.clock - f.bufferedAt > T.input.bufferSec) {
    f.buffered = null;
    events.push({ type: 'buffer-expired', id: f.id });
  }

  if (!f.alive) return events;

  switch (f.state) {
    case 'move': {
      f.pos.x += f.dodgeDir.x * f.moveSpeed * dt;
      f.pos.z += f.dodgeDir.z * f.moveSpeed * dt;
      break;
    }
    case 'attack':
      updateAttack(f, events);
      break;
    case 'dodge': {
      const speed = T.dodge.distanceM / T.dodge.durationSec;
      f.pos.x += f.dodgeDir.x * speed * dt;
      f.pos.z += f.dodgeDir.z * speed * dt;
      if (f.stateTime >= T.dodge.durationSec) {
        f.state = 'idle';
        f.stateTime = 0;
      }
      break;
    }
    case 'hit':
      if (f.stunTimer <= 0) {
        f.state = 'idle';
        f.stateTime = 0;
      }
      break;
    case 'launch':
      if (f.thrown) {
        // projectile flight (§1.3): encounter checks collisions along the way
        const speed = T.throwRules.distanceM / T.throwRules.flightSec;
        f.pos.x += f.throwDir.x * speed * dt;
        f.pos.z += f.throwDir.z * speed * dt;
        f.throwTimer -= dt;
        if (f.throwTimer <= 0) {
          f.thrown = false;
          f.state = 'down';
          f.stateTime = 0;
          f.downTimer = T.reactions.downSec;
        }
      } else {
        // brief rise, then juggle window
        if (f.stateTime >= 0.15) {
          f.state = 'juggle';
          f.stateTime = 0;
        }
      }
      break;
    case 'juggle':
      f.airTimer -= dt;
      if (f.airTimer <= 0) {
        f.state = 'down';
        f.stateTime = 0;
        f.downTimer = T.reactions.downSec;
      }
      break;
    case 'down':
      f.downTimer -= dt;
      if (f.downTimer <= 0 && f.alive) {
        f.state = 'idle';
        f.stateTime = 0;
      }
      break;
    case 'idle':
    case 'grab':
      break;
  }

  // consume buffered command the moment we're actionable again
  if (f.buffered !== null && (canAct(f) || inCancelWindow(f))) {
    const cmd = f.buffered;
    // during recovery only dodge/power cancel; light waits for chain-advance below
    if (canAct(f) || cmd.type === 'dodge' || cmd.type === 'power') {
      f.buffered = null;
      command(f, cmd);
    }
  }

  return events;
}

function updateAttack(f: Fighter, events: FighterEvent[]): void {
  const kind = f.attackKind ?? 'light';
  const timing =
    kind === 'light'
      ? lightTiming(f.chainIndex)
      : { startup: T.launcher.startupSec, recovery: T.launcher.recoverySec, damage: T.launcher.damage };

  switch (f.attackPhase) {
    case 'startup':
      if (f.stateTime >= timing.startup) {
        f.attackPhase = 'active';
        f.stateTime = 0;
        events.push({
          type: 'attack-active',
          id: f.id,
          kind,
          chainIndex: f.chainIndex,
          damage: timing.damage,
          knockback: kind === 'light' && f.chainIndex === T.lightChain.hits - 1 && T.lightChain.thirdHitKnockback,
        });
        if (kind === 'power') events.push({ type: 'power-move', id: f.id });
      }
      break;
    case 'active':
      if (f.stateTime >= T.lightChain.activeSec) {
        f.attackPhase = 'recovery';
        f.stateTime = 0;
      }
      break;
    case 'recovery':
      if (f.stateTime >= timing.recovery) {
        // chain: a buffered light during the combo queues the next hit (§1.2)
        if (kind === 'light' && f.buffered?.type === 'light' && f.chainIndex < T.lightChain.hits - 1) {
          f.buffered = null;
          startAttack(f, 'light', f.chainIndex + 1);
          events.push({ type: 'chain-advance', id: f.id, chainIndex: f.chainIndex });
        } else {
          f.state = 'idle';
          f.stateTime = 0;
          f.attackKind = null;
        }
      }
      break;
  }
}
