// Shared scripted-bout driver for the pacing regression suite and ad-hoc
// probes (NOT a test file). Mash bot + skill bot over the real combat modules;
// fully deterministic (seeded encounters, fixed 30Hz step, no Math.random).
import {
  heroHitsEnemy,
  swapControlled,
  updateEncounter,
  type Encounter,
  type EncounterEvent,
  type Grade,
} from '../../../../src/combat/encounter';
import type { Enemy } from '../../../../src/combat/enemies';
import {
  command,
  createFighter,
  setMoveInput,
  throwHeld,
  tryGrab,
  type DamageTags,
  type Fighter,
  type Vec2,
} from '../../../../src/combat/fighter';
import { combatTuning as T } from '../../../../src/combat/tuning';

export const GRADE_INDEX: Record<Grade, number> = { D: 0, C: 1, B: 2, A: 3, S: 4 };

const DT = 1 / 30;
const ARENA = { minX: -12, maxX: 12, minZ: -5, maxZ: 5 };
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * At-tier squad: rep tiers arrive WITH hero progression (docs/02 §2.1 — Raw
 * Power nodes are +8% damage / +10% HP each; a tier-4 player has most of a
 * branch). The bots model that: +25% damage and +15% HP per tier past 1.
 * Without this the sim pits a naked hour-one squad against tier-4 spawns,
 * which is not a state the game produces (§2.3: rep gates content by play time).
 */
export function tierDmgMult(tier: number): number {
  return 1 + 0.25 * (tier - 1);
}

export function makeSquad(tier: 1 | 2 | 3 | 4 = 1): Fighter[] {
  const hp = Math.round(100 * (1 + 0.15 * (tier - 1)));
  return [
    createFighter({ id: 'anchor', team: 'squad', pos: { x: -8, z: 0 }, moveSpeed: 4, maxHp: hp }),
    createFighter({ id: 'ally1', team: 'squad', pos: { x: -9, z: 1.5 }, moveSpeed: 4, maxHp: hp }),
    createFighter({ id: 'ally2', team: 'squad', pos: { x: -9, z: -1.5 }, moveSpeed: 4, maxHp: hp }),
  ];
}

export interface BoutResult {
  timeSec: number;
  status: 'victory' | 'defeat' | 'stall';
  grade: Grade | '-';
  score: number;
  detainments: number;
  dodges: number;
  dodgeDenied: number;
  dmgTaken: number;
  civilianSaved: boolean;
}

export type Policy = 'mash' | 'skill';

export interface BoutOpts {
  /** Trace hook for probes. */
  onEvent?: (t: number, ev: EncounterEvent) => void;
  intercept?: boolean;
  reservation?: number; // pin the Anchor's thread reservation (finding #10 probe)
  noSwap?: boolean;
  maxSec?: number;
}

function alive(enc: Encounter): Enemy[] {
  return enc.enemies.filter((e) => e.fighter.alive && !e.routed && !e.gone && e.mode !== 'abandoned');
}

