/**
 * Canonical URLs, Schema.org graph, and the per-page SEO payload.
 */
import { PUBLIC_SITE_URL } from '$env/static/public';
import { site, contact, home, testimonials } from '$lib/content';

/*
  `$env/static/public`, not dynamic. Static env is sourced from the committed
  `.env.[mode]` files at build time and hard-fails on a missing declaration,
  so a build can never silently fall back to the production default below.
  The dynamic variant resolves from the build process's environment instead
  of the mode files, which on a sibling site turned a mis-applied mode into
  silently-wrong baked output: every staging image carried production
  canonicals and sitemap origin for months.

  This is deploy configuration, not CMS content. An editor must not be able
  to rewrite the canonical origin.
*/
function normalizeSiteUrl(raw: string | undefined): string {
  const fallback = 'https://gosscounselling.co.uk';
  const value = (raw ?? '').trim() || fallback;
  return value.replace(/\/+$/, '');
}

export const SITE_URL = normalizeSiteUrl(PUBLIC_SITE_URL);

const THEME_COLOR = '#0a2833';

/** Absolute URL for a site-relative path. */
export function absUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

const PRACTICE_ID = `${SITE_URL}/#practice`;
const PERSON_ID = `${SITE_URL}/#john`;

/** External profiles that disambiguate the entity. Single-sourced from the
 *  membership list rather than typed twice. */
const personSameAs = site.memberships
  .map((m) => m.href)
  .filter((h): h is string => Boolean(h));

/**
 * The site-wide graph: the practice and the person, cross-linked by `@id`.
 *
 * No `address`: John works in Bletchley and online, and the old site never
 * published a street address. `areaServed` carries the geography instead, so
 * the entity is placed without inventing a postal address it does not have.
 */
function siteGraph(): object[] {
  return [
    {
      '@type': 'ProfessionalService',
      '@id': PRACTICE_ID,
      name: site.name,
      description: site.description,
      url: `${SITE_URL}/`,
      telephone: contact.phone,
      email: contact.email,
      priceRange: '££',
      serviceType: site.schema.serviceType,
      areaServed: site.schema.areaServed.map((name) => ({ '@type': 'Place', name })),
      availableLanguage: 'en-GB',
      provider: { '@id': PERSON_ID },
      founder: { '@id': PERSON_ID }
    },
    {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: site.name,
      jobTitle: site.schema.jobTitle,
      description: site.schema.bio,
      url: `${SITE_URL}/`,
      telephone: contact.phone,
      email: contact.email,
      knowsAbout: site.schema.knowsAbout,
      knowsLanguage: 'en-GB',
      worksFor: { '@id': PRACTICE_ID },
      ...(personSameAs.length ? { sameAs: personSameAs } : {}),
      memberOf: site.memberships.map((m) => ({
        '@type': 'Organization',
        name: m.name,
        ...(m.href ? { url: m.href } : {})
      }))
    }
  ];
}

/**
 * The FAQ block, as a `FAQPage` node. Derived from the same content the page
 * renders, so the two can never drift apart.
 */
export function faqNode(): object {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: home.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };
}

/**
 * Testimonials as `Review` nodes on the practice.
 *
 * Emitted only when there are testimonials to emit, and deliberately without
 * an `aggregateRating`: nobody has given John a star rating, and inventing
 * one to win a rich result would be a lie told to a search engine about a
 * counsellor. Anonymised attributions stay anonymised here too.
 */
export function reviewNodes(): object[] {
  return testimonials.items.map((t, i) => ({
    '@type': 'Review',
    '@id': `${SITE_URL}/#review-${i + 1}`,
    itemReviewed: { '@id': PRACTICE_ID },
    reviewBody: t.quote,
    author: { '@type': 'Person', name: t.name }
  }));
}

/** Site-wide JSON-LD graph, optionally extended with page-specific nodes. */
export function buildSiteJsonLd(extra: object[] = []): object {
  return { '@context': 'https://schema.org', '@graph': [...siteGraph(), ...extra] };
}

export interface PageSeo {
  title: string;
  description: string;
  author: string;
  themeColor: string;
  canonical: string;
  og: {
    type: string;
    siteName: string;
    title: string;
    description: string;
    url: string;
    image: { url: string; alt: string; width: number; height: number; type: string };
  };
  twitter: { card: string; title: string; description: string; image: string };
  jsonLd: string;
}

interface BuildPageSeoInput {
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  image?: string;
  imageAlt?: string;
  graph?: object[];
}

/** Map a site-relative path to its OG slug (`/` → home). */
function ogSlug(path: string): string {
  if (path === '/') return 'home';
  return path.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-');
}

/** Assemble the `PageSeo` for a page. */
export function buildPageSeo(input: BuildPageSeoInput): PageSeo {
  const canonical = absUrl(input.path);
  const ogTitle = input.ogTitle ?? input.title;
  const imageUrl = absUrl(input.image ?? `/img/og/${ogSlug(input.path)}.png`);
  const imageAlt = input.imageAlt ?? `${site.name} — ${site.tagline}`;

  return {
    title: input.title,
    description: input.description,
    author: site.name,
    themeColor: THEME_COLOR,
    canonical,
    og: {
      type: 'website',
      siteName: site.name,
      title: ogTitle,
      description: input.description,
      url: canonical,
      image: { url: imageUrl, alt: imageAlt, width: 1200, height: 630, type: 'image/png' }
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: input.description,
      image: imageUrl
    },
    jsonLd: JSON.stringify(buildSiteJsonLd(input.graph))
  };
}
