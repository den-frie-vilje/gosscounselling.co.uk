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
> **Superseded by §27, 6 August 2026.** There is one cutout now, and no edge treatment in it at
> all. The measurements below are still true of what was built, and `scripts/gen-cutouts.ts` and
> `scripts/keyer.ts` cite this section for the choke figure as a matter of record — but the
> approach it describes is not what ships.

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

## 21. Detail pages are prepared, not written, and the summary is written once
Each service can carry a `detail` body. Its presence is what creates the page: with none,
the home row renders exactly as it always has and there is no link, which is what ships. The
four services have no `detail`, because writing their copy is John's job and inventing it is
the failure §19 records. The alternative is writing 800 words per service in John's voice about how he works, which is the failure this repo has already made once and caught. Empty pages are worse than absent ones for search, and invented ones are worse than both — see `docs/copy-to-confirm.md`, which is where the questions went instead.

Two things follow, and both are about not making him keep two things in step.

The URL is derived in code from the slug the content already carries: `/counselling/<slug>`
for client work, `/supervision` at the top level because it is a different audience
(docs/information-architecture.md). There is no `path` field. He may write EXTERNAL links,
which are genuinely his, and never a link into his own site.

The detail page opens with the SAME `body` the home page shows, then adds `detail.body`. So
the summary exists in one place, the front page and the top of the detail page cannot drift
apart, and the longer material is written without touching what is already published.

One route serves all of them, `[...service]`, with `entries()` over the services that have a
`detail`. A static `/supervision/+page.svelte` would prerender and appear in the sitemap on
the day he has not written it; a rest parameter that enumerates nothing produces nothing.

## 22. Drafts are removed at build time; a scheduled post is gated in the browser
A post carries `status` and `publishAt`, and the two states are different in kind.

A DRAFT is private. It is stripped in `vite.config.ts`, on the JSON's way into the bundle,
and that is not where it started: filtering in `$lib/content` left the draft's title, summary
and body inside `_app/immutable/chunks/*.js` on every page, because a bundler cannot drop
array entries that only the data says are unused. The repository is public, so a draft that
reached the build would have been published twice over.

Each post is now its own file in `src/content/posts/`, read with `import.meta.glob`, which
makes that stripping load-bearing rather than a belt over braces: the glob imports every file
in the folder by name, so a draft is a module in the graph whether anything reads it or not.
The plugin replaces its contents with `{ "status": "draft" }` before Vite's JSON plugin runs,
so the module that survives carries the fact and none of the words.

A post PUBLISHED with a date in the future is not private, it is early. It is in the build
deliberately, and the listings hide it until its moment passes, in the browser. That is a
decision taken with the cost known: its text is in the HTML from the day it is written. What
it buys is that a post appears at the time it says, without a deploy and without anyone being
at a keyboard.

"Publish now" needs nothing special: saving in the CMS is a commit, a commit is a build, and a past date is live immediately.

The clock starts at `PUBLIC_BUILD_TIME` and moves to the real time on mount, so the server
and the browser's first render agree, and the set of visible posts can only grow. A reader
sees a post appear and never sees one appear and then vanish.

`scripts/check-posts.ts` is the proof, run against the built output after every build in the
image and on the static host. It proves itself against a canary on every run, in both
directions: a draft's words must be caught, a scheduled post's words must not.

## 23. Mock content, visible in dev and eliminated from the build
John has no posts and no service pages, so the blog index, the featured section on the home
page and a detail page were layouts nobody could look at. `src/content/mock/` holds stand-ins
in the same shapes, loaded through a dynamic import inside an `import.meta.env.DEV` branch:
Vite substitutes the literal `false` into a build and the branch and its import are removed,
which a top-level import of the same file would not be.

Every string in those files carries the sentinel `MOCKONLY-8f3a1c`, and
`scripts/check-mock.ts` greps the built output for it. Both halves matter: a mock file
without the sentinel would be invisible to the grep, so an unmarked file is itself a failure.

## 24. The keyer is measured against the photograph, not against his photograph
`scripts/keyer.ts` pulls a matte from an evenly-lit backing with nothing about John's
plate written into it. The backing colour is a robust plane fit to the border band, so
"reasonably even" stops being a judgement and becomes two measured numbers — a tilt across
the frame and a residual sigma — that the keyer refuses on. Every spatial constant is a
fraction of a reference width. `scripts/gen-cutouts.ts --self-test` keys five synthetic
frames whose answer is known exactly (white cyclorama, warm cream at 0.6x, mid grey at
1.35x, a dark wall with a light subject, and one at the very edge of the gradient and grain
tolerances) and refuses five more.

The one thing that had to change to survive those five was the window over which the
known-backing solve is believed. It was an absolute distance in linear light, 0.3 to 0.6,
and that is a white-backdrop assumption in disguise: linear light compresses the bottom of
the scale elevenfold, so a light subject on a dark studio wall measured a separation of 380
times the noise in the plate and was refused as "the same colour as the background". It is
now a signal-to-noise ratio against the measured backing noise, 8x to 20x, because the
solve's error in alpha is about 1/SNR — 20x is 5% and 8x is 12.5%. John's own plate sits at
65x, so his cut-out is unchanged by the switch (ill-conditioned fringe 2.5% → 2.1%,
everything else identical to three figures).

