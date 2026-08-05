/**
 * An automatic keyer for an evenly-lit backing.
 *
 * This is the machinery only — no I/O, no printing, no policy. `scripts/gen-cutouts.ts`
 * is the command that reads a file, calls `key()`, audits the numbers it returns and
 * decides whether to write anything.
 *
 * WHAT THIS IS FOR. `scripts/build-cutouts.py` produced today's two assets from a matte
 * that a person had already pulled by hand: it re-solves, de-lights and verifies that
 * matte, but it cannot make one. So the moment John replaces his photograph through the
 * CMS the pipeline stops, because its first input no longer exists. This module supplies
 * that missing first step, and takes the hand-tuned constants out of the rest: everything
 * the Python script hard-codes for HIS photograph — the backing is a flat 255, the plate
 * is 1800px wide, the garment is navy below row 960 — is either measured from the image
 * or scaled off its width here.
 *
 * It is the same physics, in the same order, and the papers are the ones cited in
 * build-cutouts.py's own docstring:
 *
 *   1. BACKING. Robust plane fit to a border band (median/MAD outlier rejection, then
 *      three IRLS rounds). A plane rather than a constant because a real backdrop falls
 *      off toward the corners, and because the plane's tilt is then a MEASURED number
 *      that can be gated on: "reasonably even" stops being a judgement.
 *
 *   2. A CRUDE KEY, to bootstrap. Distance from the backing field in sRGB levels, ramped
 *      between `keyLo` and `keyHi` multiples of the measured backing noise. Then the
 *      largest connected component with its holes filled, which is what turns a
 *      per-pixel test into a figure.
 *
 *   3. FOREGROUND PRIOR by geodesic extension (Rhemann, Rother & Gelautz, BMVC 2008,
 *      §2.1) — the colour travels THROUGH the figure, so a crevice inherits from its own
 *      surface rather than across the gap.
 *
 *   4. ALPHA, solved against the known backing: Wang & Cohen (CVPR 2007) eq. 2,
 *      alpha = (C - B)·(F - B) / ||F - B||², in linear light, with B measured rather
 *      than sampled. Where the equation cannot speak — the plate clipped at the same end
 *      the backing is, or F and B too close to tell apart from the backing's own noise —
 *      alpha falls back to ONE MONOTONE TRANSFER CURVE, fitted from the crude key to the
 *      solved alpha over the pixels where the equation DOES speak. The fraction of the
 *      fringe that needed the fallback is reported, not hidden.
 *
 *   5. FOREGROUND COLOUR, in closed form: F = (C − B(1−a)) / a. Not an estimate — the
 *      definition of unassociated alpha against a known backing. Below `directLo` the
 *      1/a noise gain makes it unusable (at a = 0.05 one level of plate noise becomes
 *      twenty in F), so there it fades to the geodesically extended interior colour,
 *      which is the right answer at 5% coverage because F is 5% of what is drawn.
 *
 *   6. GAMUT BOUND. Spill only ever pushes the observed colour TOWARD the backing, so F
 *      may not sit further along (B − F_prior) than F_prior does by more than
 *      `gamutSlack`. The component perpendicular to that direction is untouched, so
 *      detail survives. This is the general form of build-cutouts.py's one-sided
 *      luminance cap: general because a backing may be DARKER than the subject, where
 *      "spill can only brighten" is false but "spill can only pull toward B" still holds.
 *
 *   7. COLOUR BLEED. Where the matte is empty the RGB still carries the extended interior
 *      colour. VP8 is YUV 4:2:0, so the chroma of a one-pixel fringe is averaged with its
 *      neighbours whatever is put there, and that average wants the subject on the other
 *      side of it.
 *
 * WHY THIS PINS F AND NOT ALPHA, AND WHAT WENT WITH THAT. Smith & Blinn (SIGGRAPH 96)
 * show single-backing matting is underdetermined by exactly one equation, so the F/alpha
 * pair has to be pinned from outside the photograph. This file used to pin ALPHA — the
 * crude key led and F was estimated afterwards (Germer, Uelwer, Conrad & Harmeling, ICPR
 * 2020) to reproduce the plate at that coverage — and then repaired the result with an
 * inverse light wrap confined to an edge band, which is why it had to emit a light/dark
 * PAIR: an edge treatment baked for one ground is wrong on the other.
 *
 * build-cutouts.py measured all three of those and none survived. The multi-level
 * estimator left +16 to +42 levels of white backing in F, because its smoothness prior is
 * satisfied by a partly-white foreground. The de-lighting ran the fringe 24-41 levels
 * darker than John's own colour at EVERY coverage, which no shading explains. And a
 * treatment windowed on distance-from-the-silhouette is a spatial gradient in the
 * picture, so it shows up wherever anything else — the hero's circle, say — crosses it.
 * Pinning F removes all three at once: F is John's own colour by construction, alpha is
 * whatever reproduces the photograph given it, and NOTHING in the output knows what
 * ground it will sit on. Hence ONE asset, on every ground, by arithmetic: the departure
 * from a correct composite is (F − F_john)·a, which has no ground term in it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. build-cutouts.py's dichromatic subtraction on the
 * navy tee is not here, and neither is anything else that was ever a look rather than a
 * solve. Nor is the crown reconstruction of DECISIONS §11: a photograph that clips the
 * top of the head needs a person, and the only responsible thing an automatic pass can do
 * is SAY so, which it does.
 */

/** value = c + gx·xn + gy·yn, with xn, yn ∈ [-1, 1] across the frame. */
export interface Plane {
  c: number;
  gx: number;
  gy: number;
}

export interface EdgeStat {
  name: string;
  total: number;
  inliers: number;
}

export interface BackingEstimate {
  /** Per channel, the fitted plane in sRGB levels. */
  plane: Plane[];
  /** The plane at the centre of the frame — "the backing colour", 0-255. */
  centre: number[];
  /** `centre` as `#rrggbb`. */
  hex: string;
  /** Robust standard deviation of the inliers about the plane, per channel, in levels. */
  residual: number[];
  /** RMS of `residual` over the channels — the scalar the key's thresholds are cut from. */
  measuredNoise: number;
  /** `measuredNoise` after the floor is applied; this is what the key actually used. */
  noise: number;
  /** Peak-to-peak of each fitted plane across the frame, in levels. */
  tilt: number[];
  /** Border samples taken, and how many survived outlier rejection. */
  sampled: number;
  inliers: number;
  edges: EdgeStat[];
  /** Fraction of border samples with a channel at 0 or 255 — evenness is unmeasurable there. */
  clipped: number;
  /** Width of the sampled border band, px. */
  bandPx: number;
}

export interface AlphaHistogram {
  /** Ten equal bins over (0,1) exclusive, as fractions of the image. */
  bins: number[];
  transparent: number;
  opaque: number;
  partial: number;
}

