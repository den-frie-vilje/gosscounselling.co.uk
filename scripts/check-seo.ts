/**
 * Gate: everything this site asserts about John to a machine is traceable.
 *
 *     pkgx node scripts/check-seo.ts
 *
 * Three claims are made in the page head that no visitor will ever read back,
 * and each has its own way of going quietly wrong. A wrong fee is caught by
 * the fee table printed underneath it. These are not.
 *
 *   1. `memberOf` — the bodies he belongs to. `memberships.json` holds four
 *      entries and only two are memberships: the Professional Standards
 *      Authority accredits the NCPS register he is on, and Men's Therapy Hub
 *      is a directory that lists him. Declaring either as a body he belongs to
 *      is a false credential claim about a counsellor, and it would sit there
 *      looking exactly like the true ones.
 *
 *   2. `sameAs` — the accounts elsewhere that are his. Built from
 *      `social.json` plus the `href` on any membership row, and that `href` is
 *      a free text box in the CMS. Put his listing in it and the claim is
 *      right; put the register's own home page in it and the site starts
 *      telling Google that John Goss and the NCPS are one entity. No code can
 *      tell those apart, so this gate holds the line instead: every URL that
 *      reaches `sameAs` must be one docs/social-profiles.md records as
 *      VERIFIED. That file's bar is two independent corroborations, and it has
 *      one entry — a LinkedIn profile — deliberately held at PROBABLE. The
 *      self-test below tries to smuggle exactly that one through.
 *
 *   3. `priceRange` — and the OG card the range travels beside. A card URL
 *      pointing at a file that was never generated is a blank preview
 *      everywhere his link is shared.
 *
 * It imports $lib/seo/entity, which is the code that actually ships, rather
 * than restating its rules here. A gate that re-implements what it gates is
 * checking its own second copy.
 *
 * Run by `pnpm check`. Self-tested first, against doctored copies of the real
 * content, because a checker that cannot fail is not a checker.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import {
  entitySameAs,
  memberOfOrganizations,
  normalizeProfileUrl,
  priceRangeFrom,
  type MembershipLike
} from '../src/lib/seo/entity.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p));

const PROFILES_DOC = 'docs/social-profiles.md';
const ROUTES = 'src/routes';

interface Result {
  ok: boolean;
  message: string;
}

/* ---------------------------------------------------------------------------
   1. memberOf
   --------------------------------------------------------------------------- */

/** A row as `memberships.json` writes it: the shipping shape plus the
 *  abbreviation, so a failure can name the row the way the CMS shows it. */
interface MembershipRow extends MembershipLike {
  abbr: string;
}

/** The emitter under test. A parameter, not a hard-wired call, purely so the
 *  self-test can hand this a broken one — see the note below `emitFault`. */
type Emitter = (rows: readonly MembershipLike[]) => Array<{ name: string }>;

/**
 * Nothing may be declared a membership that is not flagged as one.
 *
 * The assertion compares the OUTPUT of the shipping function against the INPUT
 * it was given, rather than against a list of body names. A rule written as
 * "the Professional Standards Authority must not appear" stops working the day
 * John adds a fifth body, and the fifth body is the one nobody is watching.
 *
 * Which means this gate cannot be provoked by doctoring the CONTENT — the
 * shipping filter is correct, so every input produces a consistent output. It
 * is a regression gate on the code, and the self-test proves it sees a fault
 * by handing it an emitter that has stopped filtering. That is the failure it
 * is here to catch: someone simplifying `memberOf` back to a plain `.map()`.
 */
