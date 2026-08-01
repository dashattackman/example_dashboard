// Ambient PEOPLE for the beauty corner (Alive Corner wave): sidewalk walkers,
// a bench regular, a record-store browser, a lakeside jogger — the handful of
// bodies that turn the golden-hour screenshot into a place someone lives.
//
// No direct @babylonjs imports (docs/05): everything graphical goes through
// engine facades (loadCharacterRig). All simulation here is plain TS math.
//
// Skeleton budget (docs/06: ≤14 active animated skeletons): this module spawns
// at most 7 rigs (4 walkers + sitter + browser + jogger@MORN/EVE); Eli is an
// 8th. Everyone shares the scene-wide rig material set (characterRig.ts).
//
// ANCHORS: positions below are read from beautyCorner.ts geometry (bench,
// LAGOON RECORDS storefront, sidewalk slabs, cross street). beautyCorner is
// owned elsewhere — if it moves furniture, these constants drift. Ideal fix:
// beautyCorner exports named anchors (bench/storefront/sidewalk lanes); noted
// for the ENV author rather than edited here.

import { loadCharacterRig, type CharacterRigHandle } from '../engine/characterRig';
import type { Scene } from '../engine/kit';
import type { BeautyCorner } from './beautyCorner';
import type { Phase } from '../sim/clock';

/** Sidewalk surface height (slab top 0.05+0.05); street surface for the jogger. */
const WALK_Y = 0.1;
const STREET_Y = 0.05;

/** Personal space — nobody phases through Eli or each other. */
const AVOID_RADIUS = 1.1;

/** Walk/Run clip playback ratio per m/s of ground speed (eyeballed against
 *  stride length in the rig harness — close enough that feet don't skate at
 *  phone scale). */
const WALK_CLIP_PER_MS = 1 / 1.45;
const RUN_CLIP_PER_MS = 1 / 3.8;

const CHAR_DIR = 'assets/characters/';

export interface AmbientPersonInfo {
  role: 'walker' | 'sitter' | 'browser' | 'jogger';
  body: string;
  position(): [number, number, number];
}

export interface AmbientCast {
  people: AmbientPersonInfo[];
  /** Animated skeletons this module owns (excludes Eli). */
  skeletonCount: number;
  /** Per-frame tick: dt seconds + the player's ground position (avoidance). */
  update(dt: number, playerX: number, playerZ: number): void;
  dispose(): void;
}

interface Person {
  rig: CharacterRigHandle;
  info: AmbientPersonInfo;
  x: number;
  y: number;
  z: number;
  /** behavior tick — returns desired velocity (m/s) in world x/z. */
  think(dt: number): [number, number];
  moves: boolean;
}