/** One coverage bucket of the fringe audit; `mean` is in sRGB luminance levels. */
export interface PurityBucket {
  lo: number;
  hi: number;
  n: number;
  mean: number;
}

export interface KeyResult {
  width: number;
  height: number;
  /** Alpha, 0-255, `width * height`. */
  alpha: Uint8Array;
  /**
   * THE ONE OUTPUT: straight (unassociated) alpha whose foreground is the subject's own
   * colour at every coverage, so `rgb*a + ground*(1-a)` is right over ANY ground.
   * RGB, `width * height * 3`.
   */
  rgb: Uint8Array;
  backing: BackingEstimate;
  histogram: AlphaHistogram;
  /** Fraction of the frame the figure covers. */
  figureFraction: number;
  /** Of the partial pixels, the fraction where |B − F| is too small for the solve to speak. */
  illConditioned: number;
  /** Median |B − F| over the partial band, 0-1 in linear light. */
  medianSeparation: number;
  /** The same, in multiples of the measured backing noise — the number the gate uses. */
  medianSnr: number;
  /**
   * Of the partial pixels, the fraction where the plate is clipped at the same end the
   * backing is, so the mixture equation carries no information at all. A blown-out
   * cyclorama behind hair is mostly this, and there alpha is the fitted curve.
   */
  clippedFringe: number;
  /**
   * The fitted monotone transfer from the crude key to the solved alpha — the fallback
   * used where the equation cannot speak, and a diagnostic in its own right: it is how
   * far a distance-from-the-backing key is from a physical one on THIS photograph.
   */
  transfer: { crude: number; solved: number; n: number }[];
  /** How deep into the silhouette a pixel must be to count as interior, px of this image. */
  coreDepthPx: number;
  /**
   * THE CLAIM, MEASURED ON THE OUTPUT: departure of the delivered foreground from the
   * subject's own colour, by coverage, in sRGB luminance levels. Positive is toward the
   * backing, which is the only direction contamination can push. A correct asset is flat
   * in coverage; one with backing left in it climbs as coverage falls.
   *
   * READ THE BOTTOM BUCKET WITH CARE: below `directLo` the foreground IS the prior this
   * is measured against, so those buckets can only come out near zero and they are a
   * statement that the fade happened, not evidence about the solve. The buckets from
   * `directHi` up are the ones the closed-form solve has to answer for, and the
   * independent measurement is `scripts/check-mattes.ts`, which builds its own reference
   * from the written file's opaque pixels and never sees this one.
   */
  purity: PurityBucket[];
  /** Which frame edges the figure runs off. A clipped subject is a warning, not a failure. */
  touchesEdges: string[];
  timings: Record<string, number>;
}

export interface KeyerParams {
  /** Border band sampled for the backing, as a fraction of min(width, height). */
  borderFrac: number;
  /** MAD sigmas beyond which a border sample is not the backing. */
  outlierSigma: number;
  /** The key ramps from `keyLo` to `keyHi` multiples of the backing noise. */
  keyLo: number;
  keyHi: number;
  /** Floor on the measured backing noise, in levels. A clipped backdrop measures zero. */
  noiseFloor: number;
  /**
   * The window over which the known-backing solve is trusted, in MULTIPLES OF THE
   * MEASURED BACKING NOISE — a signal-to-noise ratio, not an absolute distance.
   *
   * It was absolute (0.3 to 0.6 in linear light) and that is a white-backdrop assumption
   * wearing a physics costume. The solve divides by |B − F|, so its error in alpha is
   * about sigma/|B − F|: what decides whether it can speak is the RATIO, and sigma is
   * measured per image. Linear light also compresses the bottom of the scale by a factor
   * of eleven, so against a dark studio wall an absolute floor of 0.3 rejects a
   * separation the equation resolves to better than a thousandth. Measured: a light
   * subject on a #222126 wall came out at 380 sigma and was refused as "the same colour
   * as the background".
   *
   * The numbers come from what the ratio MEANS. The solve's error in alpha is about
   * 1/SNR, so 20x is 5% of alpha — fully trusted — and 8x is 12.5%, which is where the
   * crude distance key is the better of two poor answers and the blend hands over to it.
   * Below 8x across most of the fringe the matte is a guess, and that is the gate.
   *
   * John's own plate sits at 65x, so nothing about his cut-out turns on the choice; a
   * mid-grey backdrop with a navy subject sits at 23x and is keyed cleanly, where the old
   * absolute window refused it outright.
   */
  sepLoSnr: number;
  sepHiSnr: number;
  /** The width the spatial constants below were measured at. Everything scales off it. */
  refWidth: number;
  /**
   * How far inside the silhouette a pixel must be before it is unambiguously interior,
   * px at `refWidth`. It is NOT an edge band and nothing is treated inside it: it seeds
   * the geodesic prior and it is the depth past which alpha is settled to 1.
   */
  coreDepth: number;
  /**
   * The coverage window over which F hands over from the extended interior colour to the
   * closed-form solve. Below `directLo` the 1/alpha gain in F = (C − B(1−a))/a turns one
   * level of plate noise into 1/a levels of foreground, so the prior carries it; above
   * `directHi` the photograph carries it on its own. Smoothstepped between.
   */
  directLo: number;
  directHi: number;
  /** How far past F_prior, along (B − F_prior), F is allowed to sit. */
  gamutSlack: number;
  /** Subsampling factor and blur schedule for the geodesic extension. */
  geoScale: number;
  geoSchedule: [number, number][];
}

export const DEFAULTS: KeyerParams = {
  borderFrac: 0.03,
  outlierSigma: 3,
  keyLo: 3,
  keyHi: 9,
  noiseFloor: 1.5,
  sepLoSnr: 8,
  sepHiSnr: 20,
  refWidth: 1800,
  coreDepth: 16,
  directLo: 0.1,
  directHi: 0.2,
  gamutSlack: 0.15,
  geoScale: 3,
  geoSchedule: [
    [3.0, 45],
    [2.0, 55],
    [1.2, 55]
  ]
};

/** Thrown for a background this keyer refuses to key. The message is the whole point. */
export class UnkeyableError extends Error {
  measured: string;
  limit: string;
  constructor(message: string, measured: string, limit: string) {
    super(message);
    this.name = 'UnkeyableError';
    this.measured = measured;
    this.limit = limit;
  }
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const LUMA = [0.2126, 0.7152, 0.0722];

/** sRGB 0-255 → linear 0-1. */
export function srgbToLinear(v: number): number {
  const x = Math.min(1, Math.max(0, v / 255));
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** linear 0-1 → sRGB 0-255. */
export function linearToSrgb(y: number): number {
  const x = Math.min(1, Math.max(0, y));
  return (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255;
}

// A 256-entry table: the transform is applied per channel per pixel several times over
// and Math.pow on 2.6 million pixels three times is measurable.
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) LIN[i] = srgbToLinear(i);

/**
 * d(linear)/d(sRGB level) at each level — how much one level of camera noise is worth in
 * the space the mixture equation is solved in. It varies by a factor of eleven across the
 * scale, which is exactly why a noise threshold expressed in linear light is really a
 * statement about how bright the backdrop is.
 */
const DLIN = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const x = i / 255;
  DLIN[i] = (x <= 0.04045 ? 1 / 12.92 : (2.4 / 1.055) * Math.pow((x + 0.055) / 1.055, 1.4)) / 255;
}

// ---------------------------------------------------------------------------
// Separable blurs, exact Euclidean distance, connected components
// ---------------------------------------------------------------------------

/**
 * Box widths whose repeated application approximates a Gaussian of this sigma.
 * Three passes; Kovesi's construction, so the result is C2 and the cost is O(n)
 * INDEPENDENT of sigma, which is what makes the geodesic extension's wide early passes
 * affordable at full frame size.
 */
function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  if (wl < 1) wl = 1;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}

