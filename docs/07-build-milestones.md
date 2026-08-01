# 07 — Build Milestones (M0 → M10)

Dependency-ordered path from empty folder to the vertical slice. Each milestone ends **playable and verifiable** — never more than a few days of agent work from something you can touch on your phone. Milestones marked ∥ can run as parallel work packages (see `08-agent-playbook.md` for the agent fan-out per milestone).

> Rule of thumb: **feel before content, content before breadth.** If a milestone's "fun check" fails red-team review, the next milestone waits.

## M0 — Scaffold & pipeline (foundation, sequential)
Vite + TS strict + Babylon + PWA plugin + vitest + Playwright + ESLint boundaries. `?debug` perf overlay. Blank scene: skydome, ground plane, capsule player, virtual joystick moves it, camera rig follows. Deploys/serves; installs to home screen; works offline.
**Check:** runs on phone via LAN at 60fps; Playwright boots it headless and screenshots.

## M1 — The look (art target lock)
Graphic-novel material library: rim+ramp shader, inverted-hull outline, time-of-day lighting rig, skyline backdrop silhouette. One hero-quality test character + one city block (kit-of-parts + thin instances) as the **beauty-corner reference scene**.
**Check:** golden-hour screenshot that makes you say "that's the game." Red-team art rubric pass. Budgets green in overlay.

## M2 — Uptown streets (world shell) ∥ with M3
`cityGen` builds the full 6×6-block Uptown layout + lake edge from `city/uptown.json`. Chunk streaming, LOD rings, collision, parked cars/props, day/night cycle visuals, ambient crowd walkers (VAT), weather states.
**Check:** free-roam the whole slice on a phone at budget; walk Hennepin at dusk, lake at dawn.

## M3 — Combat core (the brawler) ∥ with M2
Fighter FSM, 3-hero squad (control one, AI two, tap-swap), combo/launcher/grab/dodge, stamina+power meters, hitstop/shake/knockback feel pass, 4 enemy archetypes, encounter orchestration in a graybox arena. Two heroes' full kits implemented as the pattern; power system fully data-driven.
**Check:** the 60-second graybox brawl is *fun on a phone* — red-team fun rubric is the gate. This is the most-iterated milestone by design.

## M4 — Integration: brawls in the streets
Combat mounted into the world: street encounters, environmental weapons, arena bounds from geometry, faction patrol triggers, loot/cash/flux drops, damage-to-props. Autosave skeleton (IndexedDB, versioned).
**Check:** roam → get jumped near the lake → win → pick up loot → save/reload on phone.

## M5 — People exist (sim v1) ∥ with M6
Clock/schedules, Tier-1/Tier-2 NPC system, opinion axes, memory log + salience decay, dialogue engine with authored pools + templating, dialogue UI. ~15 named NPCs live in Uptown with schedules and remember interactions ("you again — heard what you did on Lagoon").
**Check:** vitest sim suite green; play: befriend/offend someone, sleep, see gossip land in a third NPC's mouth.

## M6 — Interiors & interaction ∥ with M5
Interior cells for first 8 venues (bar, diner, co-op, club, tattoo, brewery, two homes), door transitions, interaction taxonomy (sit/use/buy/talk/flirt/steal/fight), venue hours, shops/economy v1, jukebox/pool-table style toys.
**Check:** full evening loop — dinner, drinks, club at midnight — all indoors, all interactive.

## M7 — Base, farm, and the compounding economy
Warehouse base with room slots (train/greenhouse/workshop/lounge/quarters), room upgrades and passive yields, flux + produce farming (base + community garden), follower units from factions, timed off-screen missions, upgrade trees purchasable (hero XP + cash + flux). Economy tuning pass against `economy.json` invariants.
**Check:** the 15-minute loop from `01-vision.md` plays end-to-end and *compounds* — day 3 is measurably richer than day 1.

## M8 — Hearts & knives (relationships + factions)
Romance/friendship tracks with milestone scenes, dates (club night/lake walk/restaurant) with choice beats, jealousy + exclusivity + gossip consequences, fade-to-black scene director, faction rep, territory control + flips, leader storylines, recruitment quests for all 10 heroes.
**Check:** recruit a hero via their arc, date someone, get caught two-timing, watch territory flip after siding in a faction clash. Tone red-team pass on every scene (bible compliance).

## M9 — Content fill to slice-complete
Remaining interiors (to ~20), full 10-hero kits + upgrade trees, dialogue pools to depth targets (every named NPC: ≥30 tagged lines), first-snow showpiece event, ambient Minnesota texture layer, sound pass (music beds per district/venue, combat SFX), onboarding first-hour flow.
**Check:** a new player's first 90 minutes with zero dev knowledge; content-coverage audit script green.

## M10 — Ship the slice
Perf hardening on real devices (thermal soak, governor tuning), save migration test, PWA polish (icons, splash, install prompt, update flow), balance pass from playtest notes, bug triage to zero-blockers. Optional: GitHub Pages deploy for shareability.
**Check:** 30fps sustained 20 min on mid-range Android; a friend can install and play unassisted.

## Parallelization map

```
M0 ──► M1 ──► M2 ──┐
        │          ├──► M4 ──► M5 ──┐
        └──► M3 ───┘         └ M6 ──┼──► M7 ──► M8 ──► M9 ──► M10
                             (5∥6)
```

M2∥M3 and M5∥M6 are the big fan-out opportunities; within every milestone, content authoring (JSON/dialogue/venues) parallelizes freely once schemas exist (end of M0).
