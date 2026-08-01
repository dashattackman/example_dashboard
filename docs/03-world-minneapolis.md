# 03 — World: Minneapolis

**Scope contract:** This doc defines the playable world for TWIN CITIES. It obeys `01-vision.md` (tone, art, mobile budget) and coordinates with `04-characters.md` (that doc owns *people* — faction leaders, romanceables, NPC bios; this doc owns *territory, venues, and streets*). Coding agents: every venue entry below is buildable as-specced. Where a number is given, it is the number.

---

## 1. Vertical slice map — Uptown

The slice is a **4×4-block street core plus the corridor frontage east of Hennepin, the lakefront band (west), and the Greenway strip (north)** — a **9×7 streaming-cell footprint (~900×700 m)** anchored on the real **Hennepin Ave / Lagoon Ave** crossing, extending **west to the Lake Bde Maka Ska shoreline** (beach, parkway, jogging path, pier). The **downtown skyline** sits to the **northeast as a non-enterable backdrop silhouette** — blue-violet, lit windows at night, framed at the end of Hennepin looking north. It is the signature postcard shot; never let a building block that sightline from the Hennepin/Lagoon corner.

New with the main arc (binding per `01-vision.md` "Premise" + "Controversy contract"): the **CIVIS Rogue Zone** occupies the slice's **south-southeast edge** — the Lake Street corridor east of Hennepin — inside the same 9×7 footprint. Its perimeter is **visible from our streets**: procurement-beige floodlight wash against our warm sodium-orange, and signage in glitched bureaucratese (see §7). The bots are fictional-contractor hardware (Paradigm Civic Systems "CIVIS" units) — no real organization's name or insignia, ever.

### Street grid (real names)

- **North–south avenues, west to east (the real west-of-Hennepin sequence):** East Bde Maka Ska Pkwy (hugging the lake) → James Ave → Irving Ave → Humboldt Ave → Holmes Ave → Hennepin Ave. (Girard/Fremont/Emerson/Dupont run EAST of Hennepin in the real Wedge — off-slice; never use them west of Hennepin.)
- **East–west streets, north to south:** W 28th St → Lagoon Ave → Lake St W → W 31st St.
- **The Lake Street corridor** east of Hennepin is our fictionalized stretch of the real corridor — the immigrant business artery: mercado, panadería, taquería, remittance windows, twenty languages of signage. In the slice's present it sits inside the **CIVIS Rogue Zone** perimeter and reaches east toward the Midtown-Market-inspired anchor (#29). Freeing it is the main arc.
- **The Midtown Greenway** runs in its real below-grade trench just north of 28th — a sunken bike corridor with graffiti walls and underpass encounters. It is the slice's "back alley highway": fast traversal, low visibility, fight spawns at night.
- **The lake edge:** beach (north end), Thomas Beach-inspired sand crescent, a wooden **pier**, the paved **jogging/bike loop**, and grass parkway with benches and firepit rings.

### Slice figure — blocks + streaming cells (one figure, authoritative)

Legend: `[##]` venue (numbered, see §2 — shells marked there) · `★` base · `♣` community garden · `≈` water · `..` greenway trench · `%%` beach/sand · `##` non-enterable filler facade (window-lit shells) · `═ ║ ╔ ╝` CIVIS perimeter (beige floodlight wash) · `GATE-A/B/C` checkpoints · `RAMP` holding/processing site · `M1–M4` rooftop Scanner relay masts (destroyable) · `⊙` induction charging pads · `·` unmarked safe-house node (dev-only marker — never rendered on the in-game map)

Streaming-cell ruler: columns **A–I** west→east (A = water/swim band, B = beach + lake path, C = the parkway/park band west of James, **D–G = the four street-block columns** — the blocks between James / Irving / Humboldt / Holmes / Hennepin, **H–I = the Lake Street corridor east of Hennepin** — filler frontage north of Lake St, **CIVIS Rogue Zone in rows 5–7**). Rows **1–7** north→south (1 = Greenway strip, 7 = W 31st edge). Each cell ≈ 100m. **Column semantics (binding): avenue names in the figure mark column BOUNDARIES — each drawn column is the block between two avenues; a venue "on X Ave" fronts that labeled boundary.**

