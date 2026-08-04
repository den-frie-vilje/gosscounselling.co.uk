# Reference scrape — the four sites John likes

Measured 2026-08-04 by fetching each site's raw HTML and its *applied* stylesheets and counting
colour and font declarations. Not read off screenshots. Frequency counts below are occurrences in
the compiled CSS, which is a decent proxy for what carries the design.

---

## 1. chrishemmings.co.uk — ours, already his favourite

Read from the repo source (`src/app.css`), not the network, so these are the authored tokens.

- **Ground:** warm paper `#f4f1ea`, raised `#fbfaf5`, alternating band `#ece5d7`, line `#ddd6c8`
- **Ink:** `#0e3346`, muted `#496a7e`
- **Structure:** navy `#093449` / `#06283a` (header, footer)
- **Accent:** orange `#ff9902` for CTAs only; `#9a4e05` when accent text sits on light grounds
  (the bright orange fails AA there — this correction is already in the tokens)
- **Type:** Hanken Grotesk everywhere, Newsreader serif for pull-quotes only
- **Rhythm:** 84px section spacing, 1160px container, display type `clamp(38px, 5vw, 58px)` at
  `letter-spacing: -0.032em`

What John is responding to: warm off-white rather than white, one strong accent used sparingly,
big confident headings, and a page you can read straight down.

## 2. sccc-la.org — Southern California Counseling Center

WordPress 6.8.1, Kause theme + WPBakery. A non-profit clinic since 1966, sliding-scale fees.

- **Accent:** apricot / amber `#fdc468` (by far the most-used colour), deepened to `#dd9f45`
- **Ink and neutrals:** slate greys `#828994`, `#4c5159`, `#666b73`, `#282d36`
- **Grounds:** white, `#f7f8f8`, warm cream `#f5efda`
- **Support tints:** sage `#98be77`, cornflower `#a1b4ee`, sky `#a8d2f4`, coral `#fba19a` —
  a soft multi-tint palette used to colour-code sections
- **Type:** Cabrito Sans (Medium / Demi / Bold), a warm humanist sans, licensed webfont
- **Scale:** 40 / 33 / 25px headings, 15–16px body, 967px container, 2–5px radii
- **Structure:** three big verb-led doors on the homepage — *Get Help*, *Train with Us*,
  *Donate* — under "Let's Get You Started"

What John is responding to: it is warm and unintimidating, and the money question is handled
openly rather than hidden. That maps directly onto his low-income appointments.

## 3. deepeddypsychotherapy.com — Deep Eddy Psychotherapy, Austin TX

WordPress 7.0.2 + Divi 4.27. A large group practice; much bigger than John, but the surface is
calm and legible.

- **Accent:** teal `#159bbc` and `#0390ae`, deepened `#1c6d8c` / `#0e6781`
- **Warm counterweight:** sand `#e9dfd7`, gold `#de9e36`, honey `#e9c46a`
- **Support:** green `#2cba6c` for affirmative states, greys `#f2f2f2` / `#808080`
- **Type:** Montserrat for body and most headings; Comfortaa (rounded, geometric) as the display
  accent; Raleway and Figtree present but minor
- **Scale:** 16–18px body at `line-height: 1.7em`, 45px display, 980px container,
  54px default section padding
- **Structure:** "Hope Starts Here" hero, then a fees/insurance reassurance band
  ("Exceptional care, covered."), then the people

What John is responding to: the calm blue-green register reads as safe and professional without
looking like a hospital, and the warm sand keeps it human.

## 4. skovbyesexologi-com.stage.denfrievilje.dk — ours

- **Tokens:** ink `oklch(18% .02 290)`, cream `oklch(97% .012 85)`, chartreuse
  `oklch(94% .26 120)` as the single high-energy accent
- **Type:** Inter (body), Fraunces (display serif), Space Grotesk, JetBrains Mono
- **Structure:** one long scroll, WebGL stage behind it

John named this one for the *scroll*, not the palette or the 3D — he wants everything reachable
by scrolling rather than by navigating. Take the structure, leave the chartreuse and the WebGL.

---

## What the four have in common

1. Warm off-white grounds, never stark white, never dark mode.
2. Exactly one accent hue doing the work, with a warm neutral counterweight.
3. Generous line-height (1.6–1.8) and a container in the 960–1160px band.
4. Humanist or geometric sans for body text; serif, if present, only for display.
5. Plain, verb-led headings that say what to do next.
6. No carousels of stock sadness, no dark clinical blue, no luxury signalling.

## Where they differ, and what that gives us

The three directions in `design/` are built on the three distinct temperaments visible above:
the **editorial calm** of a serif-led warm page, the **community warmth** of the SCCC apricot,
and the **clear professional teal** of Deep Eddy. All three keep the single-scroll structure and
the call-or-email CTA.
