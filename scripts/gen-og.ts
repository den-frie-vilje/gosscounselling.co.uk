/**
 * Open Graph image generator — pure TypeScript, no native image tooling.
 *
 * Renders one 1200×630 PNG per card into `static/img/og/<slug>.png` using
 * satori (HTML/CSS → SVG) + @resvg/resvg-js (SVG → PNG). Runs in the
 * `prebuild` hook, so it works the same locally and in the GitHub/Docker
 * CI build (pure JS + native resvg — no ImageMagick).
 *
 * The copy is pulled from the content JSON, so the card updates whenever
 * John edits the `og` block under General → Search engines and sharing and
 * the site is rebuilt. Keep the card list below in sync with the routes
 * (today: one page, one card).
 *
 * THREE FILES, and each is read for one thing: his name from `site.json`,
 * the card's own headline and the search title from `search.json`, and the
 * hero's eyebrow and headline from the home page's top section. They are the
 * files the CMS entries write, so a field this script reads is a field John
 * can see; `scripts/check-contact.ts` forbids a {placeholder} in each of the
 * four, because nothing here resolves one.
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
const search = readJson('src/content/search.json');
const hero = readJson('src/content/home/hero.json');

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
// --color-on-deep-kicker). Kept as literals because satori never sees the
// stylesheet.
const DEEP = '#0a2833';
const TEAL_BRIGHT = '#17a2c4';
// The plate's own mid tone. The page draws it as three soft radial layers;
// at 470px across, flattening to the middle of them is a few levels out and
// satori would not take a gradient inside an image anyway.
const PLATE = { r: 0x90, g: 0xc5, b: 0xd8, alpha: 1 };
const ON_DEEP_KICKER = '#82c9dc';
const WHITE = '#ffffff';

const NBSP = String.fromCharCode(160);
const NAME: string = site.name;
/** The hero's own eyebrow — where he is. One field, read here and rendered on
 *  the page, rather than a second copy of the same sentence in the og block
 *  that John would have to remember to keep in step. */
const WHERE: string = hero.eyebrow ?? '';

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

// The lockup sits at the bottom left, where the disc's curve has pulled away
// from the column, so it has more room than the title above it. How much is
// arithmetic, not a guess: the disc's left boundary at height y is
//
//     x(y) = cx - sqrt(r^2 - (y - cy)^2)
//
// and the tightest point is the TOP of the lockup block, where the circle is
// still widest. Measured there, with the same 40px gutter the column keeps.
const DISC_CX = DISC_X + DISC / 2;
const DISC_CY = DISC_Y + DISC / 2;
const DISC_R = DISC / 2;
const LOCKUP_TOP = 630 - 64 - 96; // the card's bottom padding, then its height
const LOCKUP_W = Math.floor(
  DISC_CX - Math.sqrt(DISC_R ** 2 - (LOCKUP_TOP - DISC_CY) ** 2) - 72 - 40
);

/**
 * The disc, WITH HIM BREAKING OUT OF IT, which is the hero's whole gesture.
 *
 * The card used to hard-clip him to the circle: everything outside it was
 * thrown away, so the card had a photograph in a hole where the page has a man
 * standing in front of a disc. It read as a different treatment of the same
 * picture, which is what the geometry file exists to prevent.
 *
 * The page builds it from two masked layers over one file
 * (src/routes/(site)/+page.svelte, `.layerIn` and `.layerOut`):
 *
 *   INSIDE the circle  — the plate's colour with the cut-out over it.
 *   OUTSIDE it         — the cut-out alone on nothing, faded to transparent
 *                        down the page between `outFadeStart` and
 *                        `outFadeEnd`, so his shoulders leave the frame
 *                        rather than being sliced off by it.
 *
 * satori supports neither CSS masks nor webp, so both layers are composited
 * here by sharp and handed over as ONE png carrying its own alpha — and the
 * image is no longer disc-sized, because the part of him outside the disc is
 * the point. It reports where the circle sits inside that image so `markup`
 * can place it with the CIRCLE where the disc always was and the overhang
 * falling outside it.
 *
 * Returns null rather than throwing: a missing or unreadable portrait should
 * cost us the photo, not the whole prebuild.
 */
