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
 * It also emits the mask geometry the two layers need. His head breaks out of
 * the top of the disc, and the reason that works is the construction rather
 * than the numbers: the circle is a MASK on two identical layers, one keeping
 * what falls inside it and one what falls outside, so neither layer has a
 * rectangle edge anywhere near the figure.
 *
 * That matters because his shoulders run off the edges of the source frame.
 * `last outside` below reports that he is outside the circle essentially all
 * the way down, so any construction that put a BOX behind the disc had an edge
 * the disc could not cover: that is what cut his shoulders on the tangent and
 * what put the disc's antialiased rim across his forehead. Masks have no such
 * edge, and because the two masks are complementary across the same ramp their
 * alphas sum to 1 along the circle, so there is no join and no double-painted
 * pixel for a fade to stack on.
 *
 *     pkgx node scripts/check-portrait-fit.ts
 *
 * It exists because these numbers were first arrived at by looking, which got
 * the crown 18px inside the circle and his head off-centre.
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

let alpha: Uint8Array = new Uint8Array(0);

async function silhouette(path: string): Promise<{ w: number; h: number; rows: Row[] }> {
  const image = sharp(path);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error(`${path}: no dimensions`);
  if (!meta.hasAlpha) throw new Error(`${path}: no alpha channel, so there is no silhouette to measure`);

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * channels + channels - 1];

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

// ---- 3. where does the figure return INSIDE the circle for good? -------
// The outer layer is masked to the circle's complement, so it paints only
// where the figure is outside the disc: his head above the arc, and the
// slivers of shoulder near the top corners. Below the last depth at which any
// part of him is outside the circle, that layer paints nothing at all — so a
// hard horizontal cutoff placed below it is invisible, and it is what stops
// his shoulders spilling out of the frame further down.
let lastEscape = -Infinity;
for (const r of rows) {
  const p = inPlate(r);
  if (p.depth <= 0) continue;
  if (!insideCircle(p.left, p.depth) || !insideCircle(p.right, p.depth)) {
    lastEscape = p.depth;
  }
}

// The pop is specified as how far the crown clears the plate; the width that
// produces it follows from the cutout's aspect. Stated this way round because
// the clearance is the thing anyone has an opinion about.
// The push-in scales the layers about their shared bottom centre and the
// plate does not scale with them, so the clearance the eye finally sees is
// larger than the one the geometry starts at. `--crown-clear` names the
// RESTING, visible clearance, because that is the one anyone has an opinion
// about, and the width is solved back from it.
const pushScale = declared(css, /--push-in-scale: ([\d.]+)/, '--push-in-scale');
const wantedClear = declared(css, /--crown-clear: ([\d.]+)%/, '--crown-clear') / 100;

// ---- 3b. the soft bottom edge -----------------------------------------
// The cutout's last rows never reach full opacity: he was cut off by the
// bottom of the source frame, so the matte ramps out instead of ending. On a
// dark band that is invisible, but inside the sand plate the ground shows
// through them as a rim under his shirt. The fix is to drop the image by that
// much so the soft rows fall outside the circle's mask, and the drop has to
// be measured rather than guessed.
let softRows = 0;
for (let y = h - 1; y >= 0; y--) {
  let anyOpaque = false;
  for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] >= 250) {
      anyOpaque = true;
      break;
    }
  }
  if (anyOpaque) break;
  softRows++;
}
// One row of margin, expressed against the image's own height, which is what
// a percentage in `translateY` resolves against.
const matteDrop = (softRows + 1) / h;

// The matte drop pushes him down, so it comes straight off the clearance.
// Solving for the width has to account for it, or `--crown-clear` names a
// number the page does not actually show.
// The push-in scales about the image's CENTRE, so only half the overshoot
// goes upward; the other half goes below the plate's bottom, where the circle
// has already ended and nothing is painted.
const halfScale = (pushScale + 1) / 2;
const restingClear = halfScale * imgH - 1 - matteDrop * imgH;
const widthForWantedClear = ((1 + wantedClear) / (halfScale - matteDrop) / (h / w)) * 100;

// ---- 4. the mask geometry, in the layers' own coordinates --------------
// Both layers are the IMAGE's box, so neither has a rectangle edge anywhere
// near the figure. The circle therefore has to be expressed as a mask tile
// placed inside that larger box, and these are the numbers that place it.
//
// The layer's box is NOT the image's box. The push-in is a transform, and a
// transform does not change layout, so the scaled image reaches above its own
// box by the overshoot; the mask is sized to the box, so without room for it
// the crown falls outside the mask and is cut clean off. The layer therefore
// carries top padding of exactly that overshoot.
//
// Expressed against the PLATE, because a percentage padding resolves against
// the containing block's inline size and the layer's containing block is the
// plate, not the layer itself. Getting that reference wrong left the padding
// 4.41px short and the crown still clipped by exactly that much.
// Half, because the scale is about the centre: only half of the growth
// reaches above the box.
const overshoot = ((pushScale - 1) / 2) * imgH; // in plate units
const layerPad = overshoot; // plate units == a fraction of the containing block
const boxH = imgH + overshoot; // = pushScale * imgH

