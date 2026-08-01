# Character asset pipeline

Reproducible processing for the rigged CC0 base body shipped at
`public/assets/characters/adventurer.glb` (license + provenance in
`public/assets/CREDITS.md`).

## Re-running

```bash
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4
node assets-pipeline/process-adventurer.mjs <source-Adventurer.glb> public/assets/characters/adventurer.glb
```

Source file: "Adventurer" from the Quaternius **Ultimate Animated Character
Pack** (CC0) — https://quaternius.com/packs/ultimateanimatedcharacter.html
(also mirrored on market.pmnd.rs as "Adventurer by Quaternius").

## What it does (and the one gotcha)

- Strips the backpack, prunes to the brawler clip set, renames clips.
- Bakes flat PBR colors to sRGB vertex colors; merges all skinned primitives
  into one → 1 draw call through `createCharacterMaterial`.
- Bakes the inverted-hull ink outline as a second skinned primitive.
- **Gotcha:** this export's bind-pose positions are 1/100 world scale (the
  bones carry a 100x scale-up). Any outline technique that pushes vertices
  pre-skinning in world units (Babylon OutlineRenderer, vertex-shader push)
  explodes 100x into shards on this rig. The script derives the local→world
  factor and bakes the hull in local units instead. If you swap in a different
  base body, keep this in mind before blaming the renderer.

## Adding more bodies / clips

Same pack has 18+ characters on the shared `CharacterArmature` rig (Punk,
Suit, Worker, Casual — far better Twin Cities fits than fantasy packs). Run
them through this same script (adjust the clip KEEP list per role), drop next
to `adventurer.glb`, and load via `loadCharacterRig(scene, { url })` or review
in the harness: `/rig.html?glb=assets/characters/<name>.glb`.
