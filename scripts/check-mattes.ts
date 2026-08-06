/**
 * The hero cut-out must be correct on EVERY ground, because one file is now
 * painted on all of them.
 *
 *     pkgx node scripts/check-mattes.ts
 *
 * WHAT THIS USED TO CHECK, AND WHY IT DOESN'T ANY MORE. There were two mattes:
 * the plain knockout inside the plate's circle and a keyed variant outside it
 * on the deep band. The gate was that they agreed everywhere except within a
 * few pixels of the outline, because otherwise the circle drew a tonal step
 * across his body. Both of those files still exist, but only one is painted,
 * and the property worth gating is no longer a relationship between two files.
 * It is a property of the one: that its straight-alpha foreground carries
 * JOHN's colour at every coverage and not the cyclorama's, which is precisely
 * what makes `F*a + ground*(1-a)` right over the light plate inside the circle
 * and the deep band outside it at the same time.
 *
 * THE MEASUREMENT. A white backing contaminates a fringe in one direction
 * only: it makes the foreground BRIGHTER than the surface it belongs to, and
 * more so the lower the coverage, because that is where more of the backing
 * was in the pixel. So compare each partially-covered pixel's unpremultiplied
 * colour with the OPAQUE pixels around it — the same surface, where there was
 * never any backing to mix in — and bucket the difference by coverage. A clean
 * asset is flat. The plain knockout, measured here, climbs to +130 as coverage
 * falls; the keyed matte it replaced fell to -40 instead, which is a de-light
 * rather than a backing but is just as visible, as a drawn-on dark line on the
 * band. Both fail this gate. What ships passes it.
 *
 * The comparison is done unpremultiplied on purpose. Premultiplied, a bright
 * fringe and a high-coverage fringe are the same picture, and the question has
 * no answer.
 *
 * The bounds are not chosen, they are the ENCODER's, self-calibrated the same
 * way this script has always done it: re-encode the asset's own decoded pixels
 * through the pipeline's settings, compare them with themselves, and take what
 * is left as the floor. Both mattes are lossy WebP, which is VP8 and therefore
 * YUV 4:2:0, so chroma is subsampled and a round trip moves pixels by several
 * levels on its own. Asking for better than the format can deliver is asking
 * for a red build that no correct asset could turn green.
 *
 * AND THE INTERIOR, WHICH THIS GATE USED TO IGNORE. Everything above lives in
 * the fringe, and a fringe gate cannot see a fully-opaque defect. It did not:
 * the F-pinned solve took its foreground from the observed plate wherever it
 * called a pixel opaque, and above row 12 there is no plate — the frame clips
 * the top of John's head and the crown is Ole's reconstruction — so 45 opaque
 * pixels of his scalp shipped as pure white on a green build. No coverage
 * bucket, no tile and no reproduction sample contained one of them.
 *
 * So the interior is gated too, against the master, which is the one thing that
 * knows what colour those pixels are. At full coverage nothing was mixed in, so
 * the matting equation has nothing to say and the only honest foreground is the
 * master's own. Same self-calibration: the encoder's worst case over the same
 * pixels, plus the margin.
 *
 * Fail-closed: a missing alpha channel, mismatched dimensions, or zero
 * comparable pixels — including a master with no opaque pixel in it — are
 * failures rather than passes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

/**
 * The one file the page paints, on every ground. `--asset <path>` points the
 * gate at another build instead, which is how it was checked that it fails on
 * the two it replaced rather than only passing on the one it was written for;
 * `--master <path>` moves the reference with it, because an out-of-tree build
 * has its own master and measuring it against this one would compare two
 * different pictures.
 */
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
const ASSET = arg('--asset', 'static/img/john-cutout.webp');
/** The unsolved master: the same matte over untouched pixels. Nothing paints it. */
const MASTER = arg('--master', 'assets/portrait/john-knockout.webp');
/**
 * The photograph the HAND pass cut from, and the alignment and backing it used:
 * the hand pass that used to live in `scripts/build-cutouts.py` puts the matte over this plate bottom-aligned, and
 * measured the cyclorama as a flat, blown-out 255.
 */
