/**
 * Open Graph image generator — pure TypeScript, no native image tooling.
 *
 * Renders one 1200×630 PNG per card into `static/img/og/<slug>.png` using
 * satori (HTML/CSS → SVG) + @resvg/resvg-js (SVG → PNG). Runs in the
 * `prebuild` hook, so it works the same locally and in the GitHub/Docker
 * CI build (pure JS + native resvg — no ImageMagick).
 *
 * The copy is pulled from the content JSON, so the card updates whenever
 * John edits the `og` block in the CMS and the site is rebuilt. Keep the
 * card list below in sync with the routes (today: one page, one card).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(root, p));
const readJson = (p: string) => JSON.parse(read(p).toString('utf8'));

const site = readJson('src/content/site.json');
const home = readJson('src/content/home.json');

// FONTS — satori can only parse `.woff`/`.ttf`/`.otf`; it CANNOT read woff2.
// The `@fontsource-variable/*` packages the site itself loads ship woff2
// ONLY, so they are useless here. These paths deliberately point at the
// STATIC `@fontsource/*` packages, which still ship real `.woff` files.
// Do not "tidy" these back to the variable packages — satori will throw
// `Unsupported OpenType signature wOF2` and the prebuild will fail.
const FONTS = [
  { name: 'Fraunces', weight: 600 as const, file: '@fontsource/fraunces/files/fraunces-latin-600-normal.woff' },
  { name: 'Inter', weight: 400 as const, file: '@fontsource/inter/files/inter-latin-400-normal.woff' },
  { name: 'Inter', weight: 600 as const, file: '@fontsource/inter/files/inter-latin-600-normal.woff' }
].map((f) => ({
  name: f.name,
  weight: f.weight,
  style: 'normal' as const,
  data: read(`node_modules/${f.file}`)
}));

// Site tokens, mirrored from `src/app.css` (--color-deep, --color-teal-bright,
// --color-on-deep-muted, --color-on-deep-kicker). Kept as literals because
// satori never sees the stylesheet.
const DEEP = '#0a2833';
const TEAL_BRIGHT = '#17a2c4';
const ON_DEEP_MUTED = '#c2d7dd';
const ON_DEEP_KICKER = '#82c9dc';
const WHITE = '#ffffff';

const NBSP = String.fromCharCode(160);
const NAME: string = site.name;
const TAGLINE: string = site.tagline;

/** Bind the last two words with a non-breaking space so a wrapped line
 *  never leaves a single-word orphan. */
function noOrphans(text: string): string {
  const words = text.trim().split(' ');
  if (words.length < 2) return text;
  const last = words.pop();
  return `${words.join(' ')}${NBSP}${last}`;
}

// Card geometry. The text column gets the lion's share of the 1200px:
// Fraunces at 62px is wide, and a narrower column pushes the title onto a
// fourth and fifth line, which the 630px height cannot absorb.
const COLUMN_W = 820;
const PORTRAIT_W = 1200 - COLUMN_W; // 380
const PORTRAIT_H = Math.round((PORTRAIT_W * 1452) / 1800); // the cutout's own aspect

/**
 * The portrait as a base64 data URI, transcoded in memory first.
 *
 * satori has NO webp decoder and the cutouts in `static/img/` are webp, so
 * sharp has to transcode before we inline it (no file is written). A data
 * URI also means satori needs no network or filesystem fetch.
 *
 * Two deliberate choices in that transcode:
 *  - Downscale to the rendered width first. Handing satori the full
 *    1800px master just makes it decode ~9× the pixels for the same card.
 *  - Emit JPEG, not PNG. satori decodes PNG in pure JS and takes ~10 s for
 *    this one image, against ~30 ms for JPEG. The cutout's alpha only ever
 *    sits on the solid card ground, so flattening onto DEEP first is
 *    visually identical — and saves ten seconds on every single build.
 *
 * Returns null rather than throwing: a missing or unreadable portrait
 * should cost us the photo, not the whole prebuild.
 */
async function portraitDataUri(publicPath: string): Promise<string | null> {
  try {
    const rel = publicPath.replace(/^\//, 'static/');
    const jpeg = await sharp(read(rel))
      .resize({ width: PORTRAIT_W, kernel: 'lanczos3' })
      .flatten({ background: DEEP })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch (e) {
    console.warn(`og: portrait ${publicPath} unusable (${(e as Error).message.split('\n')[0]}); rendering without it`);
    return null;
  }
}

interface Card {
  slug: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
}

// Card copy comes from each page's `og` block in the content JSON
// (CMS-editable). The name + tagline lockup is added by the layout below,
// from site.json. `?? ''` throughout: a stale CMS save can strip a field,
// and an empty line on the card beats a crashed build.
const CARDS: Card[] = [
  {
    slug: 'home',
    eyebrow: home.og?.eyebrow ?? '',
    title: home.og?.title ?? home.seo?.title ?? '',
    subtitle: home.og?.subtitle ?? '',
    cta: home.og?.cta ?? ''
  }
];

const PORTRAIT = '/img/john-cutout-dark.webp';

function markup(card: Card, portrait: string | null): string {
  // The portrait is bottom-right anchored and absolutely positioned so it
  // can sit against the card edge without dragging the text column around.
  const portraitImg = portrait
    ? `<img src="${portrait}" width="${PORTRAIT_W}" height="${PORTRAIT_H}" style="position:absolute;right:0;bottom:0;width:${PORTRAIT_W}px;height:${PORTRAIT_H}px;" />`
    : '';
  // The column is three space-between groups (copy / CTA / lockup) rather
  // than a centred stack with an absolutely-placed lockup: that way a
  // longer title pushes its neighbours instead of overprinting them.
  return `
  <div style="display:flex;position:relative;width:1200px;height:630px;background:${DEEP};font-family:'Inter';">
    ${portraitImg}
    <div style="display:flex;flex-direction:column;justify-content:space-between;width:${COLUMN_W}px;height:100%;padding:52px 60px;">
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;color:${ON_DEEP_KICKER};font-size:22px;font-weight:600;letter-spacing:3.5px;text-transform:uppercase;">${card.eyebrow}</div>
        <div style="display:flex;color:${WHITE};font-family:'Fraunces';font-size:62px;font-weight:600;line-height:1.08;margin-top:20px;">${noOrphans(card.title)}</div>
        <div style="display:flex;color:${ON_DEEP_MUTED};font-size:26px;font-weight:400;line-height:1.35;margin-top:22px;">${noOrphans(card.subtitle)}</div>
      </div>
      <div style="display:flex;">
        <div style="display:flex;align-items:center;background:${TEAL_BRIGHT};color:${DEEP};font-size:24px;font-weight:600;padding:14px 28px;border-radius:6px;">${noOrphans(card.cta)}</div>
      </div>
      <div style="display:flex;color:${ON_DEEP_MUTED};font-size:22px;font-weight:600;">${NAME} · ${TAGLINE}</div>
    </div>
  </div>`;
}

async function renderCard(card: Card, portrait: string | null): Promise<void> {
  const svg = await satori(html(markup(card, portrait)) as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: FONTS
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const out = resolve(root, `static/img/og/${card.slug}.png`);
  writeFileSync(out, png);
  console.log(`og: wrote static/img/og/${card.slug}.png (${(png.length / 1024).toFixed(1)} KB)`);
}

mkdirSync(resolve(root, 'static/img/og'), { recursive: true });
const portrait = await portraitDataUri(PORTRAIT);
for (const card of CARDS) {
  await renderCard(card, portrait);
}
