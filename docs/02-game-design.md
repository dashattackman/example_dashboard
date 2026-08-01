# 02 — Game Design: Core Loops & Systems

**Binding upstream:** `01-vision.md` (pillars 1–5, tone bible). Hero roster & power kits: `04-characters.md` — this doc defines the *systems* heroes plug into, never individual kits. World/venues: `03-world-minneapolis.md`.

**All numbers below are tunable defaults.** They live in one config file (`design/tuning.json` when implemented), not scattered in code. Ambiguity is a bug: where a rule could be read two ways, the table wins.

---

## 1. Combat — Squad Brawler

### 1.1 The frame

You field **3 heroes** from your recruited roster. You directly control one; squad AI runs the other two; **tap a hero's portrait to swap instantly** (no cooldown on swap itself — swapping is a core move, not a panic button). Streets-of-Rage DNA: side-of-street arenas, readable crowds, launchers, juggles, throws, and furniture that hurts.

**Fight length target: 45–90 seconds** for a standard street brawl. If a fight regularly runs past 2 minutes at intended power level, cut enemy HP — never add player damage nag. Boss/leader fights may run to 3 minutes, hard cap.

### 1.2 Touch controls

Left thumb: **virtual joystick** (floating origin — appears where the thumb lands, dead zone 12% of stick radius). Right thumb: **4 context buttons** in a fixed arc:

| Button | Tap | Hold (≥300ms) | Context override |
|---|---|---|---|
| **ATTACK** | light attack (chains) | heavy attack (launcher) | near a prop: environmental attack |
| **POWER** | hero's equipped power move (kit-defined, see 04) | charged version if kit supports it | full meter + ally adjacent: **team-up finisher** |
| **DODGE/GRAB** | dodge roll in stick direction | — | adjacent stunned/grabbable enemy: throw |
| **SWAP** | swap to next hero (portrait order) | radial: pick specific hero | downed ally targeted: swap-revive |

Rules that make this work on a phone:
- **No directional inputs on buttons.** Never "forward + attack." Direction comes from the stick only; buttons are pure taps/holds.
- **Generous buffering:** inputs buffer 250ms; a tap during a combo queues the next hit.
- **Auto-facing:** attacks magnetize to the nearest valid target within a 60° cone, 2.5m snap range. The player aims *intent*, the game aims *pixels*.
- **Fat targets:** every button ≥ 88pt touch target, 12pt gaps.
- Portraits (top-right, 3 stacked) are also swap targets — tap portrait = swap to that hero, works mid-combo.

### 1.3 Combo system

- **Light chain:** 3-hit string (L-L-L), each hit cancels into dodge or power. Third hit knocks back.
- **Launcher:** hold-attack pops a grunt-weight enemy 3m up, 1.2s of juggle airtime. Any hit on an airborne enemy is a **juggle hit** (+25% damage, builds power meter 2×). Bruisers need 2 launchers within 3s to pop ("heavy launch"); leaders can't be launched, only staggered.
- **Team juggling:** AI allies are tuned to contribute one hit to your juggles when in range — the "splash page" moment (pillar 2). Swapping mid-juggle keeps the juggle alive; juggle counter is squad-wide.
- **Throws:** grab a stunned/grabbed enemy → stick direction + release throws them 4m. Thrown enemies are projectiles: 1.5× impact damage to anything they hit, knockdown in a 1.5m radius. Throwing enemies into other enemies is the highest-skill, highest-reward crowd tool. Throw into a wall = wall-splat (2s stun).
- **Environmental attacks:** flagged props (parking meters, patio chairs, trash cans, bike racks, café tables) show a subtle ink-outline pulse when in ATTACK context range. One-button use, big juicy result: parking meter uproot = 3-hit club with coin-spray VFX on break; patio chair = one throw. Props respawn per-fight, 4–8 per arena. Environmental kills grant +20% material drops.
- **Team-up finishers:** each **hero pairing** (not trio) has a named finisher — a 2.5s canned cinematic-lite move, triggered via POWER at full meter with that ally within 5m. Damage: 400% of a light hit in a 4m radius + guaranteed knockdown. Pairing moves are defined per-pair in `04-characters.md`; this doc guarantees the *slot* exists for every pair. Cost: full power meter of the controlled hero. These are the screenshot moment — camera pulls in, time dilates to 0.5× for 0.8s.

