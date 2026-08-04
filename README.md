# gosscounselling.co.uk

Site for **John Goss** — counsellor and clinical supervisor in Bletchley, Milton Keynes.
A rebuild of `goss-counselling.co.uk` (WordPress on HealthHosts) onto his own unhyphenated
domain, which matches his email address.

**Status: design iteration.** Three directions are up for John to choose from; the app has not
been scaffolded yet. See [DECISIONS.md](DECISIONS.md) for why that order.

## Design directions

```sh
python3 -m http.server 5199 --bind 0.0.0.0
```

Served from the repo root so the prototypes can reach `docs/source-assets/`. Open
`http://<this-machine>:5199/design/` for the chooser, or go straight to a direction:

- `/quiet-practice.html` — **Quiet Practice**: warm paper, ink-green, serif display. Editorial
  and discreet.
- `/full-colour.html` — **Full Colour**: warm cream with a coral-to-violet spectrum running down
  the page. Optimistic, type-led, no cards.
- `/clear-water.html` — **Clear Water**: teal and sand, geometric sans. Calm and professional,
  with the fees answered before anyone has to ask.

All three are self-contained HTML, use John's real content, and are built to the same brief:
one scroll, call-or-email only, no booking system.

## Documentation

- [docs/client-brief.md](docs/client-brief.md) — what John asked for, and what the practice is
- [docs/content-scrape.md](docs/content-scrape.md) — every word of the old site, captured
- [docs/reference-scrape.md](docs/reference-scrape.md) — measured palettes and type of the four
  sites he likes
- [docs/domain-and-email.md](docs/domain-and-email.md) — DNS findings and the migration order
- [docs/information-architecture.md](docs/information-architecture.md) — detail pages, URL
  structure, SEO and the redirect map
- [docs/source-assets/](docs/source-assets/) — his portraits and membership logos from the old site

## Portrait assets

`scripts/build-cutouts.py` rebuilds everything in `design/assets/` from the source photographs.
It takes one argument, the height of the reconstructed crown as a fraction of the fitted arc
(currently `0.5`):

```sh
python3 scripts/build-cutouts.py 0.5
```

- **The light frame is knocked out.** Background removed via macOS Vision subject lifting, then
  decontaminated against the white backdrop. His shoulders are cut by the edges of the original
  photograph, so it is always placed in a frame narrower than the image: the crop you see is made
  by the frame or by the viewport, never by a line floating mid-section.
- **The crown is reconstructed.** The photograph clips the top of his head, leaving a flat 137px
  chord. A circle fitted to the local edge slope on both sides of the gap restores the arc, at
  half its fitted height, with edge fuzz matched to the measured statistics of his real
  silhouette (ramp 6.4px vs 6.5px real, roughness 0.41px vs 0.42px real).
- **A separate dark-ground variant** (`john-cutout-dark.webp`) gets keyer-style edge treatment —
  colour edge-extend, matte choke, negative light wrap — because a matte pulled from a white
  backdrop carries light spill that glows on a dark ground.
- **The dark studio frame keeps its background**, levelled with a tone curve that lifts the mids
  (median 38 → 55) while leaving the highlights where they were, and is only used small and round.

## Intended stack

Follows `chrishemmings.co.uk`: SvelteKit 2 with Svelte 5 runes, TypeScript, Tailwind v4,
adapter-static, Sveltia CMS at `/admin`, pkgx, deployed via the shared pull-only CD model.
Scaffolded once a direction is chosen.