export function checkMemberOf(
  memberships: readonly MembershipRow[],
  emit: Emitter = memberOfOrganizations
): Result {
  const emitted = emit(memberships);
  const names = new Set(emitted.map((o) => o.name));
  const wrong = memberships.filter((m) => !m.isMembership && names.has(m.name));

  if (wrong.length) {
    return {
      ok: false,
      message:
        `check-seo: ${wrong.length} entr(y/ies) in src/content/memberships.json reach \`memberOf\` but are ` +
        `not memberships: ${wrong.map((m) => `${m.abbr} (${m.name})`).join(', ')}.\n` +
        '  A body that accredits or lists him is not a body he belongs to.'
    };
  }

  const expected = memberships.filter((m) => m.isMembership).length;
  if (emitted.length !== expected) {
    return {
      ok: false,
      message: `check-seo: memberOf carries ${emitted.length} bodies, but ${expected} are flagged as memberships.`
    };
  }

  const excluded = memberships.filter((m) => !m.isMembership).map((m) => m.abbr);
  return {
    ok: true,
    message:
      `check-seo: memberOf declares ${emitted.length} bod(y/ies) — ${[...names].join(', ')}` +
      (excluded.length ? `; kept out: ${excluded.join(', ')}.` : '.')
  };
}

/* ---------------------------------------------------------------------------
   2. sameAs
   --------------------------------------------------------------------------- */

/**
 * The URLs docs/social-profiles.md records as VERIFIED.
 *
 * Read off the table rows only — the `**VERIFIED**` verdict cell — so a URL
 * quoted in the prose of a rejection ("Nick Goss Counselling", the wrong
 * John Goss) can never be mistaken for a verdict. Google Business Profile is
 * VERIFIED there but has no https URL, so it simply contributes nothing.
 */
export function verifiedProfileUrls(doc: string): Set<string> {
  const urls = new Set<string>();
  for (const line of doc.split('\n')) {
    if (!line.includes('**VERIFIED**')) continue;
    for (const m of line.matchAll(/`(https?:\/\/[^`]+)`/g)) urls.add(normalizeProfileUrl(m[1]));
  }
  return urls;
}

export function checkSameAs(sameAs: string[], verified: Set<string>): Result {
  // Fail closed. An empty set means the table's shape changed under the
  // parser above, and every URL would then look unverified — or, if the
  // comparison were written the other way round, every URL would pass.
  if (verified.size === 0) {
    return {
      ok: false,
      message:
        `check-seo: no VERIFIED profile URLs could be read out of ${PROFILES_DOC}. ` +
        'The table format changed, or the file moved. This check has verified nothing.'
    };
  }

  const unvouched = sameAs.filter((url) => !verified.has(normalizeProfileUrl(url)));
  if (unvouched.length) {
    return {
      ok: false,
      message:
        `check-seo: ${unvouched.length} URL(s) are being declared as John's own to search engines ` +
        `without a VERIFIED entry in ${PROFILES_DOC}:\n` +
        unvouched.map((u) => `    ${u}`).join('\n') +
        '\n  Either the profile is his and the evidence belongs in that file, or it is not his ' +
        'and it must not be in `sameAs`. A directory listing goes in as HIS LISTING, never as the\n' +
        "  register's own home page: `sameAs` says these are the same entity."
    };
  }

  return {
    ok: true,
    message: `check-seo: all ${sameAs.length} sameAs URL(s) are VERIFIED in ${PROFILES_DOC}.`
  };
}

/* ---------------------------------------------------------------------------
   3. priceRange, and the cards
   --------------------------------------------------------------------------- */

interface FeeRow {
  lines: Array<{ value: string }>;
}

/**
 * The published range must actually span the published fees.
 *
 * Checked as a property rather than by working the range out a second way:
 * both endpoints have to appear somewhere in the fee table, and no fee may
 * fall outside them. That catches a range that is stale, inverted or narrower
 * than the table, without this file owning a rival copy of the arithmetic.
 */
