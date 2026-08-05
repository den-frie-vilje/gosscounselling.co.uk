/**
 * Content access layer.
 *
 * All site copy lives in `src/content/*.json` and is imported here at build
 * time (single locale, English). Prose fields are **markdown strings**,
 * rendered through `$lib/markdown`, not arrays of short bullets; structured
 * arrays are reserved for genuine lists (steps, fee rows, qualifications,
 * FAQ). Components never import the JSON directly, they go through the typed
 * accessors below, so `pnpm check` is the contract: a CMS save that stops
 * matching an interface fails the build rather than production.
 */

import { PUBLIC_BUILD_TIME } from '$env/static/public';
import siteData from '../../content/site.json';
import contactData from '../../content/contact.json';
import homeData from '../../content/home.json';
import testimonialsData from '../../content/testimonials.json';
import socialData from '../../content/social.json';
import postsData from '../../content/posts.json';
import { mockPosts, mockServiceDetail, mockTestimonials } from './mock';
import { mailtoHref, telHref, whatsappHref } from '$lib/phone';
import { resolveDeep, resolveTokens, type TokenValues } from '$lib/copy-tokens';

export interface Membership {
  name: string;
  abbr: string;
  /** Qualifier such as "Accredited Member". Null where the body is a plain
   *  membership rather than a graded one. */
  note: string | null;
  /** The mark, shown on its own white plate beside the name. */
  logo: string;
  /** The public register listing. Null until John supplies it; the component
   *  renders the name unlinked rather than guessing a URL. */
  href: string | null;
  /** True where John is a member. The Professional Standards Authority is not
   *  a body he belongs to, it is the body that accredits the register he is
   *  on, so it appears in this list but must never be emitted as `memberOf`. */
  isMembership: boolean;
}

export interface Site {
  name: string;
  tagline: string;
  description: string;
  /** Carries `{year}`, filled in at render time by `footerNote()`. */
  footerNote: string;
  /* There is no `serviceType`. It was in the CMS and in this interface for
     months, and nothing ever read it: `schema.org/serviceType` has domain
     Service, not LocalBusiness, so the graph could not use it and used
     `knowsAbout` instead (see $lib/seo/structured-data). A field John could
     edit with no effect anywhere teaches him the editor is lying to him, so
     it is gone from both sides rather than left as a comment saying it does
     nothing. */
  schema: {
    jobTitle: string;
    bio: string;
    knowsAbout: string[];
    areaServed: string[];
  };
  memberships: Membership[];
}

/**
 * What John writes. The links are not in here: see `Contact`.
 *
 * Details only, no headings. There were two — `heading` and `menuHeading` —
 * and all three copies of "Get in touch" (this file's two, plus
 * `home.contact.heading`) had to be edited together to change one sentence.
 * `heading` was read by nothing at all; the contact section has always used
 * the home page's own heading beside its kicker and intro, where the rest of
 * that section's copy lives. The menu panel now reads that same one.
 */
interface ContactCopy {
  email: string;
  phone: string;
  location: string;
  locationNote: string;
  /* The three notes under the contact rows. Kept deliberately free of any
     claim about how John's practice runs at his end: an earlier draft said
     visitors would not reach a receptionist and would get a call back, and
     neither is anywhere in what he told us. See docs/content-coverage.md. */
  phoneNote: string;
  emailNote: string;
  whatsappNote: string;
}

/**
 * What the components get: his copy, plus the three links worked out from it.
 *
 * `whatsappHref` is nullable and the others are not. A `mailto:` or a `tel:`
 * can always be built from the string he typed, even a malformed one, and a
 * link that fails is visible; a wa.me address built from an unparseable number
 * would be a working link to somebody else's phone, so there is none.
 */
export interface Contact extends ContactCopy {
  emailHref: string;
  phoneHref: string;
  whatsappHref: string | null;
}

export interface Step {
  title: string;
  body: string;
}

