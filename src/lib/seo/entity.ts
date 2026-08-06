/**
 * The claims the Schema.org graph makes about John that are DERIVED from what
 * he has published rather than typed alongside it, pulled out of
 * `structured-data.ts` into a module with no imports at all.
 *
 * No `$env`, no `$lib`, no JSON: everything arrives as an argument. That is
 * the point of the file. `structured-data.ts` cannot be loaded by a plain node
 * script, because importing it pulls in `$env/static/public` and the whole
 * content layer, so a build-time gate could only ever have re-implemented
 * these rules and then checked its own re-implementation — which is not a
 * check, it is a second copy. `scripts/check-seo.ts` imports THIS file, so
 * what it gates is the code that actually ships.
 *
 * Two of the three are claims about a counsellor's credentials and identity.
 * Nothing a visitor reads contradicts those, and the only reader is a machine,
 * which is precisely why they need a gate rather than an eye: a wrong fee gets
 * spotted against the fee table beneath it, and a wrong `memberOf` does not
 * get spotted at all.
 */

/** The shape `memberOf` and `sameAs` read. Structural, so `Membership` from
 *  `$lib/content` satisfies it without this file importing it. */
export interface MembershipLike {
  name: string;
  href: string | null;
  /** False for a body that accredits rather than admits. */
  isMembership: boolean;
}

export interface ProfileLike {
  url: string;
}

/** One row of the published fee table; only the money column is read. */
export interface FeeRowLike {
  lines: ReadonlyArray<{ value: string }>;
}

/**
 * The bodies John belongs to, as Organization nodes.
 *
 * The filter is the whole function, and it is here rather than inline because
 * of what it prevents. Two of the four entries in `memberships` are not
 * memberships: the Professional Standards Authority accredits the NCPS
 * register he is on, and Men's Therapy Hub is a directory that lists him.
 * Both belong in the qualifications block on the page, where the note beside
 * each says what the relationship is; neither may be declared to a search
 * engine as a body he is a member of. That would be a small lie about a
 * counsellor's credentials, which is the one kind of error this site cannot
 * afford — and it is exactly the sort that survives review, because a logo
 * row and a `memberOf` array look the same from a distance.
 */
export function memberOfOrganizations(
  memberships: readonly MembershipLike[]
): Array<{ '@type': 'Organization'; name: string; url?: string }> {
  return memberships
    .filter((m) => m.isMembership)
    .map((m) => ({
      '@type': 'Organization' as const,
      name: m.name,
      ...(m.href ? { url: m.href } : {})
    }));
}

/**
 * The URLs that say "the John Goss here is the John Goss there".
 *
 * His verified social accounts, plus any listing in the memberships block that
 * carries a URL. The second source is the fragile one: `href` is a free text
 * field in the CMS labelled "Your public listing on their register", and a
 * listing ABOUT him is a correct `sameAs` while the register's own home page
 * is not — put `https://ncps.com` in that box and the graph starts telling
 * Google that John Goss and the National Counselling & Psychotherapy Society
 * are the same entity. Nothing in the data distinguishes the two cases, so
 * this function cannot; `scripts/check-seo.ts` settles it instead, by
 * requiring every URL that lands here to appear as VERIFIED in
 * docs/social-profiles.md.
 */
export function entitySameAs(
  profiles: readonly ProfileLike[],
  memberships: readonly MembershipLike[]
): string[] {
  const urls = [
    ...profiles.map((p) => p.url),
    ...memberships.map((m) => m.href).filter((h): h is string => Boolean(h))
  ];
  return [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
}

/**
 * One URL, in the form the gate compares on: trailing slash and case are not
 * identity. `social.json` records the Instagram account without a trailing
 * slash and docs/social-profiles.md records it with one, and neither is wrong.
 * Exported so the gate cannot normalise differently from the thing it gates.
 */
export function normalizeProfileUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * `priceRange`, read off the fee table the page actually publishes.
 *
 * It used to be the literal `'£45-£110'`, under a comment saying it was
 * derived from the fee rows. It was not derived from anything; it was right on
 * the day somebody typed it. John edits those fees in the CMS, and the first
 * time he did, this would have gone on quoting a floor and a ceiling that
 * appeared nowhere on his site.
 *
 * Every number in every fee line, low to high: "£70–90" counts as both ends,
 * a flat "£45" as one. Only a value naming the currency is read, because that
 * column is the only place a number means money.
 *
 * Returns null when there is nothing numeric to read, and the caller omits the
 * property. `priceRange` is optional; no claim beats a made-up one.
 */
export function priceRangeFrom(rows: readonly FeeRowLike[]): string | null {
  const amounts: number[] = [];
  for (const row of rows) {
    for (const line of row.lines) {
      if (!String(line.value).includes('£')) continue;
      for (const match of String(line.value).matchAll(/\d+(?:\.\d+)?/g)) {
        const n = Number(match[0]);
        if (Number.isFinite(n)) amounts.push(n);
      }
    }
  }
  if (amounts.length === 0) return null;
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  return low === high ? `£${low}` : `£${low}-£${high}`;
}

/** A PostalAddress, minus the parts we have no business guessing. */
export interface PostalParts {
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

/**
 * The address, parsed out of the ONE line John types.
 *
 * `addressLocality: 'Bletchley'`, `addressRegion: 'Milton Keynes'` and
 * `postalCode: 'MK3'` were written into `structured-data.ts` as literals while
 * `contact.location` said the same thing three feet away. Two copies of a fact
 * is one copy too many, and this was the copy nobody would ever look at: if he
 * moved practice, every page a visitor reads would say the new town and the
 * machine-readable graph would keep insisting on the old one.
 *
 * So it is derived, and it is derived from the field he already fills in
 * rather than from three new ones. Asking him to type the locality, the region
 * and the postcode separately AND a line to display would be four fields for
 * one fact, and `check-contact.ts` exists specifically to refuse a second copy
 * of something he has already written.
 *
 * The grammar is the one his line already uses and the one a UK address uses:
 *
 *     <locality>, <region> <outward code>      Bletchley, Milton Keynes MK3
 *     <locality>, <region>                     Bletchley, Milton Keynes
 *     <locality>                               Bletchley
 *
 * The outward code is the first half of a UK postcode — one or two letters, a
 * digit, then optionally one more letter or digit — and it is only read when
 * it is the LAST token, because that is the only position it occupies.
 *
 * Anything that does not parse yields fewer properties rather than wrong ones.
 * A PostalAddress carrying only a locality is valid and true; one carrying a
 * region that is really the second half of a street name is neither.
 */
export function postalPartsFrom(location: string): PostalParts {
  const line = location.trim().replace(/\s+/g, ' ');
  if (!line) return {};

  // Split on the LAST comma: "Bletchley, Milton Keynes MK3" has one, but a
  // line like "Whaddon Way, Bletchley, Milton Keynes" puts the locality and
  // region in the final two parts and the street in front of them.
  const cut = line.lastIndexOf(',');
  if (cut === -1) return { addressLocality: line };

  const addressLocality = line.slice(0, cut).split(',').pop()!.trim();
  let rest = line.slice(cut + 1).trim();

  const outward = rest.match(/\s([A-Z]{1,2}\d[A-Z\d]?)$/);
  const postalCode = outward?.[1];
  if (outward) rest = rest.slice(0, outward.index).trim();

  return {
    ...(addressLocality ? { addressLocality } : {}),
    ...(rest ? { addressRegion: rest } : {}),
    ...(postalCode ? { postalCode } : {})
  };
}
