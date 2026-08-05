# gosscounselling.co.uk

Site for **John Goss** — counsellor and clinical supervisor in Bletchley, Milton Keynes.
A rebuild of `goss-counselling.co.uk` (WordPress on HealthHosts) onto his own unhyphenated
domain, which matches his email address.

**Status: building.** John has chosen, and the site is the two directions he picked, combined:
Clear Water's blue, bold opening band and divided-not-boxed layout, lightened with Quiet
Practice's warm ground and air. See [DECISIONS.md](DECISIONS.md) §16.

## Running it

```sh
pkgx pnpm install
pkgx pnpm dev --host 0.0.0.0    # vite on :5173, reachable from the LAN
pkgx pnpm check                 # svelte-check, the CMS key-diff and the contrast check
pkgx pnpm build --mode staging  # static output into build/
```

`pnpm check` is what the image build runs before `pnpm build`, so all three gates fail the
image rather than production:

- `svelte-check` — the content JSON against its interfaces in `src/lib/content/index.ts`
- `scripts/check-cms.ts` — the Sveltia config against the JSON, both directions. A key the
  config does not name is deleted the first time the editor saves that file
- `scripts/check-contrast.ts` — every colour pairing, 4.5:1 for text and 3:1 for graphic marks

Both checkers are self-tested against injected faults before their clean runs are believed:
`pkgx pnpm check:cms:selftest`.

Two more gates read the OUTPUT rather than the input, so they run AFTER the build rather than
in `pnpm check`. The image build and the static-host workflow both run them:

```sh
pkgx pnpm check:build   # check-posts + check-mock, against build/
```

- `scripts/check-posts.ts` — no draft post's words are anywhere in `build/`. Drafts are
  stripped on the JSON's way into the bundle (`vite.config.ts`); this is the proof. It proves
  itself against a canary on every run, so "nothing found" can never mean "nothing examined".
- `scripts/check-mock.ts` — none of the dev-only stand-in content in `src/content/mock/`
  survived into `build/`. That content is what makes the blog and the service detail pages
  visible in `pnpm dev` while John has written neither.

## The design directions

The four prototypes John chose from are archived in
[docs/design-directions/](docs/design-directions/). Serve the repo root and open
`/docs/design-directions/`:

```sh
python3 -m http.server 5199 --bind 0.0.0.0
```

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