const PLATE = 'docs/source-assets/John-Goss-1.jpg';
/**
 * What the CMS writes when John replaces his portrait, and the record
 * `scripts/gen-cutouts.ts` leaves when it keys it. Once he has uploaded one,
 * THAT photograph is the source and this file's hard-coded plate is not — but
 * the check does not stand down for it any more, it follows the record.
 *
 * It used to stand down, and that note was written when this gate's other
 * checks did the real work. They no longer do: the reproduction check is the
 * only one here that needs no reference for the subject's own colour, and
 * losing it the moment the pipeline starts running automatically would leave
 * the automatic path gated more weakly than the hand one. Everything it needs —
 * which picture, where the crop sits in it, and what the backing was measured
 * to be — is in the audit record, so it is read from there.
 */
const CMS_SOURCE_DIR = 'static/img/portrait';
const AUDIT = 'src/lib/generated/cutout-audit.json';

/** Coverage buckets, as 8-bit alpha. The fringe is everything between them. */
const FRINGE_LO = 6;
const FRINGE_HI = 249;
const BUCKETS: [number, number][] = [
  [6, 16],
  [16, 31],
  [31, 51],
  [51, 89],
  [89, 140],
  [140, 204],
  [204, 250]
];
/**
 * Extra margin over the encoder's own floor.
 *
 * The reference this gate compares against is a EUCLIDEAN box mean of the
 * nearby opaque pixels, not the geodesic extension the hand pass that used to live in `scripts/build-cutouts.py`
 * solves with, so it carries a small positive bias: the interior inside the
 * window is brighter than the rim at the edge of it. Measured on the shipped
 * asset, this gate's reference is a ring-propagated Euclidean one where the
 * build script solves a geodesic extension, and the two agree to a couple of
 * levels. The margin covers that. It is nowhere near enough to let a
 * contaminated fringe through: the plain knockout reads +135 on the same
 * measurement and the de-lit matte this replaced reads -30 in the tiles where
 * its light wrap landed hardest.
 */
const MARGIN = 5;
/** Below this coverage, no grazing-angle surface can explain a dark fringe. */
const NO_SHADING_ABOVE = 89;
/**
 * The gate is also run TILE BY TILE, not only over the whole fringe.
 *
 * That is not thoroughness, it is the difference between catching the defect
 * and missing it. The matte this replaced averaged -7 over the whole fringe at
 * low coverage, which is inside any sane bound; the average hid a +1 at the
 * crown and a -41 at the neck, because its de-lighting was fitted per pixel
 * and landed hardest where the cyclorama had reached furthest. A localised
 * dark line is exactly as visible as a global one and a mean cannot see it.
 */
const TILE = 128;
/** A tile needs this many fringe pixels before its mean means anything. */
const TILE_MIN = 200;
/** How far past the matte to carry the reference, for the colour-bleed check. */
const BLEED_RINGS = 4;
/**
 * Above this 8-bit alpha the master calls a pixel FULLY opaque, and the asset's
 * colour there has to be the master's own.
 *
 * 254, not `FRINGE_HI + 1`: 250-253 is the last sliver of the ramp, where the
 * solve is legitimately still working and the master legitimately still carries
 * backing — measured on the asset that ships, the two differ by up to 99 levels
 * in that sliver and by 8.3 at 254 and above. This is the threshold
 * the hand pass that used to live in `scripts/build-cutouts.py` pins F at, expressed in the asset's own units.
 */
const OPAQUE_LO = 254;
/** The crop's own antialiasing, at the edges of the frame he runs off. */
const FRAME_EDGE = 3;
/**
 * What a single tile may depart by. Not the encoder's floor: over a tile this
 * gate is limited by its own REFERENCE, not by the format.
 *
 * The reference is a ring propagation, which is Euclidean-in-character and
 * therefore wrong where the surface has a steep gradient right at the outline —
 * the hairline above the ear, the lit top edge of a dark shoulder. Measured, on
 * the asset that ships: this gate reads up to 20.5 in the tile at x 512 y 512,
 * where the hand pass that used to live in `scripts/build-cutouts.py`'s geodesic solve reads +1.2 for the same
 * pixels. That 20 is the reference's error and nothing else.
 *
 * So the bound sits above it, and it is still far below what it exists to
 * reject: the plain knockout reads +167 in its worst tile, and the de-lit matte
 * this replaced reads -30. Tightening this without first porting the geodesic
 * extension into this file would only produce a red build that no correct asset
 * could turn green — which is the same mistake the old hardcoded max of 5 made.
 */
const TILE_LIMIT = 25;

interface Img {
  data: Buffer;
  w: number;
  h: number;
  c: number;
}

