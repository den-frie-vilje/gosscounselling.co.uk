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
import postsData from '../../content/posts.json';
import { mockPosts, mockServiceDetail, mockTestimonials } from './mock';

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
  footerNote: string;
  schema: {
    jobTitle: string;
    bio: string;
    serviceType: string;
    knowsAbout: string[];
    areaServed: string[];
  };
  memberships: Membership[];
}

export interface Contact {
  heading: string;
  email: string;
  emailHref: string;
  phone: string;
  phoneHref: string;
  whatsappHref: string;
  location: string;
  locationNote: string;
  /** Heading over the contact block in the full-page menu. In content rather
   *  than hardcoded, so it is editable with the rest of the copy. */
  menuHeading: string;
  /* The three notes under the contact rows. Kept deliberately free of any
     claim about how John's practice runs at his end: an earlier draft said
     visitors would not reach a receptionist and would get a call back, and
     neither is anywhere in what he told us. See docs/content-coverage.md. */
  phoneNote: string;
  emailNote: string;
  whatsappNote: string;
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

export interface Home {
  navLabel: string;
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    /** His own sentence, from the old site. */
    aside: string;
    /** Inline markdown. */
    reassure: string;
    ctaPrimary: string;
    ctaSecondary: string;
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
  seo: { title: string; description: string };
  og: { eyebrow: string; title: string; subtitle: string; cta: string };
}

export interface Testimonial {
  quote: string;
  /** Attribution. Anonymised for client work, by name for colleagues. */
  name: string;
  /** Optional role or context, e.g. "Supervisee". */
  detail?: string;
}

export interface Testimonials {
  kicker: string;
  heading: string;
  /** Optional standing note shown under the heading. Empty string hides it. */
  note: string;
  items: Testimonial[];
}

export interface Post {
  /** Identifier, not copy: the post's address is built from it, so it is not
   *  an editable field in the CMS. */
  slug: string;
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

export const site: Site = siteData;
export const contact: Contact = contactData;

/* Mock content is merged in only where it exists, and it only exists in dev
   (see ./mock.ts). Production reads exactly the JSON in src/content/. */
export const testimonials: Testimonials = mockTestimonials ?? testimonialsData;

export const home: Home = mockServiceDetail
  ? {
      ...homeData,
      services: {
        ...homeData.services,
        items: homeData.services.items.map((item) =>
          mockServiceDetail[item.slug] ? { ...item, detail: mockServiceDetail[item.slug] } : item
        )
      }
    }
  : homeData;

/* ---------------------------------------------------------------------------
   Addresses.

   Every URL that points at this site is derived here, from the route tree and
   from the identifiers the content already carries. None of them is typed by
   an editor. External links (a register listing, a body he trained with, a
   link out of a blog post) stay plain string fields in the content, because
   those genuinely are his to write; an address on his own site is not.
   --------------------------------------------------------------------------- */

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
  return service.slug === 'supervision'
    ? '/supervision/'
    : `/counselling/${service.slug}/`;
}

/** The services that have a page. Ships empty: no service has a `detail`. */
export function detailServices(): Service[] {
  return home.services.items.filter((s) => s.detail);
}

export const BLOG_PATH = '/blog/';

export function postPath(post: Post): string {
  return `${BLOG_PATH}${post.slug}/`;
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

const allPosts: Post[] = [
  ...(postsData as Posts).posts,
  ...(mockPosts ? mockPosts.posts : [])
];

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
  href: string;
  label: string;
}

export const nav: NavItem[] = [
  { href: '/#help', label: 'How I can help' },
  { href: '/#about', label: 'About me' },
  { href: '/#fees', label: 'Fees' },
  { href: '/#faq', label: 'Questions' },
  { href: '/#contact', label: 'Get in touch' }
];

/** Appended by the header only while there is something to read. */
export const blogNavItem: NavItem = { href: BLOG_PATH, label: 'Blog' };

/** Footer note with the `{year}` placeholder resolved. */
export function footerNote(year: number): string {
  return site.footerNote.replace('{year}', String(year));
}
