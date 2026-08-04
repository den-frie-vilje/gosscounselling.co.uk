# Information architecture, detail pages and SEO

How the single-scroll home page grows into a site with detail pages, and how that structure
should be organised so John gets found. Built from what is actually on his current site
([content-scrape.md](content-scrape.md)) — not from a generic therapist-site template.

---

## The shape: a deep home page, with a page per thing people search for

John asked for one scroll with everything on it. That is right for the person who already knows
they want him. It is wrong for search, because one page can only rank for one main topic, and his
practice covers four quite different searches — general counselling, relationship work,
psychosexual therapy, and clinical supervision for other therapists.

So: **keep the single scroll as the home page, and give each service its own page underneath it.**
The home page summarises each service in two or three sentences and links down to the full page.
Nothing is hidden — the scroll still answers everything — but each detail page can be long,
specific, and aimed at one search.

This is why every service block in the three prototypes already ends with a "More about …" link.
The structure is in place; only the pages are missing.

## Proposed URL structure

```
/                                    Home — the single scroll
/counselling/                        What counselling with me is like (hub)
/counselling/individual              Individual counselling, 11+
/counselling/relationship            Relationship counselling — couples, throuples, poly
/counselling/psychosexual-therapy    Psychosexual therapy / sex therapy
/supervision                         Clinical supervision for therapists
/fees                                Fees, including the low-income offer
/about                               About John, training, how he works
/qualifications                      Qualifications and membership
/faq                                 The full FAQ
/contact                             Phone, email, WhatsApp, where he is
/blog/                               Index (only if he wants it — see below)
/blog/<slug>                         Posts
```

Notes on the choices:

- **`/counselling/psychosexual-therapy`, not `/psychosexual`.** People search the full phrase, and
  the words in the URL are a (small) ranking signal and a large clarity signal in results.
- **Hyphens, all lowercase, no dates in blog URLs.** Dates make a post look stale in two years.
- **`/supervision` sits at the top level, not under `/counselling`.** It is a different audience
  (therapists, not clients) and should not read as a sub-service of client work.
- **Fees get their own page even though they're on the home scroll.** "Counselling cost Milton
  Keynes" is a real search, and a page can answer it directly.

## Which page targets which search

One page, one primary intent. His practice, mapped to how people actually type:

| Page | Primary target | Also covers |
| --- | --- | --- |
| `/` | counsellor Milton Keynes / Bletchley | his name, "counselling near me" |
| `/counselling/individual` | counselling for anxiety / depression / bereavement MK | counselling for teenagers (11+) |
| `/counselling/relationship` | relationship counselling Milton Keynes | couples counselling, poly-aware, non-monogamy |
| `/counselling/psychosexual-therapy` | psychosexual therapy / sex therapy Milton Keynes | erectile difficulties, vaginismus, painful sex, low libido, delayed ejaculation, porn use, kink |
| `/supervision` | clinical supervision for counsellors | supervision for helping professions |
| `/fees` | counselling cost / low cost counselling Milton Keynes | sliding scale, online session cost |
| `/about` | John Goss counsellor | integrative therapist, NCPS, COSRT |

**The psychosexual page is the opportunity.** It is his growth area, it is what he is training
towards, and it is far less contested locally than "counselling Milton Keynes". The symptom list
already on his FAQ — unreliable erections, delayed ejaculation, loss of desire, vaginismus,
painful sex, orgasm problems, vulvodynia — is a ready-made set of sections, and each of those is
something people type into Google at 1am. Give each symptom its own `<h2>` and two honest
paragraphs. Do not fold them into a bulleted list; a list of seven words ranks for nothing.

If any one of them grows into a page's worth of material later, promote it:
`/counselling/psychosexual-therapy/erectile-difficulties`. Not before there is real content for it.

## Titles and descriptions

Pattern: `<what it is> | <where> | John Goss`, under about 60 characters so it is not truncated.

- `/` — "Counsellor & Clinical Supervisor in Milton Keynes | John Goss"
- `/counselling/psychosexual-therapy` — "Psychosexual Therapy in Milton Keynes | John Goss"
- `/supervision` — "Clinical Supervision for Therapists | John Goss"

