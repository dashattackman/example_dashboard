# 05 — Codebase Architecture

Stack: **Babylon.js 7 + TypeScript (strict) + Vite**, shipped as an installable **PWA** (`vite-plugin-pwa`). Saves in **IndexedDB** (via `idb`). No backend, no accounts — fully offline after first load.

## Directory layout

Everything lives under `game/` at the repo root (repo may later hold other tools/docs).

```
game/
  index.html
  vite.config.ts            # PWA manifest, asset precache, base path
  package.json
  public/
    assets/                 # CC0 pack assets that survive red-team arbitration (glb/ktx2)
    icons/                  # PWA icons
  src/
    main.ts                 # boot: engine, scene, loop, resize, visibility pause
    engine/                 # Babylon wrapper — the ONLY module that imports @babylonjs/*
      renderer.ts           # engine/scene setup, hardware scaling, fps governor
      materials.ts          # graphic-novel shader library (rim, ramp, outline hull)
      cameraRig.ts          # dynamic 3rd-person: brawl/explore/interior/dialogue framings
      lighting.ts           # time-of-day sun/ambient/neon rig, skydome
      debug.ts              # perf overlay (fps, draw calls, actives), toggled via ?debug
    world/
      chunks.ts             # 100m cell grid; load/unload around player; LOD swap
      cityGen.ts            # parametric block/building generator (footprint -> mesh)
      interiors.ts          # interior cell loader; door transition (fade, camera tighten)
      props.ts              # interactable object registry (sit/use/buy/talk/fight/steal)
      ambient.ts            # crowds, traffic abstraction, weather, birds/joggers
    combat/
      brawl.ts              # encounter orchestration: spawn waves, arena bounds, victory
      fighter.ts            # shared fighter FSM (idle/move/attack/hit/launch/down/grab)
      powers.ts             # data-driven power moves; projectiles, AoEs, buffs
      squadAI.ts            # your 2 AI heroes; enemy AI (grunt/bruiser/ranged/leader)
      combatFeel.ts         # hitstop, camera shake, knockback curves, damage numbers
    sim/
      npc.ts                # NPC entity: archetype, personality dials, schedule runner
      memory.ts             # event log per NPC; salience decay; promotion to "named"
      opinion.ts            # respect/attraction/fear/trust axes; modifiers
      gossip.ts             # event propagation across relationship graph, per sleep tick
      relationships.ts      # NPC<->NPC and NPC<->player edges; romance state machines
      factions.ts           # territory, rep, leader logic, patrols
      zone.ts               # Rogue Zone overlay: perimeter/checkpoint/patrol state,
                            # firmware-mutation ticks, flagged-NPC pressure, mission grammar
                            # (own state model — NOT a faction; see 02/03)
      clock.ts              # game time, day phases, calendar, sleep/advance
    base/
      rooms.ts              # room slots, levels, staffing, passive yields
      farming.ts            # plots, crops, growth ticks, watering, harvest
      missions.ts           # timed off-screen follower missions
    dialogue/
      engine.ts             # line selection: authored pools filtered by state + templating
      templater.ts          # {name}, {memory.lastFight}, opinion-conditional fragments
      scenes.ts             # milestone scenes/dates: choice beats, fade-to-black director
    ui/
      hud.ts                # vanilla TS + DOM, no framework (see UI note below)
      joystick.ts           # virtual stick (left) + 4 context buttons (right)
      menus.ts              # squad, upgrades, base, relationships, map
      dialogueBox.ts        # portrait, line, choices; tap-through
      toasts.ts             # gossip pings, rep changes, save indicator
    save/
      store.ts              # IndexedDB adapter; schema version + migration
      serialize.ts          # world/sim/hero snapshot; autosave triggers
    content/                # DATA, not code — the moddable heart
      schemas.ts            # zod schemas for all content types (single source of truth)
      heroes/*.json         # 10 hero defs: kit, moves, upgrade tree, arc beats
      npcs/*.json           # named NPCs + archetype templates
      dialogue/*.json       # line pools tagged by speaker/context/opinion-range/memory-flags
      venues/*.json         # interiors: layout recipe, props, hours, staff, faction
      city/uptown.json      # block layout, streets, venue placement, territory map, zone footprint
      story/*.json          # main-arc acts, Act-reveal stages, zone mission templates, lore fragments
      items.json  crops.json  economy.json  tuning.json
  test/
    unit/                   # vitest: sim logic (memory, gossip, opinion, economy) — pure TS
    e2e/                    # playwright: boots game headless, screenshots, perf asserts
```

