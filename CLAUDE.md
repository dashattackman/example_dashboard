# CLAUDE.md — Twin Cities

Superpowered open-world life-sim/brawler set in a stylized Minneapolis. Mobile-first Babylon.js PWA.

## Read first, in order

1. `docs/01-vision.md` — pillars + **tone bible (binding, both its dares and its hard lines)**
2. `docs/07-build-milestones.md` — where we are and what's next
3. `docs/08-agent-playbook.md` — how work gets done here: author agents + red-team critics, every package
4. The doc for whatever you're touching: `02` systems, `03` world, `04` characters, `05` architecture, `06` perf

## Stack & commands

- Babylon.js 7 + TypeScript strict + Vite + vite-plugin-pwa. Game code lives in `game/`.
- `cd game && npm run dev -- --host` → playtest on phone via LAN. `npm test` (vitest), `npm run e2e` (Playwright), `npm run build`.
- Playwright uses the locally installed Chromium; e2e must pass headless (software WebGL) — geometry/budget asserts don't need a GPU.

## Non-negotiable conventions

- **Only `game/src/engine/` imports `@babylonjs/*`.** Sim/combat-logic/dialogue/save are pure TS — unit-testable without WebGL.
- **Content is data.** Heroes/NPCs/venues/dialogue/tuning live in `game/src/content/*.json`, validated by zod schemas in `content/schemas.ts`. New content must require zero engine changes.
- **Perf budgets in `docs/06-mobile-performance.md` are hard.** Draw calls ≤120 street / ≤60 interior, ≤300k tris, ≤25MB precache. Breach = fix before merge. Keep the `?debug` overlay honest.
- **Save compatibility:** any `SaveGame` schema change ships with a migration. Never brick a phone save.
- **Tone:** R-rated fade-to-black. Lean bold and flirty (the bible calls tameness a bug) but the hard lines in `01-vision.md` are absolute: adults only, cut away, agency respected, no explicit content.
- Event bus (`brawl.won`, `npc.witnessed`, …) is how systems talk. No cross-system direct calls.

## Working style

- Follow the author→red-team→revise loop in `08-agent-playbook.md` for every substantive package. Max 3 rounds, then escalate to Paul with a short decision memo.
- Asset routing: procedural by default; CC0 packs (Quaternius/Kenney/PolyHaven) on 2 consecutive ART failures or when a pack asset is an obvious win. All pack assets go through our shader pipeline + `public/assets/CREDITS.md`.
- Milestone gates are **played** (Playwright player-zero + Paul on phone), not just reviewed. Feel before content.
- Commit per surviving package, push daily. Branch: whatever Paul's current feature branch is.

## Settled cross-doc decisions (do not relitigate)

- **Factions:** 3 territorial (The Commons — Bee Toliver, lakefront; Iron Range Crew — Cass Delane, Greenway/28th; The Aldermen — Odegaard, Hennepin spine) + the non-territorial **Isles Trust** (Adelaide Wray — holds paper, not corners; no banners/flips). Final before M2.
- **Player identity:** at new game you choose your hero from the roster — that hero IS you (romance/reputation/dialogue); you recruit 2 squadmates. Slice ships 6 of the 10 heroes.
- **Time bases:** in-game clock (sleep-driven) for crops/businesses/buffs; real-world timestamps only for follower missions. Phases enum: MORN/DAY/EVE/LATE; LATE ends 3a (forced sleep); clock runs 4× slower in social/romance venues during LATE.
- **Scope:** 18 full interiors in-slice (rest are shells); one finisher anim per hero with pair-flavor VO garnish; venue toys are animation+buff (only the 2 date minigames are real); STEAL's "heat" is pure social fallout, no police system; businesses are the designated first cut if M7 runs long.