/**
 * The extra material a service's own page carries, and nothing else.
 *
 * There is no `path` and no link field. John writes prose; the address of a
 * page on his own site is the route tree's business, derived by
 * `servicePath()` below from the `slug` that already exists. A URL he has to
 * type is a URL he has to keep in step with the code.
 *
 * There is no second copy of the summary either. `Service.body` is the home
 * page's words, and the detail page opens with exactly that string before
 * this one, so the front page and the top of the detail page cannot drift.
 */
export interface ServiceDetail {
  /** Markdown. Rendered UNDER `Service.body` on the service's own page. */
  body: string;
  /** Optional. Falls back to the service title and the site description. */
  seo?: { title: string; description: string };
}

export interface Service {
  /** Identifier, not copy: it is what the detail page's address is built
   *  from, which is why it is not an editable field in the CMS. */
  slug: string;
  title: string;
  who: string;
  /** Markdown. The home-page summary, and the opening of the detail page. */
  body: string;
  /** Present means this service has a page. Absent means it does not, and
   *  the home row renders exactly as it always has, with no link. */
  detail?: ServiceDetail;
}

export interface FeeLine {
  label: string;
  value: string;
}

export interface FeeRow {
  title: string;
  lines: FeeLine[];
}

export interface Qualification {
  title: string;
  detail: string;
}

export interface FaqItem {
  q: string;
  /** Markdown. */
  a: string;
}

/* There is no `navLabel`. It said "Home" and nothing on the site read it:
   the brand in the header is `site.name` over `site.tagline`, and the bar is
   built from `nav` below. It had been editable, and dead, since the first
   commit. */
export interface Home {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    /** His own sentence, from the old site. */
    aside: string;
    /** Inline markdown. Carries `{whatsapp}`. */
    reassure: string;
    /** Carries `{phone}`, so the button cannot read one number and dial
     *  another. See $lib/copy-tokens. */
    ctaPrimary: string;
    ctaSecondary: string;
    /** What the CMS records when John uploads a photograph, e.g.
     *  `/img/portrait/john.jpg`. Read by the BUILD, not by the page: the
     *  keying pipeline cuts it out and the page paints the result. Absent
     *  until he uploads one, which is why it is optional. */
    portrait?: string;
    portraitAlt: string;
  };
  steps: { kicker: string; heading: string; intro: string; items: Step[] };
  services: { kicker: string; heading: string; intro: string; items: Service[] };
  about: { kicker: string; heading: string; body: string; photoAlt: string };
  fees: {
    kicker: string;
    heading: string;
    intro: string;
    rows: FeeRow[];
    /** `body` is markdown and carries `{mailto}`. */
    note: { title: string; body: string };
  };
  quals: {
    kicker: string;
    heading: string;
    items: Qualification[];
    /** Just the heading: the bodies themselves come from site.memberships, so
     *  the names are not typed twice. */
    bodies: { title: string };
  };
  faq: { kicker: string; heading: string; items: FaqItem[] };
  contact: { kicker: string; heading: string; intro: string };
  /** `description` is NOT in home.json and is not a field: see `home` below. */
  seo: { title: string; description: string };
  /** The share card. Only the title is John's to write here: the card also
   *  carries his name and the hero's own eyebrow, and it reads those from
   *  where he already wrote them rather than asking twice. */
  og: { title: string };
}

export interface Testimonial {
  quote: string;
  /** Attribution. Anonymised for client work, by name for colleagues. */
  name: string;
  /** Optional role or context, e.g. "Supervisee". */
  detail?: string;
}

/**
 * A kicker and the quotes. There is no heading and no standing note: a
 * quotation introduced by a sentence telling you it is a quotation is weaker
 * than the quotation. The kicker stays because every other section on the page
 * has one, and it is a label rather than an introduction.
 */
export interface Testimonials {
  kicker: string;
  items: Testimonial[];
}