```
   cells: A = water/swim · B = beach + path · C–I below (letters sit in each column's border)
   ≈≈≈ %%+----C----+----D-----+----E-----+----F-----+----G-----+----H-----+----I-----+ →
            NE → downtown skyline silhouette (backdrop only, unreachable)  ▲
                 James     Irving   Humboldt   Holmes   Hennepin  (corridor east of Hennepin)
 1 ≈≈≈ %%|.........|..........|..........|..........|..........|..........|..........|   MIDTOWN
   ≈≈≈ %%|... GREENWAY TRENCH (sunken, graffiti, underpasses) ..(trench continues east →)  GREENWAY
 2 ≈≈≈ %%+---------+----------+----------+----------+----------+----------+----------+
   ≈≈≈ %%| [18]    |  ★ BASE  | [15][16] | [13][14] | [01][02] |  ##  ##  |  ##  ##  |  W 28TH ST
 3 ≈≈≈ %%| pavilion| warehouse| fourplex |  duplex  | [03]  ## |  ##  ##  |  ##  ##  |
   ≈≈≈PIER+--------+----------+----------+----------+----------+----------+----------+
 4 ≈≈≈ %%| parkway | [17][28] | [11][12] | [09][10] | [04][05] |  ##  ##  |  ##  ##  |  LAGOON AVE
   ≈≈≈ %%| benches |  houses  |  ##  ##  |  ##  ##  | [06]  ## |  ##  ##  |  ##  ##  |
 5 ≈≈≈ %%+---------+----------+----------+----------+----------+═M2═══════════════M4══╗
   ≈≈≈ %%| jogging | ♣ GARDEN | [19][20] | [21][22] | [07][08] GATE-A [30]M3 [31] [29] GATE-C ═►  LAKE ST W
   ≈≈≈ %%| loop    | (plots)  |  ##  ##  | [23][25] |  ##  ##  ║  CIVIS ROGUE ZONE   ⊙ ║  (corridor
 6 ≈≈≈ %%+---------+----------+----------+----------+----------║  RAMP ⊙⊙  [32]· shut- ║   continues
   ≈≈≈ %%| firepits| [26] ##  | [27]  ## |  [24] ## |  ##  ##  ║  M1(roof)  tered ##   ║   east —
 7 ≈≈≈ %%| dog park|  houses  |  (rink)  |  ##  ##  |  ##  ##  ╚═GATE-B═══════════════╝   post-slice)
  LAKE BDE MAKA SKA (swimmable shallow band, no boats in slice)
```

This figure is authoritative: a **4×4 street-block core** (columns D–G — the blocks between the labeled avenue boundaries — × the four block rows between the Greenway and W 31st) inside a **9×7 cell footprint** — unchanged by the zone, which occupies **cells H5–I7** and continues east off-slice. All prose in this doc and §6 uses these numbers. The lake (swimmable shallow band, no boats in slice) bounds the footprint west and south-west. Worked examples of the boundary rule: the base (column D) fronts **Irving**; the garden's plots gate at **Irving & Lake**; #26 (column D, row 6–7) sits on **W 31st between James & Irving** and faces #27 (column E) across **Irving**; #25 (column F, Lake row) sits on **Lake St W between Humboldt & Holmes** beside #23 at the **Holmes & Lake** corner.

**Anchors:**
- **★ Base — "The Fulton Works"**: converted brick warehouse on **Irving between W 28th & Lagoon**, half a block from the Greenway trench (private ramp down = your secret exit). Ground floor: garage/training room. Upper floor: squad loft. Roof: skyline view + future garden beds upgrade. This is the only player-owned interior at start.
- **♣ Community garden — "Irving Commons Plots"**: fenced plots at **Irving & Lake St**. The Stardew layer: **2 free starter beds + additional rentable beds**, compost bin, tool shed (enterable, tiny), an NPC plot-neighbor rivalry over zucchini. Crop income feeds base upgrades per pillar 3.
- **Density rule:** every block face has at minimum door-decals and lit windows; ~2-4 facades per block are true enterable venues or shells (below). Filler shells still get stoops, AC units, and porch furniture — nothing reads as flat.

### The Rogue Zone — perimeter & furniture (geography layer)

The zone's state model lives in `02-game-design.md`; this is its physical anatomy. All of it sits in **cells H5–I7** and reads from our streets.

