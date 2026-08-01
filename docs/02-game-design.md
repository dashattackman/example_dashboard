# 02 — Game Design: Core Loops & Systems

**Binding upstream:** `01-vision.md` (pillars 1–5, tone bible). Hero roster & power kits: `04-characters.md` — this doc defines the *systems* heroes plug into, never individual kits. World/venues: `03-world-minneapolis.md`.

**All numbers below are tunable defaults.** They live in one config file (`design/tuning.json` when implemented), not scattered in code. Ambiguity is a bug: where a rule could be read two ways, the table wins.

---

## 1. Combat — Squad Brawler

### 1.1 The frame

You field a squad of 3: **the Anchor** (you — the authored player character, the 11th character sheet in `04-characters.md`, always fielded) plus **2 heroes from your recruited roster**. You directly control one; squad AI runs the other two; **tap a hero's portrait to swap instantly** (no cooldown on swap itself — swapping is a core move, not a panic button). You can hand the Anchor to AI and drive a roster hero — his threads keep running (§1.8). Streets-of-Rage DNA: side-of-street arenas, readable crowds, launchers, juggles, throws, and furniture that hurts.

**Fight length target: 45–90 seconds** for a standard street brawl. If a fight regularly runs past 2 minutes at intended power level, cut enemy HP — never add player damage nag. Boss/leader fights may run to 3 minutes, hard cap.

### 1.2 Touch controls

Left thumb: **virtual joystick** (floating origin — appears where the thumb lands, dead zone 12% of stick radius). Right thumb: **4 context buttons** in a fixed arc:

| Button | Tap | Hold (≥300ms) | Context override |
|---|---|---|---|
| **ATTACK** | light attack (chains) — **always**, no context overrides on tap | heavy attack (launcher); near a flagged prop, the hold becomes the **environmental attack** instead | — |
| **POWER** | fires the **currently-equipped power move** — heroes unlock up to 3 power moves (per `04-characters.md` / the `moves[3]` schema in `05-architecture.md`) and equip exactly 1, swappable in the squad menu | charged version if the equipped move supports it | full meter: **signature finisher** (§1.3) |
| **DODGE/GRAB** | dodge roll in stick direction | — | adjacent stunned/grabbable enemy: throw |
| **SWAP** | swap to next hero (portrait order) | radial: pick specific hero | downed ally targeted: swap-revive |

Rules that make this work on a phone:
- **No directional inputs on buttons.** Never "forward + attack." Direction comes from the stick only; buttons are pure taps/holds.
- **Generous buffering:** inputs buffer 250ms; a tap during a combo queues the next hit.
- **Auto-facing:** attacks magnetize to the nearest valid target within a 60° cone, 2.5m snap range. The player aims *intent*, the game aims *pixels*.
- **Fat targets:** every button ≥ 44pt touch target (≈88px @2x), 12pt gaps.
- Portraits (top-right, 3 stacked) are also swap targets — tap portrait = swap to that hero, works mid-combo.

### 1.3 Combo system

