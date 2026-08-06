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

`pnpm check` is us, at a keyboard, before we commit: every gate, strict. Its `precheck` runs the
asset pipeline first, so nothing downstream measures a stale cut-out:

- `svelte-check` — the content JSON against its interfaces in `src/lib/content/index.ts`
- `scripts/check-cms.ts` — the Sveltia config against the JSON, both directions. A key the
  config does not name is deleted the first time the editor saves that file
- `scripts/check-nav.ts` — the bar's written order against the section order in the home page's
  own markup. Sorting the bar at runtime instead worked on the home page and nowhere else
- `scripts/check-contact.ts` — the number John typed can actually be dialled. The `tel:`, the
  `mailto:` and the wa.me address are derived from it, so one typo breaks three links
- `scripts/check-contrast.ts` — every colour pairing, 4.5:1 for text and 3:1 for graphic marks
- `scripts/check-copy.ts` — nothing a visitor can READ is written into a component. Every word
  is John's to change, including the site's own furniture ("Phone", "Call", "Older post"), which
  lives in `src/content/labels.json`. Assistive-technology labelling stays in code and is named
  in the script's `ALLOWED` list with a reason each — a wrong edit there is a fault he cannot see
- `scripts/check-portrait-fit.ts` — the hero's geometry, solved from the cut-out's own alpha
- `scripts/check-mattes.ts` — the cut-outs differ only where they are supposed to, against a
  floor the WebP encoder's own noise sets rather than a number somebody picked

Each one is self-tested against injected faults before its clean run is believed — a checker
that has never been seen to fail is not a checker. `pnpm check:cms:selftest`,
`pnpm cutouts:selftest`.

### A gate may stop us. It may not stop John

The image build runs **`pnpm check:publish`**, not `pnpm check`. That build IS John's publish: he
saves in Sveltia, the push builds this image, and if a gate fails, his change does not go live and
the reason is in a CI log he has no reason to know exists. A site that refuses to publish because a
nav label came out two characters long is worse than one with a long nav label.

So the gates that judge **his content** — cms, nav, social, contact, seo, portrait-fit, mattes —
run through `scripts/run-gates.ts`, which has two modes. Strict under `pnpm check`. Advisory under
`--advisory`, where every gate still runs and prints everything it found and the build continues.
Advisory on **production too**: production is where a blocked publish costs most, because the edit
silently does not appear and the live site keeps yesterday's words.

`svelte-check`, `check-contrast` and `check-copy` are outside that runner and stay strict
everywhere — they judge code, design tokens and our own source, none of which John can change.

And the finding is not left in a log. Every run writes `src/lib/generated/gate-status.json`, which
the build compiles into the editor page: `GateStatus.svelte` shows John, in his words, whether the
last publish went through clean. It shows him **only what is his** — findings our tooling owns go
to the build log. It is also hidden until somebody is signed in (`static/admin/gate-status.js`),
because the first screen at /admin is a sign-in form and a warning floating over it is alarming
rather than useful.

Two more gates read the OUTPUT rather than the input, so they run AFTER the build rather than
in `pnpm check`. These are **disclosure** gates, not consistency gates, and they block on every
path including production — shipping a draft he has not published is worse than not shipping:

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
- [docs/copy-to-confirm.md](docs/copy-to-confirm.md) — every line that is OURS and not his, for
  him to approve or overrule. §0 is live on the site and replaced a sentence of his own
- [docs/social-profiles.md](docs/social-profiles.md) — the profiles claimed as his, with the
  evidence for each. `check-seo.ts` refuses a `sameAs` URL this file does not record as VERIFIED
- [docs/content-coverage.md](docs/content-coverage.md) — what the old site said and where it went
- [docs/emails/](docs/emails/) — drafted for Ole to send, facts checked against the scrapes
- [docs/source-assets/](docs/source-assets/) — his portraits and membership logos from the old
  site. READ-ONLY: the hand-retouched crown lives here and nothing regenerates it

## Portrait assets

**One path.** `scripts/keyer.ts` keys whatever photograph it is given, measuring the backdrop
rather than assuming one, and `scripts/gen-cutouts.ts` runs it over whatever is in
`static/img/portrait/`. There used to be a second, a Python hand pass over his current portrait;
it is gone, and what replaced it is the rule below.

- **A photograph is keyed. A cut-out is not.** If the upload already carries a real matte — a
  substantial area transparent, a substantial area solid — there is nothing to key, and keying it
  anyway is destructive rather than merely wasteful: the solve estimates a backing that is not
  there and removes a spill that does not exist. Measured on exactly that case, a hand matte
  flattened onto green and re-solved came back with 43.77% of its fringe in the violet band and
  2,273 blown pixels, against 10.85% and 40 for the matte it started from.
- **A given matte keeps its coverage and gets its colour carried.** A matte settles coverage and
  says nothing about what is underneath it, and the two often disagree — cutting someone out
  changes the shape, not the pixels. So the alpha is used exactly as given (0.0000 drift) and the
  fringe colour is pulled outward from the part the matte calls solid. A finished cut-out passed
  through comes out at 7 blown pixels; the Python hand pass it replaced managed 40.
- **This is also the escape hatch.** Any photograph the solver gets wrong can be masked by hand
  and uploaded, and the pipeline stops arguing. It has to be finished, edges included: whatever is
  in that file is what appears on the site.
- **The source is a committed file in the folder the CMS writes to** —
  `static/img/portrait/john-goss.webp`. The file John sees in the editor, the file he replaces,
  and the file the build reads are one file rather than three that have to agree.
- **The crown was reconstructed by hand**, once, in `docs/source-assets/john-light-decontaminated.png`.
  The photograph clips the top of his head, and the keyer will not invent it — it says so and
  carries on. That reconstruction now enters the pipeline as ordinary pixels, like any other
  upload, rather than through a script that knew about it.
- **One asset is painted, on every ground** — `static/img/john-cutout.webp`, the only cut-out in
  the directory the build copies from. There used to be a light/dark pair, each with its own edge
  treatment. Instead the foreground is pinned to John's own colour, carried across the fringe from
  the opaque interior, and coverage is solved against the measured backing; `F*a + ground*(1-a)`
  is then right on the light plate and the deep band at once, by arithmetic rather than grading.
  Nothing in the file knows what it will sit on.
- **The hero's geometry is solved, not typed.** `scripts/check-portrait-fit.ts` reads the cut-out's
  own alpha and emits the tokens the page uses — how wide he is drawn, where his head centres,
  where `.layerOut`'s fade begins and ends. The fade is a fraction of the gap between his crown
  and his shoulders, so a portrait of different proportions gets a shorter fade rather than a
  failed build.

## Intended stack

Follows `chrishemmings.co.uk`: SvelteKit 2 with Svelte 5 runes, TypeScript, Tailwind v4,
adapter-static, Sveltia CMS at `/admin`, pkgx, deployed via the shared pull-only CD model.
Scaffolded once a direction is chosen.
