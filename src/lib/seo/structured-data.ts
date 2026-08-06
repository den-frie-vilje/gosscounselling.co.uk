/**
 * Canonical URLs, Schema.org graph, and the per-page SEO payload.
 */
import { PUBLIC_SITE_URL } from '$env/static/public';
import { site, contact, home, memberships, search, social, testimonials } from '$lib/content';
import { parsePhone } from '$lib/phone';
import {
  entitySameAs,
  memberOfOrganizations,
  postalPartsFrom,
  priceRangeFrom
} from '$lib/seo/entity';

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
 *
 * The rule itself lives in $lib/seo/entity, with no imports, so that
 * `scripts/check-seo.ts` can gate the code that ships rather than a copy of
 * it. What that gate enforces is the part no code can decide: every URL that
 * reaches here has to be one docs/social-profiles.md records as VERIFIED.
 */
const personSameAs = entitySameAs(social.profiles, memberships);

/**
 * The number in international form, for machines only.
 *
 * John writes "07776 153 426", which is how you would say it and how it is
 * set on the page. Schema.org asks for a number a machine can dial without
 * knowing which country it is reading from, and a bare UK trunk number is
 * ambiguous outside the UK — `07776…` is a valid national number in several
 * other places. The site already turns his string into E.164 for `tel:` and
 * for wa.me, through the same parser, so this is the fourth consumer of one
 * number rather than a fifth copy of it. `scripts/check-contact.ts` fails the
 * build if it will not parse; the fallback below is for that build's benefit
 * only, and never reaches a deploy.
 */
const TELEPHONE = parsePhone(contact.phone).e164 ?? contact.phone;

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
  // Read off the fee table the page publishes, never typed. It was the
  // literal `'£45-£110'` under a comment claiming it was derived; see
  // $lib/seo/entity, where the rule lives so a build gate can test the code
  // that actually ships rather than a second copy of it.
  const fees = priceRangeFrom(home.fees.rows);
  return [
    {
      '@type': 'ProfessionalService',
      '@id': PRACTICE_ID,
      name: site.name,
      description: search.description,
      url: `${SITE_URL}/`,
      telephone: TELEPHONE,
      email: contact.email,
      // Parsed off the one line he types, never written twice. See
      // $lib/seo/entity's `postalPartsFrom`: the locality, region and postcode
      // used to be literals here while `contact.location` said the same thing,
      // which meant a move of practice would have changed every page a visitor
      // reads and left the graph insisting on the old town.
      address: {
        '@type': 'PostalAddress',
        ...postalPartsFrom(contact.location),
        addressCountry: 'GB'
      },
      ...(fees ? { priceRange: fees } : {}),
      // `knowsAbout`, not `serviceType`: the latter's domain is Service, not
      // LocalBusiness, so it was three lines that looked like they were doing
      // work and were not. Same reason `provider` and `availableLanguage`
      // came out; `founder` already carries the link to the person. The
      // `schema.serviceType` field John could still edit in the CMS has now
      // gone too — it fed nothing here or anywhere else.
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
      telephone: TELEPHONE,
      email: contact.email,
      knowsAbout: site.schema.knowsAbout,
      knowsLanguage: 'en-GB',
      worksFor: { '@id': PRACTICE_ID },
      ...(personSameAs.length ? { sameAs: personSameAs } : {}),
      // Only the bodies he actually belongs to — the Professional Standards
      // Authority accredits the register rather than admitting him, and Men's
      // Therapy Hub is a directory that lists him. The filter is in
      // $lib/seo/entity so that scripts/check-seo.ts gates this exact code.
      memberOf: memberOfOrganizations(memberships)
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
export function buildSiteJsonLd(extra: (object | null | undefined)[] = []): object {
  // Nulls are dropped here rather than at every call site. A node that only
  // sometimes applies — a BreadcrumbList needs at least two crumbs, a review
  // list needs a review — should be able to say "not this time" by returning
  // null, and the caller should not have to filter for it.
  return {
    '@context': 'https://schema.org',
    '@graph': [...siteGraph(), ...extra.filter((node): node is object => node != null)]
  };
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
  /** Open Graph object type. Defaults to `website`; a post passes `article`.
   *  It is here rather than in `SeoHead` because `SeoHead` renders what it is
   *  handed and decides nothing, which is what makes it readable. */
  ogType?: string;
  graph?: (object | null | undefined)[];
}

/**
 * The trail, for a search result rather than for the page.
 *
 * Google renders a BreadcrumbList as the little path above a result instead of
 * the bare URL, which is the only reason to emit it: it is the same trail the
 * page already draws, said again in the form a crawler reads. Built from the
 * SAME array the component is handed, so the two cannot disagree — a
 * breadcrumb in the markup that says one thing and a BreadcrumbList that says
 * another is worse than neither.
 *
 * The last item carries no `item`: it is the current page, and naming it would
 * be telling a crawler the page links to itself.
 */
export function breadcrumbNode(trail: { label: string; href?: string }[]): object | null {
  if (trail.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      ...(crumb.href && i < trail.length - 1 ? { item: absUrl(crumb.href) } : {})
    }))
  };
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
      type: input.ogType ?? 'website',
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