async function load(path: string): Promise<Img> {
  const image = sharp(path);
  const meta = await image.metadata();
  if (!meta.hasAlpha) throw new Error(`${path}: no alpha channel, so there is no matte`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}

const asset = await load(ASSET);
const master = await load(MASTER);

if (asset.w !== master.w || asset.h !== master.h) {
  console.error(
    `${ASSET} is ${asset.w}x${asset.h} and ${MASTER} is ${master.w}x${master.h}. The geometry is measured off the master and applied to the asset, so they must match exactly.`
  );
  process.exit(1);
}

const { w, h, c } = asset;
const lum = (d: Buffer, o: number) => 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];

/**
 * The encoder's own noise floor, self-calibrated: the asset's decoded pixels
 * pushed back through the pipeline's settings (the keyer (`scripts/keyer.ts`):
 * quality 92, alpha quality 100, effort 6) and compared with themselves.
 */
async function encodeFloor(): Promise<{ mean: number; max: number; opaqueMax: number }> {
  const round = await sharp(asset.data, { raw: { width: w, height: h, channels: c as 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const { data: back, info } = await sharp(round)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let n = 0;
  let sum = 0;
  let max = 0;
  // The same round trip over the OPAQUE interior, which is what the opaque check
  // below is measured against. It is a different number from the fringe's: the
  // fringe is where 4:2:0 hurts most, and a flat interior encodes better.
  let opaqueMax = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * info.channels;
    const a = asset.data[i * c + 3];
    const d = Math.abs(lum(back, o) - lum(asset.data, i * c));
    if (a >= OPAQUE_LO && d > opaqueMax) opaqueMax = d;
    if (a <= FRINGE_LO || a > FRINGE_HI) continue;
    n++;
    sum += d;
    if (d > max) max = d;
  }
  if (n === 0) throw new Error('the encode floor compared zero pixels');
  return { mean: sum / n, max, opaqueMax };
}

const floor = await encodeFloor();

/**
 * The surface each fringe pixel belongs to: the luminance of the OPAQUE pixels,
 * propagated outward across the fringe one ring at a time.
 *
 * A wide box mean was tried first and is wrong here. It reaches 20px deep into
 * the interior, so on the shoulder — where the shirt is dark and the lit rim is
 * at the very edge — it reports a surface far darker than the pixel's own, and
 * calls real modelling contamination. Propagating from the nearest opaque ring
 * instead takes the rim's own opaque continuation, which is the surface the
 * fringe pixel actually belongs to. It is the cheap Euclidean cousin of the
 * geodesic extension the hand pass that used to live in `scripts/build-cutouts.py` solves with.
 *
 * Geodesic matters, and cheaply: the propagation is allowed to travel only
 * through pixels the matte holds. Without that restriction it crosses the gap
 * between an earlobe and the skull behind it and reports the cheek on the far
 * side as "the surface", which reads as 20 levels of contamination that is not
 * there. Rhemann, Rother & Gelautz make the same argument for their sample sets
 * (BMVC 2008, sec 2.1): spread in geodesic distance, "which respects the shape
 * of the foreground object".
 *
 * A few extra rings run past the matte afterwards, unrestricted, so the empty
 * pixels just outside it have a reference for the colour-bleed check.
 */
function nearestOpaqueLuma(): Float64Array {
  const val = new Float64Array(w * h);
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (asset.data[i * c + 3] >= 250) {
      known[i] = 1;
      val[i] = lum(asset.data, i * c);
    }
  }
  const next = new Float64Array(w * h);
  const gained = new Uint8Array(w * h);
  const reached = new Uint8Array(w * h);

  /** One ring. `inside` keeps the propagation within the matte. */
  const ring = (inside: boolean): number => {
    let grew = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        if (inside && asset.data[i * c + 3] === 0) continue;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (known[j]) {
              sum += val[j];
              n++;
            }
          }
        }
        if (n) {
          next[i] = sum / n;
          gained[i] = 1;
          grew++;
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (gained[i]) {
        val[i] = next[i];
        known[i] = 1;
        gained[i] = 0;
        reached[i] = 1;
      }
    }
    return grew;
  };

  // Phase one: through the matte, until every partly-covered pixel has one.
  // Bounded, because a matte with an enclosed transparent hole never converges.
  for (let pass = 0; pass < 64 && ring(true) > 0; pass++);
  // Phase two: a few rings past it, for the colour-bleed check.
  for (let pass = 0; pass < BLEED_RINGS && ring(false) > 0; pass++);

  const out = new Float64Array(w * h).fill(NaN);
  for (let i = 0; i < w * h; i++) {
    if (reached[i] && asset.data[i * c + 3] < 250) out[i] = val[i];
  }
  return out;
}

