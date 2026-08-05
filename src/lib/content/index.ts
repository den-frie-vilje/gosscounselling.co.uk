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

import siteData from '../../content/site.json';
import contactData from '../../content/contact.json';
import homeData from '../../content/home.json';
import testimonialsData from '../../content/testimonials.json';

export interface Membership {
  name: string;
  abbr: string;
  /** Qualifier such as "Accredited Member". Null where the body is a plain
   *  membership rather than a graded one. */
  note: string | null;
  /** The public register listing. Null until John supplies it; the component
   *  renders the name unlinked rather than guessing a URL. */
  href: string | null;
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

export interface Service {
  slug: string;
  title: string;
  who: string;
  /** Markdown. */
  body: string;
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
    bodies: { title: string; body: string };
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

export const site: Site = siteData;
export const contact: Contact = contactData;
export const home: Home = homeData;
export const testimonials: Testimonials = testimonialsData;

/**
 * The in-page navigation. Generated from the sections the home page actually
 * renders, paired with the heading each one already carries, so there is no
 * second list to keep in sync.
 *
 * `collapse` names the breakpoint at which a link joins the inline bar; below
 * it, the link lives in the full-page menu only.
 */
export interface NavItem {
  href: string;
  label: string;
}

export const nav: NavItem[] = [
  { href: '#help', label: 'How I can help' },
  { href: '#about', label: 'About me' },
  { href: '#fees', label: 'Fees' },
  { href: '#faq', label: 'Questions' },
  { href: '#contact', label: 'Get in touch' }
];

/** Footer note with the `{year}` placeholder resolved. */
export function footerNote(year: number): string {
  return site.footerNote.replace('{year}', String(year));
}