- **Perimeter:** modular CIVIS barrier segments (procurement-beige, retroreflective chevrons, one per ~10m — instanced mesh). It crosses Lake St just east of Hennepin, runs east along the corridor's north curb, wraps the east map edge, and returns along W 31st. **Border light rule (binding):** inside/behind the wire the light wash is flat procurement-beige floodlight; our side keeps warm sodium-orange. The seam between the two is the arc's signature image — frame it from the Hotdish House windows.
- **Checkpoint gates (3):** **GATE-A** — Lake St at Hennepin, the west gate; pedestrian queue lanes, a Scanner arch, a PR easel. This is the gate Uptown sees daily. **GATE-B** — W 31st at the zone's southwest corner (a couple short blocks down 31st from The Understory's cellar door — deliberately close, never touching). **GATE-C** — Lake St at the east map edge; vehicle-scaled, where Detainer convoys exit toward the off-slice corridor.
- **Holding/processing site — "the Ramp":** a commandeered municipal parking structure mid-zone (cell H6–H7). Ground level: induction pads + processing kiosks. Upper decks: holding pens behind privacy scrim (we stage dread by implication, never spectacle — controversy contract rule 4). Roof: mast M1.
- **Scanner relay masts (4, rooftop, destroyable):** M1 on the Ramp roof, M2 above GATE-A, M3 mid-corridor above [30], M4 on the mercado block roof. Each mast projects a visible scan-sweep cone at night; destroying one (per 02's BLIND missions) kills the beige floodlights block by block in its radius — the world's most legible progress bar.
- **Induction charging pads:** two-bay pad cluster inside the Ramp (units dock ~20 min, eyes-down — stealth windows) and one street pad by GATE-C.
- **Zone signage:** every gate, barrier segment, and the Ramp facade carries glitched-bureaucratese boilerplate (canonical strings in §7). Fictional contractor branding only: **Paradigm Civic Systems** wordmark, "CIVIS" unit stencils. No real org's name or insignia, ever.

---

## 2. Enterable venues & shells (20 full interiors ship in the slice)

**Ship arithmetic, as amended for the Rogue Zone arc (one line): 20 full interiors + 7 shells + base + garden shed + 1 unmarked micro-cell (#32).** That is round 1's 18 fulls **+ #29 (mercado) + #30 (panadería)** — both arc-critical; round 1's 6 shells **+ #31 (corridor taquería, the first storefront to visibly re-open as the zone recedes)**; #32 (safe-house node) is a single unmarked story room budgeted with the non-venue interiors, not the 20. The four HOUSING rows #13–16 remain one re-skinned template counted separately as the housing set — see build notes. A **SHELL (post-slice)** ships exterior + door decal + hours sign only; its interior lands after the slice.

All names are lightly fictionalized — evocative of real Uptown institutions, legally safe, no verbatim trademarks. **Hours phases (canon enum across all docs):** MORN (6a–11a) / DAY (11a–5p) / EVE (5p–10p) / LATE (10p–3a; **hard sleep at 3a — the day always ends**). Function tags: SHOP / JOB / SOCIAL / ROMANCE / FACTION-HQ / HOUSING.

| # | Name | What it evokes | Function | Hours | Vibe (1 line) |
|---|------|----------------|----------|-------|---------------|
| 01 | **The Marquee** | Uptown Theater's landmark marquee, reborn as a music venue | SOCIAL · ROMANCE · JOB (stage crew) | EVE–LATE | Deco bones, sticky floor, the marquee's neon wash spills a block down Hennepin. |
| 02 | **The CC Tap** | The beloved dive bar institution | SOCIAL · ROMANCE · FACTION (Commons' informal turf) | DAY–LATE | Wood-panel dive where Moe Okonkwo knows your order and your business; locals of a certain age still call it the Wheelhouse (see `09-story-lore.md`). |
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
| 28 | **Farhia's Halal Market** | Small halal grocery | SHOP | MORN–EVE | **Lagoon between James & Irving, two doors from Ope's (#17)** — its own storefront, its own owner; her version of any story and Ope's owner's version never match, and both are canon. |
| 29 | **Mercado Estrella del Norte** | Midtown-Global-Market-style mercado hall (the corridor's anchor) | SHOP · SOCIAL · JOB (stall shifts) · **arc-critical** | MORN–EVE, curfew-truncated under zone control; recovers LATE hours as the zone recedes | One big hall, many stalls — tamales and sambusas, a remittance window, a two-chair barber, a botánica; twenty flags on the rafters and zero intention of leaving. Inside the wire. FULL. |
| 30 | **La Golondrina Panadería** | Corridor family bakery — **the kid's maternal family's store** (family names owned by `04-characters.md`) | SHOP · SOCIAL · **arc-critical** | MORN–DAY under occupation; MORN–EVE when freed — first-light bake starts at MORN open (6a); no 4 a.m. phase exists, hard sleep at 3a stands | Conchas at dawn, a wall of family photos the camera lingers on, the good radio station; the back kitchen hosts more than baking. Inside the wire. FULL. |
| 31 | **Taquería El Relámpago** | Corridor taquería | **SHELL (post-slice)** — SHOP | shuttered at ship; exterior **re-opens** (shutters up, lightning bolt repainted, music on) as the zone recedes | Steel shutters and a hand-painted lightning bolt; the first light to come back on when you push the wire — the world thanking you, in storefront form. |
| 32 | **The Quiet Door** | Safe-house network node | unmarked · story-revealed — no sign, no hours, no shop economy | story-gated | An unlisted door between corridor storefronts; one room — cots, coffee, a laminated map of routes nobody photographs. Micro-cell; never appears on the in-game map or minimap. |

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

**Build notes for venue generators:** #05, #24, and #32 gate on story progress. #13–16 are the **housing template set** — one interior template built once, re-skinned into 4 cells; they are the housing set in the ship arithmetic, not part of the 20. #22 and #24 are the two designated "truce interiors" (combat disabled); combat is also disabled inside #30 and #32 (family and sanctuary cells — the fight happens at the wire, never in them). Shells: **#03, #10, #11, #19, #20, #27, #31**. Full-interior roster (the 20): **#01, 02, 04, 05, 06, 07, 08, 09, 12, 17, 18, 21, 22, 23, 24, 25, 26, 28, 29, 30**. Non-venue interiors: base (★), the garden tool shed, and the unmarked micro-cell #32. Corridor venues #29–31 carry a **zone-state hours modifier** (see §5) — author their hours as (occupied → freed) pairs, not constants.

---

## 3. Interior design language

**Cell philosophy:** interiors are **small, dense, readable** — 1 to 3 rooms max, each room a single camera-comfortable volume (~8–15m across). No load-bearing emptiness. A player entering any interior should identify all interactables within 3 seconds via silhouette + rim-light highlight (per art bible: hero props get the inked outline).

**Standard cell anatomy:**
1. **Entry beat** — door frames a composed "establishing shot" (lighting per palette rules: warm spill, neon, or window-light).
2. **The social spine** — bar counter, diner counter, checkout, or couch cluster: where NPCs anchor and conversations trigger.
3. **2–5 interactable objects minimum per interior**, drawn from the object library: jukebox, pool table, arcade cabinet (toy: animation + buff), bar seats, dartboard, bookshelf, kitchen stove, fitting room, washer/dryer, stage, tattoo chair, barber chair, heavy bag, cash register, bulletin board, bed (save/rest in owned housing only), TV, plot bed (garden).
4. **One "tell" object** — a unique prop that carries the venue's story (The CC Tap's polaroid wall; The Velvet Antler's velvet rope; the Pawn's chained display case).

**Slice toy rule (binding):** in the slice, USE on arcade cabinets, pool tables, dartboards, and lanes plays an **animation + grants a buff only** — no playable minigame behind them. The two date minigames defined in `02-game-design.md` are the only real minigames in the slice.

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

### The Rogue Zone overlay (NOT a fourth flip faction — implementers, read this twice)

The CIVIS Rogue Zone is **its own overlay layer with its own state model** (defined in `02-game-design.md`'s zone-system section). Zone cells carry zone-state (pressure / perimeter / patrol values) layered **on top of** whatever faction turf they sit on or border. **Do not wedge the zone into the banner/graffiti/flip pipeline** — separate data, separate renderer, separate progression. Territory-flip tech still ships for exactly 3 factions, unchanged. Truce rules unaffected: Spin Cycle (#22) and The Understory (#24) stay neutral; the Understory's 31st St cellar door sits a couple short blocks off the wire, on purpose.

**What each faction does at the border:**
- **The Aldermen** signed the CIVIS procurement (Civic Shield co-signed; Odegaard's name is on Contract Amendment 14-C). They want it **quiet**: a PR easel at GATE-A, "pilot program" language on every flyer, and money spent keeping news vans on the far side of Hennepin. Their patrols do not approach the wire; their fixers do.
- **The Isles Trust** holds the paper — the contractor's municipal lease and liens on corridor property. Adelaide Wray profits whether the zone stands or falls; estate-security walkers appear at the perimeter's edge exactly twice a week to "inspect the collateral," and never once look at the people in the queue.
- **The Commons** run the **warning tree** — Bee Toliver's phone chain propagates patrol and convoy movements ahead of the bots (ambient barks reference it; see §7) — plus sanctuary logistics: the garden tool shed doubles as a supply depot, and the Shorehouse quietly hosts displaced families after close.
- **The Iron Range Crew** smuggles people and goods through — Greenway trench to the 31st St alleys, past GATE-B's blind corner. The garage's (#23) chop-shop questline grows a strand: a delivery van the Scanners reliably misclassify. For a fee. Usually.

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

### The Rogue Zone in the world sim

State model owned by `02-game-design.md`'s zone system; this is the street-level rendering contract.

**CIVIS patrols by phase:**

| Phase | Inside the wire | At the gates / visible from our streets |
|-------|-----------------|------------------------------------------|
| MORN | Scanner pairs walk the stall rows; pad rotations begin | Queue forms at GATE-A ~7a — flagged NPCs on **contracted schedules** line up for work passes, visible from the Hotdish House windows |
| DAY | Densest Scanner coverage; units dock ~20 min per pad cycle (stealth windows) | Checkpoint throughput theater; the PR easel gets refreshed; kids chalk the sidewalk just outside the wire |
| EVE | Perimeter floodlights ramp — beige wash hardens against our sodium-orange; patrols contract inward | Corridor shutters come down early; curfew klaxon on high-pressure days |
| LATE | **Detainer convoys move** — Ramp ↔ GATE-C, wrong-beige running lights, loudspeaker courtesy lines (§7). Deliberately routed where nightlife players on Hennepin will see them | Greenway smuggle runs; BLIND-mission windows on masts M1–M4 |

**Zone-state rendering (the world visibly thanks you):** as zone pressure drops — GATE-A queues shorten, then vanish; shuttered corridor storefronts **re-open one by one** (#31 first: shutters up, lightning bolt repainted, music on); the mercado's hours extend into EVE, then LATE; string lights cross Lake St; flagged NPCs' contracted schedules relax back into free schedules — the corridor's regulars start turning up at OUR venues again (a mercado barber arguing lagers at Falls City is the reward made flesh). As pressure rises: the inverse, plus the curfew klaxon and a second Detainer on every convoy.

**Firmware-mutation days:** on mutation ticks (02 owns the cadence), patrol logic changes **visibly** for that day — new routes, new glitch tics (units ticketing parked cars in triplicate, saluting fire hydrants, reclassifying pigeons as unlicensed drones). Always readable from the street so players can plan around it. Destroying a mast (BLIND missions) blacks out its radius: the beige floodlights die block by block — the game's most legible progress bar.

---

## 6. Expansion plan (post-slice district roadmap)

**Streaming assumption:** the world is a grid of **~100m cells**, streamed in a 3×3 ring around the player (interiors are separate always-resident-when-entered cells). Districts are authored as cell bundles; a district ships when its bundle + its venue interiors pass the density rule. The Uptown slice is the **9×7-cell footprint** defined in the §1 figure.

| Order | District | Gameplay identity (1 line) |
|-------|----------|---------------------------|
| 1 | **Downtown / Warehouse District** | Nightlife + corporate: club crawls, skyway infiltrations, tower lobbies, the Aldermen's real masters — verticality and money. |
| 2 | **Northeast (NE)** | Arts + breweries: gallery scene, taproom row, artist studios — the crafting/creative economy district and the Commons' cultural allies. |
| 3 | **Dinkytown / U of M** | Campus chaos: young NPCs, house shows, cheap eats, exam-season rhythms — recruitment ground for every faction. |
| 4 | **St. Paul (eventually)** | The other twin: slower, older money, capitol intrigue — a full second city with its own faction ecology and a bridge-crossing that *means something*. |

Connective tissue ships with each district: the Greenway extends east (Uptown→Downtown link, past Sideshow North), the river + Stone Arch silhouette upgrade from backdrop to walkable when Downtown lands, and **the Lake Street corridor continues east past GATE-C toward the full Midtown market district** — the zone arc's second act ships as its own corridor chunk alongside district 1.

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
27. Warning-tree call, overheard on a porch: "It's Bee's tree — convoy's rolling early tonight. Move bingo to the church basement, tell Amal, and bring the good cooler."
28. Mercado rafter banner, hand-painted: *"OPEN. ABIERTO. FURAN. — 20 years on this corner. Beige rusts. We don't."*
29. Overheard at the CC Tap: "They commandeered the RAMP. Where the winter farmers market goes. And the people, obviously — the people are the main thing. But also, Gary: the market."
30. Chalk on the sidewalk just outside the wire: a hopscotch grid drawn as a checkpoint queue, final square labeled "4.7 STARS." The kids play it loudly, on purpose, in front of the units.
31. One (1) parked pickup, one (1) bumper sticker: *"AM 1440 THE LOON — 'FINALLY SOMEBODY'S ENFORCING SOMETHING.'"* It receives one new passive-aggressive Post-it per in-game week. It has never once been keyed. That would be rude.
32. Overheard at the panadería counter: "You need eggs, knock twice. You need the *other* thing, knock once and wait for the porch light. Don't write this down, sweetheart."
33. Overheard on the wire's north side, two neighbors: "You don't gotta be a hero about it. You gotta drive a van on Thursday. Different thing. Mostly."

### CIVIS signage & announcements (glitched bureaucratese — canonical strings)

Comedy per the controversy contract: the joke is the machine and the contractor — never anyone's fear. Deploy on gates, barrier segments, the Ramp facade, and convoy loudspeakers.

- Z1 (GATE-A arch): "THIS CHECKPOINT IS RATED 4.7 STARS BY COMPLIANT PEDESTRIANS."
- Z2 (perimeter): "WELCOME TO THE ENHANCED SERVICE AREA. YOUR PRESENCE HAS BEEN LOGGED AS FEEDBACK."
- Z3 (queue lane): "PLEASE HAVE DOCUMENTATION READY. ACCEPTABLE DOCUMENTATION: [LIST NOT FOUND]. THANK YOU FOR YOUR PREPAREDNESS."
- Z4 (barrier boilerplate): "LOITERING IS PROHIBITED. STANDING IS LOITERING AT REST. WALKING IS LOITERING IN MOTION. THANK YOU FOR YOUR COMPLIANCE."
- Z5 (curfew board): "CURFEW BEGINS AT SUNDOWN OR 8:41 PM, WHICHEVER ACHIEVES COMPLIANCE FIRST."
- Z6 (queue display): "YOUR ESTIMATED WAIT TIME IS: YES."
- Z7 (unit chassis stencil): "THIS UNIT IS UNARMED. THIS UNIT'S ARMS ARE ATTACHMENTS."
- Z8 (Ramp facade): "PROCESSING IS A SERVICE. ALL SERVICES MAY EXPERIENCE ELEVATED WAIT TIMES."
- Z9 (perimeter): "REPORT SUSPICIOUS ACTIVITY. SUSPICION CRITERIA AVAILABLE UPON REQUEST. REQUESTS MEET THE CRITERIA."
- Z10 (PR easel): "PARADIGM CIVIC SYSTEMS: BUILDING TOMORROW'S COMPLIANCE TODAY.™ FOR PERIMETER FEEDBACK, PRESS 4. [PRESSING 4 IS NOT SUPPORTED]"
- Z11 (maintenance placard): "SCHEDULED FIRMWARE MAINTENANCE COMPLETED 4,112 DAYS AGO. NO ISSUES FOUND. NO ISSUES WILL BE FOUND."
- Z12 (zoning notice): "SANCTUARY IS NOT A RECOGNIZED ZONING CATEGORY. PLEASE RESUBMIT YOUR COMMUNITY AS A PARKING STRUCTURE."
- Z13 (perimeter): "THIS PERIMETER PROTECTS YOU. SPECIFICS AVAILABLE IN THE FULL CONTRACT (SEALED)."
- Z14 (convoy loudspeaker, LATE): "THANK YOU FOR YIELDING. YOUR COOPERATION HAS BEEN RATED: ADEQUATE."
- Z15 (mutation-day ticker): "TODAY'S DIRECTIVE: [PIGEON]. ALL UNITS: [PIGEON]."

---
*End of doc. Coordinate all named humans (faction leaders, venue owners, romanceables referenced above as roles — "the bartender," "the doorwoman," "the mechanic") through `04-characters.md`.*