interface Disc {
  uri: string;
  width: number;
  height: number;
  /** Where the circle's top-left corner sits inside the image. */
  circleLeft: number;
  circleTop: number;
}

async function discDataUri(): Promise<Disc | null> {
  try {
    const geom = JSON.parse(read('src/lib/generated/portrait-geometry.json').toString()) as {
      plateImgWidth: string;
      headShift: string;
      layerPad: string;
      outFadeStart: string;
      outFadeEnd: string;
    };
    const pct = (v: string) => parseFloat(v) / 100;
    const imgW = Math.round(pct(geom.plateImgWidth) * DISC);
    const shift = Math.round(pct(geom.headShift) * imgW);

    // The KEYED matte, for the same reason the hero uses it inside its disc:
    // the plain knockout's fringe still carries the white cyclorama, and this
    // canvas is the plate, PLATE above, luminance 187. Composited on it the
    // knockout's fringe rises ABOVE the plate — 189.6, 192.8, 196.6, 198.2 as
    // alpha climbs 0.02 to 0.35 — which is a bright rim traced around him.
    // The keyed matte falls monotonically instead: 184.2, 183.4, 181.7,
    // 177.6. See the note on .layerIn in src/routes/(site)/+page.svelte.
    const cutout = await sharp(read('static/img/john-cutout.webp'))
      .resize({ width: imgW, kernel: 'lanczos3' })
      .toBuffer();
    const { height: cutH = DISC } = await sharp(cutout).metadata();

    // The LAYER BOX, in the page's own terms: the cut-out at `plateImgWidth`
    // of the plate, with `layerPad` of headroom above it. A percentage padding
    // in CSS resolves against the containing block's WIDTH, and that block is
    // the plate, so the pad is a fraction of DISC rather than of the image.
    const padTop = Math.round(pct(geom.layerPad) * DISC);
    const boxW = imgW;
    const boxH = padTop + cutH;

    // The circle inside that box. Its bottom is the box's bottom, because the
    // layer is `bottom: 0` on the plate and the disc IS the plate; and it is
    // centred on the box and then moved by `headShift`, which is what puts his
    // head rather than his image in the middle of it.
    const circleLeft = Math.max(0, Math.round((boxW - DISC) / 2 - shift));
    const circleTop = boxH - DISC;
    const cx = circleLeft + DISC / 2;
    const cy = circleTop + DISC / 2;
    const r = DISC / 2;

    const onBox = (input: Buffer, background: sharp.Color) =>
      sharp({ create: { width: boxW, height: boxH, channels: 4, background } })
        .composite([{ input, left: 0, top: padTop }])
        .png()
        .toBuffer();

    // INSIDE: plate and cut-out, kept only within the circle.
    const inside = await sharp(await onBox(cutout, PLATE))
      .composite([
        {
          input: Buffer.from(
            `<svg width="${boxW}" height="${boxH}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/></svg>`
          ),
          blend: 'dest-in'
        }
      ])
      .png()
      .toBuffer();

    // OUTSIDE: the cut-out on nothing, faded down the box, with the circle
    // punched out. The two stops are fractions of the LAYER BOX, which is what
    // the page's `mask-size: 100% 100%` makes them.
    //
    // The punched circle is half a pixel SMALLER than the one filled above, so
    // the two layers OVERLAP along the join. Wider was tried and drew exactly
    // what it should have: a half-pixel ring belonging to neither layer, which
    // let the card's dark ground through as a line across his crown, right
    // where the circle crosses his head. This is `--mask-overlap` on the page
    // and it points the same way there.
    const outMask = Buffer.from(
      `<svg width="${boxW}" height="${boxH}" xmlns="http://www.w3.org/2000/svg">
         <defs>
           <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
             <stop offset="${parseFloat(geom.outFadeStart).toFixed(3)}%" stop-color="#fff"/>
             <stop offset="${parseFloat(geom.outFadeEnd).toFixed(3)}%" stop-color="#000"/>
           </linearGradient>
           <mask id="m">
             <rect width="${boxW}" height="${boxH}" fill="url(#fade)"/>
             <circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="#000"/>
           </mask>
         </defs>
         <rect width="${boxW}" height="${boxH}" fill="#fff" mask="url(#m)"/>
       </svg>`
    );
    const outside = await sharp(await onBox(cutout, { r: 0, g: 0, b: 0, alpha: 0 }))
      .composite([{ input: outMask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // Disjoint by construction — one is the circle, the other its complement —
    // so which goes on top of which does not matter.
    const disc = await sharp(outside)
      .composite([{ input: inside, blend: 'over' }])
      .png()
      .toBuffer();

    return {
      uri: `data:image/png;base64,${disc.toString('base64')}`,
      width: boxW,
      height: boxH,
      circleLeft,
      circleTop
    };
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
// title needed.
//
// The chain matters. `og.title` is a SECOND copy of a headline, written for a
// picture almost nobody proofreads, so a stale one is invisible in a way a
// stale heading never is: nothing on the site shows it back to John. Left
// empty it falls through to the hero's own title, which is the sentence the
// card is standing in for anyway, and the empty string at the end is for a
// stale CMS save that strips the field outright — an empty line beats a
// crashed build.
const CARDS: Card[] = [
  {
    slug: 'home',
    title: search.og?.title?.trim() || hero.title?.trim() || search.title?.trim() || ''
  }
];
function markup(card: Card, disc: Disc | null): string {
  // Absolutely positioned so it can sit against the card's right without
  // dragging the text column around — and placed by its CIRCLE, not by its
  // own corner. The image is bigger than the disc now, because it carries the
  // part of him that stands outside it, so its top-left is offset by exactly
  // where the circle sits within it. Everything downstream — the column width,
  // the lockup's clearance from the curve — is measured off DISC_X and DISC_Y
  // and none of it moves.
  const discImg = disc
    ? `<img src="${disc.uri}" width="${disc.width}" height="${disc.height}" style="position:absolute;left:${DISC_X - disc.circleLeft}px;top:${DISC_Y - disc.circleTop}px;width:${disc.width}px;height:${disc.height}px;" />`
    : '';
  // Two things in the column, pushed apart: the title, and his lockup. A
  // longer title pushes the lockup down rather than overprinting it.
  //
  // The lockup is the header's, scaled up: his name in the display serif, and
  // beneath it in the sans, letterspaced and set in caps, the line that says
  // WHERE. Set on one line and separated by a middot, the name and the label
  // competed for the same reading, and the name — the thing a person is being
  // asked to recognise — was in the same face and size as the job title.
  //
  // What sits under the name is the hero's own eyebrow, the same field, not a
  // copy of it: a card is usually seen next to a link that already says what
  // he does, and where he is is the thing it does not say. It also means the
  // line cannot drift from the page's, because there is only one of it.
  //
  // The ratio is the header's, 19px over 11.5px, so the card reads as the
  // same lockup at a different size rather than as a second design of it.
  const LOCKUP_NAME = 40;
  const LOCKUP_UNDER = Math.round((11.5 / 19) * LOCKUP_NAME * 10) / 10; // 24.2
  return `
  <div style="display:flex;position:relative;width:1200px;height:630px;background:${DEEP};font-family:'Inter';">
    ${discImg}
    <div style="display:flex;flex-direction:column;justify-content:space-between;width:${COLUMN_W}px;height:100%;padding:64px 0 64px 72px;">
      <div style="display:flex;color:${WHITE};font-family:'Fraunces';font-size:68px;font-weight:600;line-height:1.06;">${noOrphans(card.title)}</div>
      <div style="display:flex;flex-direction:column;width:${LOCKUP_W}px;">
        <div style="display:flex;color:${WHITE};font-family:'Fraunces';font-size:${LOCKUP_NAME}px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;">${NAME}</div>
        <div style="display:flex;color:${ON_DEEP_KICKER};font-size:${LOCKUP_UNDER}px;font-weight:600;letter-spacing:0.08em;line-height:1.3;margin-top:8px;">${WHERE.toUpperCase()}</div>
      </div>
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