## Module rules (enforced by convention + ESLint boundaries)

1. **`engine/` is the only Babylon importer.** Sim, combat logic, dialogue, save are pure TypeScript operating on plain state — testable in vitest with zero WebGL. Rendering reads state; state never reads rendering.
2. **`content/` is data.** All heroes, NPCs, venues, dialogue, tuning live in JSON validated by zod schemas at load (dev) and build. Adding a hero or venue must require **zero engine code changes**.
3. **One fixed-timestep sim loop** (10 Hz) drives clock/NPC/needs/farming; render loop interpolates. Combat runs at render rate with its own FSM but writes results back through the same event bus.
4. **Event bus is the spine**: `events.emit('brawl.won', {...})` → memory system logs it for witnesses → gossip queues it → faction rep adjusts → save marks dirty. New systems subscribe; they don't call each other directly.

## Key architectural choices

### World: single scene + streamed cells (not scene-per-interior)
One Babylon scene. The city is a grid of **~100m cells**; the loader keeps a 3×3 around the player (geometry built from `city/uptown.json` via `cityGen`), with far cells swapped to merged low-LOD shells and the skyline as a static billboard-ish backdrop mesh. **Interiors are cells too**: pre-built at low cost, kept disabled, enabled on door entry while the exterior cell set is disabled (instant, no scene teardown, shared materials stay warm). Door transitions = 200ms fade + camera lens change.

### NPC sim: full sim for the cast, statistical for the crowd
- **Tier 1 (named, ~40 in slice)**: full schedule, memory log, opinions, relationships. Always simulated (cheap — it's a 10 Hz state machine, not pathfinding the whole map; off-screen NPCs teleport along schedule waypoints).
- **Tier 2 (ambient, ~80 concurrent max on screen budget ~25)**: archetype + personality dials + a small memory ring-buffer (last 5 player interactions). Repeated interaction promotes to Tier 1 ("the sim remembers you back").
- Gossip propagates on **sleep ticks** (cheap batch graph pass), not real time.

### Dialogue: authored pools + state templating
No LLM at runtime. Lines are authored in pools tagged with `speaker|context|opinionRange|memoryFlags|factionState`; the engine picks the most-specific matching line, templates in memory details ("Saw you drop three of Vex's boys on Lagoon last night"). Milestone scenes (dates, recruitment, betrayals) are authored branching scenes in `dialogue/scenes`.

### Content schemas (sketch — `content/schemas.ts` is source of truth)

```ts
Hero      { id, name, alias, kit: PowerKit, moves: Move[3], signature: Move,
            upgradeTree: { power: Node[], utility: Node[], signature: Node[] },
            personality, scheduleId, recruitQuestId, arc: RomanceArc | FriendArc }
Move      { id, anim, damage, staminaCost, tags: ['launcher'|'aoe'|'projectile'|...],
            fx: FxRecipe, upgradesTo?: MoveId }
Npc       { id, name, tier, archetypeId?, dials: {warmth,boldness,chattiness,mischief},
            schedule: Waypoint[], factionId?, romanceable: boolean, home: VenueId }
Venue     { id, name, kind: 'bar'|'club'|'shop'|'home'|..., cell, hours: PhaseRange,
            layout: InteriorRecipe, props: PropPlacement[], staff: NpcId[], factionId? }
MemoryEvent { type, actors, venueId?, tick, salience, decayRate }
Opinion   { respect, attraction, fear, trust }   // -100..100 each
SaveGame  { version, clock, player, heroes, npcs, factions, zone, story, base, farm, flags }
```

### Save/versioning
Autosave on sleep, door transitions, and brawl end. `SaveGame.version` + explicit migration functions — never break a phone save. Export/import save as JSON blob (share between devices).

### UI: vanilla DOM over the canvas
HUD/menus are plain TS + DOM/CSS (fast, tiny, thumb-friendly), not React and not Babylon GUI (both cost more than they give here). One `ui/` root element; game canvas below it.

## Testing strategy
- **vitest** on the pure-TS sim: gossip propagation, memory decay, opinion math, economy balance invariants ("day-1 income can't buy tier-3 upgrade"), schedule resolution, save round-trip.
- **Playwright** (preinstalled Chromium) e2e: boot to gameplay, screenshot at set times-of-day (visual reference), assert the `?debug` overlay's **geometry budgets** (draw calls, tris, materials — see 06). FPS is asserted on real devices only; software-WebGL framerate is noise and is never a CI gate.
- Every milestone in `07-build-milestones.md` ends with a runnable check.