/** Deterministic PRNG — stable cast quirks across runs (screenshot diffs). */
function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export async function createAmbientCast(
  scene: Scene,
  corner: BeautyCorner,
  phase: Phase,
): Promise<AmbientCast> {
  const rand = makeRand(0xca57);
  const people: Person[] = [];

  // Lane ends ride the corner's exported bounds so walkers spawn/despawn just
  // past the playable edge, never mid-block in front of the camera.
  const zSouth = corner.bounds.minZ + 1; // ≈ -33
  const zNorth = corner.bounds.maxZ - 2; // ≈ 86

  const load = (body: string): Promise<CharacterRigHandle> =>
    loadCharacterRig(scene, { url: `${CHAR_DIR}${body}.glb`, targetHeight: 1.78 });

  const addPerson = (
    rig: CharacterRigHandle,
    role: AmbientPersonInfo['role'],
    body: string,
    x: number,
    y: number,
    z: number,
    rotY: number,
    think: Person['think'],
    moves: boolean,
  ): Person => {
    rig.root.position.set(x, y, z);
    rig.root.rotation.y = rotY;
    const p: Person = {
      rig,
      x,
      y,
      z,
      think,
      moves,
      info: {
        role,
        body,
        position: () => [p.x, p.y, p.z],
      },
    };
    people.push(p);
    return p;
  };

  // --- 4 sidewalk walkers: both avenues, both directions, varied pace -------
  const lanes: Array<{ body: string; laneX: number; dirZ: 1 | -1; speed: number }> = [
    { body: 'suit', laneX: 1.3, dirZ: 1, speed: 1.5 }, // east walk, northbound
    { body: 'worker', laneX: 3.2, dirZ: -1, speed: 1.25 }, // east walk, southbound
    { body: 'casual', laneX: -13.0, dirZ: 1, speed: 1.35 }, // west walk, northbound
    { body: 'skater', laneX: -14.9, dirZ: -1, speed: 1.6 }, // west walk, southbound
  ];
  for (const lane of lanes) {
    const rig = await load(lane.body);
    const startZ = zSouth + rand() * (zNorth - zSouth);
    const p = addPerson(
      rig,
      'walker',
      lane.body,
      lane.laneX,
      WALK_Y,
      startZ,
      lane.dirZ > 0 ? 0 : Math.PI,
      () => {
        // Despawn past the corner edge, respawn at the opposite edge.
        if (lane.dirZ > 0 && p.z > zNorth) p.z = zSouth;
        if (lane.dirZ < 0 && p.z < zSouth) p.z = zNorth;
        // Gentle spring back to the lane after avoidance shoves — nobody
        // wanders off the curb and stays there.
        return [(lane.laneX - p.x) * 0.6, lane.dirZ * lane.speed];
      },
      true,
    );
    rig.play('Walk', { speed: lane.speed * WALK_CLIP_PER_MS, startFraction: rand() });
  }

  // --- bench regular (bench at x 4.5, z -3.4 faces the avenue; the pack has
  // no sit clip, so: a believable stand — leaning by the bench, watching the
  // street with a neutral idle) ----------------------------------------------
  {
    const rig = await load('vest');
    addPerson(rig, 'sitter', 'vest', 3.9, WALK_Y, -3.9, -Math.PI / 2 + 0.25, () => [0, 0], false);
    rig.play('Idle_Neutral', { startFraction: rand() });
  }

  // --- storefront browser at LAGOON RECORDS (display windows z 2.2 / 6.2,
  // glass at x≈4.94): idles at one window, occasionally drifts to the other ---
  {
    const rig = await load('punk');
    const windows = [2.2, 6.2];
    let target = 0;
    let dwell = 6 + rand() * 8;
    const p = addPerson(rig, 'browser', 'punk', 3.95, WALK_Y, windows[0]!, Math.PI / 2, (dt) => {
      const dz = windows[target]! - p.z;
      if (Math.abs(dz) > 0.08) {
        // amble to the other window (x spring keeps the nose at the glass)
        rig.play('Walk', { speed: 0.45, fade: 0.25 });
        return [(3.95 - p.x) * 0.6, Math.sign(dz) * 0.55];
      }
      rig.play('Idle', { fade: 0.3 });
      dwell -= dt;
      if (dwell <= 0) {
        target = 1 - target;
        dwell = 8 + rand() * 10;
      }
      return [0, 0];
    }, true);
  }

  // --- lakeside jogger (MORN/EVE — the lake light hours): out-and-back along
  // the cross street toward the shore ----------------------------------------
  if (phase === 'MORN' || phase === 'EVE') {
    const rig = await load('jogger');
    const xWest = -60;
    const xEast = 22;
    let dirX: 1 | -1 = -1;
    const speed = 3.3;
    const p = addPerson(rig, 'jogger', 'jogger', 6, STREET_Y, 18.2, -Math.PI / 2, () => {
      if (p.x < xWest) dirX = 1;
      if (p.x > xEast) dirX = -1;
      return [dirX * speed, (18.2 - p.z) * 0.6];
    }, true);
    rig.play('Run', { speed: speed * RUN_CLIP_PER_MS, startFraction: rand() });
  }

  // --- shared movement + avoidance tick --------------------------------------
  const update = (dt: number, playerX: number, playerZ: number): void => {
    if (dt <= 0) return;
    for (const p of people) {
      const [vx0, vz0] = p.think(dt);
      if (!p.moves) continue;
      let vx = vx0;
      let vz = vz0;
      // Personal space: soft push away from Eli and every other cast member.
      // (Static roles still repel movers; movers never shove the statics.)
      const repel = (ox: number, oz: number): void => {
        const dx = p.x - ox;
        const dz = p.z - oz;
        const d = Math.hypot(dx, dz);
        if (d < AVOID_RADIUS && d > 1e-4) {
          const push = (AVOID_RADIUS - d) / AVOID_RADIUS;
          vx += (dx / d) * push * 1.6;
          vz += (dz / d) * push * 1.6;
        }
      };
      repel(playerX, playerZ);
      for (const o of people) if (o !== p) repel(o.x, o.z);

      p.x += vx * dt;
      p.z += vz * dt;
      p.rig.root.position.set(p.x, p.y, p.z);
      // Face travel direction (only when actually moving — idlers hold pose).
      const v = Math.hypot(vx, vz);
      if (v > 0.15) {
        const target = Math.atan2(vx, vz);
        let d = target - p.rig.root.rotation.y;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        p.rig.root.rotation.y += d * Math.min(8 * dt, 1);
      }
    }
  };

  return {
    people: people.map((p) => p.info),
    skeletonCount: people.length,
    update,
    dispose: () => {
      for (const p of people) p.rig.dispose();
      people.length = 0;
    },
  };
}