export interface Post {
  /** Identifier, not copy: the post's address is built from it, so it is not
   *  an editable field in the CMS. Optional because a post written in the
   *  editor arrives without one, and `postSlug()` makes it from the title. */
  slug?: string;
  title: string;
  /** ISO 8601. */
  publishAt: string;
  status: 'draft' | 'published';
  /** Plain text. The home feed and the index show this and nothing else, so
   *  there is no second, "featured" copy of a post to keep in step. */
  excerpt: string;
  /** Markdown. */
  body: string;
  /** Optional. Falls back to the title and the excerpt. */
  seo?: { title: string; description: string };
}

export interface Posts {
  posts: Post[];
}

/**
 * His social profiles, and only the ones verified on two independent counts:
 * the phone number, the email, either domain, the location, the memberships,
 * or a photograph matching his own. A wrong link in a counsellor's footer
 * sends his clients to a stranger, so a single corroboration is not enough.
 * The evidence for each is in docs/social-profiles.md.
 */
export interface SocialProfile {
  /** Lowercase id, matched against SocialIcon's glyph table. */
  platform: string;
  label: string;
  url: string;
}

export interface Social {
  profiles: SocialProfile[];
}

export const social: Social = socialData;

/**
 * The contact block, with the three links worked out rather than typed.
 *
 * John writes the number and the address; `mailto:`, `tel:` and the wa.me
 * address all follow from them. He used to type all five, which meant keeping
 * `07776 153 426`, `tel:+447776153426` and `https://wa.me/447776153426` in
 * step by hand — the country code, the dropped leading zero and the missing
 * plus, three chances to send a caller to a stranger. `scripts/check-contact.ts`
 * fails the build if what he wrote cannot be turned into a number that dials.
 *
 * WhatsApp is null when the number will not parse, and the row is skipped;
 * there is no honest fallback for a wa.me address.
 */
export const contact: Contact = {
  ...(contactData as ContactCopy),
  emailHref: mailtoHref(contactData.email),
  phoneHref: telHref(contactData.phone),
  whatsappHref: whatsappHref(contactData.phone)
};

/**
 * What `{phone}`, `{whatsapp}` and the rest stand for in John's copy.
 *
 * Same rule as the hrefs above, one layer down. The number used to appear
 * three more times in his PROSE — spelled out on the hero button, linked as a
 * wa.me address under it, and his email linked from the low-income note —
 * where a search for a field name never found it. Those three are now
 * placeholders filled in here from the one place he types each thing, so the
 * button cannot read a number the site no longer dials.
 *
 * `contact` is the source and is deliberately NOT resolved: resolving the
 * thing the values come from is how you get a placeholder that resolves to
 * itself. `{year}` is left alone on purpose, because it is not a property of
 * the content; `footerNote()` answers it at render time.
 *
 * `scripts/check-contact.ts` is the gate: it refuses a placeholder this list
 * does not know, and refuses the number, the address or a wa.me link written
 * out longhand in any content file but contact.json.
 */
const COPY: TokenValues = {
  phone: contact.phone,
  email: contact.email,
  tel: contact.phoneHref,
  mailto: contact.emailHref,
  whatsapp: contact.whatsappHref
};

export const site: Site = resolveDeep(siteData, COPY);

/* Mock content is merged in only where it exists, and it only exists in dev
   (see ./mock.ts). Production reads exactly the JSON in src/content/. */
export const testimonials: Testimonials = resolveDeep(
  mockTestimonials ?? testimonialsData,
  COPY
);

/** home.json as it is on disk: everything `Home` has except the description,
 *  which is not in the file and is not a field. */
type HomeSource = Omit<Home, 'seo'> & { seo: { title: string } };

function withMockDetail(detail: Record<string, ServiceDetail>): HomeSource {
  return {
    ...homeData,
    services: {
      ...homeData.services,
      items: homeData.services.items.map((item) =>
        detail[item.slug] ? { ...item, detail: detail[item.slug] } : item
      )
    }
  };
}

const homeSource: HomeSource = mockServiceDetail ? withMockDetail(mockServiceDetail) : homeData;
const homeResolved = resolveDeep(homeSource, COPY);