const ref = nearestOpaqueLuma();

const tally = BUCKETS.map(() => ({ n: 0, sum: 0 }));
const masterTally = BUCKETS.map(() => ({ n: 0, sum: 0 }));
const tilesW = Math.ceil(w / TILE);
const tiles = Array.from({ length: tilesW * Math.ceil(h / TILE) }, () => ({
  lowN: 0,
  lowSum: 0,
  allN: 0,
  allSum: 0
}));
let bled = 0;
let bledN = 0;

for (let i = 0; i < w * h; i++) {
  const a = asset.data[i * c + 3];
  const r = ref[i];
  if (Number.isNaN(r)) continue;
  if (a === 0) {
    // COLOUR BLEED. Where the matte is empty the RGB is still encoded, and VP8
    // subsamples chroma across it into the fringe, so it has to hold John's
    // colour rather than white or black.
    bled += Math.abs(lum(asset.data, i * c) - r);
    bledN++;
    continue;
  }
  if (a <= FRINGE_LO || a > FRINGE_HI) continue;
  const b = BUCKETS.findIndex(([lo, hi]) => a >= lo && a < hi);
  if (b < 0) continue;
  const d = lum(asset.data, i * c) - r;
  tally[b].n++;
  tally[b].sum += d;
  const t = tiles[Math.floor(i / w / TILE) * tilesW + Math.floor((i % w) / TILE)];
  t.allN++;
  t.allSum += d;
  if (a < NO_SHADING_ABOVE) {
    t.lowN++;
    t.lowSum += d;
  }
  const ma = master.data[i * c + 3];
  if (ma > FRINGE_LO && ma <= FRINGE_HI) {
    masterTally[b].n++;
    masterTally[b].sum += lum(master.data, i * c) - r;
  }
}

const compared = tally.reduce((n, t) => n + t.n, 0);
if (compared === 0) {
  console.error('compared zero fringe pixels. That is a failure, not a pass.');
  process.exit(1);
}

console.log(
  `encoder's own floor: ${floor.mean.toFixed(2)} mean, ${floor.max.toFixed(1)} max over the fringe (the asset round-tripped against itself)`
);
console.log(
  `\nunpremultiplied foreground vs the opaque surface around it, by coverage.\npositive is toward the white cyclorama, which is the only direction a backing can contaminate in:`
);
console.log(`  ${'coverage'.padEnd(12)} ${'n'.padStart(8)} ${'asset'.padStart(9)} ${'master'.padStart(9)}`);
BUCKETS.forEach(([lo, hi], k) => {
  const t = tally[k];
  if (!t.n) return;
  const m = masterTally[k];
  console.log(
    `  ${`${(lo / 255).toFixed(2)}-${(hi / 255).toFixed(2)}`.padEnd(12)} ${String(t.n).padStart(8)} ${(t.sum / t.n).toFixed(1).padStart(9)} ${(m.n ? (m.sum / m.n).toFixed(1) : '-').padStart(9)}`
  );
});
console.log(
  `\ncolour bleed into the empty region: ${bledN ? (bled / bledN).toFixed(1) : 'n/a'} mean levels from the nearby opaque surface, over ${bledN} px`
);

let failures = 0;

// == THE STRONGEST CHECK: DOES IT REPRODUCE THE PHOTOGRAPH IT CAME FROM? =====
// Everything above needs a REFERENCE for John's own colour, and this file's
// reference is a ring propagation that is worth about +-20 levels where the
// surface has a steep gradient at the outline. This check needs no reference at
// all. The backing was MEASURED, so
//
//     F*a + B*(1 - a) = I
//
// is a statement about the photograph with no free parameters left, and an
// asset that satisfies it while its foreground is flat in coverage is correct
// over any ground by construction. In linear light, because the camera did the
// mixing in radiance and not in sRGB.
//
// Measured, over the fringe where the plate is not clipped: the asset that
// ships 1.07, the plain knockout 13.59, the de-lit matte this replaced 16.95.
// That is a thirteen-fold separation with nothing to argue about.
interface Origin {
  /** The photograph. */
  file: string;
  /** Where the asset's (0,0) sits in it, in the photograph's own pixels. */
  ox: number;
  oy: number;
  /** The backing, per channel, as `c + gx·xn + gy·yn` over the PHOTOGRAPH's frame. */
  plane: { c: number; gx: number; gy: number }[];
  how: string;
}

