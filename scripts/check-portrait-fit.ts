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
  discSettle: number;
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
// leaves his head off to one side.
//
// The head has to be segmented from the shoulders first, or the measurement is
// of the wrong thing: taking the centre from the sliver that rises above the
// plate measures his CROWN, and taking it from the whole figure measures his
// shoulders. The neck is the narrowest point between the two, so smooth the
// per-row width, find the first local maximum (the head at its widest, about
// the ears) and then the first local minimum below it.
const widths = rows.map((r) => r.right - r.left);
const SMOOTH = 12;
const smooth = widths.map((_, i) => {
  let sum = 0;
  let n = 0;
  for (let k = -SMOOTH; k <= SMOOTH; k++) {
    const j = i + k;
    if (j >= 0 && j < widths.length) {
      sum += widths[j];
      n++;
    }
  }
  return sum / n;
});
let peak = -1;
for (let i = SMOOTH; i < smooth.length - SMOOTH; i++) {
  if (smooth[i] >= smooth[i - SMOOTH] && smooth[i] >= smooth[i + SMOOTH]) {
    peak = i;
    break;
  }
}
let neck = -1;
if (peak > 0) {
  for (let i = peak + SMOOTH; i < smooth.length - SMOOTH; i++) {
    if (smooth[i] <= smooth[i - SMOOTH] && smooth[i] <= smooth[i + SMOOTH]) {
      neck = i;
      break;
    }
  }
}
if (neck < 0) {
  console.error(
    `\nFAIL  could not find the neck in ${CUTOUT}: no local width minimum below the head's widest row. Centring his head is guesswork without it.`
  );
  process.exit(1);
}
const headBand = rows.slice(0, neck + 1);

// The alpha-weighted centroid across that band, rather than the midpoint of
// its extremes: a centroid is not thrown by one ear sticking out further than
// the other, and the eye reads the mass, not the bounding box.
let mass = 0;
let moment = 0;
for (const r of headBand) {
  const y = Math.round(r.y * h);
  for (let x = Math.round(r.left * w); x <= Math.round(r.right * w); x++) {
    const a = alpha[y * w + x];
    if (a > ALPHA_FLOOR) {
      mass += a;
      moment += a * x;
    }
  }
}
const headCentreFrac = moment / mass / w;

// A percentage in `translate` resolves against the ELEMENT's own width, which
// is the image, so the image's width cancels out of the solution and this is
// simply how far off centre his head is. Multiplying by it, as an earlier
// version did, over-shifted him by that factor: 3.11% instead of 2.43%.
const headShift = 0.5 - headCentreFrac;
const imgLeft = 0.5 - imgW / 2 + headShift * imgW;

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

// ---- the outer layer's vertical fade ------------------------------------
// `.layerOut` paints whatever falls OUTSIDE the circle, and he falls outside it
// in two separate places: his crown, above the disc, and his shoulders, either
// side of it and all the way down. Only the second one wants removing, so the
// layer carries a vertical fade — and until this was solved, that fade was two
// style numbers (7% -> 21%) rather than a measurement.
//
// It has exactly one constraint, and breaking it is visible: the fade must
// still be at 1 everywhere the CROWN lies outside the circle. Where it is not,
// the same opaque skin is painted at full strength on the plate just inside the
// arc and at partial strength over the deep band just outside it, and the eye
// reads a step across his head that no matte can fix. Measured at the old 7%,
// on the arc where the circle crosses his skull: the outer layer was down to
// 0.63 while the inner one was at 1, a 19.2 luminance-level step on opaque
// pixels.
//
// So the fade has to fit in the GAP — the rows where nothing of him lies
// outside the circle at all — and the gap is wide (about 12% to 71% of the
// layer box), so satisfying this costs the design nothing.
//
// Solved over the whole push-in, because the image scales against a mask that
// does not: the crown reaches further out of the circle the further he pushes
// in, and it is the settled state that binds.
const circle = { cx: 0.5, cy: 0.5, r: 0.5 }; // the mask tile IS the plate, solved above
const imgCx = imgLeft + imgW / 2;
const imgCy = 1 - imgH / 2;

