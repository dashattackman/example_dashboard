# 08 — Multi-Agent Build Playbook

How the game gets built: **author agents do the work, red-team agents attack it, revision loops converge.** This is the operating manual for the local Claude Code session driving the build. Nothing merges without surviving its critic.

## The core loop (every work package)

```
AUTHOR agent ──produces──► artifact (code / content JSON / asset / scene)
      ▲                          │
      │                          ▼
   revise ◄──verdict+notes── RED-TEAM agent (rubric below)
      │
      └─ max 3 rounds → if still failing: escalate to orchestrator
         (descope, change approach, or asset-route switch — see arbitration)
```

- Red-team verdicts are **PASS / REVISE (with specific, actionable notes) / KILL (wrong approach)**.
- Critics never fix, only critique — authors own their artifact. Different agent = different context = honest review.
- The orchestrator (main session) batches work packages per milestone (see `07-build-milestones.md` parallelization map) and is the only one who merges.

## Work-package types & who builds them

| Package | Author agent brief | Paired red-team rubric |
|---|---|---|
| **Systems code** (combat FSM, sim, chunks, save) | Senior TS engineer; pure-logic modules get vitest tests in the same package | CODE + FUN (if player-facing) |
| **Content JSON** (heroes, venues, NPCs, dialogue, economy) | Writer/designer; must validate against `content/schemas.ts`; must cite doc sections | TONE + BORING + consistency |
| **Procedural assets** (cityGen kits, characters, materials, interiors) | Tech-artist agent; delivers into the beauty-corner reference scene + screenshots via Playwright | ART + PERF |
| **CC0 asset integration** (when arbitration picks packs) | Pipeline agent: source (Quaternius/Kenney/PolyHaven), convert to glb+KTX2, restyle via our shaders, license note in `public/assets/CREDITS.md` | ART + PERF |
| **Feel/tuning** (combat feel, camera, touch, economy curves) | Tuning agent playing via Playwright scripts + explicit tuning targets | FUN |

## Red-team rubrics

Critics score 1–5 per line; any 1–2 forces REVISE with concrete notes ("boring" is not a note; "the bruiser telegraphs 1.5s — mash-through-able, no decision" is).

**FUN** — Is there a decision every ~2 seconds? Does mastery look different from mashing? Fight length in 45–90s window? Would you replay it voluntarily? Screenshot-worthy moment present? Thumb ergonomics: reachable, no gestures, fat-finger safe?

**BORING (content)** — Would a TV writer keep this character/scene in the pilot? Does this NPC want something? Is any line a line you've read in another game? Does the venue have one memorable thing? Kill clichés on sight.

**TONE** — Bible compliance both directions: (a) risqué enough — is this scene tamer than the bible promises? flag cowardice; (b) hard lines — adults only, fade-to-black held, agency respected, wit not sleaze. Minnesota voice present?

**ART** — Matches beauty-corner reference? Rim/ramp/outline consistent? Palette per district spec? Silhouette readable at phone size? Screenshot test at actual 6" scale.

**PERF** — Budgets from `06-mobile-performance.md` measured, not estimated: draw calls, tris, texture MB, sim ms. Playwright asserts attached. Any budget breach = automatic REVISE regardless of beauty.

**CODE** — Module boundaries respected (engine-only Babylon imports)? Data-driven (new content requires zero engine changes)? Tests meaningful (sim logic covered, not snapshot noise)? Save-schema migration provided if schema touched? No dead abstraction built "for later"?

## Asset-route arbitration (procedural vs CC0) — the user's standing rule

Default is procedural. Switch to CC0 pack per **asset category** when either trigger fires:

1. **Failure trigger:** a procedural asset category fails ART review **2 consecutive rounds** → next round MUST be attempted via CC0 pack; ship whichever of the two then scores higher.
2. **Obvious-win trigger:** during planning, if a pack asset already nails the need (water, street surfaces, generic props, foliage), skip procedural entirely — don't build pride projects. The ART critic makes this call in a 10-minute pre-check before any asset package starts.

Every pack asset must pass through our material pipeline (rim/ramp/palette) so nothing looks pasted-in, and gets a `CREDITS.md` line.

## Consistency desk (cross-doc/cross-content referee)

One recurring red-team agent audits **coherence**, not quality: names, numbers, and facts must match across docs and content JSON (e.g. faction count/names between `03` and `04`, currency names, venue hours vs NPC schedules, move names between hero JSON and dialogue references). Runs at every milestone close. Known open item at handoff: **doc 03 defines 3 factions; doc 04 was briefed for 4 — reconcile before M5** (recommendation: adopt doc 04's cast, map onto 03's three territories, or give the 4th faction a non-territorial niche, e.g. the syndicate operates everywhere).

## Orchestration mechanics (local session)

- Fan out authors per milestone's parallel packages **in single messages** (concurrent agents); pair each with its critic on completion — don't barrier the whole milestone on the slowest package.
- Keep package briefs self-contained: link the doc sections, the schema, the budgets, and the rubric it will face. An author who has to guess produces mush.
- **Milestone gates are played, not just reviewed**: at each M-close, a fresh "player-zero" agent (no build context) plays via Playwright + the orchestrator (or Paul, on-phone) does a feel pass. Paul's phone verdict outranks every rubric.
- Escalations after 3 failed rounds come to Paul with a one-paragraph decision memo: what failed, the two options, the recommendation.
- Commit per surviving package with the milestone tag (`M3: combat FSM + feel pass r2`); push at least daily.

## Anti-patterns (learned the hard way, enforced)

- ❌ Critic and author in the same context ("self-review theater").
- ❌ Vague REVISE notes — critics must cite the rubric line and the fix direction.
- ❌ Building breadth while a FUN gate is red (feel before content).
- ❌ Silent budget debt ("we'll optimize later") — PERF rubric is per-package, not per-milestone.
- ❌ Endless polish loops — 3 rounds then escalate; shipped-and-flagged beats perfect-and-stuck.
