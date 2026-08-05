/**
 * The hero portrait's geometry, computed from the cutout's own alpha channel.
 *
 *     pkgx node scripts/check-portrait-fit.ts
 *
 * From 880px up, John stands on a circular sand plate. Two numbers place him,
 * and both are properties of the photograph rather than matters of taste:
 *
 *   --plate-img-width   how large he is drawn, as a fraction of the plate
 *   --head-shift        how far to move him so his HEAD, not his image, is
 *                       centred in the circle
 *
 * It also records a NEGATIVE result, which is the more valuable half. His head
 * does not break out of the top of the disc, and that is not a decision anyone
 * took: the solver below sweeps every width from 100% to 160% and finds none
 * where his crown clears the plate AND his shoulders stay inside the circle
 * far enough down to hide a second layer's edge behind it. His shoulders run
 * off the edges of the source frame, so they are at full width the moment he
 * is large enough to clear the top. Every attempt therefore leaves a visible
 * seam, and the disc's own antialiased rim ends up drawn across his face.
 *
 * Run it before changing either number, and read the feasibility line before
 * trying the pop again:
 *
 *     pkgx node scripts/check-portrait-fit.ts
 *
 * It exists because both numbers were first arrived at by looking, which got
 * the crown 18px inside the circle and his head off-centre, and because the
 * impossibility above is not visible in anything but arithmetic.
 *
 * Fail-closed: an unreadable image, an image with no alpha, or a stylesheet
 * whose declarations cannot be found are all failures, not passes.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const CUTOUT = 'static/img/john-cutout.webp';
const CSS = 'src/routes/(site)/+page.svelte';

/** Alpha above this counts as the figure. Matches the matte's own ramp. */
const ALPHA_FLOOR = 40;

interface Row {
  /** Fraction of image height, 0 at the top. */
  y: number;
  left: number;
  right: number;
}

async function silhouette(path: string): Promise<{ w: number; h: number; rows: Row[] }> {
  const image = sharp(path);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error(`${path}: no dimensions`);
  if (!meta.hasAlpha) throw new Error(`${path}: no alpha channel, so there is no silhouette to measure`);

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  const rows: Row[] = [];
  for (let y = 0; y < h; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * channels + channels - 1] > ALPHA_FLOOR) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) rows.push({ y: y / h, left: left / w, right: right / w });
  }
  if (rows.length === 0) throw new Error(`${path}: every pixel is transparent`);
  return { w, h, rows };
}

/** Pull a numeric declaration out of the stylesheet, or fail. */
function declared(css: string, pattern: RegExp, what: string): number {
  const m = css.match(pattern);
  if (!m) {
    console.error(`could not find ${what} in ${CSS}; the rule moved and this check is now blind.`);
    process.exit(1);
  }
  return parseFloat(m[1]);
}

const css = readFileSync(CSS, 'utf8');
const { w, h, rows } = await silhouette(CUTOUT);

// ---- what the stylesheet currently says --------------------------------
// Read the NAMED tokens, not the rules that consume them. An earlier version
// of this pattern-matched `.heroFig img { width: … }` and silently picked up
// the base rule's 118% instead of the 136% inside the media query, then
// reported that no part of him rose above the plate. A check that reads the
// wrong declaration is worse than no check.
const imgWidthPct = declared(css, /--plate-img-width: ([\d.]+)%/, '--plate-img-width');
const headShiftPct = declared(css, /--head-shift: (-?[\d.]+)%/, '--head-shift');
// --pop and --pop-depth are deliberately gone; see the header.

// ---- geometry, in units of the plate's width ---------------------------
// The plate is square, so 1 plate width = 1 plate height.
const imgW = imgWidthPct / 100; // image width, in plate widths
const imgH = imgW * (h / w); // image height, same units
// The image's bottom sits on the plate's bottom, so its top is above the
// plate's top by however much taller than the plate it is.
const crownAbovePlateTop = imgH - 1;

// The image is centred on the plate and then shifted; the shift is a
// percentage of the IMAGE's own width, which is how `translate` resolves it.
const shift = (headShiftPct / 100) * imgW;
const imgLeft = 0.5 - imgW / 2 + shift; // in plate widths, 0 at the plate's left

/** A row's horizontal extent, expressed in plate widths. */
const inPlate = (r: Row) => ({
  left: imgLeft + r.left * imgW,
  right: imgLeft + r.right * imgW,
  /** Distance below the plate's top, in plate heights. */
  depth: r.y * imgH - crownAbovePlateTop
});

// ---- 1. is his head centred in the circle? -----------------------------
// Measure the head across the band that is actually visible above the plate,
// which is the only part the eye judges the centring on.
const above = rows.filter((r) => inPlate(r).depth < 0);
if (above.length === 0) {
  console.error('FAIL  no part of the figure rises above the plate: there is nothing to break out.');
  process.exit(1);
}
const headLeft = Math.min(...above.map((r) => inPlate(r).left));
const headRight = Math.max(...above.map((r) => inPlate(r).right));
const headCentre = (headLeft + headRight) / 2;
const centringError = headCentre - 0.5;

