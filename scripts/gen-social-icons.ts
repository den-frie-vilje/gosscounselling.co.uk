/**
 * The social glyphs, written out from Simple Icons.
 *
 * Path data is not something to type by hand. Two glyphs were transcribed into
 * `SocialIcon.svelte` when there were two, and every one added that way is a
 * chance to drop a decimal in a brand mark and never notice. This reads them
 * from the `simple-icons` package — CC0, a devDependency, pinned by the
 * lockfile — and writes `src/lib/generated/social-icons.ts`.
 *
 * The OUTPUT is committed, so nothing at build time or at runtime depends on
 * the package: it is a generator run when the list changes, like the portrait
 * geometry, not a step in the build.
 *
 *     node scripts/gen-social-icons.ts
 *
 * TWO SOURCES, IN ORDER, AND STILL NOTHING TYPED BY HAND.
 *
 * Simple Icons first. Where it carries no mark, Bootstrap Icons (MIT, also a
 * devDependency, also pinned) is read second, straight off its SVG file. This
 * exists because of LinkedIn: Simple Icons removed that mark at LinkedIn's own
 * request over trademark, so a set built for redistribution does not ship it,
 * while a set that never took the request still does.
 *
 * Drawing it here instead was the alternative and is worse on both counts. It
 * would be a hand-transcribed trademark — the exact thing the paragraph above
 * says not to do — and it would be one special case rather than a rule. This
 * is a rule: any platform Simple Icons drops gets looked up in the second set,
 * and only a platform NEITHER carries falls through to the name.
 *
 * On the trademark itself: a permissive licence on an icon package grants no
 * trademark rights and does not claim to. What is happening here is nominative
 * use — his own mark, on his own link, pointing at his own profile — which is
 * what the mark is for. Simple Icons' problem was redistributing a library of
 * other people's marks, which is not what this footer does.
 *
 * The glyphs are drawn on different grids: Simple Icons on 24, Bootstrap on
 * 16. The viewBox travels with each path rather than being assumed, so a mark
 * from either set fills the same optical square.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as icons from 'simple-icons';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'src/lib/generated/social-icons.ts');
const BOOTSTRAP = resolve(root, 'node_modules/bootstrap-icons/icons');

/**
 * How much of its own box a mark actually inks, 0..1, measured by rendering it.
 *
 * Brand marks are not drawn to a common weight and cannot be: Facebook's is a
 * filled disc with an f cut out of it, Instagram's is a hairline camera, and
 * LinkedIn's is a filled ROUNDED SQUARE — the same design as Facebook's, only
 * square, and a square holds 4/π times the area of the circle inside it. Set
 * at the same 20px they do not read as one row; the square reads as a black
 * chip between two lighter marks. Measured: 58.2%, 42.0%, 75.7%, and
 * 58.2 × 4/π = 73.9, so that ratio is the whole of the difference.
 */
async function inkFraction(path: string, viewBox: string): Promise<number> {
  const N = 128;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${N}" height="${N}"><path d="${path}" fill="#000"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 3; i < data.length; i += 4) ink += data[i] / 255;
  return ink / (N * N);
}

/**
 * The optical scale a mark is drawn at, from what it inks.
 *
 * REFERENCE is a filled circular mark, the commonest shape in this set, and a
 * mark heavier than that is scaled until its ink matches — area goes as the
 * square of scale, hence the square root.
 *
 * The clamp is the interesting half. It only ever scales marks DOWN. Equalising
 * ink in both directions would inflate Instagram's hairline camera by 18% and
 * leave it the largest thing in the row, which is the wrong reading: an outline
 * mark is light by design and looks correct at its drawn size. What breaks a
 * row's rhythm is something too heavy, not something slightly light.
 */
const REFERENCE_INK = 0.582;
const MIN_SCALE = 0.85;

function opticalScale(ink: number): number {
  const raw = Math.sqrt(REFERENCE_INK / ink);
  return +Math.min(1, Math.max(MIN_SCALE, raw)).toFixed(3);
}

/**
 * A Bootstrap Icons glyph, or null if that set has not got one either.
 *
 * Its files are plain single-glyph SVGs, so this reads the viewBox and every
 * `d` in document order. Multiple subpaths concatenate into one `d`, which is
 * what a single `<path>` renders anyway — but only under one fill rule, so a
 * file that mixes them is refused rather than drawn wrongly.
 */