// The tile is the plate: square in pixels, so its size is a different
// percentage of the box's width than of its height.
const tileW = 1 / imgW; // plate diameter as a fraction of the box's width
const tileH = 1 / boxH; // and of its height
// `mask-position` percentages align p% of the free space, not a raw offset.
const freeX = imgW - 1;
const freeY = boxH - 1;
const posX = freeX > 0 ? -imgLeft / freeX : 0;
const posY = freeY > 0 ? (overshoot + crownAbovePlateTop) / freeY : 0;

// ---- report ------------------------------------------------------------
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
console.log(`cutout            ${w}x${h}, aspect ${(h / w).toFixed(4)}`);
console.log(`drawn at          ${imgWidthPct}% of the plate → ${pct(imgH)} of its height`);
console.log(`crown clears      ${pct(crownAbovePlateTop)} before the push-in, ${pct(restingClear)} after it`);
console.log(`head centre       ${pct(headCentre)} of the plate (error ${pct(centringError)})`);
console.log(
  `first outside     ${firstEscape === Infinity ? 'never' : pct(firstEscape)} below the plate's top`
);
console.log(
  `last outside      ${lastEscape === -Infinity ? 'never' : pct(lastEscape)} below the plate's top`
);
console.log(
  `→ he is outside the circle down to ${pct(lastEscape)}, so the outer layer needs a fade`
);
console.log('');
console.log('mask geometry for the two complementary layers, in the image box:');
console.log(`  --mask-size:     ${pct(tileW)} ${pct(tileH)}`);
console.log(`  --mask-position: ${pct(posX)} ${pct(posY)}`);
console.log(`  --layer-pad:     ${pct(layerPad)}  (room for the push-in's overshoot)`);
console.log(
  `  --matte-drop:    ${pct(matteDrop)}  (${softRows} soft rows at the bottom of the cutout)`
);
console.log('');
console.log(
  `--crown-clear ${pct(wantedClear)} wants --plate-img-width ${widthForWantedClear.toFixed(2)}%`
);
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
if (Math.abs(widthForWantedClear - imgWidthPct) > 0.5) {
  console.error(
    `\nFAIL  --crown-clear asks for ${pct(wantedClear)} once the push-in has run, but --plate-img-width is ${imgWidthPct}%, which settles at ${pct(restingClear)}. Set the width to ${widthForWantedClear.toFixed(2)}%.`
  );
  failures++;
}
// The mask tokens in the stylesheet must match what this run computes. They
// were once copied from a run taken BEFORE the width token was updated in the
// same sitting, which left the mask circle 9.91px wider than the plate and a
// rim of the disc showing along the edge. Reading a number out of an earlier
// run's output is exactly the mistake this catches.
const declaredMask = css.match(/--mask-size: ([\d.]+)% ([\d.]+)%/);
const declaredPos = css.match(/--mask-position: ([\d.]+)% ([\d.]+)%/);
const declaredPad = css.match(/--layer-pad: ([\d.]+)%/);
const declaredDrop = css.match(/--matte-drop: ([\d.]+)%/);
if (!declaredMask || !declaredPos || !declaredPad || !declaredDrop) {
  console.error('\nFAIL  could not find the mask tokens in the stylesheet; this check is blind.');
  process.exit(1);
}
const expect: [string, number, number][] = [
  ['--mask-size width', parseFloat(declaredMask[1]), tileW * 100],
  ['--mask-size height', parseFloat(declaredMask[2]), tileH * 100],
  ['--mask-position x', parseFloat(declaredPos[1]), posX * 100],
  ['--mask-position y', parseFloat(declaredPos[2]), posY * 100],
  ['--layer-pad', parseFloat(declaredPad[1]), layerPad * 100],
  ['--matte-drop', parseFloat(declaredDrop[1]), matteDrop * 100]
];
for (const [name, declared_, computed] of expect) {
  if (Math.abs(declared_ - computed) > 0.02) {
    console.error(
      `\nFAIL  ${name} is ${declared_}% in the stylesheet but computes to ${computed.toFixed(2)}%. The mask no longer matches the plate.`
    );
    failures++;
  }
}

if (crownAbovePlateTop < 0.02) {
  console.error(
    `\nFAIL  the crown clears by only ${pct(crownAbovePlateTop)}, so the image's top edge falls inside the disc and draws a line across his head.`
  );
  failures++;
}

if (failures) process.exit(1);
console.log(
  `\nThe portrait fits: his crown settles ${pct(restingClear)} above the plate, the image's own top edge falls outside the disc, and his head is centred in the circle to ${pct(Math.abs(centringError))}.`
);