// ---- 2. how far may the layer reach down? ------------------------------
// Below the plate's top, the disc covers the circle but NOT the corners. A row
// is safe while its whole silhouette is inside the circle; the first row that
// pokes out is where the layer has to have stopped.
const R = 0.5;
function insideCircle(x: number, depth: number): boolean {
  const dx = x - 0.5;
  const dy = depth - R; // the circle's centre is one radius below its top
  return dx * dx + dy * dy <= R * R + 1e-9;
}
let firstEscape = Infinity;
for (const r of rows) {
  const p = inPlate(r);
  if (p.depth <= 0) continue;
  if (!insideCircle(p.left, p.depth) || !insideCircle(p.right, p.depth)) {
    firstEscape = p.depth;
    break;
  }
}

// ---- 3. solve for the size, rather than guessing one -------------------
// The two requirements pull against each other. Drawn larger, his crown
// clears the plate by more; drawn larger, his SHOULDERS also reach the plate's
// top sooner, and once they reach it there is no depth left for the head layer
// to overlap into and no way to hide its edge behind the disc. Sweep the
// width and report the range where both hold, so the token is chosen by the
// photograph rather than by eye.
const WANT_CLEAR = 0.05; // crown must clear the plate by at least this
const WANT_OVERLAP = 0.06; // shoulders must stay in the circle at least this far down

function evaluate(widthFrac: number) {
  const iH = widthFrac * (h / w);
  const clear = iH - 1;
  const sh = (headShiftPct / 100) * widthFrac;
  const left0 = 0.5 - widthFrac / 2 + sh;
  let escape = Infinity;
  for (const r of rows) {
    const depth = r.y * iH - clear;
    if (depth <= 0) continue;
    const l = left0 + r.left * widthFrac;
    const rt = left0 + r.right * widthFrac;
    if (!insideCircle(l, depth) || !insideCircle(rt, depth)) {
      escape = depth;
      break;
    }
  }
  return { clear, escape };
}

let best: { width: number; clear: number; escape: number } | null = null;
const feasible: number[] = [];
for (let width = 1.0; width <= 1.6; width += 0.005) {
  const { clear, escape } = evaluate(width);
  if (clear >= WANT_CLEAR && escape !== Infinity && escape >= WANT_OVERLAP) {
    feasible.push(width);
    if (!best || clear > best.clear) best = { width, clear, escape };
  }
}

// ---- report ------------------------------------------------------------
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
console.log(`cutout            ${w}x${h}, aspect ${(h / w).toFixed(4)}`);
console.log(`drawn at          ${imgWidthPct}% of the plate → ${pct(imgH)} of its height`);
console.log(`crown clears      ${pct(crownAbovePlateTop)} of the plate above its top edge`);
console.log(`head centre       ${pct(headCentre)} of the plate (error ${pct(centringError)})`);
console.log(
  `shoulders escape  ${firstEscape === Infinity ? 'never' : pct(firstEscape)} below the plate's top`
);
if (feasible.length) {
  const lo = Math.min(...feasible);
  const hi = Math.max(...feasible);
  console.log(
    `\nfeasible widths   ${(lo * 100).toFixed(1)}% to ${(hi * 100).toFixed(1)}% ` +
      `(crown clears >= ${pct(WANT_CLEAR)}, shoulders stay in >= ${pct(WANT_OVERLAP)})`
  );
  if (best) {
    console.log(
      `largest clearance ${(best.width * 100).toFixed(1)}% → crown ${pct(best.clear)}, overlap ${pct(best.escape)}`
    );
  }
} else {
  console.log(
    `\nfeasible widths   NONE between 100% and 160%. At every size, either the crown does not` +
      `\n                  clear the plate or his shoulders reach its top edge. The head cannot` +
      `\n                  break out of a circle this size without the layer's edge showing.`
  );
}

let failures = 0;

if (crownAbovePlateTop <= 0.005) {
  console.error(
    `\nFAIL  the crown clears the plate by ${pct(crownAbovePlateTop)}: too little to read as breaking out. Draw him larger.`
  );
  failures++;
}
if (Math.abs(centringError) > 0.01) {
  const wanted = headShiftPct - (centringError / imgW) * 100;
  console.error(
    `\nFAIL  his head sits ${pct(centringError)} off the circle's centre. Set --head-shift to ${wanted.toFixed(2)}%.`
  );
  failures++;
}
// The crown clearing the plate is what keeps the image's own top edge OUTSIDE
// the disc. If it did not clear, that straight edge would fall inside the
// circle and read as a line cut across his head.
if (crownAbovePlateTop < 0.02) {
  console.error(
    `\nFAIL  the crown clears by only ${pct(crownAbovePlateTop)}, so the image's top edge falls inside the disc and draws a line across his head.`
  );
  failures++;
}

if (failures) process.exit(1);
console.log(
  `\nThe portrait fits: his crown clears the plate by ${pct(crownAbovePlateTop)}, so the image's own top edge falls outside the disc, and his head is centred in the circle to ${pct(Math.abs(centringError))}.`
);