Descriptions are for the human reading the result, not for the algorithm: say what the page
offers and how to reach him. About 150 characters. Every page needs its own; duplicated
descriptions are one of the most common faults on small therapist sites.

## Structured data

Three types, all as JSON-LD:

- **`ProfessionalService`** (or `MedicalBusiness` — `ProfessionalService` is the safer, more
  honest fit for a counsellor) on the home page: name, the MK3 area, phone, email, opening hours
  if he wants them published, `areaServed` for Milton Keynes plus "online, UK-wide", and
  `priceRange`. Because the fees are real numbers he is happy to publish, this can be accurate.
- **`Person`** on `/about`, with `hasCredential` for the qualifications list and `memberOf` for
  NCPS and COSRT. The qualification table on his current site is unusually complete — it is an
  asset, and structured data is where it earns its keep.
- **`FAQPage`** on `/faq`, from the five questions already written. These can surface directly in
  search results, and his answers are already in the right voice for that.

## Local search

He is in Bletchley, MK3, and sees people in person there as well as online.

1. **Google Business Profile** is worth more than any on-page work for "counsellor near me".
   Category "Counselor"/"Psychotherapist", service area set, the same phone number and address
   format as the website, and the website link.
2. **Name, address, phone must match exactly** everywhere — the site, the Business Profile, the
   NCPS and COSRT directory listings, Counselling Directory if he is on it. Inconsistent formats
   ("07776153426" vs "07776 153 426") are a known cause of weak local ranking. Pick one written
   format for humans, and always `tel:+447776153426` in the markup.
3. **Say Bletchley and Milton Keynes in prose**, not just in the footer — in the hero, in the
   fees page ("in person in MK3"), on the contact page.
4. The directory listings are also his strongest inbound links. Make sure each one points at
   `https://gosscounselling.co.uk` once the migration is done, not the old hyphenated domain.

## Redirects from the old site

Every old URL should 301 to its new home, from the hyphenated domain and within the new site.
Two of the blog slugs are WordPress placeholders and must not be carried over.

| Old | New |
| --- | --- |
| `/home` | `/` |
| `/about-me` | `/about` |
| `/counselling` | `/counselling/` |
| `/supervision` | `/supervision` |
| `/availability-fees` | `/fees` |
| `/qualifications-and-membership` | `/qualifications` |
| `/contact` | `/contact` |
| `/faq` | `/faq` |
| `/blog` | `/blog/` |
| `/lorem-ipsum` | `/blog/why-therapy-costs-what-it-does` |
| `/hello-world` | `/blog/lgbt-history-month` |
| `/sample-blog-post` | gone (410) — it only says "Blogs coming soon!" |
| `/sample-page`, `/test` | gone (410) |

## Internal linking

The thing most small sites get wrong. Three rules:

1. **Every detail page links back to `/contact` and carries the phone number in its own text**,
   because a detail page is often the entry point, not the home page.
2. **Link between siblings where it is genuinely useful.** The relationship page should link to
   psychosexual therapy, since couples arrive for one and find the other is the issue. The
   individual page should link to the fees page where it mentions cost.
3. **Link with descriptive text.** "Read about psychosexual therapy", never "click here" — it is
   both the accessible choice and the one search engines can use.

## About the blog

There are two real posts and one placeholder. A blog is not required for the site to work, and a
blog with three posts that stops for two years reads worse than no blog at all.

If he wants one, the honest framing is: publish when he actually has something to say, and let
each post answer a question he is genuinely asked in the room. His existing post on why therapy
costs what it does is exactly that, and it is the sort of thing that earns links. If he does not
want the commitment, launch without `/blog` and keep the door open — the URL structure above does
not depend on it.

## What to do first

In order of return:

1. Get the domain and email migration right ([domain-and-email.md](domain-and-email.md)).
2. Home page, `/counselling/psychosexual-therapy`, `/fees`, `/contact`. That is a complete,
   rankable site.
3. Google Business Profile, and the directory listings pointed at the new domain.
4. The remaining detail pages.
5. The blog, only if he wants it.
