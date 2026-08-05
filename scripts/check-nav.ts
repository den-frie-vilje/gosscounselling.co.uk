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

const result = checkNav(home, nav);
console.log(result.message);
if (!result.ok) process.exit(1);
