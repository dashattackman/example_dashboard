// Combat tuning — the single source for every combat number (docs/02 preamble:
// "All numbers below are tunable defaults. They live in one config file").
// Each knob cites the docs/02 section it comes from. Numbers marked [resolved]
// are not in docs/02 and were chosen here; see the comment for rationale.
// Pure data. No Babylon imports (docs/05 module rule 1).

export const combatTuning = {
  /** §1.1 — fight length target, seconds (informational; encounter telemetry). */
  fightLengthTargetSec: { min: 45, max: 90 },

  /** §1.2 — touch controls. */
  input: {
    bufferSec: 0.25, // §1.2 "inputs buffer 250ms; a tap during a combo queues the next hit"
    holdThresholdSec: 0.3, // §1.2 hold ≥300ms
    autoFaceConeDeg: 60, // §1.2 auto-facing cone
    autoFaceSnapRangeM: 2.5, // §1.2 snap range
  },

  /** §1.3 — light chain. Damage is the baseline "light hit" unit other rules scale from. */
  lightChain: {
    hits: 3, // §1.3 "3-hit string (L-L-L)"
    damage: [10, 10, 14] as readonly number[], // [resolved] baseline light = 10; docs give only ratios (finisher = 400% of a light)
    startupSec: [0.08, 0.08, 0.12] as readonly number[], // [resolved] feel numbers, sum ≈ readable 3-hit string
    activeSec: 0.06, // [resolved]
    recoverySec: [0.18, 0.18, 0.3] as readonly number[], // [resolved] third hit heavier
    thirdHitKnockback: true, // §1.3 "Third hit knocks back"
  },

  /** §1.3 — launcher / juggle. */
  launcher: {
    staminaCost: 0.15, // §1.4 heavy/launcher 15%
    startupSec: 0.25, // [resolved] hold-attack windup
    recoverySec: 0.35, // [resolved]
    damage: 18, // [resolved] ~1.8 lights
    popHeightM: 3, // §1.3 "pops a grunt-weight enemy 3m up"
    juggleAirtimeSec: 1.2, // §1.3 "1.2s of juggle airtime"
    heavyLaunchHits: 2, // §1.3 "Bruisers need 2 launchers within 3s"
    heavyLaunchWindowSec: 3, // §1.3
    leaderStaggerSec: 0.8, // [resolved] §1.3 "leaders can't be launched, only staggered" — stagger length unspecified
  },
  juggle: {
    damageBonus: 0.25, // §1.3 juggle hit +25% damage
    powerGainMult: 2, // §1.3 builds power meter 2×
  },

  /** §1.3 — throws. */
  throwRules: {
    staminaCost: 0.2, // §1.4 throw 20%
    distanceM: 4, // §1.3 "throws them 4m"
    projectileImpactMult: 1.5, // §1.3 "1.5× impact damage to anything they hit"
    knockdownRadiusM: 1.5, // §1.3 knockdown radius
    wallSplatStunSec: 2, // §1.3 "Throw into a wall = wall-splat (2s stun)"
    flightSec: 0.4, // [resolved] 4m at ~10m/s
  },

  /** §1.2/§1.4 — dodge. Duration/i-frames unspecified in docs/02; [resolved] to standard brawler feel. */
  dodge: {
    staminaCost: 0.25, // §1.4 dodge 25%
    durationSec: 0.4, // [resolved]
    iframeSec: 0.3, // [resolved] i-frames cover startup+travel, not the recovery tail
    distanceM: 2.5, // [resolved]
  },

  /** §1.4 — meters. Stamina is 0..1; power is 0..100. */
  stamina: {
    regenPerSec: 0.2, // §1.4 "regen 20%/s after 1s of not spending"
    regenDelaySec: 1, // §1.4
    hitRegenLockSec: 1.5, // §1.4 "Getting hit interrupts stamina regen for 1.5s"
  },
  power: {
    perLightHit: 1, // §1.4
    perJuggleHit: 3, // §1.4
    perThrowImpact: 4, // §1.4
    perHpLostTaken: 0.5, // §1.4 taking damage 0.5/point of HP lost
    max: 100,
    moveCost: 30, // §1.4
    chargedCost: 60, // §1.4
    signatureCost: 100, // §1.4 full meter
    betweenFightDecay: 0.5, // §1.4 persists at 50% decay
    benchedGainRate: 0.3, // §1.4 benched heroes gain at 30% of active rate
  },

  /** §1.4 — second wind, precise rule (last standing hero, once per brawl). */
  secondWind: {
    invulnSec: 2, // §1.4 "survive at 1 HP with 2s of invulnerability"
  },

  /** §1.3 — signature finisher. */
  signature: {
    damageMultOfLight: 4, // §1.3 "400% of a light hit"
    radiusM: 4, // §1.3
    durationSec: 2.5, // §1.3 canned cinematic-lite
    assistRangeM: 5, // §1.3 pair-flavor garnish range
  },

  /** [resolved] hit reactions — docs/02 gives telegraphs, not stun frames. */
  reactions: {
    hitStunSec: 0.35,
    downSec: 1.2, // knockdown before getting back up
    playerMaxHp: 100, // baseline; hero sheets (04) may override
    gruntBaseHp: 30, // [resolved] the 1× unit all archetype HP multiplies (§1.5 table is in × grunt)
  },

  /** §1.5 — attack tokens + crowd. */
  tokens: {
    maxSimultaneousAttackers: 2, // §1.5 "only 2 melee tokens live regardless of crowd size"
  },
  crowd: {
    totalMin: 8, // §1.5 "8–14 enemies total"
    totalMax: 14,
    onScreenCap: 6, // §1.5 "≤6 on screen"
    wavesMin: 2, // §1.5 "2–3 waves"
    wavesMax: 3,
    nextWaveAtRemaining: 2, // §1.5 "next wave enters as current drops to 2"
  },

  /** §1.5 — telegraph floor for heavy hits. */
  telegraph: {
    heavyHitHpFrac: 0.1, // §1.5 attacks dealing >10% player HP...
    minTelegraphSec: 0.6, // ...need a ≥0.6s telegraph
  },

  /** §1.6 — difficulty ramp. */
  ramp: {
    hpPerTier: 0.15, // §1.6 cap +15% HP per rep tier
    dmgPerTier: 0.2, // §1.6 cap +20% damage per rep tier
    tier1GruntHitHpFrac: 0.12, // §1.6 tier-1 grunt hit = 12% of player max HP
    rangedByEncounter: 2, // §1.6 [resolved schedule] ranged appears by encounter 2...
    bruiserByEncounter: 3, // ...bruiser by encounter 3 — both "within the first three encounters"
  },
  rubberBand: {
    wipesToTrigger: 2, // §1.6 "if the squad wipes twice on the same encounter"
    bruisersRemoved: 1, // §1.6 "one fewer bruiser"
    dropFoodPickup: true, // §1.6
  },

  /** §1.6 — Splash Rating (D→S) and §1.9 Demolition Rating. Factor math is [resolved]:
   *  five equal-weight factors, each clamped 0..1; grade cuts at 0.2/0.4/0.6/0.8. */
  splash: {
    lootMultMin: 1.0, // §1.6 ×1.0–×1.5
    lootMultMax: 1.5,
    gradeCuts: { C: 0.2, B: 0.4, A: 0.6, S: 0.8 } as const, // [resolved]
  },

  /** §1.9 — CIVIS machine family. */
  civis: {
    scannerFlagDamageBonus: 0.2, // §1.9 flagged targets take +20% damage from machines
    scannerFlagIntervalSec: 4, // [resolved] flag cadence unspecified
    detainerRescueSec: 20, // §1.9 "a rescue timer (20s), never a DPS race"
    detainerCarrySlow: 0.3, // §1.9 "carrying slows it 30%"
    detainerGripHits: 4, // [resolved] "hits to its arm assembly break the grip" — hit count unspecified
    bulwarkShieldArcDeg: 120, // [resolved] "frontal shield, immune from the front" — arc width unspecified
    bulwarkTurnRateRadPerSec: 1.2, // [resolved] slow enough to flank
    swarmGroupMin: 5, // §1.9 groups of 5–8
    swarmGroupMax: 8,
    momentumStructuralBonus: 0.5, // [resolved] §1.9 quirk 4 "momentum is king ... bonus structural damage" → +50% on knockback/throw/crush hits vs machines
    scrapPerUnit: { min: 2, max: 5 }, // §1.9 loot is SCRAP, 2–5 per unit
    wardenScrap: { min: 12, max: 20 }, // §1.9 Warden-hand 12–20 scrap
    wardenFluxCells: 5, // §1.9 5 flux containment cells
    wardenPerMissionCap: 1, // §1.9 capped 1 per mission
  },

  /** §1.5/§1.9 [resolved] — leader aura: "grunts buffed while leader alive", size unspecified. */
  leaderAura: {
    gruntDamageMult: 1.25,
    powerWhiffVulnerableSec: 3, // §1.5 leaders take +50% damage for 3s after their power whiffs
    powerWhiffDamageTakenBonus: 0.5, // §1.5
  },

  /** §1.8 — the Anchor's threads. */
  threads: {
    freeSlotsStart: 1, // §1.8 Slot Zero + 1 free at start
    freeSlotsMax: 3, // §1.8 → Slot Zero + 3 free late-tree
    capacityNodeForSlot2: 3, // §1.8 Capacity branch: free slot 2 at node 3
    capacityNodeForSlot3: 6, // §1.8 free slot 3 at node 6
    stanceUnlockNode: 2, // §1.8 Stance unlocks at node 2
    fieldUnlockNode: 4, // §1.8 Field at node 4
    reservationPerThread: 0.25, // §1.8 each free thread reserves 25% of stamina regen
    reservationImproved: 0.2, // §1.8 Capacity branch improves to 20%
    reservationImprovementNode: 5, // [resolved] which Capacity node grants 25%→20% is unspecified
    igniteCostPower: 20, // §1.8 igniting an echo costs 20 power
    fidelityByBond: { 2: 0.6, 3: 0.8, 4: 0.8, 5: 1.0 } as const, // §1.8 fidelity curve
    fidelityPerNode: 0.03, // [resolved] "branch nodes raise the floor and push the cap" — +3%/node, 7 nodes ≈ +21%
    fidelityHardCap: 1.2, // §1.8 cap 120%
    fullHandsDurationSec: 5, // §1.8 Full Hands: 5 seconds
    fullHandsCost: 100, // §1.8 standard 100-power cost
    paletteTimeScale: 0.3, // §1.8 game time at 0.3×
    paletteMaxSec: 4, // §1.8 up to 4s
    aiStarvedStaminaFrac: 0.2, // [resolved] §1.8 "when stamina-starved" threshold unspecified
  },
} as const;

export type CombatTuning = typeof combatTuning;
