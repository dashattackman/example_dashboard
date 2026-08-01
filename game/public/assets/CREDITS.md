# Asset credits

All third-party assets in this tree are CC0 (public domain dedication) — credit
is not legally required, but we keep provenance honest per CLAUDE.md.

## characters/ — the cast (eli, punk, suit, worker, casual, skater, vest, jogger)

- **Assets:** rigged + animated character bodies, all from Quaternius'
  **Ultimate Animated Character Pack** (CC0 1.0 —
  https://creativecommons.org/publicdomain/zero/1.0/), all on the pack's shared
  62-joint `CharacterArmature` rig: Adventurer (→ `eli.glb`, `jogger.glb`),
  Punk (→ `punk.glb`, `skater.glb`), Suit (→ `suit.glb`, `casual.glb`),
  Worker (→ `worker.glb`, `vest.glb`).
- **Author:** Quaternius — https://quaternius.com
  (https://quaternius.com/packs/ultimateanimatedcharacter.html)
- **Obtained via:** the cloud asset channel (GitHub raw/LFS; quaternius.com and
  asset CDNs are unreachable from the build container). Mirror URLs are pinned
  in `game/assets-pipeline/build-cast.mjs`: Adventurer from
  `adityaagurav/OceanCleanup2` (Git LFS, filename stamped "Adventurer by
  Quaternius"); Punk/Suit/Worker from `JonathanOll/supermarket-alone`
  (`Assets/Models/Characters/*.glb`). Rig/clip integrity (joints, clip set,
  materials) verified with gltf-transform before processing.
- **Modifications** (ours — `game/assets-pipeline/process-character.mjs` +
  cast table in `build-cast.mjs`, gltf-transform v4): same treatment as
  adventurer.glb below (clip prune — ambient bodies keep only locomotion
  clips — vertex-color bake, single-primitive merge, baked inverted-hull ink
  outline), plus **outfit recolors** baked into the vertex colors for
  `eli`/`casual`/`skater`/`vest`/`jogger` (exact palettes in the cast table).
- **Runtime treatment:** rim/ramp `GraphicNovelPlugin` StandardMaterial + flat
  ink hull, shared scene-wide (`src/engine/characterRig.ts`).

## props/ — street trees (tree_a, tree_b, tree_c)

- **Assets:** low-poly stylized trees "CommonTree_1 / _3 / _4" from Quaternius'
  **Lowpoly Nature / Ultimate Nature** pack family (CC0 1.0 —
  https://creativecommons.org/publicdomain/zero/1.0/), the pack's standard
  flat-color FBX2glTF exports (Brown/Green/DarkGreen material set).
- **Author:** Quaternius — https://quaternius.com
- **Obtained via:** the cloud asset channel (GitHub raw; quaternius.com and
  asset CDNs are unreachable from the build container). Mirror pinned in
  `game/assets-pipeline/process-trees.mjs`: `flo-bit/tiny-planets`
  (`public/lowpoly_nature/*.gltf`, self-contained data-URI buffers). The same
  pack files also mirror under `castle-engine/castle-engine` at
  `…/data/quaternius/nature/glTF/`, which triangulates provenance. Each file
  is verified on fetch (FBX2glTF generator tag + embedded buffers + the pack's
  exact material set) before processing.
- **Modifications** (ours — `game/assets-pipeline/process-trees.mjs`,
  gltf-transform v4): node transforms baked, all primitives merged to ONE,
  flat material colors REPLACED with our late-summer Uptown palette baked as
  sRGB vertex colors (bark `#3f2e1f`, canopy `#324a2a`/`#223618`), height
  normalized (7.4/6.6/6.2 m), converted right→left-handed, and re-emitted as
  compact JSON vertex payloads (`props/*.json`) for `kit.prop()`.
- **Runtime treatment:** white-diffuse graphic-novel env material (rim nearly
  off — fresnel washes bushy silhouettes), thin-instanced with near-white
  green-leaning per-instance tints (`src/world/beautyCorner.ts`).

## characters/adventurer.glb

- **Asset:** "Adventurer" rigged + animated character (base body for the shared
  character pipeline; see `src/engine/characterRig.ts`).
- **Author:** Quaternius — https://quaternius.com
- **Pack:** Ultimate Animated Character Pack
  (https://quaternius.com/packs/ultimateanimatedcharacter.html)
- **License:** CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- **Obtained via:** Poimandres market mirror of the pack (market.pmnd.rs), fetched
  from the public GitHub mirror `adityaagurav/OceanCleanup2` (`public/Adventurer.glb`,
  Git LFS object `4a8639cd…`, filename stamped "Adventurer by Quaternius") because
  quaternius.com is unreachable from the build container. Rig/clip integrity
  verified locally with gltf-transform before processing.
- **Modifications** (ours — script: `game/assets-pipeline/process-adventurer.mjs`,
  gltf-transform v4):
  - Backpack subtree removed (urban silhouette + tri budget; body is ~8.5k tris).
  - Animations pruned to the brawler/locomotion set and renamed
    (`CharacterArmature|Idle` → `Idle`, …): Idle, Idle_Neutral, Walk, Run, Run_Back,
    Punch_Left, Punch_Right, Kick_Left, Kick_Right, Roll, HitRecieve, Death.
  - The 10 flat-color PBR materials baked to sRGB VERTEX COLORS and all skinned
    primitives merged into ONE (single draw call), matching the engine's
    white-diffuse + vertex-color character material contract.
  - A baked inverted-hull outline added as a second skinned primitive
    ("AdventurerHull": positions pushed 2cm-world along bind-pose normals,
    winding flipped). NB: this export keeps bind-pose positions at 1/100 world
    scale (bones carry a 100x scale-up), so the push is 2e-4 in local units —
    runtime shader-based outline pushes explode 100x on this rig.
  - `resample` + `dedup` + `prune`.
  - KTX2 not applicable: no textures survive (flat colors ride in vertex colors).
- **Runtime treatment:** body renders through our rim/ramp `GraphicNovelPlugin`
  StandardMaterial, hull in flat ink (`src/engine/characterRig.ts`); the glb's
  own PBR materials are discarded on load.

## audio/ — footsteps, UI ticks, record-store music

See `audio/CREDITS.md`: Kenney RPG Audio + UI Audio (CC0, via the
`ETdoFresh/kenney.nl` GitHub mirror) and one OpenLo-Fi track (CC0,
`btahir/open-lofi` release zip via ranged extraction). Ambient beds are
runtime-synthesized (no assets).
