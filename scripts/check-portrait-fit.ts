/**
 * The hero portrait's geometry, SOLVED from the cutout's own alpha channel.
 *
 *     pkgx node scripts/check-portrait-fit.ts
 *
 * From 880px up, John stands on a circular sand plate and his head breaks out
 * of the top of it. That composition rests on several numbers, and only three
 * of them are anyone's choice: `crownClear`, `pushInScale` and `discInset`, in
 * `src/lib/portrait.config.json`. Every other number is a property of
 * whichever photograph is present, so this script measures the cutout, derives
 * them, and writes them to `src/lib/generated/portrait-geometry.json` for the
 * page to read.
 *
 * That is what lets John replace his portrait through the CMS without anyone
 * hand-tuning CSS. It also removes a class of bug: while these lived as
 * hand-typed tokens, the mask circle came out 9.91px wider than the plate
 * because a value had been copied from a run of this very script taken before
 * another token changed. A number that lives in two places drifts.
 *
 * How the effect works, since the numbers only make sense against it: the
 * circle is a MASK on two identical layers, one keeping what falls inside it
 * and one what falls outside, so neither layer has a rectangle edge anywhere
 * near the figure. That matters because his shoulders run off the edges of the
 * source frame, so he is outside the circle essentially all the way down, and
 * any construction with a BOX behind the disc has an edge the disc cannot
 * cover.
 *
 * Fail-closed: an unreadable image, an image with no alpha, an empty matte or
 * an unparseable config are failures rather than passes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const CUTOUT = 'static/img/john-cutout.webp';
const CONFIG = 'src/lib/portrait.config.json';
const OUT = 'src/lib/generated/portrait-geometry.json';

/** Alpha above this counts as the figure. Matches the matte's own ramp. */
const ALPHA_FLOOR = 40;
/** And this counts as fully opaque, for the soft-edge scan. */
const SOLID = 250;

interface Row {
  /** Fraction of image height, 0 at the top. */
  y: number;
  left: number;
  right: number;
}

const image = sharp(CUTOUT);
const meta = await image.metadata();
if (!meta.hasAlpha) {
  console.error(`${CUTOUT}: no alpha channel, so there is no silhouette to measure.`);
  process.exit(1);
}
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;

const alpha = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) alpha[i] = data[i * channels + channels - 1];