/** Which picture the matte on disk was actually cut from, and how it sits in it. */
function origin(assetH: number, plateH: number): Origin | string {
  const uploaded = existsSync(CMS_SOURCE_DIR)
    ? readdirSync(CMS_SOURCE_DIR).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f))
    : [];
  const flat = [0, 1, 2].map(() => ({ c: 255, gx: 0, gy: 0 }));
  if (uploaded.length === 0) {
    // The hand pass: build-cutouts.py bottom-aligns the matte on the plate and
    // measured the cyclorama as a flat, blown-out 255.
    return { file: PLATE, ox: 0, oy: -(assetH - plateH), plane: flat, how: 'the hand pass, bottom-aligned on its plate, against the flat 255 cyclorama it measured' };
  }
  // He has uploaded one, so scripts/gen-cutouts.ts keyed it and left the record
  // of WHICH picture, WHERE the alpha crop landed in it, and what the backing
  // was fitted to be. Without all three this check cannot be run honestly, and
  // saying so is better than running it against the wrong picture.
  if (!existsSync(AUDIT)) return `the photograph in ${CMS_SOURCE_DIR} (${uploaded.join(', ')}) is the source now, but ${AUDIT} is not on disk, so where the crop sits in it and what its backing was measured to be are both unknown. Re-run \`node scripts/gen-cutouts.ts\`.`;
  let rec: {
    source?: string;
    crop?: { left: number; top: number; width: number; height: number };
    derived?: { backing?: { plane?: { c: number; gx: number; gy: number }[] } };
  };
  try {
    rec = JSON.parse(readFileSync(AUDIT, 'utf8'));
  } catch (e) {
    return `${AUDIT} could not be read (${(e as Error).message}), so the source of the matte is unknown.`;
  }
  const plane = rec.derived?.backing?.plane;
  if (!rec.source || !rec.crop || !plane || plane.length !== 3) {
    return `${AUDIT} does not carry the source, the crop and the fitted backing plane, so the reproduction check has nothing to align or subtract. Re-run \`node scripts/gen-cutouts.ts\`.`;
  }
  if (!existsSync(rec.source)) return `${AUDIT} names ${rec.source} as the source and it is not on disk.`;
  return { file: rec.source, ox: rec.crop.left, oy: rec.crop.top, plane, how: `the keyed pass over ${rec.source}, cropped at (${rec.crop.left}, ${rec.crop.top}), against the backing plane it fitted` };
}

