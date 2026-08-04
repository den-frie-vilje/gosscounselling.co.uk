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