### 1.4 Stamina & power economy

Two meters, deliberately asymmetrical:

| Meter | Fills by | Spends on | Notes |
|---|---|---|---|
| **Stamina** (green, per-hero) | regen 20%/s after 1s of not spending | dodge (25%), throw (20%), heavy/launcher (15%) | Light attacks are FREE. You can always fight; stamina gates *defense and burst*, so button-mashing is viable but suboptimal, never punished with a dead hero. |
| **Power** (violet, per-hero) | landing hits (1 pt/light, 3/juggle hit, 4/throw impact), taking damage (0.5/point of HP lost) | power move (30 pts), charged power (60), team-up finisher (100 = full) | Persists between fights at 50% decay. Benched heroes gain power at 30% of the active hero's rate — swapping cycles fresh meters, rewarding swap play. |

Getting hit interrupts stamina regen for 1.5s. There is **no chip death**: at 1 HP with full squad down risk, the last standing hero gets a one-time 25% "second wind" heal per fight.

### 1.5 Enemy archetypes

Readable crowds = strict archetype silhouettes and telegraphs. Every attack that deals >10% player HP has a ≥0.6s telegraph (windup pose + ink-flash outline).

| Archetype | Role | HP (× grunt) | Behavior | Counterplay |
|---|---|---|---|---|
| **Grunt** | crowd volume | 1× | approaches in arcs, attacks in max groups of 2 at once (attack-token system: only 2 melee tokens live regardless of crowd size) | anything; they're juggle food |
| **Bruiser** | armor check | 4× | slow, armored (no flinch on lights), grab-punishes mashing | heavy launch ×2, throws, environmental hits pierce armor |
| **Ranged** | positioning check | 1.5× | keeps 8m, fires telegraphed 0.8s shots, repositions when approached | dodge-cancel approach, throw a grunt at them, swap to a gap-closer hero |
| **Leader** | mini-boss, has a POWER | 8–12× | one signature superpower per leader type (shield dome, tremor slam, blink-flank, crowd-buff aura), commands grunts (buffed while leader alive) | break the power's tell; leaders take +50% damage for 3s after their power whiffs |

Crowd composition budget: a standard brawl is **8–14 enemies total, ≤6 on screen**, spawned in 2–3 waves. Waves overlap by design (next wave enters as current drops to 2) so pacing never flatlines.

### 1.6 Difficulty ramp

- **Rep-tier scaling** (see §2.3): enemy composition — not HP sponging — is the primary ramp. Tier 1 fights are grunts + 1 bruiser; tier 4 fights mix leaders, dual ranged, hazard arenas.
- Numeric scaling capped at **+15% HP / +20% damage per rep tier**. Past that, we ramp with mechanics: new leader powers, mixed-archetype waves, arena hazards (traffic, light-rail crossings, patio fire pits).
- **Rubber-banding, gently:** if the squad wipes twice on the same encounter, next attempt spawns one fewer bruiser and drops a food pickup. Invisible, never announced.
- Fights the story requires you to *lose* do not exist. Fights you can *skip via relationship or reputation* do (pillar 4).

### 1.7 What makes it fun on a phone (checklist, enforced)

1. 45–90s fights — one bus stop, one fight.
2. Zero fiddly inputs: no gestures, no double-taps, no directional-button combos.
3. Mash is viable, mastery (juggles, throws, swap-cycling, environment) is 2–3× faster and looks incredible.
4. Every fight ends with a **loot splash** (cash + flux + materials fountain) and a squad walk-off pose. Dopamine is a deliverable.
5. Damage numbers OFF by default; hit-stop, ink-flash, and knockback communicate impact.

---

## 2. Progression & Upgrades

### 2.1 Per-hero upgrade trees

Every hero has **3 branches × 7 nodes** (21 nodes/hero):

| Branch | Theme | Example node types |
|---|---|---|
| **Raw Power** | damage, HP, meter gain | +8% damage/node, +10% HP, +stamina cap, armor-pierce on heavies |
| **Utility** | squad & world value | AI-ally behavior upgrades, +swap bonus (swapping in grants 1s of 20% damage buff), out-of-combat perks (haggle discount, scavenge yield), team-up meter share |
| **Signature Evolution** | the hero's power move (from 04) grows | 3 evolution nodes that visibly transform the signature move + 4 modifier nodes (range, charge speed, status effect). Node 7 = the "poster" version. |

