# 03 — World: Minneapolis

**Scope contract:** This doc defines the playable world for TWIN CITIES. It obeys `01-vision.md` (tone, art, mobile budget) and coordinates with `04-characters.md` (that doc owns *people* — faction leaders, romanceables, NPC bios; this doc owns *territory, venues, and streets*). Coding agents: every venue entry below is buildable as-specced. Where a number is given, it is the number.

---

## 1. Vertical slice map — Uptown

The slice is a **5×4-block street core plus the lakefront band (west) and the Greenway strip (north)** — a **9×7 streaming-cell footprint (~900×700 m)** anchored on the real **Hennepin Ave / Lagoon Ave** crossing, extending **west to the Lake Bde Maka Ska shoreline** (beach, parkway, jogging path, pier). The **downtown skyline** sits to the **northeast as a non-enterable backdrop silhouette** — blue-violet, lit windows at night, framed at the end of Hennepin looking north. It is the signature postcard shot; never let a building block that sightline from the Hennepin/Lagoon corner.

### Street grid (real names)

- **North–south avenues, west to east (the real west-of-Hennepin sequence):** East Bde Maka Ska Pkwy (hugging the lake) → James Ave → Irving Ave → Humboldt Ave → Holmes Ave → Hennepin Ave. (Girard/Fremont/Emerson/Dupont run EAST of Hennepin in the real Wedge — off-slice; never use them west of Hennepin.)
- **East–west streets, north to south:** W 28th St → Lagoon Ave → Lake St W → W 31st St.
- **The Midtown Greenway** runs in its real below-grade trench just north of 28th — a sunken bike corridor with graffiti walls and underpass encounters. It is the slice's "back alley highway": fast traversal, low visibility, fight spawns at night.
- **The lake edge:** beach (north end), Thomas Beach-inspired sand crescent, a wooden **pier**, the paved **jogging/bike loop**, and grass parkway with benches and firepit rings.

### Slice figure — blocks + streaming cells (one figure, authoritative)

Legend: `[##]` venue (numbered, see §2 — shells marked there) · `★` base · `♣` community garden · `≈` water · `..` greenway trench · `%%` beach/sand · `##` non-enterable filler facade (window-lit shells)

Streaming-cell ruler: columns **A–I** west→east (A = water/swim band, B = beach + parkway band, C–G = the five street-block columns, H = Hennepin east frontage filler shells, I = east buffer). Rows **1–7** north→south (1 = Greenway strip, 7 = W 31st edge). Each cell ≈ 100m.

```
   cells:  A    B       C          D          E          F          G       H..I →
            NE → downtown skyline silhouette (backdrop only, unreachable)  ▲
          James      Irving    Humboldt    Holmes     Hennepin
 1 ≈≈≈ %%|.........|..........|..........|..........|..........|   MIDTOWN
   ≈≈≈ %%|... GREENWAY TRENCH (sunken, graffiti, underpasses) .|   GREENWAY
 2 ≈≈≈ %%+---------+----------+----------+----------+----------+
   ≈≈≈ %%| [18]    |  ★ BASE  | [15][16] | [13][14] | [01][02] |  W 28TH ST
 3 ≈≈≈ %%| pavilion| warehouse| fourplex |  duplex  | [03]  ## |
   ≈≈≈PIER+--------+----------+----------+----------+----------+
 4 ≈≈≈ %%| parkway | [17][28] | [11][12] | [09][10] | [04][05] |  LAGOON AVE
   ≈≈≈ %%| benches |  houses  |  ##  ##  |  ##  ##  | [06]  ## |
 5 ≈≈≈ %%+---------+----------+----------+----------+----------+
   ≈≈≈ %%| jogging | ♣ GARDEN | [19][20] | [21][22] | [07][08] |  LAKE ST W
   ≈≈≈ %%| loop    | (plots)  | [25]  ## | [23] ##  |  ##  ##  |
 6 ≈≈≈ %%+---------+----------+----------+----------+----------+
   ≈≈≈ %%| firepits| [26] ##  | [27]  ## |  [24] ## |  ##  ##  |  W 31ST ST
 7 ≈≈≈ %%| dog park|  houses  |  (rink)  |  ##  ##  |  ##  ##  |  LAKE BDE MAKA SKA ↓
```

