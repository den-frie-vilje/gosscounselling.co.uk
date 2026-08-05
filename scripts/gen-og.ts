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
// The plate's own mid tone. The page draws it as three soft radial layers;
// at 470px across, flattening to the middle of them is a few levels out and
// satori would not take a gradient inside an image anyway.
const PLATE = { r: 0x90, g: 0xc5, b: 0xd8, alpha: 1 };
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

// Card geometry.
//
// The card carries the page's own composition: John on the circular disc,
// and as little text as possible. At the size a card is actually shown, a
// few hundred pixels wide in a chat preview or a search result, an eyebrow
// at 22px and a subtitle at 26px are below the threshold of legibility, so
// they were decoration that cost the title its room. The title and his name
// are what survive being scaled down, so they are all that is left.
const DISC = 470; // the disc's diameter on the card
const DISC_X = 1200 - DISC - 72; // its left edge, with a right margin
const DISC_Y = Math.round((630 - DISC) / 2);
const COLUMN_W = DISC_X - 72 - 40;

/**
 * The disc: the plate's own gradient with the cutout composited onto it, and
 * a circular alpha, rendered by sharp and handed to satori as ONE image.
 *
 * Two reasons it is built here rather than in the card's markup. satori has
 * no support for CSS masks, so the hero's two-layer construction cannot be
 * expressed in it at all. And satori has no webp decoder, while the cutouts
 * are webp, so sharp has to be in the path regardless.
 *
 * The cutout is drawn at the same fraction of the disc as on the page, and
 * bottom-anchored the same way, so the card reads as the site rather than as
 * a different treatment of the same photograph.
 *
 * Returns null rather than throwing: a missing or unreadable portrait should
 * cost us the photo, not the whole prebuild.
 */
async function discDataUri(): Promise<string | null> {
  try {
    const geom = JSON.parse(read('src/lib/generated/portrait-geometry.json').toString()) as {
      plateImgWidth: string;
      headShift: string;
    };
    const imgW = Math.round((parseFloat(geom.plateImgWidth) / 100) * DISC);
    const shift = Math.round((parseFloat(geom.headShift) / 100) * imgW);

    const cutout = await sharp(read('static/img/john-cutout.webp'))
      .resize({ width: imgW, kernel: 'lanczos3' })
      .toBuffer();
    const { height: cutH = DISC } = await sharp(cutout).metadata();

    // Build on a canvas the size of the CUTOUT and extract the disc's window
    // from it, rather than compositing onto a disc-sized canvas: he is drawn
    // wider than the plate, and sharp refuses to composite an image larger
    // than what it is going onto.
    //
    // The window is placed exactly as the page places it. He is centred on
    // the plate and then shifted so his HEAD rather than his image is in the
    // middle, so the disc sits that much the other way within him; and his
    // feet are on the plate's bottom, so the window's bottom is the cutout's.
    const windowLeft = Math.max(0, Math.round((imgW - DISC) / 2 - shift));
    const windowTop = Math.max(0, cutH - DISC);

    const plate = await sharp({
      create: { width: imgW, height: cutH, channels: 4, background: PLATE }
    })
      .composite([{ input: cutout, left: 0, top: 0 }])
      .png()
      .toBuffer();

    // Circular alpha, drawn as an SVG and applied with `dest-in`.
    const circle = Buffer.from(
      `<svg width="${DISC}" height="${DISC}"><circle cx="${DISC / 2}" cy="${DISC / 2}" r="${DISC / 2}" fill="#fff"/></svg>`
    );
    const disc = await sharp(plate)
      .extract({
        left: Math.min(windowLeft, Math.max(0, imgW - DISC)),
        top: Math.min(windowTop, Math.max(0, cutH - DISC)),
        width: Math.min(DISC, imgW),
        height: Math.min(DISC, cutH)
      })
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // PNG here, not JPEG, because the alpha outside the circle is the point.
    // It is one 470px image, so the pure-JS decode is affordable where the
    // full-size master was not.
    return `data:image/png;base64,${disc.toString('base64')}`;
  } catch (e) {
    console.warn(
      `og: disc unusable (${(e as Error).message.split('\n')[0]}); rendering without it`
    );
    return null;
  }
}

interface Card {
  slug: string;
  title: string;
}

// Card copy. Only the title now: at the size a card is actually shown, the
// eyebrow, subtitle and CTA pill were text nobody could read taking room the
// title needed. `?? ''` because a stale CMS save can strip a field, and an
// empty line beats a crashed build.
const CARDS: Card[] = [
  {
    slug: 'home',
    title: home.og?.title ?? home.seo?.title ?? ''
  }
];

function markup(card: Card, disc: string | null): string {
  // The disc is absolutely positioned so it can sit against the card's right
  // without dragging the text column around.
  const discImg = disc
    ? `<img src="${disc}" width="${DISC}" height="${DISC}" style="position:absolute;left:${DISC_X}px;top:${DISC_Y}px;width:${DISC}px;height:${DISC}px;" />`
    : '';
  // Two things in the column, pushed apart: the title, and his name. A
  // longer title pushes the name down rather than overprinting it.
  return `
  <div style="display:flex;position:relative;width:1200px;height:630px;background:${DEEP};font-family:'Inter';">
    ${discImg}
    <div style="display:flex;flex-direction:column;justify-content:space-between;width:${COLUMN_W}px;height:100%;padding:64px 0 64px 72px;">
      <div style="display:flex;color:${WHITE};font-family:'Fraunces';font-size:68px;font-weight:600;line-height:1.06;">${noOrphans(card.title)}</div>
      <div style="display:flex;color:${ON_DEEP_MUTED};font-size:26px;font-weight:600;">${NAME} · ${TAGLINE}</div>
    </div>
  </div>`;
}

async function renderCard(card: Card, disc: string | null): Promise<void> {
  const svg = await satori(html(markup(card, disc)) as Parameters<typeof satori>[0], {
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
const disc = await discDataUri();
for (const card of CARDS) {
  await renderCard(card, disc);
}