- **Light chain:** 3-hit string (L-L-L), each hit cancels into dodge or power. Third hit knocks back.
- **Launcher:** hold-attack pops a grunt-weight enemy 3m up, 1.2s of juggle airtime. Any hit on an airborne enemy is a **juggle hit** (+25% damage, builds power meter 2×). Bruisers need 2 launchers within 3s to pop ("heavy launch"); leaders can't be launched, only staggered.
- **Team juggling:** AI allies are tuned to contribute one hit to your juggles when in range — the "splash page" moment (pillar 2). Swapping mid-juggle keeps the juggle alive; juggle counter is squad-wide.
- **Throws:** grab a stunned/grabbed enemy → stick direction + release throws them 4m. Thrown enemies are projectiles: 1.5× impact damage to anything they hit, knockdown in a 1.5m radius. Throwing enemies into other enemies is the highest-skill, highest-reward crowd tool. Throw into a wall = wall-splat (2s stun).
- **Environmental attacks:** flagged props (parking meters, patio chairs, trash cans, bike racks, café tables) show a subtle ink-outline pulse when in range. Triggered on **ATTACK-hold** near the prop — a tap never steals your light chain (input theft is a bug class, not a tradeoff). One input, big juicy result: parking meter uproot = 3-hit club with coin-spray VFX on break; patio chair = one throw. Props respawn per-fight, 4–8 per arena. Environmental kills grant +20% material drops.
- **Signature finishers:** each **hero** has exactly ONE signature finisher (**11 total — the 10 roster heroes plus the Anchor's *Full Hands*, §1.8**; the anim budget in `06-mobile-performance.md` caps unique animations at 3 power moves + 1 signature per hero; per-pairing cinematics are explicitly out of scope). Triggered via POWER at full meter: a 2.5s canned cinematic-lite move, 400% of a light hit in a 4m radius + guaranteed knockdown, costs the full power meter. **Pair flavor is garnish, not animation:** if an ally is within 5m, they snap a canned assist pose and the pairing fires a shared VO bark line — per-pairing *data* (pose ID + bark line rows in `04-characters.md`), zero unique animation. These are the screenshot moment — camera pulls in, time dilates to 0.5× for 0.8s.

### 1.4 Stamina & power economy

Two meters, deliberately asymmetrical:

| Meter | Fills by | Spends on | Notes |
|---|---|---|---|
| **Stamina** (green, per-hero) | regen 20%/s after 1s of not spending | dodge (25%), throw (20%), heavy/launcher (15%) | Light attacks are FREE. You can always fight; stamina gates *defense and burst*, so button-mashing is viable but suboptimal, never punished with a dead hero. |
| **Power** (violet, per-hero) | landing hits (1 pt/light, 3/juggle hit, 4/throw impact), taking damage (0.5/point of HP lost) | power move (30 pts), charged power (60), signature finisher (100 = full) | Persists between fights at 50% decay. Benched heroes gain power at 30% of the active hero's rate — swapping cycles fresh meters, rewarding swap play. |

Getting hit interrupts stamina regen for 1.5s. **Second wind (precise rule):** when the **last standing hero** would drop below 1 HP, they instead survive at 1 HP with **2s of invulnerability** — once per brawl. No heal, no other trigger conditions.

### 1.5 Enemy archetypes (human)

These are the **human** archetypes; the CIVIS machine family (§1.9) is a parallel enemy class with its own rules. Readable crowds = strict archetype silhouettes and telegraphs. Every attack that deals >10% player HP has a ≥0.6s telegraph (windup pose + ink-flash outline).

| Archetype | Role | HP (× grunt) | Behavior | Counterplay |
|---|---|---|---|---|
| **Grunt** | crowd volume | 1× | approaches in arcs, attacks in max groups of 2 at once (attack-token system: only 2 melee tokens live regardless of crowd size) | anything; they're juggle food |
| **Bruiser** | armor check | 4× | slow, armored (no flinch on lights), grab-punishes mashing | heavy launch ×2, throws, environmental hits pierce armor |
| **Ranged** | positioning check | 1.5× | keeps 8m, fires telegraphed 0.8s shots, repositions when approached | dodge-cancel approach, throw a grunt at them, swap to a gap-closer hero |
| **Leader** | mini-boss, has a POWER | 8–12× | one signature superpower per leader type (shield dome, tremor slam, blink-flank, crowd-buff aura), commands grunts (buffed while leader alive) | break the power's tell; leaders take +50% damage for 3s after their power whiffs |

Crowd composition budget: a standard brawl is **8–14 enemies total, ≤6 on screen**, spawned in 2–3 waves. Waves overlap by design (next wave enters as current drops to 2) so pacing never flatlines.

### 1.6 Difficulty ramp

- **Rep-tier scaling** (see §2.3): enemy composition — not HP sponging — is the primary ramp. **Ranged and bruiser enemies both appear within the player's first three encounters** — positioning and armor are the hour-one decisions, not later unlocks. Tier 4 fights mix leaders, dual ranged, hazard arenas.
- **Hits must matter from hour one:** tier-1 grunt hit = **12% of player max HP** (tunable). Eating 3 unanswered hits is a real dent, so "tap attack again" is never the whole decision.
- **Splash Rating:** every fight ends with a D→S rating scoring move variety, juggle hits, throws, environmental use, and swap/assist play. It **visibly multiplies the loot splash ×1.0–×1.5** and is printed on it. Mash stays viable; its cost is now on every payout, so mastery is legible without damage numbers.
- Numeric scaling capped at **+15% HP / +20% damage per rep tier**. Past that, we ramp with mechanics: new leader powers, mixed-archetype waves, arena hazards (traffic, light-rail crossings, patio fire pits).
- **Rubber-banding, gently:** if the squad wipes twice on the same encounter, next attempt spawns one fewer bruiser and drops a food pickup. Invisible, never announced.
- Fights the story requires you to *lose* do not exist. Fights you can *skip via relationship or reputation* do (pillar 4).

### 1.7 What makes it fun on a phone (checklist, enforced)

1. 45–90s fights — one bus stop, one fight.
2. Zero fiddly inputs: no gestures, no double-taps, no directional-button combos.
3. Mash is viable, mastery (juggles, throws, swap-cycling, environment) is 2–3× faster, pays up to ×1.5 loot via Splash Rating, and looks incredible.
4. Every fight ends with a **loot splash** (cash + flux + materials fountain, Splash Rating stamped on it) and a squad walk-off pose. Dopamine is a deliverable.
5. Damage numbers OFF by default; hit-stop, ink-flash, and knockback communicate impact.

### 1.8 The Anchor — multithreading as a combat verb

**What threads ARE is owned by `04-characters.md` §1.0 and `09-story-lore.md` §5 (canonical). This section is the systems wrapper.** The Anchor is a **null holding other people's resonances**: his threads are **attunement echoes** of bonded squadmates' core moves. He has no generic power library — a generic library would re-break the one-resonance law (09 §2/§5). Everything he fields, someone let him hold.

**Attunement:** a bonded roster hero **consents** (authored scene at **bond 2**) → unlocks an **echo** of one of their core moves for his palette. Echoes persist whether or not the source hero is currently fielded. Echo classes mirror the canonical move classes — **Stance / Field / Strike** — e.g., a running *Black Ice* Field echo under his feet while a *Payback* Strike echo runs in his hands (04 §1.0's own example).

**Slots — explicit mapping to the round-2 numbers:** displayed slots still read **2 → 4 total**, decomposed as **Slot Zero + 1 free slot at start → Slot Zero + 3 free slots late-tree**. **Slot Zero** (binding, 04 §1.0) is permanently occupied and permanently lit — Lucía's unset resonance, held since the Act: unspendable, never droppable, hosts nothing, and reserves **zero** stamina regen (what it costs him, the stamina bar can't measure). The UI never explains it until the story does.

**Controls (unchanged):** tap POWER = fire the equipped **Strike echo**, exactly like any hero's tap; hold ≥300ms = the **thread palette** — a radial around the thumb, game time at **0.3× for up to 4s**; drag-release lights an echo on a free slot or drops a running one. Left stick keeps steering; same interaction pattern as the SWAP radial. Echoes are **fire-and-forget**: no aiming, no micromanagement — the only decision is *which echoes*, made at 0.3× time.

**Thread economics (unchanged — the per-fight decision):** each running **free** thread reserves **25% of his stamina regen** (Capacity branch improves to 20%). Two echoes = half-speed dodges; three free echoes (late tree) = massive board control on a nearly dry stamina bar. Igniting an echo costs **20 power meter**; dropping is free and instant — thread uptime competes directly with his signature.

**Branch structure — REPLACES the standard 3-branch shape (§2.1), same 21 nodes and cost curve:**

| Branch | Theme |
|---|---|
| **Capacity** | free slot 2 (node 3), free slot 3 (node 6); **class permissions** — Strike echoes at start, Stance unlocks at node 2, Field at node 4; reservation 25%→20%; palette duration |
| **Echo Fidelity** *(replaces "Library")* | an echo's strength = the **source hero's bond level** through the fidelity curve: **60% of the source move's numbers at bond 2, 80% at bond 3–4, 100% at bond 5**; branch nodes raise the floor and push the cap to **120%** ("truer than the original — he's had time to listen"). **The synergy, stated plainly: bond XP now feeds combat twice** — roster-hero XP (§2.2) AND the Anchor's echo strength. Date your squad; your threads hit harder. |
| **Braids** | two running echoes braided into one composite effect occupying both slots. Recipes are **data rows keyed to source-move pairs** — naming and flavor per pairing are owned by 04, not invented here. |

**Signature finisher — "Full Hands"** *(canon name; "Full Braid" is dead)*: for **5 seconds, every attuned echo in his loadout runs at once at full fidelity**, ignoring slot count and stamina reservation — the screen fills with everyone he's let in. Then every free thread drops. Standard 100-power cost; §1.3's assist-garnish rule applies, and 04 §1.11's Anchor barks fire off whichever hero's echo is lit.

**AI rules when a roster hero is controlled:** the AI Anchor keeps echoes running, never lights new ones, and when stamina-starved drops the highest-reservation echo first. **Progression:** the Anchor levels on combat XP and story beats only — no bond-XP spigot on yourself (§2.2 applies to roster heroes).

### 1.9 Machine enemies — the CIVIS family

Parallel enemy class to §1.5, bound by the controversy contract in 01: **machines are punchable; people are people.** No injury guilt, huge destruction physics (parts fountains, panel-shear, momentum ragdolls), and the loot is **SCRAP** — a new material lane (2–5 per unit; scrap sells for cash, so machine fights pay). Machines never drop flux, with one exception below.

| Unit | Role | HP (× grunt) | Behavior | Counterplay |
|---|---|---|---|---|
| **Scanner** | force multiplier, priority kill | 0.75× | paints/flags targets: flagged targets take +20% damage from machines and Detainers path to them; hangs back, fragile | kill first, always; throwing anything at it works |
| **Detainer** | the scary one | 3× | grabs a flagged NPC (or downed squadmate) and **tries to LEAVE** — a rescue timer (20s), never a DPS race; carrying slows it 30% | hits to its arm assembly break the grip; Field-class echoes (§1.8) and the roster's control kits (04) are counters by design |
| **Bulwark** | shield wall | 5× | frontal shield, immune from the front, anchors formations | environmental attacks and thrown bodies bypass the shield; bait the shield-raise, flank, or bowl it over |
| **Swarm drone** | dodge practice | 0.2× | groups of 5–8, telegraphed dive attacks, one-hit satisfying pops | dodge timing; each pop feeds power meter — they're batteries |
| **Warden-hand** | rare mini-boss | 10× | detached heavy manipulator chassis; grabs props and squadmates, uses the environment against YOU; the only machine that re-plans mid-fight | drops 5 flux containment cells + 12–20 scrap; capped 1 per mission |

**Why fighting machines FEELS different (behavior quirks — decisions, not waves):**
1. **They obey traffic law.** Patrols halt at crosswalks and signals, hold formation lanes, and yield to buses — exploitable ambush windows the neighborhood teaches you about ("they stop for the 21. Every time. Bless 'em.").
2. **Zero self-preservation, total directive-preservation.** They never dodge, never flee, never adapt to damage — but they instantly abandon a fight if their directive target moves. A crafted spoof beacon (§3.3 workshop) can walk an entire patrol into the lake.
3. **They announce everything, honestly.** Compliance VO telegraphs every action ("PLEASE REMAIN DETAINED. YOUR COOPERATION HAS BEEN LOGGED."). Machine fights are perfect-information sequencing puzzles — kill order and positioning — where human fights are reads and reactions.
4. **Mass, not morale.** No flinch, no fear (your Fear axis means nothing to them — §9), but momentum is king: knockback, throws, and crush physics do bonus structural damage. Bowling a Bulwark through a Scanner is the machine-fight equivalent of a juggle.

**Demolition Rating:** the machine-fight Splash Rating variant — same D→S scale, scoring chain-destruction, crush/knockback kills, Scanner-first discipline, and zero-detainments; multiplies **scrap ×1.0–×1.5**. Style still scores.

---

## 2. Progression & Upgrades

### 2.1 Per-hero upgrade trees

Every **roster hero** has **3 branches × 7 nodes** (21 nodes/hero). The Anchor keeps the 21-node/cost-curve chassis but swaps the branch themes for Capacity / Echo Fidelity / Braids (§1.8):

| Branch | Theme | Example node types |
|---|---|---|
| **Raw Power** | damage, HP, meter gain | +8% damage/node, +10% HP, +stamina cap, armor-pierce on heavies |
| **Utility** | squad & world value | AI-ally behavior upgrades, +swap bonus (swapping in grants 1s of 20% damage buff), out-of-combat perks (haggle discount, scavenge yield), squad power-meter share |
| **Signature Evolution** | the hero's signature finisher (from 04) grows | 3 evolution nodes that visibly transform the signature + 4 modifier nodes (range, charge speed, status effect). Node 7 = the "poster" version. |

Node costs: **cash + flux**, curve per node index within a branch (n = 0–6): `cost(n) = base × 1.5^n`. Defaults: cash base 100, flux base 7. That sums to ≈3,217 cash + 225 flux per branch, **≈9,650 cash + 676 flux for a full 21-node tree** — roughly 10–12 hours of mixed play for a mainline hero. (Node 7 of a branch = 1,139 cash + 80 flux.) No respec cost for Utility; Power/Signature respec costs 25% of spent flux back (choices should have light weight, not regret).

### 2.2 Hero XP — two spigots

Hero levels (1–30) gate tree tiers (nodes 1–2 free at Lv1, 3–4 at Lv10, 5–7 at Lv20).

- **Combat XP:** shared to the full squad of 3 (100% controlled hero, 70% AI allies) — swapping is never an XP tax. Benched roster heroes get 20% trickle.
- **Bond XP:** each **bond level with that hero** (friendship or romance track, §5) grants a flat hero-XP grant equal to ~one tier-appropriate brawl *and* a permanent perk (e.g., bond 3 = that hero's signature finisher costs 90 power instead of 100) — and, for attuned heroes, raises the Anchor's echo fidelity (§1.8). **Hanging out with your bruiser makes them a better bruiser.** This is pillar 3 and pillar 4 shaking hands; do not cut it for balance reasons — rebalance combat XP instead.
- **Training room** (§3) adds passive XP as a third minor spigot, capped so it never outpaces play.

### 2.3 Player Reputation (account progression)

**Rep** is account-level, earned from everything: brawls (+10–40), story beats (+50–200), faction jobs, first-time venue discoveries, bond milestones (+25). Rep tiers (5 tiers for the slice, thresholds 0 / 500 / 1500 / 3500 / 7000 — **1-indexed: tier 1 = 0 rep**, every player is tier 1 at boot):

- Gate **content**, not power: new districts' job boards, club VIP access, faction storylines, recruitable followers, base room unlocks.
- Feed the **gossip system**: NPC greeting lines and prices reference your tier ("aren't you the one from the Lagoon thing?").
- Rep never decreases from combat. It CAN take temporary district-level hits from gossip fallout (§5.5) — social consequences, not grind punishment.

### 2.4 Currencies

| Currency | Sources | Sinks | Feel |
|---|---|---|---|
| **Cash** | brawl loot, jobs, businesses, crop/dish sales | upgrade nodes, base rooms, dates, gifts, fashion | fluid, always something worth buying |
| **Flux** | brawl drops (superpowered exertion sheds charge, and charge crystallizes on charged ground — you're sweeping the arena after a fight, not looting bodies; lore per 09 §2), **flux crops** (§3), leader kills (3–8) | upgrade nodes (the real gate), signature evolutions, greenhouse seed tiers | scarcer; the combat↔farming bridge. **Parity rule: one flux plot-cycle ≈ one good brawl's flux take.** With the hard 4-plot cap (§3.2), farm and fight lanes both land on ~60 flux/real-hour mid-game — neither runs away. |

No premium currency. No energy system. Ever.

---

## 3. Base Building & Resources

### 3.1 The warehouse

One base: a converted **Uptown warehouse**, **owned from minute one** (per docs/03; docs/01's loop starts "wake at base"). At boot it is mostly derelict — the player sleeps on a **base cot, available from minute one**. The **~30-min story beat unlocks the room system**, not the building. **Grid-free room-slot system:** 8 fixed room slots — 4 open with the room-system unlock, +4 via rep: **tier 2 grants two slots, tiers 3 and 4 one each**. You assign a room *type* to a slot and level the room 1→3. **Room types may not duplicate in the slice** (spare slots are reserved for post-slice room types and decor staging). Slots differ only in cosmetics/adjacency flavor — no placement puzzle, no furniture Tetris. Decor is a separate free-placement cosmetic layer (no stats) because people love it and it costs us nothing.

### 3.2 Room types

| Room | Lv1 → Lv3 effect | Build/upgrade cost (cash + materials) | Staffing effect |
|---|---|---|---|
| **Train Room** | passive hero XP to 2 assigned heroes: 0.5%/1%/1.5% of their level bar per in-game hour | 800 / 2,000 / 5,000 | staffed follower: +50% rate |
| **Flux Greenhouse** | **4 flux plots at every level (hard cap — parity, §2.4)**; levels unlock flux crop *tiers* 1/2/3 and add 4/8 normal produce plots at Lv2/Lv3 | 1,000 / 2,500 / 6,000 | staffed: auto-waters (harvest stays manual & tactile) |
| **Workshop** | crafts gear mods & environmental "care packages"; **bot-tech lane (scrap-fed):** anti-bot gear (shield-piercer mods, spoof beacons — §1.9/§8), plus kid-related gadgets (see 04/09); Lv3 unlocks material→flux transmute (lossy, 10:1) | 600 / 1,800 / 4,500 | staffed: crafting queue 1→3 slots |
| **Lounge** | squad **morale buff**: +5/8/12% combat XP **until next sleep**, refreshed by visiting; Lv3 hosts squad hangout scenes | 500 / 1,500 / 4,000 | staffed: also +5% power meter gain |
| **Private Quarters** | the romance venue: date-night invitations, morning-after scenes (tone bible rules, §5.6); Lv2+ required to invite anyone over | 700 / 2,000 / — (Lv3 is story) | never staffed |

### 3.3 Resource loops

- **Cash:** faction jobs (repeatable, 100–400), story beats, **businesses** (rep-gated passive stakes in local venues, e.g., the co-op grocery from docs/03: 150 per in-game day, ticked on sleep, collected at base terminal, capped at 2 in-game days so it never demands login anxiety), crop & cooked-dish sales.
- **Materials:** brawl drops (every enemy, 1–3; environmental kills +20%), scavenging nodes in the world (dumpster/alley/shoreline, respawn daily), job rewards. Spent on rooms, workshop crafts.
- **Scrap:** machine-only drop (§1.9, 2–5/unit, Demolition Rating multiplies). Feeds the workshop bot-tech lane (anti-bot gear, spoof beacons, kid gadgets) and sells for cash at 5 cash/scrap — zone fights pay at parity with street brawls via scrap.
- **Flux:** §2.4. Grown, looted, transmuted (badly). Machines don't carry it (Warden-hand containment cells are the sole exception).

### 3.4 Followers (non-hero units)

Recruitable from **factions** at rep milestones and via side stories — bartenders, mechanics, retired supers, a very intense community gardener. Followers are NOT combat units. They:

1. **Staff rooms** (one each, effects above).
2. Go on **timed off-screen missions** from the base job board: 2–4 real-hour timers, party of 1–3 followers, returns cash/materials/flux/rarely a recruit lead. Success chance from follower traits vs. mission tags (shown as simple 1–3 star fit). Missions never fail catastrophically — worst case is reduced loot and a funny debrief line (pillar 4: even mission reports are characterful).

Roster cap for the slice: **8 followers**. Followers have opinions and schedules too — they're NPCs who moved in, not staff-bots.

---

## 4. Stardew Rhythm — Day Cycle & Farming

### 4.1 The clock

- **In-game day = 20 real minutes** (tunable; 1 in-game hour = 50s). Clock pauses in menus, dialogue scenes, and dates — never lose daylight to reading.
- Phases use docs/03's enum **verbatim**: **MORN** (6a–11a), **DAY** (11a–5p), **EVE** (5p–10p), **LATE** (10p–3a). 3a forces sleep (soft: screen dims, hero autowalks home, small energy penalty — no Stardew pass-out robbery). Both the enum and the hour boundaries live in `tuning.json`.
- **LATE runs long where it counts:** inside venues tagged SOCIAL or ROMANCE, the game clock runs **4× slower** during LATE — a club night is ~12+ real minutes of playable time, not a 3-minute sprint to the forced-sleep bell.
- Phases gate **NPC schedules** (pillar 1: everyone has somewhere to be) and **venue hours**: co-op grocery in MORN, gym in DAY, restaurants in EVE, clubs LATE-only. The club district is dead at 9 AM and that's correct.
- Sleeping advances to next MORN, triggers: crop growth tick, business income tick, gossip propagation, autosave. (Follower missions run on real time regardless — §3.4.)

**Time bases (convention — this table wins over any prose):**

| System | Time base |
|---|---|
| Crops (growth) | in-game clock — advance on sleep tick |
| Businesses (income accrual + 2-day cap) | in-game clock — tick on sleep |
| Buffs (lounge morale, food) | in-game clock — lounge lasts until next sleep; food buffs per-fight/per-date |
| **Follower missions** | **REAL time** (2–4 real hours), timestamp checked at load — the ONLY real-time system |
| Everything else | in-game clock |

### 4.2 Farming

Two sites: the **base greenhouse** (§3.2) and a **community garden plot** near the lake: **2 free starter beds; additional beds are rentable** for cash (per docs/03), and befriending the garden coordinator discounts the rent — relationships unlock dirt, pillar 3.

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
    BIZ -->|passive cash| B
    REP --> BIZ
    Z[ROGUE ZONE<br/>missions] -->|scrap| B
    Z -->|rep, city sentiment| REP
    Z -->|freed NPCs: bond scenes,<br/>schedules re-expand| R
    B -->|anti-bot gear, spoof beacons| Z
    REP -->|mission tiers| Z
```

Audit rule: **every system must have ≥2 outbound edges.** A proposed feature that only feeds itself gets cut (pillar 3).

### 6.2 Income vs. sinks, sanity curve

Target: a mid-game player (rep tier 3) earns **~1,500 cash + ~60 flux per real hour** of mixed play. Sinks at that stage: upgrade nodes (~340–760 cash each, nodes 4–6 on the §2.1 curve), room Lv2s (~2,000), dates (50–200), gear mods (~300). **Sanity rule: the next meaningful purchase is always ≤ 45 minutes of play away.** Price curves are geometric (×1.6 nodes, ×~2.5 room levels) against roughly linear income growth per tier — early game feels rich, late game asks for intent, nothing asks for a week.

**Price-modifier stacking:** district/territory price modifiers (docs/03), gossip-fallout modifiers (§5.5), and any other price effects **do not stack — the single worst applicable modifier wins.** Hard rule for `economy.json`.

Anti-grind guarantees: (1) no sink accepts only one currency source — everything has a combat path AND a farm/social path; (2) repeatable jobs rotate daily so no single job is ever the optimal-forever grind; (3) if telemetry shows >30% of a currency earned from one activity across the population, retune that week.

### 6.3 Money-out summary

Cash sinks in priority order of designed spend: upgrade nodes > base rooms > dates & gifts > cosmetics/fashion > consumables. Flux sinks: upgrade nodes > signature evolutions > seed tiers. Materials: rooms > workshop crafts. Nothing is cash-only-forever; cosmetics are the intended late-game cash faucet drain.

---

## 7. Session Design

### 7.1 The 5-minute phone session

Must be fully satisfying: open at base → water/harvest (≤60s) → collect business income & finished follower missions → launch **one** job-board brawl (45–90s) **or one short zone mission — INTERCEPT and BLIND are built to this length and are the prime 5-minute-session content (§8.2)** → bank loot, queue a follower mission, maybe buy one node. Every step ≤3 taps from the base terminal. A 5-minute session should always advance ≥2 systems (pillar 3 self-test).

### 7.2 The 30-minute couch session

Story beat → 2–3 brawls → a date or milestone scene → base build decision → next-day plan. The day clock (20 min) means a couch session spans ~1.5 in-game days — one full "wake to club" loop from `01-vision.md` §"15 minutes", plus change. EVE/LATE content (clubs, dates — with LATE's 4× venue dilation, §4.1) is deliberately the *deep* content: long sessions naturally drift into the social game.

### 7.3 Autosave rules

- Autosave triggers: sleep, fight end, **zone mission end (success or abort — zone state writes atomically with the save)**, scene end, room purchase, entering/leaving a building, app background/`visibilitychange` (PWA: flush to IndexedDB immediately — mobile browsers kill tabs without warning).
- **Never** save mid-fight or mid-scene; a killed tab resumes at the pre-fight/pre-scene checkpoint with resources as they were (fights are ≤90s; losing one is losing nothing).
- Single save slot + 3 rolling backup snapshots (last 3 sleep saves) for corruption recovery. Save size budget ≤ 2MB. All local; no account server in the slice.
- **Follower missions are the only real-timestamp system** (checked at load — closing the app never wastes a timer). Crops, businesses, and buffs advance on the in-game clock via sleep ticks (§4.1 time-base table); income caps (§3.3) mean staying away is never punished.

---

## 8. The Rogue Zone — the Arc as a System

The slice's main arc (01, Premise). It is a **system with state, not a quest chain** — story beats read and write the same zone state the sandbox does. Controversy-contract rules (01) bind every mission and bark in this section.

### 8.1 Zone state model

The Lake Street corridor is **6 map segments** in the slice. All state is **visible on the map overlay** — the zone is a dashboard you punch.

| State variable | Scope | Range | Moved by |
|---|---|---|---|
| `patrol_density` | per segment | 0–3 | INTERCEPT wins lower it; firmware mutations & time raise it |
| `scanner_coverage` | per segment | 0–100% | BLIND lowers it (−50% for 1 in-game day); relays rebuild over 2 days |
| `checkpoint` | per segment | active / disabled | SIEGE disables permanently (story-gated) |
| `perimeter_integrity` | zone-wide | 0–100% | SIEGE + story beats only |
| `holding_occupancy` | zone-wide | count (named NPCs listed first, by name) | Detainer captures raise it; INTERCEPT prevents, EXTRACT lowers |

### 8.2 Mission grammar — six verbs, zero wave-defense

Hard rule: **every mission's objective is a state change** in the table above. "Survive N waves" does not ship. The verbs:

| Verb | The job | Shape & length | Notes |
|---|---|---|---|
| **ESCORT** | move a flagged NPC through the corridor | 2–3 min; pick a route on the map; play it stealth-lite (time the patrols' traffic-law halts), disguised (workshop craft), or loud | the NPC has agency — they talk, they have opinions about your route |
| **INTERCEPT** | stop a Detainer convoy before it reaches holding | 60–90s brawl on a moving target; convoy timer visible | prime 5-minute-session content (§7.1) |
| **EXTRACT** | holding-site rescue | 2–3 min under timer; grip-break per detainee (§1.9 Detainer rules) | named NPCs first; rescued NPCs remember (§8.4) |
| **BLIND** | destroy Scanner relay clusters | 60–90s demolition; opens a safe window (−50% coverage, 1 day) | pairs with ESCORT: blind a segment, then run it |
| **SPOOF** | feed CIVIS false signatures at a terminal | 45s plant-and-defend, or talk your way in — the tech-hero lane (Priya, `04-characters.md`) | crafts the spoof beacons §1.9 quirk 2 exploits |
| **SIEGE** | set-piece push on zone infrastructure with faction allies | 3 min hard cap; rare, loud, story-gated | **2 in the slice** (§10) |

### 8.3 Firmware mutation — the anti-boredom engine

Every **3 in-game days** (tunable) the fleet re-syncs and its behavior **mutates**: new unit-mix weights, new patrol logic, and occasionally a hilarious new literal-minded directive (mutation deck is **12 authored entries** in the slice — e.g., patrols begin escorting food trucks after a "protect commerce" misparse; comedy per controversy contract rule 4: the bots' literal-mindedness, never anyone's fear). A zone-wide sync klaxon telegraphs it; spoofed terminals let you read the new directive early. **This is stated as the anti-boredom engine:** the zone never presents the same tactical problem two visits running, without hand-authoring new content.

**Reconciliation with story canon (binding):** the mutation clock starts at **Patch Night** (09 §6). The story mutations **M1–M6** are **scheduled deck entries** injected at their act beats — when one fires, it **consumes that cycle's pull** (no comedic mutation stacks on a story mutation's cycle). The 12-entry comedic deck fills all remaining ticks. **09 owns M1–M6 narratively**; this section owns only cadence and pull mechanics; per-mutation bot combat-behavior changes are specced with the combat AI in `05-architecture.md`.

### 8.4 Zone pressure ↔ the NPC sim

- **Pressure on:** flagged NPCs' schedules **contract** (LATE outings stop first, then EVE — they stop going out); corridor venues cut hours and lose stock; gossip carries fear tags that dent district Social buffs and date options.
- **Player wins visibly reverse it:** on the next sleep tick after a win, schedules **re-expand**, venues re-light, rescued NPCs and their circles fire gratitude beats (+Respect/+Trust across their gossip neighborhood, bond XP). **The world thanks you by living more** — pillar 1's payoff, and the loudest reward signal the zone gives.

### 8.5 Endings — the reveal ledger and zone-state resolution

The four endings (canon: 09 §6 — Sunset Patch / Accounting / Custodian / Long Winter) read one variable: the **reveal ledger** — `reveal_ledger[stage] ∈ {face_it, bury_it}`, recorded at Stages 1, 2, 3, and 5 (**Stage 4 records the chosen opening, not a verb — it has no bury-it**, 09 §5). **Endings gate on the PATTERN, not any single pick:**

- **Accounting** requires face-it at Stage 5 plus a face-it majority across Stages 1–3.
- **Custodian** requires bury-it at Stage 5 (Adelaide's door); prior burials deepen it, none is individually required.
- **Sunset Patch** is pattern-agnostic — available on any ledger and any reputation state (canon).
- **Long Winter** is triggered by an *action* (brute-forcing the perimeter before Act 3 resolves), on any pattern.

| Ending | `perimeter_integrity` | `patrol_density` | Fleet disposition | `registry_escrow` | Post-ending sim rules |
|---|---|---|---|---|---|
| **Sunset Patch** | 0 (dismantled) | 0 | bricked mid-sentence; corridor becomes salvage fields (scrap-rich harvest nodes for 2 in-game weeks) | **TRUE** — survives in backup escrow, and the ending says so | venues reopen on next sleep; schedules fully re-expand; Commons gratitude beats; sentiment normalizes on standard gossip decay |
| **Accounting** | 0 | 0 | stands down by its own logic (one completed file), then decommissioned | **FALSE** — legally destroyed on camera | opinion craters, then rebuilds **house by house: the epilogue is the gossip system running in reverse** (authored positive items propagate on normal §5.5 hop rules); corridor reopens |
| **Custodian** | 100 — repurposed, player-held | 1 zone-wide (his patrols) | active; answers to Eli | **TRUE** — he holds it | corridor machine fights end (mission board switches to directed-patrol variants); flagged schedules re-expand but GRUDGE greetings persist; Fear currency permanently live; Bee's board/vendor lockouts; Adelaide's card |
| **Long Winter** | 0 (broken, not freed) | 0 in corridor; rare single-unit encounters citywide | Warden escaped into the municipal grid mid-sentence | **TRUE** — unresolved | corridor scarred: 30% of zone venues stay dark permanently; first-snow state locks in; no gratitude wave; sentiment normalizes at 2× decay time |

---

## 9. Public Opinion & the Reveal

### 9.1 No new meter — the gossip graph IS the sentiment system

City sentiment is **an aggregate readout of the existing per-NPC opinion axes (§5.1) propagated on the existing gossip graph (§5.5)**. There is no separate global opinion variable; the "street temperature" UI is a weighted sample of nearby NPCs' axes. State this in code review terms: any PR adding a global sentiment scalar is wrong by design.

### 9.2 The reveal — five stages, five different payloads

The Act surfaces in **FIVE named stages** (canon: `09-story-lore.md` §5 owns order, content, and scenes; this section owns the mechanical payload each stage drops into the sim). Stages that inject gossip items inject them **high-salience**: fidelity 1.0 at source, 2 hops per sleep (vs. normal 1), half-speed decay. Every stage writes its verb to the reveal ledger (§8.5).

| Stage | Sim payload (mechanics) |
|---|---|
| **1. The Handshake Photo** | standard **forked gossip item**: enters weirdness-class, forks into betrayal-class on hops. **Hub curation is live** — named hub NPCs choose to amplify or refuse (Dre refuses; the Gopher Line amplifies): spread is shaped by the §5.5 graph, never scripted. |
| **2. The Architecture** | **NO gossip item.** Squad-only flag `knows_architecture` on the current squad + August. **Explicit leak condition (bury-it gone bad):** if Stage 2 was buried (lied to August) AND later any flagged squadmate's bond drops below 2, OR the player uses Fear-intimidation on any squadmate, the item enters the graph as betrayal-class at **fidelity 0.7**. Face-it never leaks — the squad keeps it. |
| **3. The Registry** | **phone-tree broadcast:** Bee's Commons tree re-tiers **every Commons NPC in one sleep tick** — the gossip system's designed maximum-load event — and plants the **`knows_the_registry_truth`** tag on every recipient. The tag gates dialogue variants and Stage-5 reactions; Adelaide's Stage-3 bury-it makes the data unprovable but **cannot remove the tag from anyone already carrying it**. |
| **4. Lucía asks** | **out-of-system — the kid channel.** Sourced from schoolyard garble of Stage 3 (fidelity-floor, mutation-heavy items reaching kids as myth); the scene is hand-written, and **no opinion mechanics fire**. This one's just for the player. |
| **5. The Ledger** | fully authored; injects the final public item and locks the ending fork against the accumulated ledger pattern (§8.5). |

Gossip math for all of the above is owned by **§5.5** — including this arc's canonized rule that **high-MISCHIEF mutations can be accidentally true** (09 §5).

**Reaction modifier table (per archetype, on reveal stages AND on bot-smashing news):**

| NPC archetype / faction | Bot-smashing wins | Reveal stages |
|---|---|---|
| Flagged community & families | +Respect +Trust (strong) — **muted after Stage 3**: GRUDGE filters gratitude | Stages 1–2: benefit of the doubt. **Stage 3: trends GRUDGE across the corridor — they do NOT rally to him** (canon, 09 §5); a written minority defends him ("the ledger is complicated"); Stage 5 reactions gate on `knows_the_registry_truth` + the ledger pattern |
| Corridor small-biz owners | +Respect; −Trust if collateral property damage that mission | mixed; a face-it Stage 5 can win them back, house by house |
| Grievance types (radio callers, lawn-sign guy) | **−Respect +Fear** — they dock you for bot-smashing | −Respect −Trust, loudly; written as textured characters per controversy contract rule 3 |
| Council / establishment | −Trust (you embarrass them) | −Trust +Fear; Stage 3 panic is genuine (they signed things) |
| Old-guard supers | per-faction (see 04/09) | +Respect from some — they knew pieces; Bee's Stage-3 fury is a mirror (09 §6) |
| Most of the city | **+Respect (cheers it)** | watches which pattern you build, stage by stage |

### 9.3 Two paths, both with teeth, neither a game-over

- **Redemption:** visible works (zone wins, EXTRACT streaks), **testimony beats** (public scenes at reveal stages), and protecting flagged NPCs convert Fear→Respect/Trust at authored milestones. Unlocks: community endorsements (corridor price floor of −10% for you — worst-wins rule still applies), volunteer ESCORT helpers, alibi/character-witness support in Testimony scenes.
- **Monster:** embrace it — **Fear becomes a usable currency.** Fear ≥25 intimidation dialogue (§5.1) expands to fight-skips, interrogations, and shakedowns of people who have it coming (point-of-view rule: targets are grievance profiteers and contractor stooges, never the flagged community). Fear ≥50 across a district sample grants **Dread aura**: human grunt-tier enemies may rout on sight. Costs: some romance tracks lock, venues go cold, kid-related scenes get harder (hooks in 04/09 — referenced, not duplicated here). Machines are immune to Fear entirely (§1.9 quirk 4) — the zone doesn't care what they call you, which is the theme, mechanized.
- Both paths clear the arc. Neither is free (01, Premise). No ending is a fail state.

---

## 10. Vertical-Slice Scope Notes

Orchestrator-final scope calls; build to these, not to the full design surface:

- **Heroes:** the slice ships **6 of the 10 heroes recruitable**. All 10 are designed in `04-characters.md`; the remaining 4 are post-slice content (their data rows exist, their recruit arcs do not).
- **Businesses (§3.3) are the designated first cut** if the base milestone runs long. Cutting them removes only a redundant passive-cash edge — the §6.1 audit rule (≥2 outbound edges per system) still holds for every remaining node without BIZ.
- **Date minigames:** only the two designed ones ship — Club Night rhythm-tap and Restaurant order-reading. The Lake Walk's stone-skipping and all other venue toys are **animation + buff interactions** in the slice (tap, watch, get the buff/bond beat), not minigames.
- **STEAL exists in-slice.** "Heat" is defined as **pure social fallout**: witness trust loss, gossip-graph spread, faction price bumps (worst-applicable-wins rule, §6.2). There is **no police/wanted system** — do not build one.
- **The Rogue Zone arc IS in-slice** — all of §8 ships: 6 corridor segments, all six mission verbs, the 12-entry mutation deck, and reveal stages Rumor/Evidence/Testimony (§9.2).
- **SIEGE set-pieces are capped at 2 in the slice.** The other five verbs are repeatable systems; SIEGE is authored spectacle and budgeted like it.

---

## Appendix: tuning defaults index

| Knob | Default | Section |
|---|---|---|
| Fight length target | 45–90s | 1.1 |
| Input buffer | 250ms | 1.2 |
| Attack-token cap (simultaneous melee) | 2 | 1.5 |
| On-screen enemy cap | 6 | 1.5 |
| Per-tier enemy scaling cap | +15% HP / +20% dmg | 1.6 |
| Tier-1 grunt hit | 12% of player max HP | 1.6 |
| Splash Rating loot multiplier | ×1.0–×1.5 (D→S) | 1.6 |
| Anchor thread slots | 2 base → 4 via tree | 1.8 |
| Thread regen reservation | 25%/thread (→20% via tree) | 1.8 |
| Thread ignition cost | 20 power; drop free | 1.8 |
| Thread palette | hold ≥300ms; 0.3× time, max 4s | 1.8 |
| Scrap per machine unit | 2–5 (Warden-hand 12–20 + 5 flux) | 1.9 |
| Scrap sale price | 5 cash/scrap | 3.3 |
| Detainer rescue timer | 20s grip-break | 1.9 |
| Demolition Rating multiplier | ×1.0–×1.5 scrap (D→S) | 1.9 |
| Tree size | 3 branches × 7 nodes | 2.1 |
| Node cost curve | 100 cash / 7 flux × 1.5^n, n = 0–6 per branch | 2.1 |
| Rep tier thresholds | 0/500/1500/3500/7000 (tier 1 = 0) | 2.3 |
| Room slots | 4 at unlock + 2 (tier 2) + 1 + 1 (tiers 3–4); no duplicate types | 3.1 |
| Flux plot cap | 4 at every greenhouse level | 3.2 |
| Follower mission timers | 2–4 real hours (only real-time system) | 3.4 |
| In-game day | 20 real minutes | 4.1 |
| Day phases | MORN/DAY/EVE/LATE; forced sleep 3a | 4.1 |
| LATE venue time dilation | 4× slower in SOCIAL/ROMANCE venues | 4.1 |
| Corridor segments | 6 | 8.1 |
| BLIND safe window | −50% coverage, 1 in-game day; relays rebuild in 2 | 8.1 |
| Firmware mutation cadence | every 3 in-game days; deck of 12 | 8.3 |
| Reveal stages | 3 (Rumor/Evidence/Testimony); gossip 2 hops/sleep, half decay | 9.2 |
| Fear currency gates | intimidation ≥25; Dread aura ≥50 (district sample) | 9.3 |
| SIEGE set-pieces in slice | 2 (3 min hard cap each) | 8.2, 10 |
| Daily farm upkeep budget | ≤60s | 4.2 |
| Opinion axes range | −100..+100 | 5.1 |
| Track levels | 0–5 both tracks | 5.2 |
| Needs buff threshold | ≥60, buff-only | 5.4 |
| Mid-game income target | 1,500 cash + 60 flux / real hr | 6.2 |
| Next-purchase horizon | ≤45 min | 6.2 |
| Save size budget | ≤2MB | 7.3 |