/** One separable box pass with clamped ("nearest") edges. `tmp` is scratch of the same size. */
function boxPass(src: Float32Array, dst: Float32Array, tmp: Float32Array, w: number, h: number, radius: number) {
  // The running-sum update below assumes the window fits inside the image; on a tiny
  // plane (the coarse end of a pyramid, or a small self-test frame) it does not, and the
  // clamped reads would break the invariant rather than merely widen the blur.
  const r = Math.min(radius, Math.max(0, Math.min(w, h) - 1));
  if (r < 1) {
    dst.set(src);
    return;
  }
  const iarr = 1 / (r + r + 1);
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = src[row] * (r + 1);
    for (let j = 0; j < r; j++) acc += src[row + Math.min(j, w - 1)];
    for (let x = 0; x < w; x++) {
      acc += src[row + Math.min(x + r, w - 1)] - src[row + Math.max(x - r - 1, 0)];
      tmp[row + x] = acc * iarr;
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let acc = tmp[x] * (r + 1);
    for (let j = 0; j < r; j++) acc += tmp[Math.min(j, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      acc += tmp[Math.min(y + r, h - 1) * w + x] - tmp[Math.max(y - r - 1, 0) * w + x];
      dst[y * w + x] = acc * iarr;
    }
  }
}

/** Gaussian blur in place, via three box passes. */
export function gauss(plane: Float32Array, w: number, h: number, sigma: number, scratch?: Float32Array[]) {
  if (sigma <= 0) return plane;
  const a = scratch?.[0] ?? new Float32Array(w * h);
  const b = scratch?.[1] ?? new Float32Array(w * h);
  const sizes = boxesForGauss(sigma, 3);
  let src = plane;
  for (let i = 0; i < 3; i++) {
    const r = (sizes[i] - 1) / 2;
    boxPass(src, i === 2 ? plane : a, b, w, h, r);
    src = i === 2 ? plane : a;
  }
  return plane;
}

/** Felzenszwalb & Huttenlocher's exact squared EDT, one dimension. */
function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/**
 * Exact Euclidean distance from every set pixel of `mask` to the nearest unset one —
 * scipy's `distance_transform_edt(mask)`, which is what build-cutouts.py calls `D`.
 */
export function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e20;
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? INF : 0;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n + 1);
  const z = new Float64Array(n + 2);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = g[row + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) g[row + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

/** The largest 4-connected component of `mask`, with any enclosed holes filled. */
export function largestComponentFilled(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  for (let seed = 0; seed < w * h; seed++) {
    if (!mask[seed] || label[seed] >= 0) continue;
    const id = next++;
    let sp = 0;
    let size = 0;
    stack[sp++] = seed;
    label[seed] = id;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && label[p - 1] < 0) (label[p - 1] = id), (stack[sp++] = p - 1);
      if (x < w - 1 && mask[p + 1] && label[p + 1] < 0) (label[p + 1] = id), (stack[sp++] = p + 1);
      if (y > 0 && mask[p - w] && label[p - w] < 0) (label[p - w] = id), (stack[sp++] = p - w);
      if (y < h - 1 && mask[p + w] && label[p + w] < 0) (label[p + w] = id), (stack[sp++] = p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }
  const out = new Uint8Array(w * h);
  if (best < 0) return out;
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;

  // Holes: flood the complement inward from the frame. Whatever the flood cannot reach
  // is enclosed by the figure and belongs to it — a gap between an arm and a body that
  // genuinely shows backdrop is NOT enclosed, so it survives.
  const seen = new Uint8Array(w * h);
  let sp = 0;
  const push = (p: number) => {
    if (!out[p] && !seen[p]) {
      seen[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  for (let i = 0; i < w * h; i++) if (!out[i] && !seen[i]) out[i] = 1;
  return out;
}

/**
 * Diffuse `vals` outward from `known` across `mask` by normalised convolution — the
 * geodesic extension of Rhemann et al. (BMVC 2008, §2.1), ported from
 * build-cutouts.py's `_geodesic_extend`.
 *
 * Geodesic, not Euclidean: the value travels THROUGH the mask, so a pixel in the
 * ear/skull crevice inherits from its own surface and not from the bright cheek on the
 * far side of the gap. Run on a subsampled grid because it is the most expensive thing
 * here by a wide margin, and the field it produces is low-frequency by construction.
 */
export function geodesicExtend(
  vals: Float32Array,
  channels: number,
  known: Uint8Array,
  mask: Uint8Array,
  w: number,
  h: number,
  scale: number,
  schedule: [number, number][]
): { data: Float32Array; valid: Float32Array } {
  const sw = Math.ceil(w / scale);
  const sh = Math.ceil(h / scale);
  const n = sw * sh;
  const k = new Float32Array(n);
  const mk = new Float32Array(n);
  const src: Float32Array[] = [];
  const cur: Float32Array[] = [];
  // One extra channel, a constant 1 diffused from exactly the same seeds: it comes back
  // as the fraction of the field that actually reached each pixel. Without it a cell the
  // diffusion never got to reads as a legitimate ZERO, and downstream that is not a
  // missing value, it is a black one. On a subsampled grid whole cells along a thin
  // silhouette can miss the mask, so this is not a corner case: a black F_prior there
  // would put |B − F| at its maximum, which is the solve's most CONFIDENT state, and the
  // one place it has no business being confident.
  const total = channels + 1;
  for (let c = 0; c < total; c++) {
    src.push(new Float32Array(n));
    cur.push(new Float32Array(n));
  }
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const p = Math.min(y * scale, h - 1) * w + Math.min(x * scale, w - 1);
      const q = y * sw + x;
      k[q] = known[p] ? 1 : 0;
      mk[q] = mask[p] ? 1 : 0;
      for (let c = 0; c < channels; c++) {
        src[c][q] = vals[p * channels + c];
        cur[c][q] = k[q] * src[c][q];
      }
      src[channels][q] = 1;
      cur[channels][q] = k[q];
    }
  }

  const s0 = new Float32Array(n);
  const s1 = new Float32Array(n);
  const acc = new Float32Array(n);
  for (const [sigma, iters] of schedule) {
    // The mask never changes, so its blur is the same every iteration. build-cutouts.py
    // recomputes it inside the loop; hoisting is exact and saves a quarter of the work.
    const wgt = Float32Array.from(mk);
    gauss(wgt, sw, sh, sigma, [s0, s1]);
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < total; c++) {
        const cc = cur[c];
        const ss = src[c];
        for (let i = 0; i < n; i++) acc[i] = cc[i] * mk[i];
        gauss(acc, sw, sh, sigma, [s0, s1]);
        for (let i = 0; i < n; i++) cc[i] = k[i] > 0.5 ? ss[i] : acc[i] / Math.max(wgt[i], 1e-12);
      }
    }
  }

  // Bilinear back up to full resolution, un-doing the validity weighting as we go so the
  // value returned is the field itself and `valid` is the confidence in it.
  const out = new Float32Array(w * h * channels);
  const valid = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(y / scale, sh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(x / scale, sw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, sw - 1);
      const tx = fx - x0;
      const i = (y * w + x) * channels;
      const lerp = (cc: Float32Array) => {
        const a = cc[y0 * sw + x0] * (1 - tx) + cc[y0 * sw + x1] * tx;
        const b = cc[y1 * sw + x0] * (1 - tx) + cc[y1 * sw + x1] * tx;
        return a * (1 - ty) + b * ty;
      };
      const v = lerp(cur[channels]);
      valid[y * w + x] = v;
      for (let c = 0; c < channels; c++) out[i + c] = lerp(cur[c]) / Math.max(v, 1e-6);
    }
  }
  return { data: out, valid };
}

