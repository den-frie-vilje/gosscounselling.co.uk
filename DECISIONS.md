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

## 16. The design is the two directions John chose, combined
His feedback picked two of the four. From Clear Water: the blue ("it's blue! I can't help
it!"), the bold dark opening band he called "the header", and the way sections are divided
rather than boxed ("in Quiet Practice, sections are put into boxes; in Clear Water, I like how
the sections are divided differently"). From Quiet Practice: the lightness, which he named
twice, "fresh/modern" and "easy to read, and scroll through".

So: Clear Water's structure and palette, lightened with Quiet Practice's warm ground, serif
display and rhythm. Nothing on the page is a card. Sections are told apart by a change of
ground and a hairline, and that rule is enforced by a `Section` component rather than left to
each page. The four prototypes move to `docs/design-directions/`; they have done their job.

## 17. A second accent, in a pair
Lime straw, `oklch(0.91 0.2 110)`. Structural marks only: the rules that lead the kickers, the
hero aside, the connector between the steps, and selected text. Never body text, never a large
field.

It ships as a pair. The light value measures 12.03:1 on the deep band and about 1:1 against
the sand ground, so a single token would have made the same mark sing in the hero and vanish
in the qualifications section. `--color-accent-ink` is the darker sibling for light grounds,
held above the 3:1 that WCAG 1.4.11 sets for a graphic mark. `scripts/check-contrast.ts` knows
the difference between a text floor and a graphic one and gates both.

## 18. Alignment is a rule, not a nudge
Text in a bullet, disc or other frame sits on the baseline of the title it belongs to when the
two are the same size, and is centred on that title's x-height band when it is not. Both halves
are one shift, because with the baselines aligned the two x-height centres differ by exactly
half the difference of the x-heights; at equal sizes that is zero and the rule collapses to
plain baseline alignment. Implemented as `.mark-row` and `--mark-ratio` in `src/app.css`,
where two failed attempts are also recorded so they are not tried again.

## 19. Every visitor-facing string is traced to a source
An audit of the copy found the site making promises John never made: a free, no-obligation
first conversation; a callback; that supervision hours would count towards a supervisee's
requirements; that he would be the one answering the phone. Six of them entered in a single
commit, the pass that rewrote the copy for its audience.

Rewriting for audience and for search is wanted. Acquiring promises, stances and facts the
client never gave is not, and it does not look invented, which is why it survived four rounds
of review. `docs/copy-to-confirm.md` holds what we would still like to say and cannot yet;
nothing in it is on the site.

## 20. The build must survive leaving this image
The site will also be hosted on ordinary third-party static file hosting. So the static output
has to be deployable by plain file copy: every page prerenders to `<path>/index.html`, and
nothing depends on nginx's `try_files` or on any header this image sets. A URL that only
resolves because of `deploy/nginx.conf` is a URL that is broken on the other host.
`.github/workflows/deploy-static-host.yml` is the second deployment, manual-only and inert
until its secrets exist. What does not survive the move is the Sveltia editor, which needs the
GitHub OAuth broker that runs in the staging compose stack.

## 21. Drafts are private at build time; scheduling is a client-side gate
Two different things were being run together, and they want different answers.

A **draft** is private. It is excluded at build time, so it is not in `build/` at all, has no
page, and is not in the sitemap. `scripts/check-posts.ts` greps the build output for the text of
every draft and fails if it finds any, so the guarantee is enforced rather than intended.

A **scheduled** post is not private, it is merely not shown yet. It ships in the HTML and a
client-side gate reveals it once its `publishAt` has passed. The cost is that its text is in the
source before it is on the page; the benefit is that it appears at the minute it is due without
waiting for a build. Ole's call, made after the tradeoff was put to him in those words.

The gate renders server-side as not-yet-published and reveals on mount, so there is no hydration
mismatch and no post that flashes up and disappears. "Publish now" needs nothing special: saving
in the CMS is a commit, a commit is a build, and a past date is live immediately.

## 22. Detail pages and the blog exist only when there is something to put in them
Both are built as capabilities rather than as pages, and neither asks John to type a URL or to
keep two pieces of copy in step.

The address of a service page is derived in code from its slug; he never sees it. And the summary
on the front page is the SAME field the detail page opens with, so there is nothing to keep in
sync: he writes the short version once, and anything he adds in the longer field appears
underneath it on that service's own page.

 A service renders a "More about" link and
gets a route only when its `page` field has content; the blog section, the `/blog` index, the nav
entry and the sitemap entries all appear only once a post is published.

The reason is the same one behind `docs/copy-to-confirm.md`: the alternative is writing 800 words
per service in John's voice about how he works, which is the failure this repo has already made
once and caught. Empty pages are worse than absent ones for search, and invented ones are worse
than both.