Node costs: **cash + flux**, curve per node index: `cost(n) = base × 1.6^n`. Defaults: cash base 150, flux base 10. Full tree ≈ 12,600 cash + 840 flux per hero — roughly 10–12 hours of mixed play for a mainline hero. No respec cost for Utility; Power/Signature respec costs 25% of spent flux back (choices should have light weight, not regret).

### 2.2 Hero XP — two spigots

Hero levels (1–30) gate tree tiers (nodes 1–2 free at Lv1, 3–4 at Lv10, 5–7 at Lv20).

- **Combat XP:** shared to the full squad of 3 (100% controlled hero, 70% AI allies) — swapping is never an XP tax. Benched roster heroes get 20% trickle.
- **Bond XP:** each **bond level with that hero** (friendship or romance track, §5) grants a flat hero-XP grant equal to ~one tier-appropriate brawl *and* a permanent perk (e.g., bond 3 = that hero's team-up finisher costs 90 instead of 100 with you). **Hanging out with your bruiser makes them a better bruiser.** This is pillar 3 and pillar 4 shaking hands; do not cut it for balance reasons — rebalance combat XP instead.
- **Training room** (§3) adds passive XP as a third minor spigot, capped so it never outpaces play.

### 2.3 Player Reputation (account progression)

**Rep** is account-level, earned from everything: brawls (+10–40), story beats (+50–200), faction jobs, first-time venue discoveries, bond milestones (+25). Rep tiers (5 tiers for the slice, thresholds 0 / 500 / 1500 / 3500 / 7000):

- Gate **content**, not power: new districts' job boards, club VIP access, faction storylines, recruitable followers, base room unlocks.
- Feed the **gossip system**: NPC greeting lines and prices reference your tier ("aren't you the one from the Lagoon thing?").
- Rep never decreases from combat. It CAN take temporary district-level hits from gossip fallout (§5.5) — social consequences, not grind punishment.

### 2.4 Currencies

| Currency | Sources | Sinks | Feel |
|---|---|---|---|
| **Cash** | brawl loot, jobs, businesses, crop/dish sales | upgrade nodes, base rooms, dates, gifts, fashion | fluid, always something worth buying |
| **Flux** | brawl drops (crystallized from defeated supers), **flux crops** (§3), leader kills (3–8) | upgrade nodes (the real gate), signature evolutions, greenhouse seed tiers | scarcer; the combat↔farming bridge. A flux crop cycle ≈ one good brawl's drops — farmers and fighters progress at par. |

No premium currency. No energy system. Ever.

---

## 3. Base Building & Resources

### 3.1 The warehouse

One base: a converted **Uptown warehouse** (story-granted, ~30 min in). **Grid-free room-slot system:** the warehouse has **8 fixed room slots** (4 at start, +4 unlocked by rep tiers 2–4). You assign a room *type* to a slot and level the room 1→3. Slots differ only in cosmetics/adjacency flavor — no placement puzzle, no furniture Tetris. Decor is a separate free-placement cosmetic layer (no stats) because people love it and it costs us nothing.

### 3.2 Room types

| Room | Lv1 → Lv3 effect | Build/upgrade cost (cash + materials) | Staffing effect |
|---|---|---|---|
| **Train Room** | passive hero XP to 2 assigned heroes: 0.5%/1%/1.5% of their level bar per in-game hour | 800 / 2,000 / 5,000 | staffed follower: +50% rate |
| **Flux Greenhouse** | 4/8/12 flux-crop plots + normal produce plots | 1,000 / 2,500 / 6,000 | staffed: auto-waters (harvest stays manual & tactile) |
| **Workshop** | crafts gear mods & environmental "care packages"; Lv3 unlocks material→flux transmute (lossy, 10:1) | 600 / 1,800 / 4,500 | staffed: crafting queue 1→3 slots |
| **Lounge** | squad **morale buff**: +5/8/12% combat XP for the real-world day, refreshed by visiting; Lv3 hosts squad hangout scenes | 500 / 1,500 / 4,000 | staffed: also +5% power meter gain |
| **Private Quarters** | the romance venue: date-night invitations, morning-after scenes (tone bible rules, §5.6); Lv2+ required to invite anyone over | 700 / 2,000 / — (Lv3 is story) | never staffed |

### 3.3 Resource loops

- **Cash:** faction jobs (repeatable, 100–400), story beats, **businesses** (rep-gated passive stakes in local venues, e.g., the coffee co-op: 150/in-game day, collected at base terminal, 2-day cap so it never demands login anxiety), crop & cooked-dish sales.
- **Materials:** brawl drops (every enemy, 1–3; environmental kills +20%), scavenging nodes in the world (dumpster/alley/shoreline, respawn daily), job rewards. Spent on rooms, workshop crafts.
- **Flux:** §2.4. Grown, looted, transmuted (badly).

### 3.4 Followers (non-hero units)

Recruitable from **factions** at rep milestones and via side stories — bartenders, mechanics, retired supers, a very intense community gardener. Followers are NOT combat units. They:

1. **Staff rooms** (one each, effects above).
2. Go on **timed off-screen missions** from the base job board: 2–4 real-hour timers, party of 1–3 followers, returns cash/materials/flux/rarely a recruit lead. Success chance from follower traits vs. mission tags (shown as simple 1–3 star fit). Missions never fail catastrophically — worst case is reduced loot and a funny debrief line (pillar 4: even mission reports are characterful).

Roster cap for the slice: **8 followers**. Followers have opinions and schedules too — they're NPCs who moved in, not staff-bots.

---

## 4. Stardew Rhythm — Day Cycle & Farming

### 4.1 The clock

- **In-game day = 20 real minutes** (tunable; 1 in-game hour = 50s). Clock pauses in menus, dialogue scenes, and dates — never lose daylight to reading.
- Phases: **Morning** (6a–11a), **Afternoon** (11a–5p), **Evening** (5p–10p), **Night** (10p–2a). 2a forces sleep (soft: screen dims, hero autowalks home, small energy penalty — no Stardew pass-out robbery).
- Phases gate **NPC schedules** (pillar 1: everyone has somewhere to be) and **venue hours**: co-op mornings, gym afternoons, restaurants evenings, clubs night-only. The club district is dead at 9 AM and that's correct.
- Sleeping advances to next morning, triggers: crop growth tick, business income, gossip propagation, follower mission progress, autosave.

### 4.2 Farming

Two sites: the **base greenhouse** (§3.2) and a **community garden plot** near the lake (2 free plots, +2 via befriending the garden coordinator — relationships unlock dirt, pillar 3).

- **Flux crops** (greenhouse only): 3 tiers, grow in 2/4/7 in-game days, yield 8/20/45 flux. Seeds cost cash; tier 2–3 seeds are rep/story gated.
- **Normal produce** (both sites): tomatoes, sweet corn, hot peppers, herbs; 1–3 day cycles; sold for cash or cooked.
- **Tactile, not a chore:** watering is one tap-hold sweep per bed (whole bed, not per-tile), ≤10 seconds for a full greenhouse. Harvest is tap-to-pop with juicy VFX. **Total daily farm upkeep ≤ 60 seconds.** If a playtest shows >90s, cut interactions, not plots. No crop death — unwatered crops pause, never wilt (punishing absence violates the no-nag rule).
- **Cooking** (lounge kitchenette or base Lv2): recipes from NPCs. Dishes = consumable combat/social buffs (+10% damage for a fight, +charm on a date) and **date gifts** — a hotdish made from your own corn is worth 3× a store gift in bond XP, and the NPC comments on it. Cooking uses hunger-need food slot too (§5.4).

---

## 5. Relationships, Dating & Sims Needs

### 5.1 Opinion axes

Every named NPC tracks four axes toward the player, **−100..+100**: **Respect, Attraction, Fear, Trust**. Axes move from witnessed actions, dialogue choices, gifts, gossip received, and faction alignment. Axes are *inputs*, not the relationship itself — they gate which track options appear (e.g., romance confession requires Attraction ≥ 30 and Trust ≥ 10; intimidation dialogue requires Fear ≥ 25, and using it drops Trust). NPCs also hold opinions of *each other* (pillar 1); ours is just the player-facing slice of that system.

### 5.2 Tracks & milestones

Two tracks per eligible NPC: **Friendship 0–5** and **Romance 0–5** (romance available only for flagged adult romanceables — see roster in `04-characters.md` and NPC sheets in 03). Track XP from: quality time (shared activities > gift spam — gift bond XP soft-caps at 2 gifts/NPC/day), dialogue depth, remembered callbacks, dates.

Each level-up = a **milestone scene** (written, not procedural): friendship scenes reveal wants/flaws/secrets; romance milestones escalate — first flirt (R1), first date (R2), the almost-moment (R3), exclusive-or-not conversation (R4), established partner (R5). Heroes in your roster use the same system; their bond levels also pay hero XP (§2.2).

### 5.3 Dates

Dates are **designed activities**, not cutscenes: **Club Night** (rhythm-tap dance minigame + VIP choice beat), **Lake Walk** (golden-hour walk-and-talk, 3 choice beats, skippable stone-skipping toy), **Restaurant** (order-reading minigame — remembering their tastes from prior dialogue pays off — + a charged conversation). Each date: 3–5 minutes real time, costs cash (50–200), ends with a choice beat that moves axes and track XP. Great dates end on a **cut-to-black or an almost** — the morning-after or the walk-home is where the writing lands (tone bible).

### 5.4 Player needs — LIGHT

Three needs only: **Energy, Social, Hunger.** Each 0–100, decaying slowly across a day.

- Needs **gate buffs, never nag**: above 60 in a need grants its buff (Energy: +10% stamina regen; Social: +10% bond XP; Hunger/well-fed: +5% max HP). Below 60: no buff, **no debuff**, no meter icons pulsing red, no autonomy failures, no wetting yourself. This is the entire system.
- Refills: sleep (energy), any hangout/date/lounge visit (social), eating (hunger — cooked > bought).

### 5.5 Jealousy, exclusivity, gossip

- Dating multiple NPCs is allowed pre-exclusivity. Every romance R4 scene forces the **exclusivity conversation**; the NPC has a written stance (some want exclusivity, at least one canonically doesn't — variety is content).
- **Gossip propagation:** flirt/date events witnessed by NPCs (or in public venues) enter the gossip graph; each sleep tick, gossip spreads 1 social hop with decaying fidelity. A partner who *hears* you're seeing someone else: −Trust, confrontation scene next encounter (written per character: fury, ice, hurt, or amused negotiation — per their sheet).
- Cheating post-exclusivity that gets discovered: relationship drops to R2, district rep hit (−10% prices become +10% at their allied venues for 3 days), and the gossip system makes sure the *next* romanceable knows your reputation. Consequences make it fun (tone bible). Recovery arcs exist but are written, slow, and never guaranteed.
- **Rejection is real:** low-compatibility or wronged NPCs refuse tracks. Refusal scenes are written as characterful content, never a fail-buzzer.

### 5.6 Fade-to-black contract (hard rules, restated for implementers)

Per `01-vision.md` tone bible, non-negotiable: escalation → charged scene → **cut to black**; storytelling resumes at the morning-after. No explicit sex, no nudity, no underage-coded characters anywhere near romance content, no coercion mechanics, "no" from an NPC is final for that beat. Any scene file violating this fails review, full stop.

---

## 6. Economy & Sinks

### 6.1 Flow map (pillar 3 made literal)

```mermaid
graph LR
    C[COMBAT<br/>brawls, jobs] -->|cash, flux, materials, XP| U[HERO UPGRADES]
    C -->|materials| B[BASE ROOMS]
    B -->|train room: passive XP<br/>lounge: morale buff| C
    B -->|greenhouse plots| F[FARMING]
    F -->|flux crops| U
    F -->|produce| K[COOKING]
    K -->|combat buffs| C
    K -->|date gifts| R[RELATIONSHIPS]
    R -->|bond XP → hero XP<br/>+ finisher discounts| C
    R -->|garden plots, recipes,<br/>recruit leads| F
    R -->|follower recruits| B
    C -->|rep| REP[REPUTATION]
    REP -->|room slots, seeds,<br/>venues, followers| B
    REP -->|romanceable access,<br/>gossip standing| R
    BIZ[BUSINESSES] -->|passive cash| U
    REP --> BIZ
```

Audit rule: **every system must have ≥2 outbound edges.** A proposed feature that only feeds itself gets cut (pillar 3).

### 6.2 Income vs. sinks, sanity curve

Target: a mid-game player (rep tier 3) earns **~1,500 cash + ~60 flux per real hour** of mixed play. Sinks at that stage: upgrade nodes (~400–900 cash each), room Lv2s (~2,000), dates (50–200), gear mods (~300). **Sanity rule: the next meaningful purchase is always ≤ 45 minutes of play away.** Price curves are geometric (×1.6 nodes, ×~2.5 room levels) against roughly linear income growth per tier — early game feels rich, late game asks for intent, nothing asks for a week.

Anti-grind guarantees: (1) no sink accepts only one currency source — everything has a combat path AND a farm/social path; (2) repeatable jobs rotate daily so no single job is ever the optimal-forever grind; (3) if telemetry shows >30% of a currency earned from one activity across the population, retune that week.

### 6.3 Money-out summary

Cash sinks in priority order of designed spend: upgrade nodes > base rooms > dates & gifts > cosmetics/fashion > consumables. Flux sinks: upgrade nodes > signature evolutions > seed tiers. Materials: rooms > workshop crafts. Nothing is cash-only-forever; cosmetics are the intended late-game cash faucet drain.

---

## 7. Session Design

### 7.1 The 5-minute phone session

Must be fully satisfying: open at base → water/harvest (≤60s) → collect business income & finished follower missions → launch **one** job-board brawl (45–90s) → bank loot, queue a follower mission, maybe buy one node. Every step ≤3 taps from the base terminal. A 5-minute session should always advance ≥2 systems (pillar 3 self-test).

### 7.2 The 30-minute couch session

Story beat → 2–3 brawls → a date or milestone scene → base build decision → next-day plan. The day clock (20 min) means a couch session spans ~1.5 in-game days — one full "wake to club" loop from `01-vision.md` §"15 minutes", plus change. Evening/night content (clubs, dates) is deliberately the *deep* content: long sessions naturally drift into the social game.

### 7.3 Autosave rules

- Autosave triggers: sleep, fight end, scene end, room purchase, entering/leaving a building, app background/`visibilitychange` (PWA: flush to IndexedDB immediately — mobile browsers kill tabs without warning).
- **Never** save mid-fight or mid-scene; a killed tab resumes at the pre-fight/pre-scene checkpoint with resources as they were (fights are ≤90s; losing one is losing nothing).
- Single save slot + 3 rolling backup snapshots (last 3 sleep saves) for corruption recovery. Save size budget ≤ 2MB. All local; no account server in the slice.
- Timed elements (crops, missions, businesses) advance on real timestamps checked at load — closing the app never wastes them, and caps (§3.3) mean it never punishes staying away.

---

## Appendix: tuning defaults index

| Knob | Default | Section |
|---|---|---|
| Fight length target | 45–90s | 1.1 |
| Input buffer | 250ms | 1.2 |
| Attack-token cap (simultaneous melee) | 2 | 1.5 |
| On-screen enemy cap | 6 | 1.5 |
| Per-tier enemy scaling cap | +15% HP / +20% dmg | 1.6 |
| Tree size | 3 branches × 7 nodes | 2.1 |
| Node cost curve | base × 1.6^n | 2.1 |
| Rep tier thresholds | 0/500/1500/3500/7000 | 2.3 |
| Room slots | 4 + 4 rep-unlocked | 3.1 |
| Follower mission timers | 2–4 real hours | 3.4 |
| In-game day | 20 real minutes | 4.1 |
| Daily farm upkeep budget | ≤60s | 4.2 |
| Opinion axes range | −100..+100 | 5.1 |
| Track levels | 0–5 both tracks | 5.2 |
| Needs buff threshold | ≥60, buff-only | 5.4 |
| Mid-game income target | 1,500 cash + 60 flux / real hr | 6.2 |
| Next-purchase horizon | ≤45 min | 6.2 |
| Save size budget | ≤2MB | 7.3 |
