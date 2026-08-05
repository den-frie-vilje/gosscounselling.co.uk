# gosscounselling.co.uk

Site for **John Goss** — counsellor and clinical supervisor in Bletchley, Milton Keynes.
A rebuild of `goss-counselling.co.uk` (WordPress on HealthHosts) onto his own unhyphenated
domain, which matches his email address.

**Status: building.** John has chosen, and the site is the two directions he picked, combined:
Clear Water's blue, bold opening band and divided-not-boxed layout, lightened with Quiet
Practice's warm ground and air. See [DECISIONS.md](DECISIONS.md) §16.

## Running it

Activate the toolchain first. This matters more than it looks: **`pkgx dev` is what reads
`pkgx.yml`; an ad-hoc `pkgx <cmd>` does not.** It defaults to "latest", which broke a sibling
site silently when Node 26 landed upstream and pkgx began handing it to a project pinned to
~25. The Dockerfile carries the same warning for the same reason.

```sh
eval "$(pkgx dev --shellcode)" && dev on

pnpm install
pnpm dev --host 0.0.0.0      # vite on :5173, reachable from the LAN
pnpm check                   # every gate below
pnpm build --mode staging    # static output into build/
```

`pnpm check` is what the image build runs before `pnpm build`, so each gate fails the image
rather than production. Its `precheck` runs the asset pipeline first, so nothing downstream
measures a stale cut-out:

- `svelte-check` — the content JSON against its interfaces in `src/lib/content/index.ts`
- `scripts/check-cms.ts` — the Sveltia config against the JSON, both directions. A key the
  config does not name is deleted the first time the editor saves that file
- `scripts/check-nav.ts` — the bar's written order against the section order in the home page's
  own markup. Sorting the bar at runtime instead worked on the home page and nowhere else
- `scripts/check-contact.ts` — the number John typed can actually be dialled. The `tel:`, the
  `mailto:` and the wa.me address are derived from it, so one typo breaks three links
- `scripts/check-contrast.ts` — every colour pairing, 4.5:1 for text and 3:1 for graphic marks
- `scripts/check-portrait-fit.ts` — the hero's geometry, solved from the cut-out's own alpha
- `scripts/check-mattes.ts` — the cut-outs differ only where they are supposed to, against a
  floor the WebP encoder's own noise sets rather than a number somebody picked

Each one is self-tested against injected faults before its clean run is believed — a checker
that has never been seen to fail is not a checker. `pnpm check:cms:selftest`,
`pnpm cutouts:selftest`.

Two more gates read the OUTPUT rather than the input, so they run AFTER the build rather than
in `pnpm check`. The image build and the static-host workflow both run them:

```sh
pnpm check:build   # check-posts + check-mock, against build/
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

## The asset pipeline

Keying his portrait is the most expensive thing in the build, so it runs only when something
it reads has changed. `scripts/build-gate.ts` hashes each step's declared inputs, including
the script that does the work, and `src/lib/generated/build-manifest.json` — committed, so CI
reaches the same decision a laptop does — records the result.

```sh
pnpm assets          # the gated pipeline (also runs via precheck and prebuild)
pnpm assets:list     # what each step reads and writes, in dependency order
pnpm assets:force    # ignore the manifest and rebuild everything
```

`scripts/keyer.ts` measures the backdrop rather than assuming it: colour by a robust plane fit
to a border band, then its gradient across the frame and its residual noise. A backdrop too
uneven to key is REFUSED, with the measurement and the limit in the message, rather than
quietly producing a bad matte. `pnpm cutouts:selftest` runs five frames it must accept and
five it must refuse.

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

Two paths, and they are not rivals. `scripts/keyer.ts` is the general one, described above: it
keys whatever photograph it is given, measuring the backdrop rather than assuming it, and it is
what a photo John uploads goes through. `scripts/build-cutouts.py` is the original hand pass
over his current portrait, and it still owns the one thing the general keyer will not do —
inventing the top of his head, which the photograph clips. It takes one argument, the height of
the reconstructed crown as a fraction of the fitted arc (currently `0.5`):

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
- **One asset is painted, on every ground** (`john-cutout-dark.webp`, a name kept only because
  the scripts write to it). There used to be a light/dark pair, each with its own edge treatment
  — colour edge-extend, matte choke, negative light wrap — and that is gone from both the hand
  pass and the general keyer. Instead the foreground is pinned to John's own colour, carried
  across the fringe geodesically from the opaque interior, and coverage is solved against the
  measured backing; `F*a + ground*(1-a)` is then right on the light plate and the deep band at
  once, by arithmetic rather than by grading. Nothing in the file knows what it will sit on.
- **The dark studio frame keeps its background**, levelled with a tone curve that lifts the mids
  (median 38 → 55) while leaving the highlights where they were, and is only used small and round.

## Intended stack

Follows `chrishemmings.co.uk`: SvelteKit 2 with Svelte 5 runes, TypeScript, Tailwind v4,
adapter-static, Sveltia CMS at `/admin`, pkgx, deployed via the shared pull-only CD model.
Scaffolded once a direction is chosen.