/**
 * The home page.
 *
 * `seo.description` is derived, not written. It was a field, and it held a
 * byte-for-byte copy of `site.description`: the same 150 characters in two
 * boxes in the editor, one of which John would eventually change and the
 * other of which he would not — and the one he did not change is the one a
 * stranger reads in a search result. This site is one page, so the site's
 * description IS the home page's; the blog index, the share card and the
 * Schema.org graph were all already using it.
 *
 * If the two ever genuinely need to differ, this is where the override goes
 * back, as an OPTIONAL field falling back to here rather than a required one
 * repeating it.
 */
export const home: Home = {
  ...homeResolved,
  seo: { ...homeResolved.seo, description: site.description }
};

/* ---------------------------------------------------------------------------
   Addresses.

   Every URL that points at this site is derived here, from the route tree and
   from the identifiers the content already carries. None of them is typed by
   an editor. External links (a register listing, a body he trained with, a
   link out of a blog post) stay plain string fields in the content, because
   those genuinely are his to write; an address on his own site is not.
   --------------------------------------------------------------------------- */

/**
 * Lowercase, hyphens, nothing else. Only ever used as a fallback: a service
 * or a post added through the editor has no identifier of its own, and an
 * address made from the title beats no address at all.
 */
function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serviceSlug(service: Service): string {
  return service.slug?.trim() || slugify(service.title);
}

export function postSlug(post: Post): string {
  return post.slug?.trim() || slugify(post.title);
}

/**
 * Where a service's detail page lives, per docs/information-architecture.md.
 *
 * Client work sits under `/counselling/`, because that is the word people
 * search for and the URL is a clarity signal in a result. Supervision does
 * not: it is a different audience, therapists rather than clients, and
 * `/counselling/supervision` would read as a sub-service of client work.
 * That is the whole rule, and it lives here rather than in the JSON so that
 * nobody has to keep an address and a route in step by hand.
 */
export function servicePath(service: Service): string {
  const slug = serviceSlug(service);
  return slug === 'supervision' ? '/supervision/' : `/counselling/${slug}/`;
}

/** The services that have a page. Ships empty: no service has a `detail`. */
export function detailServices(): Service[] {
  return home.services.items.filter((s) => s.detail);
}

export const BLOG_PATH = '/blog/';

export function postPath(post: Post): string {
  return `${BLOG_PATH}${postSlug(post)}/`;
}

/* ---------------------------------------------------------------------------
   Publishing.

   Two gates, because the two cases are different in kind.

   A DRAFT is private. It is filtered out here, at build time, so it is not in
   the HTML, has no page and is in no sitemap. The source of this site is
   public, so anything else would publish it twice over.

   A post PUBLISHED with a date in the future is not private, it is early. It
   is in the build, and the listings hide it until its moment passes, in the
   browser, so it appears on the day without waiting for a rebuild. Its text
   is therefore in the HTML from the day it is written, and that is a decision
   rather than an oversight: see DECISIONS.md §22.
   --------------------------------------------------------------------------- */

/**
 * The moment this build was made.
 *
 * `$env/static/public`, not dynamic, for the reason set out at the top of
 * $lib/seo/structured-data: static env is sourced from the committed
 * `.env.[mode]` files and hard-fails on a missing declaration, so a build
 * cannot silently fall back. CI passes the real value as a `--build-arg`
 * (see deploy/Dockerfile); it is empty in local dev, where the current time
 * is right and is baked at prerender rather than read in the browser.
 */
export const BUILD_TIME: number = Date.parse(PUBLIC_BUILD_TIME) || Date.now();

/* Through the same resolver as the rest of the copy, so a post can say "call
   me on {phone}" and mean whatever the number is on the day it is read. */
const allPosts: Post[] = resolveDeep(
  [...(postsData as Posts).posts, ...(mockPosts ? mockPosts.posts : [])],
  COPY
);