function fromBootstrap(id: string): { path: string; viewBox: string } | null {
  let svg: string;
  try {
    svg = readFileSync(resolve(BOOTSTRAP, `${id}.svg`), 'utf8');
  } catch {
    return null;
  }

  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const ds = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if (!viewBox || !ds.length) return null;

  const rules = new Set([...svg.matchAll(/fill-rule="([^"]+)"/g)].map((m) => m[1]));
  if (rules.size > 1) {
    throw new Error(
      `gen-social-icons: ${id}.svg mixes fill rules (${[...rules].join(', ')}), so its ` +
        `subpaths cannot be merged into one path without changing what it draws.`
    );
  }

  return { path: ds.join(' '), viewBox };
}

/**
 * What John can choose from, in the order the editor offers it.
 *
 * Chosen for a counsellor in the UK rather than for completeness: the ones he
 * might plausibly hold an account on, and no more, because a dropdown of forty
 * platforms is its own kind of question. WhatsApp is not here on purpose — it
 * is a way of reaching him and lives under Contact details, not a profile to
 * follow.
 */
const PLATFORMS = [
  { id: 'facebook', title: 'Facebook' },
  { id: 'instagram', title: 'Instagram' },
  { id: 'linkedin', title: 'LinkedIn' },
  { id: 'x', title: 'X' },
  { id: 'threads', title: 'Threads' },
  { id: 'bluesky', title: 'Bluesky' },
  { id: 'youtube', title: 'YouTube' },
  { id: 'tiktok', title: 'TikTok' },
  { id: 'substack', title: 'Substack' },
  { id: 'spotify', title: 'Spotify' },
  { id: 'mastodon', title: 'Mastodon' },
  { id: 'pinterest', title: 'Pinterest' }
];

const all = icons as unknown as Record<string, { title: string; path: string; slug?: string }>;
const rows: string[] = [];
const missing: string[] = [];
const borrowed: string[] = [];
const weights: string[] = [];

for (const p of PLATFORMS) {
  const key = `si${p.id[0].toUpperCase()}${p.id.slice(1)}`;
  const icon = all[key];

  const glyph = icon?.path
    ? { path: icon.path, viewBox: '0 0 24 24', source: 'simple-icons' }
    : (() => {
        const fallback = fromBootstrap(p.id);
        if (!fallback) return null;
        borrowed.push(p.id);
        return { ...fallback, source: 'bootstrap-icons' };
      })();

  if (!glyph) {
    missing.push(p.id);
    rows.push(
      `  { id: '${p.id}', title: ${JSON.stringify(p.title)}, path: null, viewBox: null, source: null, scale: 1 },`
    );
    continue;
  }

  const ink = await inkFraction(glyph.path, glyph.viewBox);
  const scale = opticalScale(ink);
  weights.push(`${p.id} ${(ink * 100).toFixed(1)}% → ×${scale}`);

  rows.push(
    `  { id: '${p.id}', title: ${JSON.stringify(p.title)}, path: ${JSON.stringify(glyph.path)}, ` +
      `viewBox: ${JSON.stringify(glyph.viewBox)}, source: ${JSON.stringify(glyph.source)}, scale: ${scale} },`
  );
}

const file = `/**
 * Generated by scripts/gen-social-icons.ts. Do not edit.
 *
 * Glyph paths from Simple Icons (CC0) where it has one, and from Bootstrap
 * Icons (MIT) where it has not — read from the packages rather than
 * transcribed, and each carrying the viewBox of the grid it was drawn on.
 * \`source\` says which set a mark came from. \`path: null\` means neither set
 * carries that platform; SocialIcon.svelte draws the title instead, so the
 * link still works and is still visible.
 *
 * One list, three consumers: the icons, the editor's dropdown (checked by
 * scripts/check-cms.ts against static/admin/config.yml) and the default name
 * for a profile John has not named himself.
 */
export interface SocialPlatform {
  id: string;
  title: string;
  path: string | null;
  viewBox: string | null;
  source: string | null;
  /** Optical scale, measured from how much of its box the mark inks. */
  scale: number;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
${rows.join('\n')}
];

/** By id, for the renderer. */
export const SOCIAL_BY_ID: Record<string, SocialPlatform> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p])
);
`;

writeFileSync(OUT, file);
console.log(
  `gen-social-icons: wrote ${PLATFORMS.length} platform(s) → src/lib/generated/social-icons.ts` +
    (borrowed.length ? `\n  no mark in Simple Icons, taken from Bootstrap Icons: ${borrowed.join(', ')}.` : '') +
    `\n  ink measured, and the optical scale it sets:\n    ${weights.join('\n    ')}` +
    (missing.length ? `\n  no mark in EITHER set for: ${missing.join(', ')} — the name is drawn instead.` : '')
);
