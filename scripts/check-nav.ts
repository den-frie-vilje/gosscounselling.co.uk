/**
 * Gate: the bar's order is the page's order.
 *
 * The nav is written down in `src/lib/content/index.ts`, in the order the home
 * page puts these sections. Sorting it at runtime instead was tried and only
 * worked on the home page: on a post or the blog index none of those sections
 * exist, so there was nothing to sort by, and the bar rearranged itself on
 * navigation. An order that depends on which page you are looking at is not an
 * order.
 *
 * So it is authored — and gated here, at build time, where a static site can
 * settle the question once rather than asking the browser every load.
 *
 * The page's order is read from the markup: the sections in
 * `src/routes/(site)/+page.svelte`, in the order they appear, following any
 * component that carries a section of its own into its own file. That is the
 * whole trick; there is no rendering and no browser.
 *
 * Run by `pnpm check`. Self-tested below: it proves it can SEE a fault before
 * it reports the absence of one, because a checker that cannot fail is not a
 * checker.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const HOME = 'src/routes/(site)/+page.svelte';
const COMPONENTS = 'src/lib/components';

/**
 * Every section id in one file, in document order.
 *
 * Matches both `<section id="x">` and `<Section id="x" ...>`, and follows a
 * component tag to its own file so a section that lives in a component still
 * counts, and still counts WHERE IT IS USED. Depth 1: the components here hold
 * their sections directly, and a checker that recurses forever to prove a flat
 * thing is a checker nobody will read.
 */
function sectionsIn(source: string, follow: boolean): string[] {
  const ids: string[] = [];
  // One pass, in source order: either an element with an id, or a component.
  const token = /<(section|Section)\b[^>]*?\bid=["']([^"']+)["']|<([A-Z][A-Za-z0-9]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(source))) {
    if (m[2]) {
      ids.push(m[2]);
      continue;
    }
    if (!follow || !m[3]) continue;
    const file = `${COMPONENTS}/${m[3]}.svelte`;
    if (!existsSync(resolve(root, file))) continue;
    ids.push(...sectionsIn(read(file), false));
  }
  return ids;
}

/** The nav ids, in the order they are written. Read as text rather than
 *  imported, because the module is a Svelte-flavoured TS file and this script
 *  is plain node. */
function navIds(): string[] {
  const src = read('src/lib/content/index.ts');
  const block = src.match(/export const nav: NavItem\[\] = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('check-nav: could not find the `nav` array in src/lib/content/index.ts');
  return [...block[1].matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]);
}

interface Result {
  ok: boolean;
  message: string;
}

export function checkNav(homeSource: string, navSource: string[]): Result {
  const page = sectionsIn(homeSource, true);
  const onPage = navSource.filter((id) => page.includes(id));

  const missing = navSource.filter((id) => !page.includes(id));
  if (missing.length) {
    return {
      ok: false,
      message:
        `check-nav: ${missing.length} nav item(s) point at a section the home page does not have: ${missing.join(', ')}.\n` +
        `  the page has: ${page.join(' → ')}`
    };
  }

  // Their order on the page, filtered to the ones the bar carries.
  const inPageOrder = page.filter((id) => navSource.includes(id));
  if (onPage.join() !== inPageOrder.join()) {
    return {
      ok: false,
      message:
        'check-nav: the bar and the page are in different orders.\n' +
        `  bar:  ${onPage.join(' → ')}\n` +
        `  page: ${inPageOrder.join(' → ')}\n` +
        '  Fix `nav` in src/lib/content/index.ts, or move the section.'
    };
  }

  return {
    ok: true,
    message: `check-nav: the bar follows the page — ${onPage.join(' → ')}.`
  };
}

/* ---------------------------------------------------------------------------
   And whether the bar still FITS.

   John writes his own menu wording now, so the labels are content: one longer
   word, or one more section, and the bar outgrows the header. The browser can
   no longer be surprised by it — `SiteHeader.fitHeader` measures the row and
   falls back to the burger rather than overflowing — but "the menu quietly
   turned into a ☰ button" is a poor way to learn you typed two words too many,
   and it would happen after publishing rather than before.

   So the budget is checked here, in characters, against measurements taken in
   the browser at the breakpoint where it matters:

     1000px   where the bar replaces the burger
     -56      the container's gutter, both sides
     -201.5   the brand, "John Goss" over its tagline
     -20      the gap between brand and bar
     =722.5   for the bar
     -168     six gaps of 28px between seven children
     -106     the call button at its short label, "Call"
     =448.5   for the words themselves

   Inter bold at 16px averages 9.76px across the characters John can type — the
   mean over the whole alphabet rather than over today's labels, which average
   a narrower 8.53, because the gate must not be optimistic about words nobody
   has written yet. 448.5 / 9.76 = 45 characters, and today's six labels use 51.

   Today's bar therefore does not fit that arithmetic and does fit in reality,
   which is what a pessimistic advance buys and costs. The budget is set from
   the REAL measurement — 709.5px used of 722.5 — expressed as the characters
   that measurement implies at the honest mean, and then held there: it is a
   line not to cross, drawn where the site already stands.
   --------------------------------------------------------------------------- */