/** Rows (as a fraction of the layer box) where any of him lies outside the circle. */
function outsideBand(s: number): { crownEnd: number; bodyStart: number } | null {
  let crownEnd = -1;
  let bodyStart = -1;
  let seenInside = false;
  for (const row of rows) {
    const y0 = 1 - imgH + row.y * imgH;
    const y = imgCy + (y0 - imgCy) * s + matteDrop * imgH;
    const dy = y - circle.cy;
    const hw = Math.abs(dy) < circle.r ? Math.sqrt(circle.r * circle.r - dy * dy) : -1;
    const l = imgCx + (imgLeft + row.left * imgW - imgCx) * s;
    const r = imgCx + (imgLeft + row.right * imgW - imgCx) * s;
    const outside = l < circle.cx - hw || r > circle.cx + hw;
    const frac = (y - (1 - boxH)) / boxH;
    if (outside) {
      if (!seenInside) crownEnd = frac;
      else if (bodyStart < 0) bodyStart = frac;
    } else {
      seenInside = true;
    }
  }
  return crownEnd < 0 || bodyStart < 0 ? null : { crownEnd, bodyStart };
}

let fadeFloor = 0;
let fadeCeil = 1;
for (const s of [1, 1 + (pushScale - 1) / 2, pushScale]) {
  const b = outsideBand(s);
  if (!b) {
    console.error(
      `\nFAIL  could not separate his crown from his shoulders against the mask circle at push-in ${s}. Without that gap there is nowhere to put .layerOut's fade.`
    );
    process.exit(1);
  }
  fadeFloor = Math.max(fadeFloor, b.crownEnd);
  fadeCeil = Math.min(fadeCeil, b.bodyStart);
}
// A quarter of a point inside the bound, and the same 14-point span the design
// had, unless the gap is too narrow to hold it.
const outFadeStart = Math.ceil(fadeFloor * 400) / 400 + 0.0025;
const outFadeEnd = Math.min(outFadeStart + 0.14, Math.floor(fadeCeil * 400) / 400 - 0.0025);

// ---- report -------------------------------------------------------------
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
console.log(`cutout          ${w}x${h}, aspect ${(h / w).toFixed(4)}`);
console.log(`soft rows       ${softRows} at the bottom, so he drops ${pct(matteDrop)}`);
console.log(`drawn at        ${pct(imgW)} of the plate`);
console.log(`crown settles   ${pct(restingClear)} above the plate (asked for ${pct(wantedClear)})`);
console.log(
  `head at widest  row ${Math.round(rows[peak].y * h)}, neck at row ${Math.round(rows[neck].y * h)}`
);
console.log(
  `head centre     ${pct(headCentreFrac)} of the image, so it shifts ${pct(headShift)}`
);
console.log(`mask tile       ${pct(tileW)} ${pct(tileH)} at ${pct(posX)} ${pct(posY)}`);
console.log(`layer padding   ${pct(layerPad)} for the push-in's overshoot`);
console.log(
  `outer fade      ${pct(outFadeStart)} -> ${pct(outFadeEnd)}, inside the gap ${pct(fadeFloor)}..${pct(fadeCeil)} where none of him is outside the circle`
);
console.log(`disc inset      ${config.discInset}px, so the mask overlaps the disc's edge`);
console.log(`disc settles    from ${config.discSettle} on the reveal`);

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
if (outFadeEnd <= outFadeStart) {
  console.error(
    `\nFAIL  the gap between his crown and his shoulders (${pct(fadeFloor)}..${pct(fadeCeil)} of the layer box) is too narrow for .layerOut's fade. Either it starts while the circle is still crossing his head, which steps his skull, or it is still fading where his shoulders are already outside, which shows them on the band.`
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
      outFadeStart: pct(outFadeStart),
      outFadeEnd: pct(outFadeEnd),
      matteDrop: pct(matteDrop),
      discInset: `${config.discInset}px`,
      discSettle: config.discSettle,
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
