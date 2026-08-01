# TWIN CITIES — Status (pause point, 2026-08-01)

**Play it: https://dagame-c59.pages.dev** — phone browser, add to home screen. Tap once to unlock audio. `?debug` = perf overlay · `?phase=MORN|DAY|EVE|LATE` · `?webgl2` = transport fallback.

## Where we are

**Design: complete.** Nine docs (`docs/01`–`09`), every one author-written and red-team-revised (3 adversarial rounds). Premise locked: you are **Eli Monroe, the Anchor** — single dad, null who multithreads other people's powers; the Act (the registry) surfaces in five stages; the Rogue Zone (glitched CIVIS enforcement bots on the Lake Street corridor) is the slice's main arc. Factions, 10-hero roster, full Uptown map, tone bible with hard lines, mobile perf budgets, agent playbook — all settled and internally consistent (see `CLAUDE.md` for the binding rulings).

**Built and deployed — "the Alive Corner"** (one Uptown street corner, deepened until it feels real, per Paul's focus directive):

- **Engine/platform**: Babylon 7 + TS strict + Vite PWA; WebGPU auto (validated on Paul's device + CI), WebGL2 fallback; installable, offline-capable (runtime caches for characters/audio); device tiers + fps governor designed (governor not yet implemented); fatal-error banner + device telemetry → GitHub issues (needs `GH_REPORT_TOKEN` verification — see Parked).
- **The look (M1, ART-passed)**: graphic-novel rim+ramp shader (GLSL+WGSL), inked character outlines, four graded phases (EVE golden-hour signature, LATE neon "marketing-grade" per the critic, DAY + MORN done), three CI-guarded signature frames (gate EVE, LATE avenue, lake glimpse).
- **The street**: real scanned CC0 surfaces (brick/asphalt/sidewalk via GitHub mirrors), full dressing (wires, AC units, mural, flyers, planters, bikes, alley), fake-interior window life, drifting clouds, real trees (Quaternius), sun-glint lake vista.
- **The people**: rigged/animated cast from the proven CC0 pipeline — Eli with owned identity (slate+amber), 7 ambient people with roles and schedules-by-phase, head-on avoidance, camera occlusion handling, instant-on input.
- **The sound**: phase-aware ambient beds, lo-fi spill from LAGOON RECORDS with distance falloff, gait-synced footsteps, rare night sirens — <1MB, gesture-unlocked, offline-cached.
- **The invisible layers**: combat core as pure TS (FSM, attack tokens, 4 human + 5 CIVIS archetypes, Detainer rescue timers, echo threads, splash rating) — **tuned by simulation**: mastery clears 2.52× faster than mashing, fight lengths 38–56s, all locked as regression tests; save system (IndexedDB, migrations, corruption fallback, provider registry); content schemas (38 zod schemas, 6 slice heroes as data); the whole Uptown map as tested data. **Suite: 244+ unit tests, 11 e2e (incl. real WebGPU boot), all green.**

**Process that got us here** (and continues): every package = author agent + adversarial red-team critic, max 3 rounds; standing playtest/QA agent that actually plays the build headless and files ranked reports (it caught a frame-rate-dependent movement bug, geometry collisions, and the avoidance failure). All work committed per package, deployed on push to `main` (dagame) via Cloudflare Pages.

**In flight at pause**: the Character System wave — 3 new base bodies (heavy/broad, second male, athletic female), hair-strip pipeline, per-body heights, palette-rule build asserts. Pass/fail: *is Maggie representable?* Lands, deploys, then we pause.

## Parked on Paul

1. **Corner verdict** — walk it with sound on: does it feel like a place? What's missing?
2. **Fight-length sign-off** — tuned to 30–60s skilled / ~90s bosses / mash ≈2.5× longer (deviates from docs/02's 45–90s, with rationale). Say "keep" or adjust.
3. **Telemetry check** — open `dagame-c59.pages.dev/api/report` on the phone once; report the one-line response (verifies the token pipe so the phone can file its own bug/fps reports).

## What's next (recommended order)

1. **Brawl integration (M4-lite, on this corner)** — mount the tuned combat core into the street: a CIVIS patrol encounter by the Greenway end, HUD meters + splash rating UI, hitstop/shake feel pass, scrap drops. The moment it stops being a walking sim. *Biggest fun-per-effort in the backlog.*
2. **First hero on the street** — build Marisol (or Camille) from the new body bases: recruit conversation with the dialogue engine v1 (authored pools + memory templating), bond level, then she fights beside you. Proves the whole loop: meet → charm → recruit → brawl together.
3. **Sim v1 seed** — clock driving phases for real (sleep to advance), 5–8 named NPCs with schedules/memory/opinion on this corner (the record-store clerk, Moe's-style bartender when interiors come), gossip between them. "People remember you" becomes playable.
4. **First interior** — LAGOON RECORDS enterable (door transition, browse-the-bins interaction, the clerk). Template for all 20.
5. **Then** M2 map expansion (more blocks toward the lake + Hennepin spine), per the milestone plan in `docs/07`.

Backlog beyond that lives in `docs/07` (M5–M10): base/farming, dating arcs, factions, the Rogue Zone acts, first-snow showpiece.

## Repo facts

- Repos: `dashattackman/dagame` (canonical, `main` = deployed) and `dashattackman/example_dashboard` (mirror of the working branch). Game in `game/`, docs in `docs/`, telemetry function in `functions/`.
- Budgets at pause: ≤76/120 draw calls, ~130k/300k tris, 8/14 skeletons, 2.7MB precache (8MB budget), ~16MB total assets (75MB cap).
- Every commit deploys: push to `dagame` `main` → Cloudflare Pages → the URL above (~2 min).