// ---------------------------------------------------------------------------
// 1. The backing
// ---------------------------------------------------------------------------

function median(v: ArrayLike<number>, n: number): number {
  if (n <= 0) return 0;
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = v[i];
  a.sort(); // typed-array sort is numeric, and an order of magnitude faster than a comparator
  return a[n >> 1];
}

/** Solve a symmetric 3×3 system by Gaussian elimination with partial pivoting. */
function solve3(m: number[][], b: number[]): number[] {
  const a = m.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    [a[c], a[piv]] = [a[piv], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) return [b[0], 0, 0];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j < 4; j++) a[r][j] -= f * a[c][j];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/**
 * Estimate the backing from the image itself: sample a border band, throw out anything
 * the median/MAD says is not the backing, then fit a plane per channel and re-reject
 * against the fit, three rounds.
 *
 * A plane and not a constant, for two reasons. It is the honest model of a real backdrop,
 * which is brighter where the light is; and its tilt is then a number a human can look at
 * and a gate can refuse, which "reasonably even" on its own is not.
 */
export function estimateBacking(rgb: Uint8Array, w: number, h: number, p: KeyerParams): BackingEstimate {
  const bandPx = Math.max(2, Math.round(Math.min(w, h) * p.borderFrac));
  const idx: number[] = [];
  const edgeOf: number[] = [];
  for (let y = 0; y < h; y++) {
    const topBand = y < bandPx;
    const botBand = y >= h - bandPx;
    for (let x = 0; x < w; x++) {
      const leftBand = x < bandPx;
      const rightBand = x >= w - bandPx;
      if (!topBand && !botBand && !leftBand && !rightBand) {
        x = w - bandPx - 1; // skip the interior of the row in one jump
        continue;
      }
      idx.push(y * w + x);
      edgeOf.push(topBand ? 0 : botBand ? 1 : leftBand ? 2 : 3);
    }
  }
  const n = idx.length;
  const keep = new Uint8Array(n).fill(1);

  // Round 0: median / MAD, which needs no model and survives an arbitrary amount of
  // subject in the band (John's shoulders fill the whole bottom edge of his plate).
  const med: number[] = [];
  const sig: number[] = [];
  for (let c = 0; c < 3; c++) {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = rgb[idx[i] * 3 + c];
    const m = median(v, n);
    const dev = new Float64Array(n);
    for (let i = 0; i < n; i++) dev[i] = Math.abs(v[i] - m);
    med.push(m);
    sig.push(Math.max(0.5, 1.4826 * median(dev, n)));
  }
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      if (Math.abs(rgb[idx[i] * 3 + c] - med[c]) > p.outlierSigma * sig[c]) keep[i] = 0;
    }
  }

  // Rounds 1-3: fit the plane on the survivors, re-reject against the fit.
  const planes: Plane[] = [{ c: med[0], gx: 0, gy: 0 }, { c: med[1], gx: 0, gy: 0 }, { c: med[2], gx: 0, gy: 0 }];
  const resid = [0, 0, 0];
  const xn = (i: number) => ((idx[i] % w) / (w - 1)) * 2 - 1;
  const yn = (i: number) => (Math.floor(idx[i] / w) / (h - 1)) * 2 - 1;
  for (let round = 0; round < 3; round++) {
    for (let c = 0; c < 3; c++) {
      let s00 = 0, s01 = 0, s02 = 0, s11 = 0, s12 = 0, s22 = 0, t0 = 0, t1 = 0, t2 = 0;
      for (let i = 0; i < n; i++) {
        if (!keep[i]) continue;
        const X = xn(i);
        const Y = yn(i);
        const v = rgb[idx[i] * 3 + c];
        s00 += 1; s01 += X; s02 += Y; s11 += X * X; s12 += X * Y; s22 += Y * Y;
        t0 += v; t1 += v * X; t2 += v * Y;
      }
      if (s00 < 16) continue;
      const [c0, gx, gy] = solve3(
        [
          [s00, s01, s02],
          [s01, s11, s12],
          [s02, s12, s22]
        ],
        [t0, t1, t2]
      );
      planes[c] = { c: c0, gx, gy };
    }
    // Robust residual sigma, then re-reject.
    for (let c = 0; c < 3; c++) {
      const dev: number[] = [];
      for (let i = 0; i < n; i++) {
        if (!keep[i]) continue;
        const fit = planes[c].c + planes[c].gx * xn(i) + planes[c].gy * yn(i);
        dev.push(Math.abs(rgb[idx[i] * 3 + c] - fit));
      }
      resid[c] = dev.length ? Math.max(0, 1.4826 * median(dev, dev.length)) : 0;
    }
    if (round === 2) break;
    for (let i = 0; i < n; i++) {
      if (!keep[i]) continue;
      for (let c = 0; c < 3; c++) {
        const fit = planes[c].c + planes[c].gx * xn(i) + planes[c].gy * yn(i);
        if (Math.abs(rgb[idx[i] * 3 + c] - fit) > p.outlierSigma * Math.max(resid[c], 0.5)) keep[i] = 0;
      }
    }
  }

  const edges: EdgeStat[] = ['top', 'bottom', 'left', 'right'].map((name) => ({ name, total: 0, inliers: 0 }));
  let inliers = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    edges[edgeOf[i]].total++;
    if (keep[i]) {
      edges[edgeOf[i]].inliers++;
      inliers++;
      const j = idx[i] * 3;
      if (rgb[j] >= 255 || rgb[j + 1] >= 255 || rgb[j + 2] >= 255 || rgb[j] === 0 || rgb[j + 1] === 0 || rgb[j + 2] === 0) {
        clipped++;
      }
    }
  }

  const centre = planes.map((pl) => Math.min(255, Math.max(0, pl.c)));
  const tilt = planes.map((pl) => 2 * (Math.abs(pl.gx) + Math.abs(pl.gy)));
  const measuredNoise = Math.sqrt((resid[0] * resid[0] + resid[1] * resid[1] + resid[2] * resid[2]) / 3);
  const hex =
    '#' + centre.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  return {
    plane: planes,
    centre,
    hex,
    residual: resid,
    measuredNoise,
    noise: Math.max(measuredNoise, p.noiseFloor),
    tilt,
    sampled: n,
    inliers,
    edges,
    clipped: inliers ? clipped / inliers : 0,
    bandPx
  };
}