This figure is authoritative: **5×4 street blocks** (columns C–G between the named avenues × the four block rows between the Greenway and W 31st) inside a **9×7 cell footprint**. All prose in this doc and §6 uses these numbers. The lake (swimmable shallow band, no boats in slice) bounds the footprint west and south-west.

**Anchors:**
- **★ Base — "The Fulton Works"**: converted brick warehouse on **Irving between W 28th & Lagoon**, half a block from the Greenway trench (private ramp down = your secret exit). Ground floor: garage/training room. Upper floor: squad loft. Roof: skyline view + future garden beds upgrade. This is the only player-owned interior at start.
- **♣ Community garden — "Irving Commons Plots"**: fenced plots at **Irving & Lake St**. The Stardew layer: **2 free starter beds + additional rentable beds**, compost bin, tool shed (enterable, tiny), an NPC plot-neighbor rivalry over zucchini. Crop income feeds base upgrades per pillar 3.
- **Density rule:** every block face has at minimum door-decals and lit windows; ~2-4 facades per block are true enterable venues or shells (below). Filler shells still get stoops, AC units, and porch furniture — nothing reads as flat.

---

## 2. Enterable venues & shells (18 full interiors ship in the slice)

**Ship arithmetic (one line): 18 full interiors + 6 shells + base + garden shed.** (The four HOUSING rows #13–16 are instances of one re-skinned template and are counted separately as the housing set — see build notes.) A **SHELL (post-slice)** ships exterior + door decal + hours sign only; its interior lands after the slice.

All names are lightly fictionalized — evocative of real Uptown institutions, legally safe, no verbatim trademarks. **Hours phases (canon enum across all docs):** MORN (6a–11a) / DAY (11a–5p) / EVE (5p–10p) / LATE (10p–3a; **hard sleep at 3a — the day always ends**). Function tags: SHOP / JOB / SOCIAL / ROMANCE / FACTION-HQ / HOUSING.

| # | Name | What it evokes | Function | Hours | Vibe (1 line) |
|---|------|----------------|----------|-------|---------------|
| 01 | **The Marquee** | Uptown Theater's landmark marquee, reborn as a music venue | SOCIAL · ROMANCE · JOB (stage crew) | EVE–LATE | Deco bones, sticky floor, the marquee's neon wash spills a block down Hennepin. |
| 02 | **The CC Tap** | The beloved dive bar institution | SOCIAL · ROMANCE · FACTION (Commons' informal turf) | DAY–LATE | Wood-panel dive where Moe Okonkwo knows your order and your business. |
| 03 | **Magers Row Books** | The indie bookstore | **SHELL (post-slice)** — SHOP · SOCIAL | MORN–EVE (sign) | Creaky shelves, a store cat named Ope, staff picks with feelings. |
| 04 | **The Greenway Grocer Co-op** | The Wedge co-op | SHOP · JOB (stocker shifts) | MORN–EVE | Bulk bins, kombucha on tap, a bulletin board that seeds side quests. |
| 05 | **The Velvet Antler** | The sex-positive-but-classy nightclub | SOCIAL · ROMANCE · vice storylines | LATE only | Magenta velvet, dancers, VIP rooms, a doorwoman who judges your outfit — heat, never sleaze; every fade-to-black in the game aspires to start here. |
| 06 | **Northern Ink Society** | Uptown tattoo parlor culture | SHOP (cosmetics/buffs) · SOCIAL | DAY–EVE | Flash sheets on brick, buzzing needles, Wren flirts while she works. |
| 07 | **The Hotdish House** | Classic MN diner | SHOP (food buffs) · SOCIAL · JOB (shifts) | **ALL** | Tater-tot hotdish special daily; Big Ronda runs the 2am counter and calls everyone "hon" — selectively meaning it. |
| 08 | **Falls City Taproom** | Uptown craft brewery taprooms | SOCIAL · ROMANCE | DAY–LATE | Garage doors up in summer, board games, a bearded brewer with opinions about lagers and you. |
| 09 | **Skål Gym & Ring** | Boxing/martial-arts gym | JOB (sparring income) · FACTION-HQ (**Iron Range Crew**) | MORN–EVE | Heavy bags, faded fight posters, respect earned in bruises. |
| 10 | **Lagoon Lanes** | Vintage bowling alley bar | **SHELL (post-slice)** — SOCIAL | EVE–LATE (sign) | Eight lanes, cosmic bowling Fridays, a jukebox that only plays Minnesota artists. |
| 11 | **Purple Noise Records** | Uptown record store culture | **SHELL (post-slice)** — SHOP · SOCIAL | DAY–EVE (sign) | Crate-digging, listening booth, a clerk who rates your purchases out loud. |
| 12 | **The Pawn & Loan (Nokomis Exchange)** | Corner pawnshop | SHOP (fence stolen goods) · vice | DAY–LATE | Bars on the window, everything's negotiable, no questions is the whole business model. |
| 13 | **Holmes Duplex — Upper** | Classic Uptown duplex | HOUSING (NPC home, romance venue) | keyed/invited | Sloped ceilings, string lights, a porch made for late-night conversations. |
| 14 | **Holmes Duplex — Lower** | Same building, feuding tenants | HOUSING (NPC home) | keyed/invited | Passive-aggressive Post-its in the shared entryway are canon world-building. |
| 15 | **Humboldt Fourplex** | Brick walk-up apartments | HOUSING (2 furnished NPC units + hallway) | keyed/invited | Radiator heat, bikes in the hall, thin walls that feed the gossip system. |
| 16 | **The Loring House** | Big old craftsman house-share | HOUSING · SOCIAL (house parties) | EVE–LATE events | Five roommates, one bathroom, legendary parties, someone's band practices in the basement. |
| 17 | **Ope's Corner Store** | The bodega-ish corner market | SHOP (24/7 consumables) | ALL | Fluorescent hum, scratch-offs, the owner has seen everything and tells none of it cheap. |
| 18 | **Bde Maka Ska Pavilion — "The Shorehouse"** | The lake pavilion/refectory | SOCIAL · SHOP (snacks) · ROMANCE (sunset dates) | DAY–EVE | Breezy timber pavilion, paddleboard racks, golden-hour tables that do half your flirting for you. |
| 19 | **Sister Fox Vintage** | Uptown vintage clothing | **SHELL (post-slice)** — SHOP (outfits) | DAY–EVE (sign) | Racks of decades, a fitting room with dramatic lighting, the owner styles you with terrifying accuracy. |
| 20 | **Cream & Sugar Scoop Shop** | The malt/ice-cream shop | **SHELL (post-slice)** — SHOP · ROMANCE | DAY–EVE (sign) | Pastel counter, absurd malt flavors, first-date energy baked into the booths. |
| 21 | **The Caucus Room** | Back-room politics bar | SOCIAL · FACTION-HQ (**The Aldermen**) | EVE–LATE | Leather booths, brown liquor, the corrupt councilmember's favorite table has a reserved plaque. |
| 22 | **Lake Street Laundromat ("Spin Cycle")** | 24hr laundromat | SOCIAL · quest hub · FACTION (neutral ground) | ALL | Fluorescent truce zone — all factions wash here; fights inside are the one taboo everyone honors. |
| 23 | **Grease & Steel Garage** | Indie auto shop | JOB · SHOP (gear mods + bike bench) · vice (chop-shop questline) | DAY–EVE | Engine hoists and radio static; the mechanic pays cash and asks where things came from exactly never. |
| 24 | **The Understory** | Supers-only speakeasy (vision doc callout) | SOCIAL · FACTION (cross-faction summit ground) · ROMANCE | LATE only, hidden entrance via 31st St cellar door | Below street level, password rotates weekly, the only room where all three turf leaders drink under one roof; Adelaide Wray has never set foot in it — her lawyer keeps a standing seat. |
| 25 | **Crown & Anchor Barbershop** | Corner barbershop | SOCIAL (gossip hub) · SHOP (cuts = minor charm buff) | DAY–EVE | Dre's chair — **Lake St W between Humboldt & Holmes**; two chairs, one wait bench, all of the neighborhood's news. Tiny, ships FULL. |
| 26 | **Cedar Bend Yoga (Petra's studio)** | Storefront yoga studio | SOCIAL · ROMANCE | MORN–EVE | **W 31st between James & Irving**; its front glass faces the Ice Barn's doors across Irving — load-bearing sightline for the Ingrid–Petra story. |
| 27 | **The Uptown Ice Barn** | Neighborhood ice arena ("the barn," as hockey people say) | **SHELL (post-slice)** — SOCIAL | MORN–LATE (sign) | **W 31st between Irving & Humboldt**, doors facing the yoga studio; rink hum, skate-bag kids, Zamboni visible through the glass. |
| 28 | **Farhia's Halal Market** | Small halal grocery | SHOP | MORN–EVE | **Lagoon between Irving & Humboldt, two doors from Ope's (#17)** — its own storefront, its own owner; her version of any story and Ope's owner's version never match, and both are canon. |

### Alias & mapping table (binding — resolves venue names used in `04-characters.md`)

| Alias in doc 04 | Canonical venue here | Notes |
|---|---|---|
| Moe's | The CC Tap (#02) | Bartender: Moe Okonkwo (04 owns the bio) |
| the Nite Owl | The Hotdish House (#07) | Hours are ALL; Big Ronda's 2am counter is canon |
| The Foundry | The Marquee (#01) | Same stage, same marquee |
| Vinyl Lake Records | Purple Noise Records (#11) | Shell in the slice |
| Second Skin | Northern Ink Society (#06) | Artist: Wren |
| Spoke & Dagger | Grease & Steel Garage (#23) | The bike bench is part of the shop |
| Sideshow North | *(off-slice)* | Canonically up the Greenway east of the slice; referenced in dialogue, never entered in the slice |

Farhia's Halal Market (#28) is **not** an alias of Ope's Corner Store (#17) — distinct stores, distinct owners; never merge them.

**Build notes for venue generators:** #05 and #24 gate on story progress. #13–16 are the **housing template set** — one interior template built once, re-skinned into 4 cells; they are the housing set in the ship arithmetic, not part of the 18. #22 and #24 are the two designated "truce interiors" (combat disabled). Shells: **#03, #10, #11, #19, #20, #27**. Full-interior roster (the 18): **#01, 02, 04, 05, 06, 07, 08, 09, 12, 17, 18, 21, 22, 23, 24, 25, 26, 28**. Base (★) and the garden tool shed are the two non-venue interiors.

---

## 3. Interior design language

**Cell philosophy:** interiors are **small, dense, readable** — 1 to 3 rooms max, each room a single camera-comfortable volume (~8–15m across). No load-bearing emptiness. A player entering any interior should identify all interactables within 3 seconds via silhouette + rim-light highlight (per art bible: hero props get the inked outline).

**Standard cell anatomy:**
1. **Entry beat** — door frames a composed "establishing shot" (lighting per palette rules: warm spill, neon, or window-light).
2. **The social spine** — bar counter, diner counter, checkout, or couch cluster: where NPCs anchor and conversations trigger.
3. **2–5 interactable objects minimum per interior**, drawn from the object library: jukebox, pool table, arcade cabinet (toy: animation + buff), bar seats, dartboard, bookshelf, kitchen stove, fitting room, washer/dryer, stage, tattoo chair, barber chair, heavy bag, cash register, bulletin board, bed (save/rest in owned housing only), TV, plot bed (garden).
4. **One "tell" object** — a unique prop that carries the venue's story (The CC Tap's polaroid wall; The Velvet Antler's velvet rope; the Pawn's chained display case).

**Slice toy rule (binding):** in the slice, USE on arcade cabinets, pool tables, dartboards, and lanes plays an **animation + grants a buff only** — no playable minigame behind them. The two date minigames defined in `02-gameplay.md` are the only real minigames in the slice.

**Interaction taxonomy (the complete verb set):**

| Verb | Trigger | Systems it feeds |
|------|---------|------------------|
| **SIT** | seats, benches, booths | passive social: nearby NPC convos trigger, time passes faster, eavesdrop unlocks |
| **USE** | jukebox, pool, arcade, washer, stove, bed, plot bed | toy animations + buffs (see slice toy rule), crop tending, save/rest |
| **BUY** | registers, bars, counters, vendors | economy; food buffs; outfits (charm stats); gear |
| **TALK** | any NPC | dialogue, quests, gossip intake, faction rep |
| **FLIRT** | flagged NPCs only (adults w/ agency, per tone bible) | romance meters, jealousy, reputation; rejection is written content |
| **STEAL** | flagged loot props, tip jars, back rooms | loot + heat; witnesses feed gossip; fenced at Pawn (#12) |
| **FIGHT** | provoked NPCs, faction patrols, story brawls | combat XP, territory pressure; **disabled in truce interiors (#22, #24) and all HOUSING cells** |

**Heat, defined (binding):** heat is **pure social fallout** — witnesses lose Trust in you, gossip spreads, and the controlling faction bumps prices against you on that turf. There is **no police or wanted system** in the slice.

Every interactable advertises its verb with a floating glyph at ~3m (mobile-thumb friendly, one-tap). Long-press opens the verb wheel when multiple verbs apply to one object/NPC (e.g., bartender: TALK / FLIRT / BUY).

---

## 4. Faction territory layer

Three **territorial** factions contest the slice, plus one **non-territorial** power. **`04-characters.md` owns the leaders and named members** — this doc defines turf, visuals, and flip rules. Faction names/identities here are binding; that doc fills in the people.

| Faction | Identity (1 line) | Home turf (blocks) | HQ |
|---------|-------------------|--------------------|----|
| **The Commons** | Bee Toliver's co-op, garden, and phone-tree network — protect the neighborhood's soul | Lakefront: parkway, beach, pier, Pavilion block, garden block | The Shorehouse (#18), informally The CC Tap (#02) |
| **Iron Range Crew** | Blue-collar muscle up from the trades: gyms, garages, the Greenway trench — Cass Delane's muscle and freight arm; front office at The Velvet Antler (#05) | Greenway trench + 28th St spine + garage block (Lake & Holmes) | Skål Gym (#09) |
| **The Aldermen** | Money and permits: developers, fixers, a corrupt councilmember's street-level machine — led by Councilmember Grant Odegaard; street units: Civic Shield LLC | Hennepin commercial spine (28th → Lake St) | The Caucus Room (#21) |
| **The Isles Trust** *(non-territorial)* | No banners, no turf, no flips — Adelaide Wray's Trust holds liens on blocks in all three territories; presence expressed via estate-security walkers; its rep track gates capital and society access, not corners | — | — |

**Territory-flip tech ships for exactly 3 factions, unchanged.** The Isles Trust never enters the flip system.

**Neutral cells (never flip):** Spin Cycle (#22), The Understory (#24), the base block, the garden (contested *narratively*, never mechanically — the Aldermen want to develop it; that's questline, not turf war).

**Territory visualization (3-layer readability, cheap on mobile):**
1. **Banners/flags** on lampposts at block corners — faction color + sigil (Commons: cyan wave; Iron Range: rust-orange pickhead; Aldermen: green-on-black laurel). Swapped mesh + texture, no shader cost.
2. **Graffiti decals** on Greenway walls, dumpsters, utility boxes — tags layer over rivals' tags when turf flips (decal stack, max 2 deep).
3. **Patrol NPCs** — 2-per-block faction walkers in colors, schedule-driven; they greet allies, shadow neutrals, brace hostiles. (The Isles Trust fields no patrols — only paired estate-security walkers posted near liened properties; they never contest turf.)

**What changes on a territory flip:**
- Banner/graffiti/patrol swap (visual, immediate, within one time-phase).
- **Shop prices** on that block: −10% for the controlling faction's friends, +10% if they hate you.
- **Job board** at the block's venues switches to the controller's job flavor (Commons: community gigs; Iron Range: muscle work; Aldermen: "consulting").
- **Ambient dialogue** re-skins: NPC gossip lines reference the flip for 2 in-game days.
- **Music stingers**: each faction has a 4-bar motif that colors the block's ambient bed.
- One **flip beat**: a short scripted street scene (confrontation, banner-raising, or a pointed *"well, that's different"* from a porch NPC) fires the first time the player enters flipped turf.

Flips are driven by faction-rep thresholds + completed turf jobs, not real-time war sim — deterministic, save-friendly, mobile-cheap.

---

## 5. Ambient life

**Street population by phase** (per visible block, mid-range Android budget: ≤12 ambient NPCs on screen + patrols):

| Phase | Streets | Lakefront | Notes |
|-------|---------|-----------|-------|
| MORN (6a–11a) | 4–6: dog walkers, coffee commuters, co-op deliveries | 6–8: **joggers on the loop**, tai chi on the grass | Garden NPCs tend plots |
| DAY (11a–5p) | 6–10: shoppers, patio lunchers, buskers at Hennepin/Lagoon | 8–12: beach towels, paddleboards, dog park full | Peak busker hours (guitar, bucket drummer, one theremin guy) |
| EVE (5p–10p) | 8–12: patio drinkers, date couples, porch sitters | 6–8: sunset watchers on pier, firepit circles | Golden hour — the postcard phase (Clear summer's EVE expression) |
| LATE (10p–3a) | 3–6: club lines outside #01/#05, smokers, one guy walking a cat | 1–2: skinny-dip dare NPCs (audio gag, nothing shown) | Patrols double; Greenway fight spawns active; hard sleep at 3a |

**Combat crowd rule (binding):** ambient NPCs inside a brawl's arena bounds switch to a VAT-flee animation or despawn on brawl start — no ragdoll bystanders, no crowd sim.

**Weather states (3 ship in slice):**
1. **Clear summer (default):** low warm sun, long shadows, teal dusk sky — the art bible's hero condition; **golden-hour is this state's EVE-phase expression.** 70% of play time.
2. **Rain:** wet-street cubemap boost, umbrella props, population −50%, everyone under awnings, jogger diehards persist ("it's just water, hon"). Neon reflections make it the second-prettiest state for free.
3. **First Snow (scripted showpiece event):** one-time story-calendar event — snow shader ramps in over one EVE phase, streets empty then *refill* (Minnesotans come OUT for first snow), firepits light, The Velvet Antler puts the heaters on the patio, and the skyline goes neon-on-snow per the art bible. After the event, snow becomes a rare ambient state.

**Traffic abstraction (no traffic sim):** parked cars line every street (6–10 per block face, 4 model variants + palette swaps, several with faction bumper stickers). **Passing cars** are spline ghosts: 1 car per 45–90s per street, spawns at map edge, despawns at the other, never stops, never collides (players get a soft push + honk + one salty-but-Minnesota-polite driver bark). Bikes on the Greenway use the same spline system at higher frequency. One RT-bus-inspired "**Route 6**" bus ghost crawls Hennepin twice per phase — pure set dressing, boardable never.

---

## 6. Expansion plan (post-slice district roadmap)

**Streaming assumption:** the world is a grid of **~100m cells**, streamed in a 3×3 ring around the player (interiors are separate always-resident-when-entered cells). Districts are authored as cell bundles; a district ships when its bundle + its venue interiors pass the density rule. The Uptown slice is the **9×7-cell footprint** defined in the §1 figure.

| Order | District | Gameplay identity (1 line) |
|-------|----------|---------------------------|
| 1 | **Downtown / Warehouse District** | Nightlife + corporate: club crawls, skyway infiltrations, tower lobbies, the Aldermen's real masters — verticality and money. |
| 2 | **Northeast (NE)** | Arts + breweries: gallery scene, taproom row, artist studios — the crafting/creative economy district and the Commons' cultural allies. |
| 3 | **Dinkytown / U of M** | Campus chaos: young NPCs, house shows, cheap eats, exam-season rhythms — recruitment ground for every faction. |
| 4 | **St. Paul (eventually)** | The other twin: slower, older money, capitol intrigue — a full second city with its own faction ecology and a bridge-crossing that *means something*. |

Connective tissue ships with each district: the Greenway extends east (Uptown→Downtown link, past Sideshow North), the river + Stone Arch silhouette upgrade from backdrop to walkable when Downtown lands.

---

## 7. Minnesota texture appendix (ambient lines, signage, details)

Tone: R-rated-adjacent, affectionate, never a tourism ad. Deploy via ambient VO barks, signage decals, and eavesdrop-while-SIT content.

1. Overheard: "Ope — sorry, just gonna sneak right past ya." (collision-bump bark, entire city, all factions.)
2. Overheard: "It's not Lake Calhoun, Gary, it hasn't been for years, and you know that."
3. Overheard, jogger to jogger: "It's a beautiful day. We get maybe nine of these. Shut up and run."
4. Hotdish House menu chalkboard: *"Tater Tot Hotdish — like your ma's, if your ma seasoned anything."*
5. Hotdish House sign, smaller print: *"We have salad. It has marshmallows in it."*
6. Overheard at the co-op: "I'm not saying it's a cult, I'm saying I've been a member-owner for six years and I'd die for this place."
7. Passive-aggressive Post-it in the Holmes Duplex entry: *"Whoever keeps taking my parking spot: no worries!! It's fine!!! :)"* (three exclamation points = declaration of war.)
8. Overheard outside The Velvet Antler: "It's classy. There's a coat check. Your mother would love it and that's the problem."
9. Skyway envy bark, winter/first-snow only: "Downtown people don't even own coats. Must be nice. Must be REAL nice."
10. Busker sign at Hennepin/Lagoon: *"Will play anything except that one purple song. You know why. Have some respect."*
11. Overheard: "He's a nice enough guy. Anyway—" (the harshest possible Minnesota character assassination; NPCs use it about people the player has wronged.)
12. Corner store scratch-off display: *"Someone's gotta win. Statistically it's not you. $2."*
13. Overheard at the garden plots: "Her zucchini crossed the plot line again. I've said nothing for three years. I am composing a note."
14. State Fair countdown chalkboard in the Scoop Shop shell window: *"XX days to the Great Minnesota Get-Together. We are legally required to fry something on a stick."*
15. Overheard at Falls City Taproom: "It's a crisp lager with notes of— it's beer, Kayla. It's good beer. Drink the beer."
16. CC Tap bathroom graffiti (decal): *"For a good time, learn to merge on 94."*
17. Overheard outside the Lagoon Lanes shell: "You don't have to apologize to the pins, Derek. …But it's nice that you do."
18. Goodbye loop bark (any doorway NPC pair): "Welp. Better let you go." / "Yep, s'pose." / *(neither moves for a full phase tick.)*
19. Weather bark, rain: "It's just water, hon." Weather bark, first snow: "OH it's SNOWING—" (said with genuine unironic joy by every NPC under 40 and exactly one grandma).
20. Overheard: "We should get together!" / "Totally!" (relationship system flags this pair as *never once hanging out*; gossip UI lists it as "mutual pending, 4 years.")
21. Pawn shop sign: *"WE BUY: gold, tools, amps, secrets. WE DON'T ASK: correct."*
22. Overheard outside the Marquee: "I saw everybody here before they got big. It's a curse. I'm cursed. Two beers please."
23. Dog park bark: "He's friendly!" (shouted precisely 1.5 seconds after the dog has already reached you.)
24. Lakefront argument, evergreen: "It's the best lake." / "It's the fourth-best lake and you're only saying that because you can walk to it." (never resolved; both NPCs faction-agnostic.)
25. Laundromat corkboard flyer: *"LOST: one (1) mitten. Sentimental. The left. You know what you did."*
26. First-snow event, one-time bark from a porch elder as the flakes start: "Welp. Here we go again, then." (delivered like a blessing, because it is one.)

---
*End of doc. Coordinate all named humans (faction leaders, venue owners, romanceables referenced above as roles — "the bartender," "the doorwoman," "the mechanic") through `04-characters.md`.*