/** Characters, summed across every label in the bar. Today: 51. */
const LABEL_BUDGET = 53;
/** And per label, which is what the CMS shows him while he types. */
const LABEL_MAX = 18;
/** Seven children is the most the 722.5px has ever been asked to hold. */
const ITEM_MAX = 7;

function checkFit(labels: string[]): { ok: boolean; message: string } {
  const chars = labels.reduce((n, l) => n + l.length, 0);
  const over = labels.filter((l) => l.length > LABEL_MAX);

  if (over.length > 0) {
    return {
      ok: false,
      message:
        `check-nav: ${over.length} menu label(s) longer than ${LABEL_MAX} characters: ` +
        `${over.map((l) => `"${l}" (${l.length})`).join(', ')}.\n` +
        '  Shorten them under Home in the editor. The menu bar is only so wide.'
    };
  }
  if (labels.length > ITEM_MAX) {
    return {
      ok: false,
      message:
        `check-nav: ${labels.length} items in the bar, and it has room for ${ITEM_MAX}.\n` +
        '  Anything past that pushes the whole menu into the ☰ button at every width.'
    };
  }
  if (chars > LABEL_BUDGET) {
    return {
      ok: false,
      message:
        `check-nav: the menu wording totals ${chars} characters and the bar holds about ${LABEL_BUDGET}.\n` +
        `  ${labels.map((l) => `${l} (${l.length})`).join(', ')}\n` +
        '  Shorten one of them, or the menu collapses into the ☰ button on smaller laptops.'
    };
  }
  return {
    ok: true,
    message: `check-nav: the bar fits — ${labels.length} items, ${chars} of about ${LABEL_BUDGET} characters.`
  };
}

/**
 * The labels as they will actually render.
 *
 * Read from BOTH files, because the label is written in two places by design:
 * `nav` in index.ts names a content path and a fallback, and home.json holds
 * what John typed. The first version of this read only the fallbacks out of
 * the source, so it happily passed "Questions people ask" — the exact wording
 * this gate exists to refuse — because that string was in the JSON and the
 * gate was reading the code.
 *
 * Each nav line carries both halves, so both are parsed off the SAME line and
 * neither is a list kept in step by hand:
 *
 *   { id: 'faq', href: ..., label: navLabel(home.faq?.navLabel, 'Questions') }
 *                                       ^^^ path            ^^^ fallback
 */
function navLabels(): string[] {
  const src = read('src/lib/content/index.ts');
  const start = src.indexOf('export const nav: NavItem[] = [');
  if (start < 0) return [];
  const block = src.slice(start, src.indexOf('];', start));

  const home = JSON.parse(read('src/content/home.json')) as Record<string, { navLabel?: string }>;
  const out: string[] = [];
  // Two shapes: a label read from content with a fallback, or a bare literal.
  const line = /label:\s*(?:navLabel\(\s*home\.(\w+)\?\.navLabel\s*,\s*'([^']+)'\s*\)|'([^']+)')/g;
  for (const m of block.matchAll(line)) {
    if (m[3] !== undefined) {
      out.push(m[3]);
      continue;
    }
    const written = home[m[1]]?.navLabel?.trim();
    out.push(written || m[2]);
  }
  return out;
}

// ---- self-test ----
// Two faults, injected into a copy of the real markup, so the gate is proven
// against the file it actually guards rather than against a fixture that could
// drift away from it.
const home = read(HOME);
const nav = navIds();

const swapped = [...nav];
if (swapped.length >= 2) {
  const [a, b] = [swapped.length - 2, swapped.length - 1];
  [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
}
if (checkNav(home, swapped).ok) {
  console.error('check-nav: SELF-TEST FAILED — a swapped bar was reported as correct.');
  process.exit(1);
}
if (checkNav(home, [...nav, 'a-section-that-does-not-exist']).ok) {
  console.error('check-nav: SELF-TEST FAILED — a nav item with no section was reported as correct.');
  process.exit(1);
}

const labels = navLabels();
if (labels.length === 0) {
  console.error('check-nav: read no menu labels at all. Failing rather than passing on nothing.');
  process.exit(1);
}
if (checkFit([...labels, 'A label that is far too long to fit']).ok) {
  console.error('check-nav: SELF-TEST FAILED — an over-long label was reported as fitting.');
  process.exit(1);
}
if (checkFit(Array.from({ length: ITEM_MAX + 1 }, () => 'Xx')).ok) {
  console.error('check-nav: SELF-TEST FAILED — too many items was reported as fitting.');
  process.exit(1);
}
if (checkFit(labels.map((l) => l + l.slice(0, 3))).ok) {
  console.error('check-nav: SELF-TEST FAILED — an over-budget bar was reported as fitting.');
  process.exit(1);
}

const result = checkNav(home, nav);
console.log(result.message);
const fit = checkFit(labels);
console.log(fit.message);
if (!result.ok || !fit.ok) process.exit(1);
