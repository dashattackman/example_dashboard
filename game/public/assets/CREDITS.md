# Asset credits

All third-party assets in this tree are CC0 (public domain dedication) — credit
is not legally required, but we keep provenance honest per CLAUDE.md.

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
