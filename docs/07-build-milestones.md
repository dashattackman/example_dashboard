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
`cityGen` builds the full Uptown slice layout + lake edge from `city/uptown.json` (the map figure in `03` is authoritative for footprint). **Territory is encoded here**, using the settled faction model: 3 territorial factions + the non-territorial Isles Trust — this decision is final before M2 starts, never after. Chunk streaming, LOD rings, collision, parked cars/props, day/night cycle visuals, ambient crowd walkers (VAT), weather states.
**Check:** free-roam the whole slice on a phone at budget; walk Hennepin at dusk, lake at dawn.

## M3 — Combat core (the brawler) ∥ with M2
Fighter FSM, 3-hero squad (control one, AI two, tap-swap), combo/launcher/grab/dodge, stamina+power meters, hitstop/shake/knockback feel pass, 4 enemy archetypes (ranged + bruiser appear in the first three encounters — early fights must have decisions, per `02`), encounter orchestration in a graybox arena. Two heroes' full kits implemented as the pattern; power system fully data-driven. **Hero kits then land ~2 per milestone through M4–M8** (they're data + a few anims; never batch them at the end).
**Check:** the 60-second graybox brawl is *fun on a phone* — red-team fun rubric is the gate. This is the most-iterated milestone by design.

## M4 — Integration: brawls in the streets
Combat mounted into the world: street encounters, environmental weapons, arena bounds from geometry, faction patrol triggers, loot/cash/flux drops + splash-rating loot multiplier, damage-to-props. Autosave skeleton (IndexedDB, versioned). **M4 closes with the clock/phase API** (MORN/DAY/EVE/LATE enum, venue-hours interface) frozen — M6 depends on it; M5 implements against the same interface.
**Check:** roam → get jumped near the lake → win → pick up loot → save/reload on phone.

## M5 — People exist (sim v1) ∥ with M6
Clock/schedules, Tier-1/Tier-2 NPC system, opinion axes, memory log + salience decay, dialogue engine with authored pools + templating, dialogue UI. ~15 named NPCs live in Uptown with schedules and remember interactions ("you again — heard what you did on Lagoon").
**Check:** vitest sim suite green; play: befriend/offend someone, sleep, see gossip land in a third NPC's mouth.

## M6 — Interiors & interaction ∥ with M5
Interior cells for first 8 venues (bar, diner, co-op, club, tattoo, brewery, two homes), door transitions, interaction taxonomy (sit/use/buy/talk/flirt/steal/fight — venue toys are animation+buff in the slice; only the two date minigames are real), venue hours (consuming M4's frozen clock API), shops/economy v1.
**Check:** full evening loop — dinner, drinks, club at midnight — all indoors, all interactive.

## M7 — Base, farm, economy — and onboarding
Warehouse base with room slots (train/greenhouse/workshop/lounge/quarters), room upgrades and passive yields, flux + produce farming (base + community garden), follower units from factions, timed off-screen missions, upgrade trees purchasable (hero XP + cash + flux). Economy tuning pass against `economy.json` invariants. **Onboarding first-hour flow lands here** — economy pacing and the first hour are the same problem; don't leave it for the end.
**Check:** the 15-minute loop from `01-vision.md` plays end-to-end and *compounds* — day 3 is measurably richer than day 1; a fresh player survives hour one unassisted.

## M8 — Hearts & knives (relationships + factions)
Romance/friendship tracks with milestone scenes, dates (club night/lake walk — restaurant date is post-slice) with choice beats, jealousy + exclusivity + gossip consequences, fade-to-black scene director, faction rep, territory control + flips, leader storylines, recruitment quests for the **6 slice heroes** (all 10 are designed in `04`; 4 are post-slice content).
**Check:** recruit a hero via their arc, date someone, get caught two-timing, watch territory flip after siding in a faction clash. Tone red-team pass on every scene (bible compliance).

## M9a — Content fill
Remaining interiors to the slice target (**18 full interiors**; the rest ship as exterior shells per `03`), any hero kits not yet landed by the 2-per-milestone drumbeat, dialogue pools to depth targets (every named NPC: ≥30 tagged lines, scaled to the named cast actually in the slice).
**Check:** content-coverage audit script green (venues, kits, line counts).

## M9b — Showpiece & sound
First-snow showpiece event, ambient Minnesota texture layer, sound pass **within the 7 MB audio budget** (looping stems + faction motifs + SFX; VO stays text barks).
**Check:** a new player's first 90 minutes with zero dev knowledge, showpiece included.

## M10 — Ship the slice
Perf hardening on real devices (thermal soak, governor tuning), save migration test, PWA polish (icons, splash, install prompt, update flow), balance pass from playtest notes, bug triage to zero-blockers. Optional: GitHub Pages deploy for shareability.
**Check:** 30fps sustained 20 min on mid-range Android; a friend can install and play unassisted.

## Parallelization map

```
M0 ──► M1 ──► M2 ──┐
        │          ├──► M4 ──► M5 ──┐
        └──► M3 ───┘         └ M6 ──┼──► M7 ──► M8 ──► M9a ──► M9b ──► M10
                             (5∥6)
```

M2∥M3 and M5∥M6 are the big fan-out opportunities (M5∥M6 is only safe because the clock/phase API freezes at M4's close — both build against it); within every milestone, content authoring (JSON/dialogue/venues) parallelizes freely once schemas exist (end of M0). Hero kits and dialogue amortize across M4–M9a rather than piling up at the end.
