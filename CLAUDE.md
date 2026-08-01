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
- **Perf budgets in `docs/06-mobile-performance.md` are hard.** Draw calls ≤120 street / ≤60 interior, ≤300k tris, ≤8MB to first playable (total precache may reach 75MB — spend it on audio/variety, never mistake disk size for runtime headroom). Breach = fix before merge. Keep the `?debug` overlay honest.
- **Save compatibility:** any `SaveGame` schema change ships with a migration. Never brick a phone save.
- **Tone:** R-rated fade-to-black. Lean bold and flirty (the bible calls tameness a bug) but the hard lines in `01-vision.md` are absolute: adults only, cut away, agency respected, no explicit content.
- Event bus (`brawl.won`, `npc.witnessed`, …) is how systems talk. No cross-system direct calls.

## Working style

- Follow the author→red-team→revise loop in `08-agent-playbook.md` for every substantive package. Max 3 rounds, then escalate to Paul with a short decision memo.
- Asset routing: procedural by default; CC0 packs (Quaternius/Kenney/PolyHaven) on 2 consecutive ART failures or when a pack asset is an obvious win. All pack assets go through our shader pipeline + `public/assets/CREDITS.md`.
- **Characters are the art priority (Paul's standing ruling):** people must look great, move great, and be attachment-worthy. Rigged+animated CC0 base bodies through the rim/ramp/outline pipeline; procedural primitive humans are placeholders only, never shippable. Character ART reviews judge animation screenshots against "would you get attached?", not just budgets.
- Milestone gates are **played** (Playwright player-zero + Paul on phone), not just reviewed. Feel before content.
- Commit per surviving package, push daily. Branch: whatever Paul's current feature branch is.

## Settled cross-doc decisions (do not relitigate)

- **Factions:** 3 territorial (The Commons — Bee Toliver, lakefront; Iron Range Crew — Cass Delane, Greenway/28th; The Aldermen — Odegaard, Hennepin spine) + the non-territorial **Isles Trust** (Adelaide Wray — holds paper, not corners; no banners/flips). Final before M2.
- **Player identity (supersedes the earlier pick-your-hero ruling):** the PC is **the Anchor** — an authored 11th character: a single dad raising a bi-racial kid, the only super who can **multithread** powers (his upgrade tree = more parallel threads). He did something horrific years ago to protect his kid; it surfaces in stages and fractures public opinion (redemption and lean-into-monster are both playable). You recruit 2 squadmates from the 10-hero roster (all 10 recruitable/romanceable; slice ships 6).
- **Main arc:** the Rogue Zone — glitched robotic enforcement units ("CIVIS", fictional contractor Paradigm Civic Systems) holding the Lake Street corridor. Robots are guilt-free punching bags; the human stakes (who they flag/detain) are serious. Write it per the controversy contract in `01-vision.md`. Lore lives in `09-story-lore.md`.
- **Anchor kit canon:** `04` §1.0 rules — threads are attunement ECHOES of bonded squadmates' moves (he's a null; no innate power library). Slot Zero + 1 free slot at start → 3 free late. Signature: "Full Hands" (11 finishers total). Echo strength scales with bond level. `02` §1.8 is the systems wrapper around this.
- **The reveal has FIVE stages** (canon in `09` §5; `02` §9 implements). The secret is two objects: registry existence+authorship goes public at Stage 3; the full ledger/context is Stage 5. Stage 4 travels via the authored "school" pseudo-node (no child NPCs; 21+ generation floor stands).
- **Lore anchors:** 1918 breach = Cuyuna Range (Mississippi watershed); Ely Deep is a later second cut. Flag queue = Eli's registry SPLICED with the contractor's legacy enforcement data (Lola is legacy-flagged, not registry). Client = municipal pilot fronting a federal-shaped contract. GATE-C detentions can become unrecoverable-for-now (one named-adjacent NPC goes through mid-arc; recovery is Act 3 content). Nothing forced Eli after month six, and he knows it.
- **Protected story elements (do not simplify):** Slot Zero's unexplained lit slot; the Warden–Lucía correspondence (the last letter stays unread by the player); the wrong-order reveal + accidentally-true gossip mutations; corridor fear gets no gossip juice multiplier.
- **Time bases:** in-game clock (sleep-driven) for crops/businesses/buffs; real-world timestamps only for follower missions. Phases enum: MORN/DAY/EVE/LATE; LATE ends 3a (forced sleep); clock runs 4× slower in social/romance venues during LATE.
- **Scope:** 20 full interiors in-slice (rest are shells; arithmetic in `03` §2 is authoritative); one finisher anim per hero with pair-flavor VO garnish; venue toys are animation+buff (only the 2 date minigames are real); STEAL's "heat" is pure social fallout, no police system; businesses are the designated first cut if M7 runs long.
