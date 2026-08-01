# TWIN CITIES

*Minneapolis, but everyone has powers — and everyone has lives.*

A mobile-first 3D open-world game: **Streets-of-Rage squad brawling** × **Invincible-style grounded supers** × **Stardew daily rhythm** × **base building** × **dating sim** × **Sims-depth people** — set in a faithful, stylized, fully-enterable Uptown Minneapolis. Built as an installable **Babylon.js PWA** that runs 30fps+ on a mid-range phone, offline after first load.

You pick your hero from a roster of **10 authored Minneapolis supers** (6 available in the vertical slice) and recruit 2 more into your squad. NPCs have schedules, memories, opinions, relationships, and gossip — they remember what you did last night, and they'll bring it up at the club. Tone is **R-rated fade-to-black**: bold, flirty, consequence-heavy, never explicit.

## Status

**Design-complete, pre-code.** This repo currently contains the full execution-ready design package. The build happens next, driven by Claude Code using the multi-agent author/red-team process in `docs/08-agent-playbook.md`.

## The design package

| Doc | What it locks down |
|---|---|
| [`docs/01-vision.md`](docs/01-vision.md) | Pitch, five pillars, tone bible, art direction (graphic-novel 3D) |
| [`docs/02-game-design.md`](docs/02-game-design.md) | Combat, progression, base/resources, farming, relationships, economy |
| [`docs/03-world-minneapolis.md`](docs/03-world-minneapolis.md) | The Uptown slice map, venues (18 full interiors in-slice + shells), factions' turf, ambient life, expansion |
| [`docs/04-characters.md`](docs/04-characters.md) | 10-hero roster, faction leaders, named NPCs, NPC-mind & gossip writing rules |
| [`docs/05-architecture.md`](docs/05-architecture.md) | Codebase layout, module rules, scene/streaming strategy, content schemas |
| [`docs/06-mobile-performance.md`](docs/06-mobile-performance.md) | Hard budgets, instancing/LOD strategy, cheap comic-look techniques |
| [`docs/07-build-milestones.md`](docs/07-build-milestones.md) | M0→M10 from empty folder to shipped vertical slice |
| [`docs/08-agent-playbook.md`](docs/08-agent-playbook.md) | Author/red-team agent orchestration, rubrics, asset arbitration |

## Continue the build locally (Windows)

```powershell
mkdir C:\xproject 2>$null
git clone https://github.com/dashattackman/example_dashboard.git C:\xproject\dagame
cd C:\xproject\dagame
git checkout claude/superhero-rpg-game-design-6imc0c
claude
```

Kickoff prompt for the local session:

> Read CLAUDE.md and all of docs/, then start executing docs/07-build-milestones.md at M0, using the author/red-team agent process in docs/08-agent-playbook.md. First deliverable: the M0 scaffold running on my phone via LAN.

Phone playtesting once `game/` exists: `cd game && npm run dev -- --host`, then open `http://<your-PC-LAN-IP>:5173` on your phone (same Wi-Fi). Milestone builds can also deploy to GitHub Pages for install-anywhere testing.