/**
 * Everything in the build, newest first. Drafts are gone by here.
 *
 * A post whose `publishAt` will not parse sorts last and is never live:
 * `Date.parse` returns NaN and every comparison against it is false, so a
 * malformed date hides a post rather than publishing it early.
 */
export const builtPosts: Post[] = allPosts
  .filter((post) => post.status === 'published')
  .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));

/** The posts that are live at a given moment. */
export function livePosts(at: number): Post[] {
  return builtPosts.filter((post) => Date.parse(post.publishAt) <= at);
}

/**
 * Live as at the build. This is what the server renders, what the sitemap
 * advertises and what the navigation is built from; the browser widens it to
 * `Date.now()` on mount through $lib/publish-clock.
 */
export const publishedPosts: Post[] = livePosts(BUILD_TIME);

/**
 * The in-page navigation. Generated from the sections the home page actually
 * renders, paired with the heading each one already carries, so there is no
 * second list to keep in sync.
 *
 * The hrefs are `/#section`, not `#section`, because the header is on every
 * page now: from a service page or a post, a bare fragment points at an
 * anchor that is not there and the link does nothing at all.
 */
export interface NavItem {
  /**
   * The section this item corresponds to, or null if it has none.
   *
   * It is not only what gets highlighted; it is also where the item sits in
   * the bar. The header sorts by where these sections really are in the
   * document, so Blog carries the id of its teaser on the home page even
   * though its href is a page of its own: that is what keeps it above Get in
   * touch in the bar, because that is where it is on the page.
   *
   * The id is the SOURCE and the href is derived from it below. It used to be
   * the other way round, with the header recovering an id by slicing each
   * href, and that broke silently the day the hrefs became `/#help` for
   * cross-page anchors: every lookup missed and nothing was ever highlighted.
   * A derived value cannot drift from the thing it is derived from.
   */
  id: string | null;
  href: string;
  label: string;
}

/** The href for an in-page section, from the one place its id is written. */
export function sectionHref(id: string): string {
  return `/#${id}`;
}

/**
 * The bar, in the order the home page puts these sections.
 *
 * Authored, not sorted at runtime. Sorting by where the sections really are
 * was the obvious fix for the bar and the page disagreeing, and it worked on
 * the home page and nowhere else: on a post or the blog index none of these
 * sections exist, so there was nothing to sort by and the order fell back to
 * however the array happened to read. Blog changed places on navigation.
 *
 * An order that depends on which page you are looking at is not an order. So
 * it is written down once, here, and `checkNavOrder` in nav-sections.svelte.ts
 * shouts in dev if the home page ever disagrees with it. Same shape as every
 * other invariant in this repo: state it, then gate it.
 */
export const nav: NavItem[] = [
  { id: 'help', href: sectionHref('help'), label: 'How I can help' },
  { id: 'about', href: sectionHref('about'), label: 'About me' },
  { id: 'fees', href: sectionHref('fees'), label: 'Fees' },
  { id: 'faq', href: sectionHref('faq'), label: 'Questions' },
  // Its href is a page of its own; its id is the teaser section on the home
  // page, which is both what gets highlighted and what puts it here rather
  // than after Get in touch. See NavItem.id.
  { id: 'blog', href: BLOG_PATH, label: 'Blog' },
  { id: 'contact', href: sectionHref('contact'), label: 'Get in touch' }
];

/** The bar minus the blog, for the days before John has published anything.
 *  A filter rather than an append: appending would have to know where to put
 *  it back, which is the thing that went wrong. */
export function navFor(hasPosts: boolean): NavItem[] {
  return hasPosts ? nav : nav.filter((item) => item.id !== 'blog');
}

/**
 * Footer note with `{year}` filled in.
 *
 * The one placeholder the load-time pass deliberately leaves standing, because
 * the year a page is READ in is not a property of the content. Same syntax as
 * the rest, and in the same vocabulary, so John does not have to know that
 * this one is answered somewhere else.
 */
export function footerNote(year: number): string {
  return resolveTokens(site.footerNote, { year: String(year) });
}