export function checkPriceRange(rows: FeeRow[]): Result {
  const range = priceRangeFrom(rows);
  const fees = rows
    .flatMap((r) => r.lines)
    .filter((l) => String(l.value).includes('£'))
    .flatMap((l) => [...String(l.value).matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])));

  if (fees.length === 0) {
    return range === null
      ? { ok: true, message: 'check-seo: no fees are published, and no priceRange is claimed.' }
      : { ok: false, message: `check-seo: priceRange claims ${range} with no fees published.` };
  }
  if (range === null) {
    return { ok: false, message: 'check-seo: fees are published but no priceRange was derived.' };
  }

  const bounds = [...range.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const low = Math.min(...bounds);
  const high = Math.max(...bounds);
  const outside = fees.filter((f) => f < low || f > high);
  if (outside.length) {
    return {
      ok: false,
      message:
        `check-seo: priceRange ${range} does not cover the published fee table — ` +
        `${[...new Set(outside)].join(', ')} fall outside it.`
    };
  }
  if (!fees.includes(low) || !fees.includes(high)) {
    return {
      ok: false,
      message: `check-seo: priceRange ${range} names a figure that is not in the fee table.`
    };
  }
  return { ok: true, message: `check-seo: priceRange ${range} spans the published fee table.` };
}

/** Every `.svelte` under src/routes. */
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(resolve(root, rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (rel.endsWith('.svelte')) out.push(rel);
  }
  return out;
}

/**
 * The text of each `buildPageSeo({...})` call, by balanced parentheses.
 *
 * A non-greedy regex was the obvious way and is wrong here: a post's call
 * contains `blogPostingNode({ … })`, and the first `})` a lazy match finds is
 * that one's, so the outer call gets read as ending early. Counting brackets
 * costs fifteen lines and cannot be fooled by nesting.
 */
function seoCalls(source: string): string[] {
  const calls: string[] = [];
  const NEEDLE = 'buildPageSeo(';
  let from = 0;
  for (;;) {
    const start = source.indexOf(NEEDLE, from);
    if (start === -1) return calls;
    let i = start + NEEDLE.length;
    let depth = 1;
    let quote: string | null = null;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    calls.push(source.slice(start, i));
    from = i;
  }
}

/**
 * Every card a page points at has to be a file that exists.
 *
 * Two ways a page gets one. It names an `image:`, which is what all of them do
 * today — then that path has to resolve under `static/`. Or it names none, and
 * `buildPageSeo` falls back to `/img/og/<slug>.png` derived from the page's
 * path — then that card has to have been generated, and `scripts/gen-og.ts`
 * builds exactly one, `home`. A page whose path is computed rather than
 * written down cannot have its fallback checked at all, so it has to name its
 * card: the alternative is a share preview that is blank in every chat window
 * it is pasted into, discovered by somebody pasting it.
 */
export function checkOgCards(files: Array<{ file: string; source: string }>): Result {
  const problems: string[] = [];
  let checked = 0;

  for (const { file, source } of files) {
    for (const call of seoCalls(source)) {
      checked++;
      const image = call.match(/\bimage:\s*'([^']+)'/);
      if (image) {
        const asset = `static${image[1]}`;
        if (!existsSync(resolve(root, asset))) {
          problems.push(`${file}: og image ${image[1]} — no such file at ${asset}`);
        }
        continue;
      }
      const path = call.match(/\bpath:\s*'([^']+)'/);
      if (!path) {
        problems.push(
          `${file}: buildPageSeo has no \`image:\` and its \`path:\` is computed, so the ` +
            'fallback card cannot be checked. Pass an explicit `image:`.'
        );
        continue;
      }
      const slug =
        path[1] === '/' ? 'home' : path[1].replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-');
      const asset = `static/img/og/${slug}.png`;
      if (!existsSync(resolve(root, asset))) {
        problems.push(
          `${file}: buildPageSeo({ path: '${path[1]}' }) falls back to /img/og/${slug}.png, ` +
            'which scripts/gen-og.ts does not build. Add a card there, or pass an explicit `image:`.'
        );
      }
    }
  }

  if (checked === 0) {
    return {
      ok: false,
      message: 'check-seo: no buildPageSeo call sites were found under src/routes. Nothing was checked.'
    };
  }
  if (problems.length) {
    return { ok: false, message: `check-seo: ${problems.map((p) => `\n    ${p}`).join('')}` };
  }
  return { ok: true, message: `check-seo: ${checked} share card(s) point at files that exist.` };
}

