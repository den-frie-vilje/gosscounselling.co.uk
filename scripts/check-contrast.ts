/**
 * WCAG contrast check for the palette in `src/app.css`.
 *
 * Reads the `@theme` block, resolves every pairing the design actually
 * uses, and computes the real ratio. Run it after any token change:
 *
 *     pkgx node scripts/check-contrast.ts
 *
 * Exits non-zero if any pairing drops below AA for small text (4.5:1), so a
 * palette edit that quietly breaks a pair fails loudly. This checks TOKEN
 * PAIRS only. Where text sits over a wash, a gradient or a photograph, the
 * token pair is not the page: sample the rendered pixels under the glyph
 * rects instead.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');

/** Pull `--color-<name>: #rrggbb;` out of the @theme block. */
const tokens = new Map<string, string>();
for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
  tokens.set(m[1], m[2]);
}
tokens.set('white', '#ffffff');

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every foreground/background pairing the stylesheet and components use. */
const PAIRS: [string, string, string][] = [
  ['ink', 'paper', 'body text on the page ground'],
  ['ink', 'mist', 'body text on the alternating band'],
  ['ink', 'sand', 'body text on the warm strip'],
  ['muted', 'paper', 'secondary prose on the page ground'],
  ['muted', 'mist', 'secondary prose on the band'],
  ['muted', 'sand', 'secondary prose on the strip'],
  ['teal', 'paper', 'links on the page ground'],
  ['teal', 'mist', 'links on the band'],
  ['teal', 'sand', 'links on the strip'],
  ['gold', 'paper', 'kickers and numerals on the page ground'],
  ['gold', 'mist', 'kickers and numerals on the band'],
  ['gold', 'sand', 'kickers and numerals on the strip'],
  ['white', 'teal', 'label on the primary button'],
  ['white', 'deep', 'headings on the dark bands'],
  ['on-deep', 'deep', 'body text on the dark bands'],
  ['on-deep-muted', 'deep', 'secondary text on the dark bands'],
  ['on-deep-kicker', 'deep', 'kickers on the dark bands'],
  ['teal-bright', 'deep', 'bright accent on the dark bands'],
  ['deep', 'teal-bright', 'label on the bright button']
];

let failures = 0;
let missing = 0;

for (const [fg, bg, what] of PAIRS) {
  const f = tokens.get(fg);
  const b = tokens.get(bg);
  if (!f || !b) {
    // Fail closed: an unresolved token means the check did not run, which
    // must never read as a pass.
    console.error(`MISSING  --color-${!f ? fg : bg} not found in app.css`);
    missing++;
    continue;
  }
  const r = ratio(f, b);
  const verdict = r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : 'FAIL';
  if (r < 4.5) failures++;
  console.log(`${r.toFixed(2).padStart(6)}  ${verdict.padEnd(9)} ${fg} on ${bg} — ${what}`);
}

if (missing || failures) {
  console.error(`\n${failures} pairing(s) below AA, ${missing} unresolved token(s).`);
  process.exit(1);
}
console.log(`\nAll ${PAIRS.length} pairings clear AA for small text.`);