const rows: Row[] = [];
for (let y = 0; y < h; y++) {
  let left = -1;
  let right = -1;
  for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] > ALPHA_FLOOR) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left >= 0) rows.push({ y: y / h, left: left / w, right: right / w });
}
if (rows.length === 0) {
  console.error(`${CUTOUT}: every pixel is transparent.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
  crownClear: number;
  pushInScale: number;
  discInset: number;
};
const wantedClear = config.crownClear / 100;
const pushScale = config.pushInScale;

// ---- the soft bottom edge ----------------------------------------------
// The cutout's last rows never reach full opacity: he was cut off by the
// bottom of the source frame, so the matte ramps out instead of ending. On a
// dark band that is invisible; inside the sand plate the ground shows through
// them as a rim under his shirt. He is dropped by that much, so those rows
// fall below the circle where the mask is already empty.
let softRows = 0;
for (let y = h - 1; y >= 0; y--) {
  let anySolid = false;
  for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] >= SOLID) {
      anySolid = true;
      break;
    }
  }
  if (anySolid) break;
  softRows++;
}
const matteDrop = (softRows + 1) / h;

// ---- how large to draw him ---------------------------------------------
// In units of the plate's width; the plate is square, so 1 width = 1 height.
// The push-in scales about the image's CENTRE, so only half its growth adds to
// the clearance, and the drop takes some back.
const halfScale = (pushScale + 1) / 2;
const imgH = (1 + wantedClear) / (halfScale - matteDrop);
const imgW = imgH / (h / w);
const restingClear = halfScale * imgH - 1 - matteDrop * imgH;

// ---- where to put him ---------------------------------------------------
// He is not centred in his own photograph, so centring the IMAGE in the circle
// leaves his head off to one side. Measure where the head's centre actually
// is, across the rows that sit above the plate, and solve the shift that
// brings it to the middle. The shift is a percentage of the IMAGE's own width,
// which is how a percentage in `translate` resolves.
const aboveFrac = Math.max((imgH - 1) / imgH, 0.02);
const headRows = rows.filter((r) => r.y <= aboveFrac);
const headCentreFrac =
  (Math.min(...headRows.map((r) => r.left)) + Math.max(...headRows.map((r) => r.right))) / 2;
const headShift = imgW * (0.5 - headCentreFrac);
const imgLeft = 0.5 - imgW / 2 + headShift;

// ---- the mask geometry, in the layers' own coordinates ------------------
// Both layers are the IMAGE's box, so neither has a rectangle edge anywhere
// near the figure. The circle is therefore a mask TILE placed inside that
// larger box.
//
// The layer's box is not quite the image's box: the push-in is a transform,
// and a transform does not change layout, so the scaled image reaches above
// its own box by half the overshoot. The mask is sized to the box, so without
// room for that the crown falls outside the mask and is cut clean off.
const overshoot = ((pushScale - 1) / 2) * imgH;
const layerPad = overshoot; // plate units == a fraction of the containing block
const boxH = imgH + overshoot;

// The tile is the plate: square in pixels, so its size is a different
// percentage of the box's width than of its height.
const tileW = 1 / imgW;
const tileH = 1 / boxH;
// `mask-position` percentages align p% of the free space, not a raw offset.
const posX = imgW - 1 > 0 ? -imgLeft / (imgW - 1) : 0;
const posY = boxH - 1 > 0 ? (overshoot + (imgH - 1)) / (boxH - 1) : 0;

// ---- report -------------------------------------------------------------
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
console.log(`cutout          ${w}x${h}, aspect ${(h / w).toFixed(4)}`);
console.log(`soft rows       ${softRows} at the bottom, so he drops ${pct(matteDrop)}`);
console.log(`drawn at        ${pct(imgW)} of the plate`);
console.log(`crown settles   ${pct(restingClear)} above the plate (asked for ${pct(wantedClear)})`);
console.log(`head shift      ${pct(headShift)} to centre his head, not his image`);
console.log(`mask tile       ${pct(tileW)} ${pct(tileH)} at ${pct(posX)} ${pct(posY)}`);
console.log(`layer padding   ${pct(layerPad)} for the push-in's overshoot`);
console.log(`disc inset      ${config.discInset}px, so the mask overlaps the disc's edge`);

let failures = 0;

if (restingClear < 0.02) {
  console.error(
    `\nFAIL  the crown clears by only ${pct(restingClear)}, so the image's own top edge falls inside the disc and draws a line across his head.`
  );
  failures++;
}
if (Math.abs(restingClear - wantedClear) > 0.0005) {
  console.error(
    `\nFAIL  asked for ${pct(wantedClear)} of clearance but the solution gives ${pct(restingClear)}.`
  );
  failures++;
}
if (imgW <= 1) {
  console.error(
    `\nFAIL  he would be drawn narrower than the plate (${pct(imgW)}), so the disc would show past him at the sides.`
  );
  failures++;
}
if (softRows > h * 0.05) {
  console.error(
    `\nFAIL  ${softRows} rows at the bottom of the cutout never reach full opacity, which is over 5% of its height. That is a matte problem, not a layout one.`
  );
  failures++;
}
if (config.discInset <= 0) {
  console.error(
    `\nFAIL  discInset is ${config.discInset}px. The disc has to sit slightly inside the mask, or its edge shows as a rim around him.`
  );
  failures++;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      note: `Generated by scripts/check-portrait-fit.ts from ${CUTOUT}. Do not edit; change ${CONFIG} instead.`,
      cutout: { width: w, height: h },
      plateImgWidth: pct(imgW),
      headShift: pct(headShift),
      crownClear: pct(restingClear),
      pushInScale: pushScale,
      maskSize: `${pct(tileW)} ${pct(tileH)}`,
      maskPosition: `${pct(posX)} ${pct(posY)}`,
      layerPad: pct(layerPad),
      matteDrop: pct(matteDrop),
      discInset: `${config.discInset}px`,
      softRows
    },
    null,
    2
  ) + '\n'
);
console.log(`\nwrote ${OUT}`);

if (failures) process.exit(1);
console.log(
  `The portrait fits: his crown settles ${pct(restingClear)} above the plate and his head is centred in the circle.`
);
