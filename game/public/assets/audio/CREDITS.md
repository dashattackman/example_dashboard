# Audio asset credits

All third-party audio in this tree is CC0 1.0 Universal
(https://creativecommons.org/publicdomain/zero/1.0/) — credit is not legally
required, but we keep provenance honest per CLAUDE.md. Everything was fetched
over the cloud asset channel (GitHub raw / releases; kenney.nl, freesound and
other asset sites are unreachable from the build container) and re-encoded to
mono mp3 (iOS Safari cannot decode ogg vorbis) with ffmpeg 7.0.2
(imageio-ffmpeg static build).

Total shipped: ~0.95 MB. Nothing here is in the PWA install precache (vite's
`globPatterns` excludes mp3) and nothing is fetched before the first user
gesture — see `src/engine/audio.ts` / `src/world/soundscape.ts`.

## step-concrete-1..4.mp3 — footsteps

- **Asset:** footstep00/01/02/05.ogg from Kenney's **RPG Audio** pack (50 CC0
  sounds).
- **Author:** Kenney — https://kenney.nl (https://kenney.nl/assets/rpg-audio)
- **License:** CC0 1.0 Universal.
- **Obtained via:** the `ETdoFresh/kenney.nl` public GitHub mirror of Kenney's
  asset packs, `master` branch, `kenney_rpgaudio/Audio/footstep0{0,1,2,5}.ogg`
  (raw.githubusercontent.com; kenney.nl itself is blocked from the container).
- **Modifications:** downmixed to mono 44.1 kHz, leading silence trimmed
  (-45 dB gate) + 5 ms fade-in, encoded mp3 CBR 64 kbps.

## ui-tick-a.mp3, ui-tick-b.mp3 — UI ticks

- **Asset:** click1.ogg / click2.ogg from Kenney's **UI Audio** pack.
- **Author:** Kenney — https://kenney.nl (https://kenney.nl/assets/ui-audio)
- **License:** CC0 1.0 Universal.
- **Obtained via:** same `ETdoFresh/kenney.nl` mirror,
  `kenney_uiaudio/Audio/click{1,2}.ogg`.
- **Modifications:** mono 44.1 kHz, mp3 CBR 64 kbps.

## lagoon-loop.mp3 — LAGOON RECORDS in-store music spill

- **Asset:** "Dust and Hardcovers" (`dust-and-hardcovers.mp3`, category
  *Jazz Lounge & Bookstore Grooves*) from **OpenLo-Fi** — "a free,
  public-domain collection of 150+ lo-fi music tracks".
- **Author/publisher:** btahir — https://github.com/btahir/open-lofi
- **License:** CC0 1.0 Universal (repo LICENSE + `catalog.json`
  `"license": "CC0-1.0"`).
- **Obtained via:** GitHub release asset `openlofi.zip` (tag `v1.0.0`), the
  single track extracted by HTTP range requests against the zip central
  directory (the full 544 MB archive was never downloaded).
- **Modifications:** 96 s excerpt (0:06–1:42 of the 3:32 track) with the loop
  seam crossfaded (last 2 s blended against the 2 s preceding the excerpt, so
  it wraps seamlessly), limiter at 0.95, downmixed to mono (it plays as a
  positional emitter), encoded mp3 CBR 80 kbps. Runtime shaves 60 ms off each
  loop end to eat the LAME encoder gap (`loopTrim` in soundscape.ts).

## Everything else is synthesized

Ambient beds (city hum, wind, crickets, lake lap), neon hum, bird/gull chirps,
distant sirens and traffic swells are generated at runtime from filtered noise
and swept oscillators in `src/engine/audio.ts` — no assets, no license surface,
zero download.
