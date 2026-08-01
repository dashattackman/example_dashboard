# 06 — Mobile Performance Strategy

Target: **30 fps sustained on a mid-range Android (e.g. Pixel 6a / Galaxy A54 class), 60 fps on flagships**, in the browser, without thermal throttling over a 20-minute session. Performance is a feature; it gets red-teamed like everything else.

## Hard budgets (enforced by the `?debug` overlay + Playwright asserts)

| Metric | Budget (street scene, worst case: brawl + crowd) |
|---|---|
| Draw calls | ≤ **120** (interiors ≤ 60) |
| Triangles on screen | ≤ **300k** |
| Active animated skeletons | ≤ **14** (3 squad + 6 enemies + 5 ambient) |
| Texture memory | ≤ **160 MB** (KTX2/basis compressed) |
| Materials (unique shaders) | ≤ **12** live |
| JS sim tick | ≤ **4 ms** at 10 Hz |
| Time to first playable | ≤ **8 MB** — this is the sacred number (tap link → playing in seconds); everything else lazy-loads in the background |
| Total precache | ≤ **75 MB** (Paul's ruling: bigger file is fine — spend it on richness, not on runtime load). Priority order for the extra: audio > texture/outfit/facade variety > VAT crowd-animation loops > baked lighting variation. |
| Audio (within total) | ≤ **20 MB**: real looping music beds per district/venue + faction motifs, varied SFX. VO is text barks in the slice — no voice acting. |

Exceeding a budget is a build failure conversation, not a shrug.

**Download size vs runtime budgets — don't confuse them:** megabytes on disk buy content variety (music, texture sets, anim loops), never runtime headroom. Draw calls, tris, skeletons, and texture *RAM* are GPU/thermal limits that stay hard no matter how big the precache gets. The 8 MB first-playable rule also stays hard — the bigger cache fills in the background while the player is already walking around.

## City geometry: instancing is the whole game

- **Thin instances** for everything repeated: window modules, doors, cornices, streetlights, parked cars, trees, fences, patio furniture. A city block is ~6 base meshes thin-instanced hundreds of times = a handful of draw calls.
- `cityGen` builds buildings from a **kit-of-parts**: footprint extrusion (1 mesh per block, merged) + instanced facade modules. Buildings are *not* unique meshes.
- **Merged static cells**: each 100m cell's non-instanced statics merge into one mesh per material at generation time.
- **LOD**: 3×3 cells full detail → ring 2 = merged low-poly shells (no props, baked window emissive texture) → beyond = skyline backdrop mesh + fog. Interiors: only the occupied interior cell is enabled.
- **Freeze everything**: `freezeWorldMatrix()` on statics, `scene.freezeActiveMeshes()` per cell set, material freeze; unfreeze only what moves.

## Characters

- One shared rigged base body (male/female/heavy variants), **~4-6k tris each**, outfits as texture + a few attachment meshes. Faces do the identity work via a portrait system in UI, not facial animation.
- Crowd NPCs beyond the animated budget use **baked vertex-animation-texture (VAT) loops** (walk/sit/idle) — no skeletons, instanced-friendly.
- Animation set is shared; heroes get unique move anims only for their 3 powers + signature.

## The graphic-novel look, cheaply

- **Rim light**: in the base material shader (node material / material plugin), a fresnel term tinted per time-of-day — near-free, sells the whole style.
- **Outlines**: inverted-hull second pass on **characters and hero props only** (~10-14 meshes). NO screen-space post outline (kills mobile fill rate).
- **Ramp lighting**: 3-step toon-ish ramp on characters, smooth on environment — contrast reads "comic" without full cel shading.
- **No dynamic shadows** from the sun on mobile default: **blob shadows** under characters + baked AO in facade textures + strong directional rim. (Flagship "high" setting may enable one cascaded shadow map.)
- Sky = gradient skydome shader + scrolling cloud texture; neon = emissive + cheap bloom-lite (half-res glow layer) only at night, only in club district frames.
- Post stack: **none** by default. Vignette/grade folded into the sky/material colors instead.

## Textures

- Everything **KTX2/BasisU**; one 2k atlas per category (facades, interiors, props, characters). Trim sheets for building detail.
- Palette-driven: many props share one 256px gradient-palette texture (low-poly-friendly, tiny memory).

## Runtime governance

- **Device tiers** (auto-detected at boot from GPU string + a 2s hidden benchmark; user-overridable in settings). The budget table above is the **BASE tier floor** — mid-range must always play great. Flagships step UP, not the game down:
  - **BASE** (mid-range): the budget table as written. Blob shadows, no post, 0.85–1.0 DPR.
  - **HIGH** (flagship, e.g. 12–16GB-class phones): native DPR, one cascaded sun shadow map, bloom always on at night, crowd density +50% (VAT only — skeleton budget unchanged), full-res texture mips (BASE loads one mip lower from the same KTX2 files — no extra download).
  - Tiers change polish, never content or sim behavior — nobody sees a different city, and saves are identical across tiers.
  - **WebGPU**: currently **opt-in via `?webgpu`** (demoted from auto-default after an untested WGSL path blue-screened production phones at M1; both transports are now e2e-validated, incl. a real WebGPU boot in CI). **Flip-back criterion:** WebGPU returns as the automatic HIGH-tier transport after one clean real-device pass — Paul opens `?webgpu&debug` on his phone at a milestone gate and the scene renders with sane fps. Until then WebGL2 is the universal default.
- `renderer.ts` **fps governor**: if fps < 28 for 3s → step down within the current tier (hardware scaling 1.0 → 0.85 → 0.75 DPR, then crowd density, then bloom/shadows) and step back up when headroom returns — it can also demote HIGH → BASE on sustained thermal throttle. Log steps to debug overlay.
- Pause sim + render on `visibilitychange` (backgrounded tab) — battery respect is retention.
- Touch input on `pointer` events with no passive-listener violations; UI in DOM so the GPU never rasterizes menus.

## Load strategy (PWA)

- First load: engine + Uptown core cells + player heroes + UI (≤ 8 MB) → playable; remaining interiors/audio lazy-load on approach and precache in the background via the service worker.
- "Offline" promise, precisely: the core loop is offline-capable immediately after first load; the game is **fully** offline once the background precache completes (a settings-screen indicator shows precache progress).
- All content JSON is tiny; it ships eagerly. Assets are the lazy part.

## Verification loop

1. Local: `?debug` overlay (fps, draw calls, tris, materials, sim ms, governor state) always available.
2. CI/desktop: Playwright boots the game in headless Chromium (software WebGL) and asserts draw-call/tri budgets exactly — geometry budgets don't need a GPU to verify.
3. Phone: real-device pass each milestone via LAN dev server (`npm run dev -- --host` → phone). A 5-minute thermal soak in a brawl is part of the milestone checklist.
