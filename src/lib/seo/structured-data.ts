/**
 * Canonical URLs, Schema.org graph, and the per-page SEO payload.
 */
import { PUBLIC_SITE_URL } from '$env/static/public';
import { site, contact, home, social, testimonials } from '$lib/content';

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

/**
 * External profiles that disambiguate the entity, single-sourced rather than
 * typed twice: his verified social accounts, plus any membership register
 * listing that has a URL.
 *
 * This is the property that tells a search engine the John Goss here is the
 * John Goss there, and it was empty. His own site linked to neither of his
 * accounts, so nothing connected them at all.
 */
const personSameAs = [
  ...social.profiles.map((p) => p.url),
  ...site.memberships.map((m) => m.href).filter((h): h is string => Boolean(h))
];

/**
 * The site-wide graph: the practice and the person, cross-linked by `@id`.
 *
 * The address is built only from what the page already publishes in prose,
 * "Bletchley, Milton Keynes MK3", and no further. `streetAddress` is not a
 * required property of PostalAddress, and John has never published one, so
 * there is none here.
 *
 * It is present at all because `address` is one of only two properties Google
 * requires of a LocalBusiness, and a node missing a required property is inert
 * rather than merely thinner: `areaServed` does not substitute and is not
 * mentioned in that guidance at any point. `areaServed` stays alongside it.
 *
 * This will not move the local pack. That is Google Business Profile's job,
 * and proximity for a service-area business is computed from the verified
 * address held there, not from anything on a website.
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
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Bletchley',
        addressRegion: 'Milton Keynes',
        postalCode: 'MK3',
        addressCountry: 'GB'
      },
      // Derived from the fee rows actually published on the page, rather
      // than a hand-picked band nobody chose.
      priceRange: '£45-£110',
      // `knowsAbout`, not `serviceType`: the latter's domain is Service, not
      // LocalBusiness, so it was three lines that looked like they were doing
      // work and were not. Same reason `provider` and `availableLanguage`
      // came out; `founder` already carries the link to the person.
      knowsAbout: site.schema.knowsAbout,
      areaServed: site.schema.areaServed.map((name) => ({ '@type': 'Place', name })),
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
      // Only the bodies he actually belongs to. The Professional Standards
      // Authority accredits the register; it is not somewhere he is a member,
      // and claiming otherwise to a search engine would be a small lie about
      // a counsellor's credentials.
      memberOf: site.memberships
        .filter((m) => m.isMembership)
        .map((m) => ({
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
 * A blog post, as a `BlogPosting` node.
 *
 * Every field is the post's own: headline, date and description come from
 * what is on the page, and the author is the Person node already in the
 * graph rather than a second copy of his name. Nothing is asserted here that
 * a reader of the page could not check.
 *
 * There is no `dateModified`, because nothing records when a post was edited
 * and a build stamp is not that date.
 */
export function blogPostingNode(input: {
  path: string;
  title: string;
  description: string;
  publishAt: string;
}): object {
  const url = absUrl(input.path);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    mainEntityOfPage: url,
    url,
    headline: input.title,
    description: input.description,
    datePublished: input.publishAt,
    author: { '@id': PERSON_ID },
    publisher: { '@id': PRACTICE_ID }
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