/* ---------------------------------------------------------------------------
   self-test
   --------------------------------------------------------------------------- */

const membershipsFile = readJson('src/content/memberships.json') as { items: MembershipRow[] };
const social = readJson('src/content/social.json') as { profiles: Array<{ url: string }> };
/* The fee table is one section of the home page and one file: see the note on
   the Home collection in static/admin/config.yml. */
const fees = readJson('src/content/home/fees.json') as { rows: FeeRow[] };
const doc = read(PROFILES_DOC);
const memberships = membershipsFile.items;

function die(message: string): never {
  console.error(`check-seo: SELF-TEST FAILED — ${message}`);
  process.exit(1);
}

// memberOf. The content has to contain the case for the gate to be worth
// anything at all: if every body in the file were a membership, a filter that
// had stopped filtering would still produce the right answer and this check
// would pass forever without testing anything.
if (memberships.every((m) => m.isMembership)) {
  die('every body in memberships.json is a membership, so nothing here is being kept out.');
}
if (checkMemberOf(memberships).ok !== true) {
  die('the real memberships were reported as wrong.');
}
// The regression: `memberOf` written as a plain map, with the flag ignored.
if (checkMemberOf(memberships, (rows) => rows.map((m) => ({ name: m.name }))).ok) {
  die('an emitter that declares every body a membership was reported as correct.');
}

// sameAs: the two failures that matter, both drawn from real life.
const verified = verifiedProfileUrls(doc);
if (verified.size === 0) die(`no VERIFIED URLs parsed out of ${PROFILES_DOC}.`);
const realSameAs = entitySameAs(social.profiles, memberships);
if (checkSameAs(realSameAs, verified).ok !== true) {
  die('the profiles actually on the site were reported as unverified.');
}
// The LinkedIn profile docs/social-profiles.md holds at PROBABLE and says
// plainly must not be linked until somebody asks John.
if (checkSameAs([...realSameAs, 'https://www.linkedin.com/in/john-goss-mncs-accred-521393118/'], verified).ok) {
  die('a PROBABLE profile was accepted as his.');
}
// A register's own home page in the membership `href` box.
if (checkSameAs([...realSameAs, 'https://ncps.com'], verified).ok) {
  die("a membership body's home page was accepted as one of his own profiles.");
}
if (checkSameAs(realSameAs, new Set()).ok) {
  die('an empty verified set was reported as a pass.');
}

// priceRange: a fee outside the range the graph publishes.
if (checkPriceRange(fees.rows).ok !== true) {
  die('the real fee table was reported as inconsistent with its own range.');
}
if (checkPriceRange([{ lines: [{ value: '£10' }, { value: 'ask me' }] }]).ok !== true) {
  die('a fee table with one figure in it was rejected.');
}
if (checkPriceRange([]).ok !== true) {
  die('an empty fee table with no priceRange was rejected.');
}

// cards: a page pointing at a file nobody generated.
const sources = routeFiles(ROUTES).map((file) => ({ file, source: read(file) }));
if (checkOgCards(sources).ok !== true) {
  die('the real routes were reported as pointing at cards that do not exist.');
}
if (
  checkOgCards([
    { file: 'fixture', source: "buildPageSeo({ path: '/', image: '/img/og/nothing-here.png' })" }
  ]).ok
) {
  die('a card that does not exist was reported as present.');
}
if (checkOgCards([{ file: 'fixture', source: "buildPageSeo({ path: somePath })" }]).ok) {
  die('a computed path with no explicit card was reported as checkable.');
}
if (checkOgCards([]).ok) {
  die('examining no routes at all was reported as a pass.');
}

/* ---------------------------------------------------------------------------
   the real thing
   --------------------------------------------------------------------------- */

const results = [
  checkMemberOf(memberships),
  checkSameAs(realSameAs, verified),
  checkPriceRange(fees.rows),
  checkOgCards(sources)
];

for (const r of results) (r.ok ? console.log : console.error)(r.message);
if (results.some((r) => !r.ok)) process.exit(1);