function nearest(enc: Encounter, pos: Vec2, filter?: (e: Enemy) => boolean): Enemy | null {
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of alive(enc)) {
    if (filter && !filter(e)) continue;
    const d = dist(e.fighter.pos, pos);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function runBout(enc: Encounter, policy: Policy, opts: BoutOpts = {}): BoutResult {
  const maxSec = opts.maxSec ?? 180;
  const res: BoutResult = {
    timeSec: 0, status: 'stall', grade: '-', score: 0,
    detainments: 0, dodges: 0, dodgeDenied: 0, dmgTaken: 0, civilianSaved: true,
  };
  const threats: { id: string; dodgeAt: number }[] = [];
  let allyClock = 0;
  let lastSwap = 0;

  while (enc.time < maxSec) {
    const events = updateEncounter(enc, DT);
    const t = enc.time;
    const controlled = enc.squad.find((h) => h.id === enc.controlledId) ?? enc.squad[0];
    if (!controlled) break;

    for (const ev of events) {
      if (opts.onEvent) opts.onEvent(t, ev);
      if (ev.type === 'telegraph' && policy === 'skill') {
        const en = enc.enemies.find((e) => e.fighter.id === ev.id);
        if (en) {
          // am I the likely target?
          let nearestHero = controlled;
          let nd = Infinity;
          for (const h of enc.squad) {
            if (!h.alive || h.state === 'down') continue;
            const d = dist(h.pos, en.fighter.pos);
            if (d < nd) {
              nd = d;
              nearestHero = h;
            }
          }
          const rangedish = en.kind === 'ranged' || en.kind === 'swarm';
          if (nearestHero.id === controlled.id && (dist(en.fighter.pos, controlled.pos) < 3.5 || rangedish)) {
            threats.push({ id: ev.id, dodgeAt: t + ev.durationSec - 0.18 });
          }
        }
      } else if (ev.type === 'attack-active') {
        // hit application (M4 mounts real hitboxes; here: §1.2 auto-face snap)
        const attacker = enc.squad.find((h) => h.id === ev.id);
        if (attacker) {
          const target = nearest(enc, attacker.pos);
          if (target && dist(target.fighter.pos, attacker.pos) <= T.input.autoFaceSnapRangeM) {
            const tags: DamageTags =
              ev.kind === 'light' ? { light: true } : ev.kind === 'heavy' ? { launcher: true } : { power: true };
            heroHitsEnemy(enc, attacker, target, ev.damage * tierDmgMult(enc.cfg.tier), tags);
          }
        }
      } else if (ev.type === 'detained') {
        res.detainments += 1;
      } else if (ev.type === 'victory') {
        res.status = 'victory';
        res.grade = ev.loot.rating.grade;
        res.score = ev.loot.rating.score;
      } else if (ev.type === 'defeat') {
        res.status = 'defeat';
      }
    }
    if (enc.status !== 'active') break;

    // ---- controlled hero ----
    const me = enc.squad.find((h) => h.id === enc.controlledId);
    if (me && me.alive && me.state !== 'down') {
      if (policy === 'skill') {
        const carrierLive =
          opts.intercept === true && alive(enc).some((e) => e.kind === 'detainer' && e.mode === 'carry');
        // during an intercept, eat hits and save the stamina for grip-breaks
        if (carrierLive) threats.length = 0;
        const dueIdx = threats.findIndex((th) => t >= th.dodgeAt);
        if (dueIdx >= 0) {
          const th = threats[dueIdx];
          threats.splice(dueIdx, 1);
          const en = th ? enc.enemies.find((e) => e.fighter.id === th.id) : undefined;
          if (en && en.mode === 'telegraph') {
            if (me.stamina >= T.dodge.staminaCost) {
              command(me, { type: 'dodge', dir: { x: me.pos.x - en.fighter.pos.x, z: me.pos.z - en.fighter.pos.z } });
              res.dodges += 1;
            } else {
              res.dodgeDenied += 1;
            }
          }
        }
        skillBrain(enc, me, opts);
        if (!opts.noSwap && t - lastSwap > 9) {
          const next = enc.squad.find((h) => h.alive && h.state !== 'down' && h.id !== enc.controlledId);
          if (next && swapControlled(enc, next.id)) lastSwap = t;
        }
      } else {
        const near = nearest(enc, me.pos);
        if (near) {
          const d = dist(near.fighter.pos, me.pos);
          if (d <= 2.0) {
            setMoveInput(me, null);
            command(me, { type: 'light' });
          } else {
            setMoveInput(me, { x: near.fighter.pos.x - me.pos.x, z: near.fighter.pos.z - me.pos.z });
          }
        }
      }
    }

    // ---- allies: assist-oriented pokes (docs/02 §1.3: AI allies contribute
    // juggle hits, they don't carry DPS), identical for both policies ----
    allyClock += DT;
    for (const h of enc.squad) {
      if (h.id === enc.controlledId || !h.alive || h.state === 'down') continue;
      const near = nearest(enc, h.pos);
      if (!near) continue;
      const d = dist(near.fighter.pos, h.pos);
      if (d <= 2.0) {
        setMoveInput(h, null);
        if (allyClock >= 2.0) command(h, { type: 'light' });
      } else {
        setMoveInput(h, { x: near.fighter.pos.x - h.pos.x, z: near.fighter.pos.z - h.pos.z });
      }
    }
    if (allyClock >= 2.0) allyClock = 0;

    if (opts.reservation !== undefined) {
      const anchor = enc.squad[0];
      if (anchor) anchor.regenReservation = opts.reservation;
    }
  }

  res.timeSec = enc.time;
  for (const h of enc.squad) res.dmgTaken += h.maxHp - Math.max(0, h.hp);
  res.civilianSaved = !enc.world.civilians.some((c) => c.detained);
  return res;
}

/** The skill bot's action pick — verbs over mash, §1.3's intended loop. */
function skillBrain(enc: Encounter, me: Fighter, opts: BoutOpts): void {
  // carrier intercept overrides everything: deliberate hits break grips, and
  // while a Detainer is on the board at all, it IS the priority target
  if (opts.intercept) {
    const carrier = alive(enc).find((e) => e.kind === 'detainer' && e.mode === 'carry');
    if (carrier) {
      // LEAD the carrier: stand in its path to the exit, don't trail it
      const cp = carrier.fighter.pos;
      const ex = enc.world.exitPoint;
      const el = Math.max(1e-6, Math.hypot(ex.x - cp.x, ex.z - cp.z));
      const intercept = { x: cp.x + ((ex.x - cp.x) / el) * 1.0, z: cp.z + ((ex.z - cp.z) / el) * 1.0 };
      const d = dist(cp, me.pos);
      if (d > 1.6) {
        setMoveInput(me, { x: intercept.x - me.pos.x, z: intercept.z - me.pos.z });
      } else {
        setMoveInput(me, null);
        if (me.stamina >= T.launcher.staminaCost) command(me, { type: 'heavy' });
        else command(me, { type: 'light' });
      }
      return;
    }
  }
  // Scanner-first discipline in machine fights; a live Detainer outranks even
  // that when the bot is playing the intercept (§1.9: "the scary one")
  const target =
    (opts.intercept ? nearest(enc, me.pos, (e) => e.kind === 'detainer') : null) ??
    nearest(enc, me.pos, (e) => e.kind === 'scanner') ??
    nearest(enc, me.pos);
  if (!target) return;
  const d = dist(target.fighter.pos, me.pos);
  if (d > 2.0) {
    setMoveInput(me, { x: target.fighter.pos.x - me.pos.x, z: target.fighter.pos.z - me.pos.z });
    return;
  }
  setMoveInput(me, null);
  const tf = target.fighter;
  const grabbable = tf.stunTimer > 0.25 || tf.state === 'down';
  const others = alive(enc).filter((e) => e !== target);
  if (grabbable && others.length > 0 && me.stamina >= T.throwRules.staminaCost && me.state !== 'attack') {
    if (tryGrab(me, tf)) {
      let tgt: Enemy | null = null;
      let bd = Infinity;
      for (const e of others) {
        const dd = dist(e.fighter.pos, tf.pos);
        if (dd < bd) {
          bd = dd;
          tgt = e;
        }
      }
      const dir = tgt ? { x: tgt.fighter.pos.x - me.pos.x, z: tgt.fighter.pos.z - me.pos.z } : { x: 1, z: 0 };
      throwHeld(me, tf, dir);
      return;
    }
  }
  if (tf.state === 'launch' || tf.state === 'juggle') {
    command(me, { type: 'light' }); // juggle food
  } else if (
    tf.weightClass !== 'unlaunchable' &&
    tf.state !== 'down' &&
    me.stamina >= T.launcher.staminaCost + T.dodge.staminaCost &&
    tf.hp > 20
  ) {
    command(me, { type: 'heavy' }); // launch (light) or stagger (armored)
  } else if (target.cfg.armored && tf.state !== 'hit' && me.stamina >= T.launcher.staminaCost + T.dodge.staminaCost) {
    command(me, { type: 'heavy' });
  } else if (me.power >= 30) {
    command(me, { type: 'power' });
  } else {
    command(me, { type: 'light' });
  }
}

