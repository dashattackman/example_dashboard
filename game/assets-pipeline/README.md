# Character asset pipeline

Reproducible processing for every rigged CC0 body shipped in
`public/assets/characters/` (license + provenance in
`public/assets/CREDITS.md`).

Sibling pipelines in this directory follow the same shape (CC0 source over
the GitHub-raw asset channel → palette bake → one merged primitive →
CREDITS.md): `process-street-textures.mjs` (surface maps) and
`process-trees.mjs` (street-tree props for `kit.prop()`, run
`node assets-pipeline/process-trees.mjs`).

## Re-running

```bash
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4

# The whole cast (Eli + ambient bodies + palette variants), one command.
# Downloads CC0 sources into assets-pipeline/src-cache/ (gitignored) on first run:
node assets-pipeline/build-cast.mjs

# One-off processing of a single body:
node assets-pipeline/process-character.mjs <src.glb> <dst.glb> \
  [--keep Idle,Walk,Run] [--strip backpack] [--recolor Green=#3b4560,...] [--name Body]

# The original single-body script (adventurer.glb) still works:
node assets-pipeline/process-adventurer.mjs <source-Adventurer.glb> public/assets/characters/adventurer.glb
```

Sources: bodies from the Quaternius **Ultimate Animated Character Pack**
(CC0) — https://quaternius.com/packs/ultimateanimatedcharacter.html. The site
and asset CDNs are blocked from the build container; sources are fetched over
the working cloud asset channel (GitHub raw/LFS — see CLAUDE.md) from public
mirrors, pinned by URL in `build-cast.mjs` and verified (glb magic + the
shared 62-joint `CharacterArmature` rig) before processing.

## What it does (and the one gotcha)

- Strips unwanted subtrees (Adventurer: backpack), prunes + renames clips
  (`CharacterArmature|Idle` → `Idle`). Ambient bodies keep only locomotion
  clips (Idle/Idle_Neutral/Walk/Run); Eli keeps the full brawler set.
- Bakes flat PBR colors to sRGB vertex colors; merges all skinned primitives
  into one → 1 draw call through `createCharacterMaterial`. **Recolor pass:**
  `--recolor Mat=#hex` overrides a material's baked color (hexes are sRGB,
  baked verbatim) — one CC0 base ships as several distinct people. The cast
  table in `build-cast.mjs` is the paper trail for every variant's outfit.
- Bakes the inverted-hull ink outline as a second skinned primitive.
- **Gotcha:** these exports' bind-pose positions are 1/100 world scale (the
  bones carry a 100x scale-up). Any outline technique that pushes vertices
  pre-skinning in world units (Babylon OutlineRenderer, vertex-shader push)
  explodes 100x into shards on this rig. The script derives the local→world
  factor and bakes the hull in local units instead. If you swap in a different
  base body, keep this in mind before blaming the renderer.

## The cast

| file | source body | who |
| --- | --- | --- |
| `eli.glb` | Adventurer | THE ANCHOR — slate jacket, amber shirt/belt, full brawler clips |
| `punk.glb` | Punk | pink-mohawk record browser (as shipped) |
| `suit.glb` | Suit | downtown walker (as shipped) |
| `worker.glb` | Worker | hi-vis walker (as shipped) |
| `casual.glb` | Suit recolor | tan jacket, slate shirt, dark hair/skin |
| `skater.glb` | Punk recolor | green fade hawk, slate jacket |
| `vest.glb` | Worker recolor | teal jacket, dark cap — the bench regular |
| `jogger.glb` | Adventurer recolor | berry top, leggings, bright shoes |
| `adventurer.glb` | Adventurer | unmodified-palette base (rig harness default) |

## Adding more bodies / clips

Same pack has 18+ characters on the shared `CharacterArmature` rig. Add a row
to the `CAST` table in `build-cast.mjs` (plus a `SOURCES` mirror URL if it's a
new base), re-run, and review in the harness:
`/rig.html?glb=assets/characters/<name>.glb`.
