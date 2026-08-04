# Decisions (ADRs)

Append-only log of non-obvious choices. Newest at the bottom.

## 1. Design directions before the app scaffold
John's brief is a taste brief ("clean and simple", four sites he likes) with no agreed visual
direction. Scaffolding SvelteKit first would mean building the design system twice. So the
first artefact is three self-contained HTML prototypes at real content length, cheap to throw
away. The stack is fixed (see 3) and gets scaffolded once he picks.

## 2. Content captured before anything else
The old site is on HealthHosts, which John is closing. Its `/wp-json/wp/v2/` API was open, so
pages, posts, media and his portraits were pulled on day one into `docs/`. That removes the
deadline pressure from the hosting cancellation entirely.

## 3. Stack: the chrishemmings.co.uk lineage
SvelteKit 2 / Svelte 5 runes / Tailwind v4 / adapter-static / Sveltia CMS / pull-only CD.
Same shape of client (single UK therapist, English only, static content, occasional self-edits,
no runtime data), and it is proven twice over. No database: nothing on this site needs one,
now that a booking system is explicitly out.

## 4. No booking system, and the CTA is `tel:` + `mailto:` + WhatsApp
John's explicit instruction: "I don't want any form of booking system on my website; I would
much rather people just phone or email me." Taken literally. His phone number is a `tel:` link
and his address a `mailto:` link, repeated down the scroll, with WhatsApp offered because he
volunteered it as often easier. Not a contact form, not Calendly. (Chris Hemmings made the same
call on his own site.)

## 5. One long scroll, with anchors
He liked the Skovbye stage site for being scrollable end to end. So the home page carries
everything — services, fees, qualifications, FAQ, contact — and the nav scrolls to anchors
rather than loading pages. Deep pages stay possible later for SEO, but nothing is hidden behind
one.

## 6. Fees stay on the page, in full
Two of the sites he chose (SCCC, Deep Eddy) put money up front, and his own site already
publishes a range including the low-income offer. Keep it visible; hiding fees is the thing
that makes therapy sites feel evasive.

## 7. Assume the old stock photography is not licensed to John
The 42 media items are mostly AdobeStock files uploaded by the previous designer
(`simplydesign`). The licence almost certainly sits with them, not with John. Only his own
portraits and the NCPS/COSRT membership logos are carried forward; the directions are designed
to work without a stock library.

## 8. Plain language about sex, no euphemism
The practice includes psychosexual therapy — erections, vaginismus, porn use, kink — and
relationship work for couples, throuples and poly dynamics. John already writes about this
plainly. The directions keep his wording rather than softening it: coyness would fail the
people the page is for.

## 9. Three directions: Quiet Practice, Full Colour, Clear Water
The first pass had an "Open Door" direction in the SCCC apricot register; it was dropped as too
close in temperature to Quiet Practice. Its replacement, Full Colour, is the deliberately bold
option: a coral-to-violet spectrum running down the page, one hue per service. The colour does
quiet work — it says this is somewhere you can bring anything, without a badge announcing it —
and it stays clear of the mesh-gradient SaaS look by keeping the grounds warm and the shapes soft.

## 10. The light portrait is a cutout; the dark one keeps its background
Two source frames exist. The light one (white studio backdrop) is knocked out and used large;
because his shoulders run off the edges of that photograph, it is always placed in a frame
narrower than the image so the crop is made by the frame or the viewport. The dark frame keeps
its own background, is auto-levelled, and appears only small and circular. Rationale: a knocked-out
figure needs a clean silhouette, and the dark frame's near-black shirt against a dark grey backdrop
does not give one.

## 11. The crown is reconstructed from a locally fitted arc, at half height
The light photograph clips the top of his head — a flat 137px chord. A circle fitted globally to
the skull underestimated the loss at 1.4px; fitting to the local edge slope either side of the gap,
constrained to leave the photograph tangentially, put it at 13px. Half that reads correctly; the
full height looked like a bump. Edge fuzz is synthesised to the measured statistics of his own
silhouette rather than left clean. Reproducible via `scripts/build-cutouts.py`.

## 12. Dark grounds get their own cutout with keyer-style edge treatment
A matte pulled from a white backdrop carries light wrap on the silhouette, which glows when
composited onto a dark ground — the same problem as green spill. Treated the standard way:
colour edge-extend (partially covered pixels take the nearest opaque colour, so no backdrop-
contaminated colour survives), a ~0.6px matte choke, and a narrow negative light wrap. Verified by
compositing on the actual band colour and profiling luminance inward: it rises monotonically, so
there is no bright halo and no drawn-on dark outline.

## 13. Levels on the dark frame: a curve, not a stretch
Per-channel histogram stretching raised saturation and burned his forehead. The tone curve is
applied to luminance only and the RGB is scaled by the ratio, so hue and saturation are provably
unchanged (measured: 0.0000% change). The curve lifts the mids (median 38 → 55) and tracks the
identity line above L≈150, so the specular highlights stay where the photographer put them.

## 14. Other people's logos: monochrome, colour on hover
NCPS and COSRT marks are shown greyscale at 72% opacity and return to full colour on hover, so
they read as credentials rather than as competing brands. Sourced as PNG from the organisations
themselves (COSRT's own 500px mark, keyed off its white background); neither publishes a true
vector, so the NCPS raster is kept at 1169px for retina.

## 15. The header may never wrap
Brand, nav links and CTA are all `white-space: nowrap`; the nav reveals one link at a time at 700,
820, 940 and 1080px; the CTA label shortens below 430px; the brand's second line drops below 420px.
Verified by measuring 15 widths from 320 to 1440 on every direction: single-row header throughout,
no wrapped CTA, and zero horizontal overflow.
