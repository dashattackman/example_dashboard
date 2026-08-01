# Street-surface texture credits

All maps in this directory are processed from **ambientCG** materials —
**CC0 1.0 Universal** (https://ambientcg.com/license,
https://creativecommons.org/publicdomain/zero/1.0/). Credit is not legally
required; we keep provenance honest per CLAUDE.md.

- **Author/site:** ambientCG (Lennart Demes) — https://ambientcg.com
- **Obtained via:** the cloud asset channel (ambientcg.com is unreachable from
  the build container). Fetched as 1K color maps from the public GitHub LFS
  mirror `PUTvision/VITALPad` (`data/textures/*_1K_Color.jpg`, master branch,
  via media.githubusercontent.com) — files carry ambientCG's canonical
  asset-ID names, verified as JPEG images after LFS resolution.
- **Modifications** (ours — `game/assets-pipeline/process-street-textures.mjs`,
  sharp): downsample to 512/1024, desaturate ×0.6 (brick_a ×0.35, brick_aged
  ×0.4), mean-luma normalize to ~0.55 (gain-capped 1.8×) so the district
  palette tint in `createEnvironmentMaterial` owns the hue; post-normalize
  contrast squeeze toward the tile mean on brick_a (×0.55), brick_aged (×0.6)
  and asphalt (×0.62) to calm per-brick confetti / crackle corduroy; baked
  overlays (sidewalk expansion joints; asphalt patch scars / cracks / oil
  stains); JPEG q78 progressive.
  KTX2/basis deferred — no encoder in this container; noted in docs/06 terms
  as the sanctioned jpg-at-512/1024 fallback for this round.

| shipped file | ambientCG source | used for |
| --- | --- | --- |
| `brick_a.jpg` | Bricks030 | building A hero wall (warm red mix) |
| `brick_b.jpg` | Bricks074 | building B (red + pale mortar) |
| `brick_aged.jpg` | Bricks073C | west-row brick + plinths (sooty aged) |
| `brick_grey.jpg` | Bricks034 | c1 massing (blue-grey, teal-tinted) |
| `asphalt.jpg` | Asphalt016 | avenue + cross street (worn, + baked wear) |
| `sidewalk.jpg` | Concrete037 | sidewalks + shore lip (+ baked 2m joints) |
| `wood.jpg` | Planks013 | storefront band / kicks / door |
| `stucco.jpg` | Concrete006 | c3 massing (smooth render) |

Runtime treatment: all maps ride the diffuse slot of the rim/ramp
`GraphicNovelPlugin` environment material (`src/engine/materials.ts`) —
graded by the palette tint, never shipped photoreal.
