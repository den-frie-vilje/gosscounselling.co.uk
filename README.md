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
- `/open-door.html` — **Open Door**: apricot and clay on cream, rounded humanist sans.
  Warm and unintimidating, in the SCCC register.
- `/clear-water.html` — **Clear Water**: teal and sand, geometric sans. Calm and professional,
  in the Deep Eddy register.

All three are self-contained HTML, use John's real content, and are built to the same brief:
one scroll, call-or-email only, no booking system.

## Documentation

- [docs/client-brief.md](docs/client-brief.md) — what John asked for, and what the practice is
- [docs/content-scrape.md](docs/content-scrape.md) — every word of the old site, captured
- [docs/reference-scrape.md](docs/reference-scrape.md) — measured palettes and type of the four
  sites he likes
- [docs/domain-and-email.md](docs/domain-and-email.md) — DNS findings and the migration order
- [docs/source-assets/](docs/source-assets/) — his portraits and membership logos from the old site

## Intended stack

Follows `chrishemmings.co.uk`: SvelteKit 2 with Svelte 5 runes, TypeScript, Tailwind v4,
adapter-static, Sveltia CMS at `/admin`, pkgx, deployed via the shared pull-only CD model.
Scaffolded once a direction is chosen.
