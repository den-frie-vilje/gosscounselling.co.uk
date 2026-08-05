/**
 * The two cutouts must differ only at their EDGE.
 *
 *     pkgx node scripts/check-mattes.ts
 *
 * The hero composites both at once: a circular sand plate carries the plain
 * knockout inside it, and the keyed matte shows outside it on the deep band,
 * partitioned by complementary CSS masks. They are the same photograph at the
 * same size, so the join has to be invisible.
 *
 * It is invisible only if the two agree everywhere the circle's edge can
 * cross, which is everywhere except the silhouette's own outline. The keyed
 * variant is allowed, and required, to differ within a few pixels of that
 * outline: the colour edge-extend, the matte choke and the narrow negative
 * light wrap are what stop the silhouette glowing on a dark ground. What it
 * may not do is carry that treatment inward, because then the circle draws a
 * tonal step across his body.
 *
 * This check exists because it did exactly that: measured at 13.00 mean
 * absolute channel difference in the first two pixels, which is the wanted
 * edge treatment, but still 6.42 at 10 to 20 pixels in and 3.63 at 20 to 40,
 * which is not.
 *
 * Fail-closed: mismatched dimensions, a missing alpha channel, or zero
 * comparable pixels are failures rather than passes.
 */
import sharp from 'sharp';

const LIGHT = 'static/img/john-cutout.webp';
const DARK = 'static/img/john-cutout-dark.webp';

/** Beyond this distance inside the outline, the two must agree. */
const INTERIOR_FROM = 10;
/** Mean absolute channel difference allowed in the interior. */
const MEAN_LIMIT = 1.0;
/** And the worst single channel. */
const MAX_LIMIT = 5;

interface Img {
  data: Buffer;
  w: number;
  h: number;
  c: number;
}

async function load(path: string): Promise<Img> {
  const image = sharp(path);
  const meta = await image.metadata();
  if (!meta.hasAlpha) throw new Error(`${path}: no alpha channel`);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}

const light = await load(LIGHT);
const dark = await load(DARK);

if (light.w !== dark.w || light.h !== dark.h) {
  console.error(
    `the two mattes are different sizes: ${light.w}x${light.h} and ${dark.w}x${dark.h}. They composite as one figure, so they must match exactly.`
  );
  process.exit(1);
}

const { w, h, c } = light;
const opaque = (i: number) => light.data[i * c + 3] >= 250 && dark.data[i * c + 3] >= 250;

// Distance inside the outline, by a two-pass chamfer over the opaque mask.
// Approximate, and that is fine: it only has to separate "at the edge" from
// "well inside it".
const dist = new Float32Array(w * h).fill(1e6);
for (let i = 0; i < w * h; i++) if (!opaque(i)) dist[i] = 0;
for (let pass = 0; pass < 2; pass++) {
  for (let y = 1; y < h; y++)
    for (let x = 1; x < w; x++) {
      const i = y * w + x;
      dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - w] + 1, dist[i - w - 1] + 1.414);
    }
  for (let y = h - 2; y >= 0; y--)
    for (let x = w - 2; x >= 0; x--) {
      const i = y * w + x;
      dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + w] + 1, dist[i + w + 1] + 1.414);
    }
}

const BUCKETS: [number, number][] = [
  [0, 2],
  [2, 5],
  [5, 10],
  [10, 20],
  [20, 40],
  [40, 80],
  [80, Infinity]
];
const tally = BUCKETS.map(() => ({ n: 0, sum: 0, max: 0 }));

for (let i = 0; i < w * h; i++) {
  if (!opaque(i)) continue;
  const o = i * c;
  const delta = Math.max(
    Math.abs(dark.data[o] - light.data[o]),
    Math.abs(dark.data[o + 1] - light.data[o + 1]),
    Math.abs(dark.data[o + 2] - light.data[o + 2])
  );
  const d = dist[i];
  const b = BUCKETS.findIndex(([lo, hi]) => d >= lo && d < hi);
  if (b < 0) continue;
  tally[b].n++;
  tally[b].sum += delta;
  if (delta > tally[b].max) tally[b].max = delta;
}

const compared = tally.reduce((n, t) => n + t.n, 0);
if (compared === 0) {
  console.error('compared zero pixels. That is a failure, not a pass.');
  process.exit(1);
}

console.log('difference between the two mattes, by distance inside the outline:');
BUCKETS.forEach(([lo, hi], k) => {
  const t = tally[k];
  if (!t.n) return;
  const label = hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
  console.log(
    `  ${label.padEnd(8)} n=${String(t.n).padStart(8)}  mean |delta| ${(t.sum / t.n).toFixed(2).padStart(6)}  max ${String(t.max).padStart(3)}`
  );
});

let failures = 0;
for (const [k, [lo]] of BUCKETS.entries()) {
  if (lo < INTERIOR_FROM) continue;
  const t = tally[k];
  if (!t.n) continue;
  const mean = t.sum / t.n;
  if (mean > MEAN_LIMIT || t.max > MAX_LIMIT) {
    console.error(
      `\nFAIL  at ${lo}px and beyond the two mattes differ by ${mean.toFixed(2)} on average and ${t.max} at worst. That is interior, so the plate's edge draws a tonal step across him wherever it crosses. Allowed: ${MEAN_LIMIT} mean, ${MAX_LIMIT} max.`
    );
    failures++;
  }
}

// The edge treatment has to still be there. A dark matte that matches the
// light one everywhere is not a dark matte, and it will glow on the band.
const edge = tally[0];
if (edge.n && edge.sum / edge.n < 1) {
  console.error(
    `\nFAIL  the two mattes are identical at the edge as well (${(edge.sum / edge.n).toFixed(2)} mean). The keyed variant has lost its edge treatment and will glow on the deep band.`
  );
  failures++;
}

if (failures) process.exit(1);
console.log(
  `\nThe mattes agree where it matters: the edge treatment is present in the first pixels, and from ${INTERIOR_FROM}px inward they are the same photograph.`
);