// ---------------------------------------------------------------------------
// The keyer
// ---------------------------------------------------------------------------

/**
 * Key `rgb` (w×h, 3 channels, sRGB bytes) against a backing estimated from its own
 * border, and return ONE straight-alpha asset that is correct on every ground.
 *
 * Throws `UnkeyableError` for a background it will not key. That is the point of the
 * exercise: a keyer that quietly emits a bad matte costs more than one that stops.
 */
export function key(rgb: Uint8Array, w: number, h: number, params?: Partial<KeyerParams>): KeyResult {
  const p: KeyerParams = { ...DEFAULTS, ...params };
  const n = w * h;
  const timings: Record<string, number> = {};
  const clock = <T>(name: string, fn: () => T): T => {
    const t = Date.now();
    const r = fn();
    timings[name] = Date.now() - t;
    return r;
  };

  // -- 1. the backing ------------------------------------------------------------
  const backing = clock('backing', () => estimateBacking(rgb, w, h, p));

  // The three gates that belong to the BACKING rather than to the key, checked before a
  // second of work is spent on an image that cannot be keyed. Each carries the number it
  // measured and the limit it failed, because "too uneven" on its own helps nobody.
  const backingVisible = backing.inliers / backing.sampled;
  if (backingVisible < 0.2) {
    throw new UnkeyableError(
      'The background is not visible enough around the edge of the frame to be measured. ' +
        'Either the subject runs off most of the border, or the background is not one colour. ' +
        'Shoot with more space around the subject, or against a plainer backing.',
      `${(100 * backingVisible).toFixed(1)}% of the border band is background`,
      'at least 20%'
    );
  }
  const usableEdges = backing.edges.filter((e) => e.inliers / Math.max(e.total, 1) >= 0.3);
  if (usableEdges.length < 2) {
    throw new UnkeyableError(
      `The background is only clear on ${usableEdges.length} of the four frame edges, so its ` +
        'evenness cannot be measured in both directions. Leave background visible on at ' +
        'least two edges.',
      backing.edges.map((e) => `${e.name} ${(100 * e.inliers / Math.max(e.total, 1)).toFixed(0)}%`).join(', '),
      'at least two edges ≥ 30%'
    );
  }
  if (backing.measuredNoise > 6) {
    throw new UnkeyableError(
      'The background is too uneven to key: what is left after fitting a smooth gradient to it ' +
        'is noise or texture, and a keyer cannot tell that from the subject. Use a plain, ' +
        'evenly lit backdrop, or a lower ISO.',
      `${backing.measuredNoise.toFixed(2)} levels of residual (per channel: ${backing.residual.map((r) => r.toFixed(2)).join(', ')})`,
      'at most 6.00 levels'
    );
  }
  const maxTilt = Math.max(...backing.tilt);
  if (maxTilt > 28) {
    throw new UnkeyableError(
      'The background brightness varies too much across the frame — one side is lit and the ' +
        'other is not. Light the backdrop evenly, or move the subject further from it.',
      `${maxTilt.toFixed(1)} levels across the frame (per channel: ${backing.tilt.map((t) => t.toFixed(1)).join(', ')})`,
      'at most 28.0 levels'
    );
  }

  // The backing field B(x,y), and the plate, both in linear light.
  const Blin = new Float32Array(n * 3);
  const Bsrgb = new Float32Array(n * 3);
  const Ilin = new Float32Array(n * 3);
  clock('fields', () => {
    for (let y = 0; y < h; y++) {
      const Y = (y / (h - 1)) * 2 - 1;
      for (let x = 0; x < w; x++) {
        const X = (x / (w - 1)) * 2 - 1;
        const i = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) {
          const v = Math.min(255, Math.max(0, backing.plane[c].c + backing.plane[c].gx * X + backing.plane[c].gy * Y));
          Bsrgb[i + c] = v;
          Blin[i + c] = srgbToLinear(v);
          Ilin[i + c] = LIN[rgb[i + c]];
        }
      }
    }
  });

  // -- 2. the crude key, to bootstrap ---------------------------------------------
  // Distance from the backing field in sRGB levels, ramped between multiples of the
  // measured backing noise. Nothing is hard-coded: on a clipped backdrop the noise floor
  // is what sets the threshold, and that substitution is reported.
  const t0 = p.keyLo * backing.noise;
  const t1 = Math.max(t0 + 2, p.keyHi * backing.noise);
  const alpha0 = new Float32Array(n);
  clock('crude', () => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const dr = rgb[j] - Bsrgb[j];
      const dg = rgb[j + 1] - Bsrgb[j + 1];
      const db = rgb[j + 2] - Bsrgb[j + 2];
      const d = Math.sqrt((dr * dr + dg * dg + db * db) / 3);
      alpha0[i] = Math.min(1, Math.max(0, (d - t0) / (t1 - t0)));
    }
  });

  const seed = new Uint8Array(n);
  for (let i = 0; i < n; i++) seed[i] = alpha0[i] > 0.5 ? 1 : 0;
  const figure = clock('components', () => largestComponentFilled(seed, w, h));
  let figureCount = 0;
  for (let i = 0; i < n; i++) figureCount += figure[i];
  const figureFraction = figureCount / n;
  if (figureFraction < 0.01) {
    throw new UnkeyableError(
      'No subject found: almost the whole frame matches the background. Either the photograph ' +
        'is of the backdrop, or the subject is the same colour as it.',
      `the figure covers ${(100 * figureFraction).toFixed(2)}% of the frame`,
      'at least 1.00%'
    );
  }
  if (figureFraction > 0.9) {
    throw new UnkeyableError(
      'Almost the whole frame keys as subject, so there is no background to key against. The ' +
        'border the backing was measured from is probably subject too.',
      `the figure covers ${(100 * figureFraction).toFixed(1)}% of the frame`,
      'at most 90.0%'
    );
  }

  const D = clock('edt', () => distanceTransform(figure, w, h));
  const touchesEdges: string[] = [];
  {
    const any = (test: (x: number, y: number) => boolean, count: number) => {
      let hits = 0;
      for (let k = 0; k < count; k++) if (test(k, 0)) hits++;
      return hits;
    };
    if (any((x) => !!figure[x], w) > w * 0.01) touchesEdges.push('top');
    if (any((x) => !!figure[(h - 1) * w + x], w) > w * 0.01) touchesEdges.push('bottom');
    if (any((y) => !!figure[y * w], h) > h * 0.01) touchesEdges.push('left');
    if (any((y) => !!figure[y * w + w - 1], h) > h * 0.01) touchesEdges.push('right');
  }

  // -- 3 and 4, twice ---------------------------------------------------------------
  // The prior and the solve feed each other, so they are run as two passes.
  //
  // Pass one has to bootstrap from the crude key, and the crude key is a SILHOUETTE
  // detector, not an alpha estimate: its ramp is cut from the backing's noise, so on a
  // subject that separates strongly it saturates at a true alpha of a few per cent.
  // Seeding the prior from "alpha0 > 0.98" therefore samples pixels that are mostly
  // BACKING, the prior is pulled toward B, and the solve — which divides by |B − F| —
  // over-reads alpha by exactly the factor the prior was pulled. Measured on John's
  // plate: the crude key's 0.95 bin corresponds to a solved alpha of 0.19.
  //
  // So pass one seeds geometrically, from pixels a real distance INSIDE the silhouette,
  // and pass two re-seeds from what pass one actually called opaque. Nothing is dialled;
  // the second seed is the first pass's own answer.
  const region = new Uint8Array(n);
  for (let i = 0; i < n; i++) region[i] = figure[i] || alpha0[i] > 0.005 ? 1 : 0;
  const corePx = (p.coreDepth * w) / p.refWidth;
  const plateF = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) plateF[i] = rgb[i];

  const alpha = new Float32Array(n);
  const conf = new Float32Array(n);
  const sepArr = new Float32Array(n);
  const snrArr = new Float32Array(n);
  const alsArr = new Float32Array(n);
  const clipArr = new Uint8Array(n);
  /** The diffused interior colour as the extension actually left it, for the colour bleed. */
  let Fgeo = new Float32Array(n * 3);
  /** Where the prior is the subject's own colour rather than the substituted backing. */
  const priorOk = new Uint8Array(n);
  let transfer: { crude: number; solved: number; n: number }[] = [];
  // The measured backing noise, carried into linear light at each pixel's own backing
  // level: RMS over the channels, because `sep` is an RMS over the channels too.
  const sigLin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < 3; c++) {
      const d = backing.noise * DLIN[Math.min(255, Math.max(0, Math.round(Bsrgb[i * 3 + c])))];
      s += d * d;
    }
    sigLin[i] = Math.sqrt(s / 3);
  }
  let Fprior = new Float32Array(n * 3);
  let Fplin = new Float32Array(n * 3);

  const pass = (known: Uint8Array, tag: string) => {
    let knownCount = 0;
    for (let i = 0; i < n; i++) knownCount += known[i];
    if (knownCount < 64) {
      throw new UnkeyableError(
        'The subject never separates cleanly from the background: there is no region the key ' +
          'can call solidly opaque, so there is nothing to extend a foreground colour from.',
        `${knownCount} pixels are unambiguously subject`,
        'at least 64'
      );
    }
    const geoF = clock(tag, () => geodesicExtend(plateF, 3, known, region, w, h, p.geoScale, p.geoSchedule));
    Fgeo = new Float32Array(geoF.data);
    Fprior = geoF.data;
    // Where nothing was diffused — outside the region, or a cell the subsampled grid
    // never reached — hand the pixel the backing itself. |B − F| is then zero, the solve
    // is unconditioned there by construction, and the crude key speaks instead of a
    // fabricated colour. Never a silent zero.
    for (let i = 0; i < n; i++) {
      priorOk[i] = region[i] && geoF.valid[i] >= 0.25 ? 1 : 0;
      if (!priorOk[i]) {
        for (let c = 0; c < 3; c++) Fprior[i * 3 + c] = Bsrgb[i * 3 + c];
      }
      // A far weaker test for the COLOUR BLEED, which is cosmetic rather than load-
      // bearing: any diffusion at all reached here, so the value is the subject's colour
      // carried outward rather than an artefact. It only has to hold for the few pixels
      // just outside the matte, which is where 4:2:0 averages chroma across the boundary.
      if (geoF.valid[i] < 0.02) {
        for (let c = 0; c < 3; c++) Fgeo[i * 3 + c] = Bsrgb[i * 3 + c];
      }
    }
    // Linear light once, not four times: srgbToLinear is a Math.pow and this is 7.8M.
    Fplin = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) Fplin[i] = srgbToLinear(Fprior[i]);

    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let num = 0;
      let den = 0;
      let clip = 0;
      for (let c = 0; c < 3; c++) {
        const B = Blin[j + c];
        const F = Fplin[j + c];
        const C = Ilin[j + c];
        const dF = B - F;
        num += (B - C) * dF;
        den += dF * dF;
        // Where the plate is clipped at the same end the backing is, the mixture
        // equation carries no information at all: 255 over 255 could be any alpha.
        const v = rgb[j + c];
        if ((v >= 254 && Bsrgb[j + c] >= 250) || (v <= 1 && Bsrgb[j + c] <= 5)) clip = 1;
      }
      const als = Math.min(1, Math.max(0, num / Math.max(den, 1e-9)));
      const sep = Math.sqrt(den / 3);
      alsArr[i] = als;
      sepArr[i] = sep;
      // |B − F| against the noise it has to be told apart from, at THIS pixel's backing
      // level. sigLin is the same measured noise in every case; what changes down the
      // scale is what one level of it is worth in linear light.
      const snr = sep / Math.max(sigLin[i], 1e-9);
      snrArr[i] = snr;
      clipArr[i] = clip;
      conf[i] = Math.min(1, Math.max(0, (snr - p.sepLoSnr) / (p.sepHiSnr - p.sepLoSnr))) * (1 - clip);
    }

    // THE FALLBACK, for the pixels where the equation cannot speak: ONE monotone transfer
    // curve from the crude key to the solved alpha, fitted from the pixels where it CAN.
    //
    // Not a blend back to the crude key, which is what this used to do and which is a
    // scale error rather than a compromise. The crude key is a distance from the backing
    // ramped over the backing's NOISE, so on a subject that separates strongly it is
    // saturated at a true alpha of a few per cent: measured on John's plate, its 0.95 bin
    // is a solved alpha of 0.13. Handing those pixels 0.95 makes the fringe seven times
    // too opaque exactly where the photograph stopped being able to say otherwise — over
    // blown-out cyclorama behind hair, which is where it matters most. The curve puts the
    // crude key on the solve's own scale first, which is the only thing it is good for.
    //
    // Fitted on the crude ramp only, 0 < alpha0 < 1: alpha0 = 1 is a silhouette statement
    // and not a coverage, so including it would anchor the top of the curve at a value the
    // solve never agreed to. Monotone by cumulative maximum, anchored at the origin, and
    // held flat past the last populated bin.
    {
      const BINS = 32;
      const buckets: number[][] = Array.from({ length: BINS }, () => []);
      const counts = new Array(BINS).fill(0);
      for (let i = 0; i < n; i++) {
        if (conf[i] <= 0.5 || alpha0[i] <= 0 || alpha0[i] >= 1) continue;
        const b = Math.min(BINS - 1, Math.floor(alpha0[i] * BINS));
        counts[b]++;
        if (buckets[b].length < 50000) buckets[b].push(alsArr[i]);
      }
      transfer = [];
      let run = 0;
      for (let b = 0; b < BINS; b++) {
        if (counts[b] < 60) continue;
        run = Math.max(run, Math.min(1, median(buckets[b], buckets[b].length)));
        transfer.push({ crude: (b + 0.5) / BINS, solved: run, n: counts[b] });
      }
    }
    const curve = (x: number): number => {
      if (transfer.length === 0) return x; // nothing to fit from; the crude key is all there is
      if (x <= 0) return 0;
      if (x <= transfer[0].crude) return (x / transfer[0].crude) * transfer[0].solved;
      for (let k = 1; k < transfer.length; k++) {
        if (x <= transfer[k].crude) {
          const t = (x - transfer[k - 1].crude) / (transfer[k].crude - transfer[k - 1].crude);
          return transfer[k - 1].solved + t * (transfer[k].solved - transfer[k - 1].solved);
        }
      }
      return transfer[transfer.length - 1].solved;
    };
    for (let i = 0; i < n; i++) {
      alpha[i] = conf[i] >= 1 ? alsArr[i] : conf[i] * alsArr[i] + (1 - conf[i]) * curve(alpha0[i]);
    }

    // Settle the two ends. Deep inside the figure AND saturated on the crude key, the
    // answer is not in doubt and a stray 0.99 would only cost bytes and put a hint of the
    // ground through his shoulder. BOTH conditions, deliberately: a genuinely soft edge
    // wider than `coreDepth` keeps alpha0 < 1, so nothing hardens it.
    for (let i = 0; i < n; i++) {
      if (figure[i] && D[i] > corePx && alpha0[i] >= 1) alpha[i] = 1;
      else if (!figure[i] && alpha0[i] <= 0) alpha[i] = 0;
      if (alpha[i] < 1 / 510) alpha[i] = 0;
      // THE SUPPORT IS AN INVARIANT (build-cutouts.py makes the same one against its
      // master): the solve may reshape the ramp, which is what it is for, but it may not
      // empty a pixel the figure holds. At this scale a dropped pixel is a hair.
      if (figure[i] && alpha[i] < 6 / 255) alpha[i] = 6 / 255;
    }
  };

  const seed1 = new Uint8Array(n);
  const seedDepth = Math.max(2, ((p.coreDepth * w) / p.refWidth) * 0.5);
  for (let i = 0; i < n; i++) seed1[i] = figure[i] && D[i] >= seedDepth ? 1 : 0;
  pass(seed1, 'geo-fprior-1');

  const seed2 = new Uint8Array(n);
  for (let i = 0; i < n; i++) seed2[i] = alpha[i] > 0.99 && D[i] >= 1 ? 1 : 0;
  pass(seed2, 'geo-fprior-2');

  // How much of the fringe the known-backing solve could not speak for. This is the
  // number that tells a human the key is guessing — white hair on a white cyclorama.
  let bandCount = 0;
  let illCount = 0;
  let clipCount = 0;
  const seps: number[] = [];
  const snrs: number[] = [];
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 0.02 && alpha[i] < 0.98) {
      bandCount++;
      if (clipArr[i]) clipCount++;
      // conf is zero exactly when the separation is below `sepLoSnr` (or when the plate
      // is clipped at the same end the backing is, where the mixture equation carries no
      // information at all). Counting at conf < 0.5 instead would be counting a DIFFERENT
      // threshold from the one the failure message quotes, which is how a gate stops
      // meaning what it says.
      if (conf[i] <= 0) illCount++;
      if (seps.length < 200000) {
        seps.push(sepArr[i]);
        snrs.push(snrArr[i]);
      }
    }
  }
  const illConditioned = bandCount ? illCount / bandCount : 0;
  const clippedFringe = bandCount ? clipCount / bandCount : 0;
  const medianSeparation = seps.length ? median(seps, seps.length) : 0;
  const medianSnr = snrs.length ? median(snrs, snrs.length) : 0;
  if (illConditioned > 0.5 && bandCount > 1000) {
    throw new UnkeyableError(
      'Over half the soft edge is too close in colour to the background to tell apart from ' +
        'the noise in it, so the matte there is a guess rather than a measurement. A ' +
        'single-backing key cannot recover it — change the backdrop to something the subject ' +
        'is not wearing, or shoot it cleaner.',
      `${(100 * illConditioned).toFixed(1)}% of the soft edge is below ${p.sepLoSnr}x the measured ` +
        `backing noise (median ${medianSnr.toFixed(0)}x)`,
      `at most 50.0% below ${p.sepLoSnr}x`
    );
  }

  // The alpha histogram, on the whole frame.
  const histBins = new Array(10).fill(0);
  let transparent = 0;
  let opaque = 0;
  for (let i = 0; i < n; i++) {
    const a = alpha[i];
    if (a <= 0) transparent++;
    else if (a >= 1) opaque++;
    else histBins[Math.min(9, Math.floor(a * 10))]++;
  }
  const partial = (n - transparent - opaque) / n;
  const histogram: AlphaHistogram = {
    bins: histBins.map((b) => b / n),
    transparent: transparent / n,
    opaque: opaque / n,
    partial
  };
  if (partial > 0.12) {
    throw new UnkeyableError(
      'The key came out as mush: far too much of the frame is neither subject nor background. ' +
        'That is what an uneven or textured backdrop looks like after keying.',
      `${(100 * partial).toFixed(2)}% of the frame is partially transparent`,
      'at most 12.00%'
    );
  }

  // -- 5. the foreground, in closed form at that alpha -----------------------------
  //
  // F = (C − B(1−a)) / a is not an estimate. It is the definition of unassociated alpha
  // against a known backing, and with alpha already solved from a foreground prior that
  // is the subject's own colour, it returns that colour — build-cutouts.py measures the
  // round trip at within 1.5 levels at every coverage.
  //
  // Two places it cannot be trusted, both measured per pixel rather than assumed. The
  // divide by alpha turns one level of plate noise into 1/a levels of F, so below
  // `directLo` the prior carries it instead; and where the equation carried no
  // information for alpha either (`conf`), it carries none for F, so the prior carries
  // that too. At 5% coverage F is 5% of what is drawn, which is why the smooth prior is
  // the right answer there rather than a concession.
  const F = new Float32Array(n * 3);
  clock('foreground', () => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const a = alpha[i];
      const t = Math.min(1, Math.max(0, (a - p.directLo) / Math.max(p.directHi - p.directLo, 1e-6)));
      const wF = a >= 0.995 ? 1 : conf[i] * (t * t * (3 - 2 * t));
      const ia = 1 / Math.max(a, 1e-6);
      for (let c = 0; c < 3; c++) {
        const direct = (Ilin[j + c] - Blin[j + c] * (1 - a)) * ia;
        F[j + c] = Math.min(1, Math.max(0, wF * direct + (1 - wF) * Fplin[j + c]));
      }
    }
  });

  // -- 6. the gamut bound ----------------------------------------------------------
  clock('gamut', () => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      // Fully opaque pixels ARE the plate; nothing was mixed into them and nothing may
      // be estimated for them.
      if (alpha[i] >= 0.995) {
        F[j] = Ilin[j];
        F[j + 1] = Ilin[j + 1];
        F[j + 2] = Ilin[j + 2];
        continue;
      }
      if (alpha[i] <= 0) continue;
      // Spill only ever pushes the observed colour TOWARD the backing, so F may not sit
      // further along (B − F_prior) than F_prior does, plus a little slack. The component
      // perpendicular to that direction is left alone, so fabric and hair detail survive.
      let dot = 0;
      let len = 0;
      for (let c = 0; c < 3; c++) {
        const d = Blin[j + c] - Fplin[j + c];
        dot += (F[j + c] - Fplin[j + c]) * d;
        len += d * d;
      }
      if (len < 1e-6) continue;
      const t = dot / len;
      if (t <= p.gamutSlack) continue;
      const excess = t - p.gamutSlack;
      for (let c = 0; c < 3; c++) {
        F[j + c] = Math.min(1, Math.max(0, F[j + c] - excess * (Blin[j + c] - Fplin[j + c])));
      }
    }
  });

  // -- 7. the output, and the audit of it ------------------------------------------
  //
  // ONE asset. There is no second treatment and no ground-dependent term anywhere above:
  // the inverse light wrap that used to live here, and the light/dark pair it forced, are
  // both gone. The cyclorama's real rim light stays on the subject, because it is light
  // that really fell on him and a straight-alpha asset's job is to carry the subject, not
  // to relight him. What is removed is the backing showing THROUGH him, which is the part
  // that was never his.
  const out = new Uint8Array(n * 3);
  const alphaOut = new Uint8Array(n);
  clock('encode', () => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const empty = alpha[i] <= 0;
      for (let c = 0; c < 3; c++) {
        // COLOUR BLEED: where the matte is empty the RGB still carries the extended
        // interior colour, because VP8 subsamples chroma across the boundary into the
        // fringe whatever is put there, and both averages want the subject.
        const v = empty ? Fgeo[j + c] : linearToSrgb(F[j + c]);
        out[j + c] = Math.round(Math.min(255, Math.max(0, v)));
      }
      alphaOut[i] = Math.round(Math.min(1, Math.max(0, alpha[i])) * 255);
    }
  });

  // The geodesic field is the right colour for the empty region, but it does not reach
  // everywhere: it is diffused on a subsampled grid across a mask that hugs the subject,
  // so a few pixels' width out it runs out of support and the fallback there is the
  // BACKING — measured, 21% of the empty pixels within four of the matte came out at the
  // white cyclorama, and white chroma subsampled back into a dark fringe is the exact
  // defect this file exists to remove. So the delivered colour is carried outward from
  // the matte itself, one ring at a time, for as far as 4:2:0 and the browser's downscale
  // can reach: the mean of whatever neighbours are already filled. Beyond that the
  // geodesic field stands, because nothing that far out is averaged into anything.
  clock('bleed', () => {
    const rings = Math.max(4, Math.round((6 * w) / p.refWidth));
    const filled = new Uint8Array(n);
    for (let i = 0; i < n; i++) filled[i] = alpha[i] > 0 ? 1 : 0;
    const gained: number[] = [];
    const acc = new Float64Array(4);
    for (let r = 0; r < rings; r++) {
      gained.length = 0;
      const vals: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (filled[i]) continue;
          acc[0] = acc[1] = acc[2] = acc[3] = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= w) continue;
              const j = yy * w + xx;
              if (!filled[j]) continue;
              acc[0] += out[j * 3];
              acc[1] += out[j * 3 + 1];
              acc[2] += out[j * 3 + 2];
              acc[3]++;
            }
          }
          if (acc[3] === 0) continue;
          gained.push(i);
          vals.push(acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]);
        }
      }
      if (gained.length === 0) break;
      for (let k = 0; k < gained.length; k++) {
        const i = gained[k];
        for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(vals[k * 3 + c]);
        filled[i] = 1;
      }
    }
  });

  // THE CLAIM, MEASURED ON WHAT IS ABOUT TO BE WRITTEN. The delivered foreground against
  // the subject's own colour, in sRGB luminance, by coverage. This is the same audit
  // `scripts/check-mattes.ts` runs on the shipped file and `_verify_solid_matte` runs in
  // build-cutouts.py, done here so a keying reports its own quality rather than waiting
  // for a gate to find out. Only where the prior is really the subject's colour: where it
  // was substituted with the backing the comparison has no reference to make.
  const PB: [number, number][] = [
    [0.02, 0.06],
    [0.06, 0.12],
    [0.12, 0.2],
    [0.2, 0.35],
    [0.35, 0.55],
    [0.55, 0.8],
    [0.8, 0.98]
  ];
  const purity: PurityBucket[] = PB.map(([lo, hi]) => ({ lo, hi, n: 0, mean: 0 }));
  for (let i = 0; i < n; i++) {
    const a = alpha[i];
    if (a <= 0.02 || a >= 0.98 || !priorOk[i]) continue;
    const k = PB.findIndex(([lo, hi]) => a >= lo && a < hi);
    if (k < 0) continue;
    const j = i * 3;
    const got = LUMA[0] * out[j] + LUMA[1] * out[j + 1] + LUMA[2] * out[j + 2];
    const want = LUMA[0] * Fprior[j] + LUMA[1] * Fprior[j + 1] + LUMA[2] * Fprior[j + 2];
    purity[k].n++;
    purity[k].mean += got - want;
  }
  for (const b of purity) if (b.n) b.mean /= b.n;

  return {
    width: w,
    height: h,
    alpha: alphaOut,
    rgb: out,
    backing,
    histogram,
    figureFraction,
    illConditioned,
    medianSeparation,
    medianSnr,
    clippedFringe,
    transfer,
    coreDepthPx: corePx,
    purity,
    touchesEdges,
    timings
  };
}