const probe = existsSync(PLATE) ? await sharp(PLATE).metadata() : { height: 0 };
const from = origin(h, probe.height ?? 0);
if (typeof from === 'string') {
  console.log(`\nthe reproduction check stands down: ${from}`);
} else if (!existsSync(from.file)) {
  console.error(`\nFAIL  ${from.file} is missing, so the reproduction check cannot run.`);
  failures++;
} else {
  const { data: pd, info: pi } = await sharp(from.file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // The overlap the two pictures actually share, minus the outermost 3px of the
  // crop: those are the crop's OWN antialiasing — his shoulders run off the
  // edges of the photograph and the top of his head is cut off, so the matte
  // ramps there against nothing and no backing equation applies.
  // build-cutouts.py excludes them from the solve, so they have to be excluded
  // here too; included, those ~5,200 pixels alone move this mean from 1.03 to
  // 18.38.
  const y0 = Math.max(FRAME_EDGE, -from.oy);
  const y1 = Math.min(h - FRAME_EDGE, pi.height - from.oy);
  const x0 = Math.max(FRAME_EDGE, -from.ox);
  const x1 = Math.min(w - FRAME_EDGE, pi.width - from.ox);
  if (x1 - x0 < 16 || y1 - y0 < 16) {
    console.error(
      `\nFAIL  the matte (${w}x${h}) and ${from.file} (${pi.width}x${pi.height}) overlap in only ${Math.max(0, x1 - x0)}x${Math.max(0, y1 - y0)} px at the recorded offset (${from.ox}, ${from.oy}). Without a real overlap the reproduction check is comparing different pictures.`
    );
    failures++;
  } else {
    const toLinear = (v: number) => {
      const x = Math.min(255, Math.max(0, v)) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const lut = Array.from({ length: 256 }, (_, v) => toLinear(v));
    const lumLin = (d: Buffer | Uint8Array, o: number) =>
      0.2126 * lut[d[o]] + 0.7152 * lut[d[o + 1]] + 0.0722 * lut[d[o + 2]];
    /** The fitted backing at a pixel of the PHOTOGRAPH, as linear luminance. */
    const backingLum = (px: number, py: number) => {
      const xn = (px / Math.max(pi.width - 1, 1)) * 2 - 1;
      const yn = (py / Math.max(pi.height - 1, 1)) * 2 - 1;
      const v = from.plane.map((p) => toLinear(p.c + p.gx * xn + p.gy * yn));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    /** Reproduction error, in 0-255 equivalents, over the unclipped fringe. */
    const repro = (img: Img): { mean: number; p95: number; n: number } => {
      const es: number[] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * w + x;
          const a = asset.data[i * c + 3];
          if (a <= FRINGE_LO || a > FRINGE_HI) continue;
          const px = x + from.ox;
          const py = y + from.oy;
          const po = (py * pi.width + px) * pi.channels;
          // A clipped plate carries no information: 255 over 255 is any alpha.
          if (Math.max(pd[po], pd[po + 1], pd[po + 2]) >= 252) continue;
          const al = img.data[i * img.c + 3] / 255;
          const got = lumLin(img.data, i * img.c) * al + backingLum(px, py) * (1 - al);
          es.push(Math.abs(got - lumLin(pd, po)) * 255);
        }
      }
      es.sort((p, q) => p - q);
      return {
        mean: es.reduce((t, v) => t + v, 0) / (es.length || 1),
        p95: es[Math.floor(es.length * 0.95)] ?? 0,
        n: es.length
      };
    };
    const mine = repro(asset);
    const theirs = repro(master);
    // The limit, self-calibrated like everything else here: the plain knockout
    // is the asset with NO solve on it at all -- its foreground is the observed
    // pixel and its alpha is the ramp the retoucher drew -- so its reproduction
    // error is what "unsolved" costs. A solved asset has to be a long way inside
    // it, and a third of it is a wide door.
    const limit = Math.max(3, theirs.mean / 3);
    console.log(
      `\nreproduction of ${from.file} in linear light, over ${mine.n} unclipped fringe px\n  (${from.how}):\n  asset  mean ${mine.mean.toFixed(2)}  p95 ${mine.p95.toFixed(2)}\n  master mean ${theirs.mean.toFixed(2)}  p95 ${theirs.p95.toFixed(2)}  (the unsolved knockout, which sets the limit at ${limit.toFixed(2)})`
    );
    if (mine.mean > limit) {
      console.error(
        `\nFAIL  the asset's foreground and matte do not reproduce the photograph they were cut from: ${mine.mean.toFixed(2)} mean against a limit of ${limit.toFixed(2)}. Either the coverage or the colour is wrong, and since the backing was measured there is nothing else it could be. An asset that cannot reproduce its own source cannot be right over an arbitrary ground either.`
      );
      failures++;
    }
  }
}

// == THE OPAQUE INTERIOR IS THE MASTER'S, NOT A SOLVED ESTIMATE ==============
// Every other check in this file lives in the FRINGE, and that is how a solve
// that turned a patch of John's scalp pure white shipped past a green build.
// The 45 pixels were fully opaque, so no coverage bucket, no tile and no
// reproduction sample ever looked at them.
//
// An opaque pixel has no backing contribution to remove: whatever the solve
// went on to compute, its colour is the master's own. That is a bound with no
// free parameters in it, and it needs no reference for "John's colour" because
// the master IS John's colour. The limit is self-calibrated like the rest — the
// encoder's own worst case over the same pixels, plus the usual margin.
//
// Measured: the asset that ships departs by 0.21 mean and 8.3 max; the broken
// one departed by 176.8 at (916, 10), with 237 pixels past this limit.
const opaqueLimit = floor.opaqueMax + MARGIN;
let opaqueN = 0;
let opaqueSum = 0;
let opaqueOver = 0;
let opaqueWorst = { d: 0, x: -1, y: -1 };
for (let i = 0; i < w * h; i++) {
  if (master.data[i * c + 3] < OPAQUE_LO) continue;
  const d = Math.abs(lum(asset.data, i * c) - lum(master.data, i * c));
  opaqueN++;
  opaqueSum += d;
  if (d > opaqueLimit) opaqueOver++;
  if (d > opaqueWorst.d) opaqueWorst = { d, x: i % w, y: Math.floor(i / w) };
}
console.log(
  `\nthe opaque interior against the master's own colour, over ${opaqueN.toLocaleString()} px the master calls solid:\n  ${(opaqueSum / Math.max(opaqueN, 1)).toFixed(2)} mean, worst ${opaqueWorst.d.toFixed(1)} at (${opaqueWorst.x}, ${opaqueWorst.y}); allowed ${opaqueLimit.toFixed(1)} (the encoder's own ${floor.opaqueMax.toFixed(1)} over the same pixels, plus ${MARGIN})`
);
if (opaqueN === 0) {
  console.error(
    '\nFAIL  the master calls no pixel fully opaque, so there is nothing to hold the interior to. That is a broken master, not a clean pass.'
  );
  failures++;
} else if (opaqueOver > 0) {
  console.error(
    `\nFAIL  ${opaqueOver} fully-opaque px depart from the master's own colour by more than ${opaqueLimit.toFixed(1)} levels, the worst by ${opaqueWorst.d.toFixed(1)} at (${opaqueWorst.x}, ${opaqueWorst.y}). At full coverage nothing is mixed into the pixel, so the matting equation has nothing to say about it and the only honest foreground is the master's. A departure here means the solve estimated a colour where it should have copied one — and because it is opaque, it is drawn at full strength on every ground.`
  );
  failures++;
}

const brightLimit = floor.max + MARGIN;
const darkLimit = -(floor.max + MARGIN);

/**
 * Whether the fringe is OURS to answer for.
 *
 * Everything below asks the same question — is there backing left in the
 * fringe, or has a de-spill taken too much out of it — and both are questions
 * about a KEYING. When the photograph arrives already matted, there was no
 * keying: `gen-cutouts.ts` recognises the alpha it came with and passes the
 * edge through, scaling and nothing else. Whatever is in that fringe is what
 * the photograph brought with it.
 *
 * So on a pre-matted source these are measured and printed and do not fail.
 * Failing was wrong twice over. It said "a de-spill or a negative light wrap
 * has been applied there" about an edge nothing of ours had touched, which is
 * a false statement in a build log people are meant to trust; and it put a
 * warning about his own photograph in front of John the first time he opened
 * the editor, for something he cannot see, cannot act on and did not cause.
 *
 * The gate keeps its teeth where they belong. When we key, every one of these
 * fails, because then the fringe is the keyer's own work.
 */
const OURS_TO_ANSWER_FOR = !(
  existsSync(AUDIT) && JSON.parse(readFileSync(AUDIT, 'utf8')).preMatted === true
);
if (!OURS_TO_ANSWER_FOR) {
  console.log(
    `\nthe photograph was already matted, so its edge was passed through rather than keyed.\n` +
      `  what follows is measured and reported: it describes the edge the photograph arrived with,\n` +
      `  and there is no de-spill or backing removal of ours for it to be evidence about.`
  );
}

/** Counts as a failure only where the fringe is ours. */
function fringeFault(message: string) {
  if (OURS_TO_ANSWER_FOR) {
    console.error(message);
    failures++;
  } else {
    // The message names a cause — a de-spill, a backing left behind — and on a
    // pre-matted source that cause is not ours. Say so on the same line, so a
    // line lifted out of this log on its own is still true.
    console.log(
      message.replace(/^\nFAIL  /, '\nnoted ') +
        ' This edge came in with the photograph; nothing in this build touched it.'
    );
  }
}

for (const [k, [lo, hi]] of BUCKETS.entries()) {
  const t = tally[k];
  if (!t.n) continue;
  const d = t.sum / t.n;
  const label = `${(lo / 255).toFixed(2)}-${(hi / 255).toFixed(2)}`;
  if (d > brightLimit) {
    fringeFault(
      `\nFAIL  at coverage ${label} the foreground is ${d.toFixed(1)} levels BRIGHTER than the surface it belongs to. A white backing is the only thing that does that, so there is cyclorama left in the fringe and this asset will draw a bright rim around him on the plate. Allowed: ${brightLimit.toFixed(1)} (the encoder's own worst case of ${floor.max.toFixed(1)}, plus ${MARGIN} for this gate's Euclidean reference).`
    );
  }
  // The dark direction only has a legitimate explanation at HIGH coverage,
  // where a grazing-angle surface is genuinely darker than its own interior --
  // and there the plain knockout, which carries no treatment at all, is darker
  // too, which is the check. At low coverage there is no such story: a
  // systematic dark bias is a de-spill or a negative light wrap, and it reads
  // as a drawn-on dark line on the deep band.
  if (hi <= NO_SHADING_ABOVE && d < darkLimit) {
    fringeFault(
      `\nFAIL  at coverage ${label} the foreground is ${d.toFixed(1)} levels DARKER than the surface it belongs to. At that coverage no shading can account for it, so a de-spill or a negative light wrap has been applied to the edge, and it will read as a dark line around him on the deep band. Allowed: ${darkLimit.toFixed(1)} (the encoder's own worst case of ${floor.max.toFixed(1)}, plus ${MARGIN}).`
    );
  }
}

// The same bounds, tile by tile. `low` is the coverage below which no
// grazing-angle surface can explain a dark fringe, so both directions are
// gated there; above it only the bright direction is, since that is the only
// one a backing can push.
let worstTileLow = { d: 0, x: -1, y: -1 };
let worstTileHigh = { d: 0, x: -1, y: -1 };
for (const [k, t] of tiles.entries()) {
  const x = (k % tilesW) * TILE;
  const y = Math.floor(k / tilesW) * TILE;
  if (t.lowN >= TILE_MIN) {
    const d = t.lowSum / t.lowN;
    if (Math.abs(d) > Math.abs(worstTileLow.d)) worstTileLow = { d, x, y };
    if (Math.abs(d) > TILE_LIMIT) {
      fringeFault(
        `\nFAIL  in the ${TILE}px tile at x ${x} y ${y} the low-coverage fringe sits ${d.toFixed(1)} levels ${d > 0 ? 'BRIGHTER' : 'DARKER'} than the surface around it, over ${t.lowN} px. At that coverage neither shading nor the encoder can account for it: ${d > 0 ? 'there is backing left in the fringe' : 'a de-spill or a negative light wrap has been applied there'}. Allowed: ${TILE_LIMIT}, which is this gate's own reference error and not the encoder's.`
      );
    }
  }
  if (t.allN >= TILE_MIN) {
    const d = t.allSum / t.allN;
    if (d > worstTileHigh.d) worstTileHigh = { d, x, y };
    if (d > TILE_LIMIT) {
      fringeFault(
        `\nFAIL  in the ${TILE}px tile at x ${x} y ${y} the fringe is ${d.toFixed(1)} levels brighter than the surface around it, over ${t.allN} px. Only a backing does that. Allowed: ${TILE_LIMIT}.`
      );
    }
  }
}
console.log(
  `worst ${TILE}px tile: ${worstTileLow.d.toFixed(1)} at low coverage (x ${worstTileLow.x} y ${worstTileLow.y}), ${worstTileHigh.d.toFixed(1)} brightest over all coverage (x ${worstTileHigh.x} y ${worstTileHigh.y}); allowed +-${TILE_LIMIT}`
);

// The colour bleed has to be there. White or black in the transparent region
// gets subsampled into the fringe by 4:2:0 whatever the fringe itself holds.
if (bledN === 0) {
  console.error(
    '\nFAIL  found no transparent pixels near the figure to check the colour bleed on.'
  );
  failures++;
} else if (bled / bledN > 6 * (floor.max + MARGIN)) {
  console.error(
    `\nFAIL  where the matte is empty the RGB sits ${(bled / bledN).toFixed(1)} levels off the surface beside it. VP8 subsamples chroma across that boundary into the fringe, so the empty region has to carry John's colour and not white or black.`
  );
  failures++;
}

// No hair may have been deleted: the asset's support is the master's.
let lost = 0;
for (let i = 0; i < w * h; i++) {
  if (master.data[i * c + 3] > 0 && asset.data[i * c + 3] === 0) lost++;
}
if (lost > 0) {
  console.error(
    `\nFAIL  ${lost} px the master's matte holds are empty in the asset. The solve may reshape the ramp — that is what it is for — but it may not drop a pixel out of the matte altogether, because at this scale that is a hair.`
  );
  failures++;
}

if (failures) process.exit(1);
console.log(
  `\nOne asset, correct on every ground: across the whole fringe its foreground stays within ${brightLimit.toFixed(1)} levels of the surface it belongs to in the direction a backing could push it, so it carries John and not the cyclorama.`
);
