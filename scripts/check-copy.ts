/**
 * Gate: nothing a visitor can READ is written into a component.
 *
 * Every word on this site is John's to change. That was true of the headings
 * and the paragraphs from the start, and quietly untrue of the site's own
 * furniture: "Phone", "Where", "Call", "Older post", and the sentence someone
 * reads at an address that is not here were all literals in components. He
 * could rewrite his entire About section and could not rename the row above
 * his own phone number. Those now live in `src/content/labels.json` with an
 * editor entry of their own.
 *
 * This is the gate that keeps it that way, because the next component someone
 * writes will have a label in it and nobody will notice.
 *
 * WHAT IS ALLOWED TO STAY, AND WHY. Assistive-technology labelling — the
 * `aria-label` on a carousel's arrows, on the menu button, on the breadcrumb
 * trail — is not read by anyone looking at the page. Putting it in the CMS
 * would hand John a screen of technical knobs where a wrong edit produces a
 * fault only a screen-reader user ever hits, and he would have no way of
 * seeing that he had done it. So it stays in code, and every instance of it is
 * named in ALLOWED below with a reason. The list is the point: the line
 * between "his words" and "the machine's words" is a judgement, and a
 * judgement that is written down can be argued with.
 *
 * Run strict on every path, including John's publish. It cannot be tripped by
 * anything he types — it only reads our source — so it can never fail him.
 * See scripts/run-gates.ts for that distinction.
 *
 * Self-tested against an injected fault before its clean run is believed:
 *
 *     node scripts/check-copy.ts --self-test
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where a visitor-facing component can live. */
const ROOTS = ['src/lib/components', 'src/routes'];

/** Attributes whose value reaches a reader or a screen reader. */
const READABLE_ATTRS = ['aria-label', 'alt', 'title', 'placeholder', 'aria-description'];

/**
 * Literal strings that may stay in code, each with the reason it may.
 *
 * Keyed by the exact string. A reason is required and is not decoration: it is
 * what a reviewer checks the next addition against.
 */
const ALLOWED: Record<string, string> = {
  // Assistive-technology labelling. Never rendered for a sighted reader, and a
  // wrong edit is a fault John cannot see.
  Breadcrumb: 'names the breadcrumb landmark to a screen reader; never drawn',
  Sections: 'names the nav landmark to a screen reader; never drawn',
  Menu: 'names the burger button; the button itself draws three lines',
  Previous: 'the testimonial carousel’s back arrow, which draws a chevron',
  Next: 'the testimonial carousel’s forward arrow, which draws a chevron',
  'More posts': 'names the older/newer list at the foot of a post',
  'Skip to content': 'the skip link — an assistive affordance, not site copy, and it must work identically on every page and in every state',

  // The editor’s own page. John never reads this as a visitor, and none of it
  // is about his practice.
  'Close this notice': 'names the /admin banner’s dismiss control to a screen reader',
  '&times;': 'the × glyph on that control, which is a shape rather than a word — the label above is what is read out'
};

/** Attribute values that are never prose. */
const IGNORED_ATTR_VALUES = [/^default-src /, /^\d/];

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

/** Comments, <style> and <script> blanked so their prose is not mistaken for
 *  markup. Blanked rather than removed, so line numbers survive. */
function markupOnly(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<style[\s\S]*?<\/style>/g, blank)
    .replace(/<script[\s\S]*?<\/script>/g, blank);
}

function scan(source: string, file: string): Finding[] {
  const found: Finding[] = [];
  markupOnly(source)
    .split('\n')
    .forEach((line, i) => {
      // A text node: between > and <, with no tag and no moustache in it. A
      // moustache means the value came from somewhere, which is the point.
      for (const m of line.matchAll(/>([^<>{}]+)</g)) {
        const text = m[1].trim();
        if (!/[A-Za-z]{2}/.test(text)) continue;
        found.push({ file, line: i + 1, kind: 'text', text });
      }
      for (const attr of READABLE_ATTRS) {
        for (const m of line.matchAll(new RegExp(`\\b${attr}="([^"{]+)"`, 'g'))) {
          const text = m[1].trim();
          if (!/[A-Za-z]{3}/.test(text)) continue;
          if (IGNORED_ATTR_VALUES.some((re) => re.test(text))) continue;
          found.push({ file, line: i + 1, kind: attr, text });
        }
      }
    });
  return found;
}

function components(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.svelte')) out.push(p);
    }
  };
  for (const r of ROOTS) walk(resolve(root, r));
  return out.sort();
}

/**
 * Proves the scanner can SEE a hardcoded string before its silence is
 * believed. A checker that has never been watched to fail is not a checker.
 */
function selfTest(): boolean {
  const cases: { name: string; source: string; expect: boolean }[] = [
    {
      name: 'a literal text node is caught',
      source: '<p class="lead">Call me on a Tuesday</p>',
      expect: true
    },
    {
      name: 'a moustache is not',
      source: '<p class="lead">{labels.header.call}</p>',
      expect: false
    },
    {
      name: 'a literal aria-label is caught',
      source: '<button aria-label="Ring John">x</button>',
      expect: true
    },
    {
      name: 'prose inside a comment is not',
      source: '<!-- Call me on a Tuesday -->\n<p>{x}</p>',
      expect: false
    },
    {
      name: 'prose inside a style block is not',
      source: '<style>\n  /* Call me on a Tuesday */\n  p { color: red; }\n</style>',
      expect: false
    }
  ];

  let ok = true;
  for (const c of cases) {
    const hits = scan(c.source, 'self-test').filter((f) => !(f.text in ALLOWED));
    const got = hits.length > 0;
    if (got !== c.expect) {
      console.error(`check-copy self-test FAILED: ${c.name} — expected ${c.expect}, got ${got}`);
      ok = false;
    }
  }
  if (ok) console.log(`check-copy: self-test passed, ${cases.length} case(s).`);
  return ok;
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

if (!selfTest()) process.exit(1);

const files = components();
const findings = files.flatMap((f) => scan(readFileSync(f, 'utf8'), relative(root, f)));
const unlisted = findings.filter((f) => !(f.text in ALLOWED));

if (unlisted.length) {
  console.error(
    `\ncheck-copy: ${unlisted.length} string(s) a visitor can read are written into a component ` +
      `rather than coming from src/content/:\n`
  );
  for (const f of unlisted) {
    console.error(`  ${f.file}:${f.line}  [${f.kind}]  ${JSON.stringify(f.text)}`);
  }
  console.error(
    `\nMove each into a content file with an editor field, so John can change it. If a string ` +
      `is genuinely NOT his — assistive-technology labelling, a robots directive — add it to ` +
      `ALLOWED in this file WITH THE REASON, and expect that reason to be read.\n`
  );
  process.exit(1);
}

// Anything on the list that no longer appears is a reason nobody is checking.
const stale = Object.keys(ALLOWED).filter((text) => !findings.some((f) => f.text === text));

console.log(
  `check-copy: ${files.length} component(s), every readable string comes from src/content/ ` +
    `except ${Object.keys(ALLOWED).length - stale.length} named exception(s).` +
    (stale.length ? `\n  no longer present, so their entries can go: ${stale.join(', ')}` : '')
);