Against the committed hand-tuned pair, the automatic key agrees to a mean 1.4 of 255 levels
of alpha and 0.03 levels over the solid core. The whole difference is at the edge, and it is
the one that was put there on purpose: the keyed silhouette sits 0.09px INSIDE the light
matte and 0.37px OUTSIDE the dark one, which is DECISIONS §12's choke, measured back out of
the asset. What it does not reproduce is the reconstructed crown of §11, and it says so
rather than inventing one — a photograph that clips the top of the head still needs a person.

## 25. One gate for every expensive step, keyed on content and committed
`scripts/build-gate.ts` is the mechanism and `scripts/gen-assets.ts` is the list: keying the
portrait, solving the hero geometry, rendering the OG cards. Each declares what it reads and
what it writes; the gate hashes both, records them in `src/lib/generated/build-manifest.json`
and runs a step only when something it actually depends on moved. A warm build is 0.08s
against 10.2s cold, and an edit to `src/content/home.json` re-renders the cards without
re-keying the portrait.

Three properties are load-bearing, and each is there because of a way this kind of cache
fails.

A step's own SOURCE is one of its inputs, so editing the renderer re-renders. Otherwise a
fix ships everywhere except in the artefact it was written for.

OUTPUTS ARE VERIFIED, not assumed: recorded, re-hashed, and re-run if they are missing or
have been touched. That is what makes the git-ignored `static/img/og/` self-healing in a
fresh CI checkout, and what stops a hand-edited generated file surviving a build.

OUTPUTS ARE DATA. A step names them as a directory and a pattern, not as filenames, and
what it delivered is whatever was there afterwards. The delivered cut-out is being reworked
from a light/dark pair into a single asset; a gate that hard-coded two filenames would have
been wrong within the day, and wrong silently.

The manifest is COMMITTED, because mtimes do not survive a clone and CI has to reach the
same answer as a laptop. A declared input that has gone missing is a failure, not a rebuild:
a step whose dependency list no longer matches the tree cannot be gated honestly. Inputs
that are legitimately absent — John has not uploaded a photograph yet — are declared
optional, and their absence is itself recorded, so the day one appears the key changes and
the keyer runs.

## 26. He types external links; internal ones are the code's job
The rule, in Ole's words: John may fill out URLs for external links, and the CMS structure must
never ask him to refer to his own site's addresses.

External links are his and stay editable: a register listing, an organisation he trained with, a
link out of a blog post. Anything that addresses gosscounselling.co.uk is derived from the route
tree in code, because the route tree already knows it. He never types a service page's address, a
post's address, or an in-page anchor, and there is no "link to" field pointing inward.

The same rule catches a subtler case, which is a field whose value the code already knows. His
phone number was in the content three times, as the number to display, as a `tel:` link and
inside a `wa.me` link; his email twice, as the address and as a `mailto:`. That is not a URL he
should be typing either, and three copies of one fact drift the moment he changes it. He types
the number once and the links are built from it.

## 27. One cutout, correct on every ground, because nothing in it knows the ground
This reverses §12, which had a light matte and a dark one, each carrying its own edge treatment —
colour edge-extend, a matte choke, a negative light wrap — tuned for the ground it would sit on.
Two files for one photograph, and each of them wrong everywhere except where it was aimed.

The reason it took two was a wrong choice inside the solve, not a fact about mattes. Smith &
Blinn's compositing equation is underdetermined by one observation, and the pipeline pinned ALPHA
and let the foreground absorb the deficit: before any de-lighting at all, a direct unpremultiply
came out 45.5 levels dark at mid coverage, and the grading existed to hide that. Pin **F** instead
— his own colour, carried across the fringe from the opaque interior, alpha following by
projection against the measured backing — and the foreground comes back in closed form. Then
`F·a + ground·(1-a)` is right on the light plate and the deep band at once, by arithmetic rather
than by grading, and nothing in the file needs to know what it will sit on.

Measured at the size he is drawn: fringe departing from his own colour by more than 10 levels fell
from 40.9% to 2.7%, the dark line on the band from 40.7% to 2.2%, and reproduction of the source
photograph in linear light from 16.95 to 1.07.

Two things followed that are worth recording as decisions in their own right.

**Where there is no photograph, there is nothing to read.** John's crown is painted above the top
of the frame — his file is twelve rows taller than the photograph — and `solid_matte()` fills those
rows of the observed image with a constant 255 standing in for the blown-out cyclorama. `F == I` at
alpha 1 is true of any real photograph and copied that fabricated white straight into the
foreground: 41 fully-opaque pixels reading pure white on the top of his head. The rule is not about
alpha. It keys off the MASTER's alpha and takes the MASTER's colour, and the confidence map — which
already knew, and was being bypassed by an `alpha >= 0.995` shortcut — decides everywhere else.

**A gate that only looks at the fringe cannot see an opaque defect.** Every check in
`check-mattes.ts` lived in the edge band, which is why that white shipped green. There is one for
the interior now: where the master calls a pixel solid, the asset must be within the encoder's own
floor over those same pixels plus a margin. Fed the broken asset it fails and names the pixel.
