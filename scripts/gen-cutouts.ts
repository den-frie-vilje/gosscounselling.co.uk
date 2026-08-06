/**
 * Build the hero cut-out from whichever photograph is present.
 *
 *     node scripts/gen-cutouts.ts                 # key the photograph, if there is one
 *     node scripts/gen-cutouts.ts --self-test     # prove the failure path, on synthetic frames
 *     node scripts/gen-cutouts.ts --source docs/source-assets/John-Goss-1.jpg \
 *                                 --out-dir /tmp/audit   # audit a run without touching the assets
 *     node scripts/gen-cutouts.ts --source ... --out-dir /tmp/audit --compare
 *                                                 # and measure it against the committed files
 *
 * ISOLATION. `--out-dir` also moves the audit record, to `<out-dir>/cutout-audit.json`. An
 * audit run may not leave anything behind that describes assets it did not write.
 *
 * WHAT IT WATCHES. `static/img/portrait/` — one photograph, the one the CMS writes when
 * John replaces his portrait. That folder is EMPTY today and its absence is the normal
 * state, exactly as `static/img/photos/` is in `scripts/gen-photos.ts`: nothing to do is
 * not a build failure. Until he uploads one, the committed assets are the hand-tuned ones
 * `scripts/build-cutouts.py` produced and nothing here overwrites them. The day he
 * uploads one, this takes over, because the hand pass cannot: its first input is a matte
 * a person already pulled.
 *
 * THIS SCRIPT DOES NOT GATE ITSELF. It keys whenever it is run. Whether it needs to run
 * is `scripts/gen-assets.ts`'s question, answered against the shared content-hash
 * manifest that gates every expensive step in this build — including this one, whose
 * declared inputs are the photograph, `scripts/keyer.ts` and this file. One gate, one
 * record, one place to look; a second gate living in here would be a second thing to
 * reason about and a second thing to get wrong.
 *
 * FAIL LOUDLY. `scripts/keyer.ts` throws `UnkeyableError` rather than emitting a matte it
 * cannot stand behind, and this script exits non-zero with the measured number, the limit
 * it missed and what to do about it. The alternative — a silently bad matte on the hero —
 * is worse than a red build, because nobody looks at an asset that built.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEFAULTS, UnkeyableError, key, srgbToLinear, linearToSrgb } from './keyer.ts';
import type { KeyResult } from './keyer.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = resolve(root, 'static/img/portrait');
const ASSET_DIR = resolve(root, 'static/img');
const PHOTO_EXT = /\.(jpe?g|png|webp|tiff?)$/i;

/**
 * TWO FILES, ONE ASSET. There used to be a light/dark PAIR — the same alpha under two
 * colour treatments, one baked for each ground — and that pair is gone: the solve in
 * `scripts/keyer.ts` produces a foreground that is the subject's own colour at every
 * coverage, which is right on every ground at once.
 *
 * What is written now is what `scripts/build-cutouts.py` writes, and for the same two
 * reasons. `OUT_ASSET` is the one file the page paints, on every ground it uses.
 * `OUT_MASTER` is the plain knockout — the photograph's own pixels under the same matte,
 * with nothing solved and the backing still in its fringe. Nothing paints it. It is the
 * reference the geometry is measured from (`scripts/check-portrait-fit.ts`) and the
 * unsolved control `scripts/check-mattes.ts` measures the asset against, and it has to be
 * the same size and the same matte as the asset for either of those to mean anything.
 *
 * See `src/routes/(site)/+page.svelte` for who paints which.
 */
const OUT_MASTER = 'john-knockout.webp';
const OUT_ASSET = 'john-cutout.webp';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};

const SELF_TEST = flag('--self-test');
const COMPARE = flag('--compare');
const OUT_DIR = resolve(root, opt('--out-dir') ?? 'static/img');
/**
 * Where the master goes, which is NOT beside the asset.
 *
 * Nothing on the site fetches the knockout, and `static/` is what the static
 * adapter copies into the build, so writing it there shipped 316 KB of dead
 * weight to every visitor. It was moved out by hand and then written straight
 * back here on the first real upload, which is what an out-of-band fix earns
 * when the script that regenerates the file does not know about it.
 *
 * An audit run (`--out-dir`) keeps everything together in its own folder, as
 * before: the separation is about what ships, and nothing in /tmp ships.
 */
const MASTER_DIR = opt('--out-dir') ? OUT_DIR : resolve(root, 'assets/portrait');
const SOURCE_ARG = opt('--source');
/** An audit run leaves its record beside its own outputs, never over the real one. */
const AUDIT_FILE =
  OUT_DIR === ASSET_DIR ? resolve(root, 'src/lib/generated/cutout-audit.json') : resolve(OUT_DIR, 'cutout-audit.json');

// Repo-relative inside the repo, absolute outside it: `--out-dir /tmp/...` produced a
// twelve-deep `../../..` chain that no human could read back to a path.
const rel = (p: string) => {
  const r = relative(root, p);
  return !r ? p : r.startsWith('..') ? p : r;
};
const pct = (x: number, d = 2) => `${(100 * x).toFixed(d)}%`;
const median = (v: ArrayLike<number>, n: number) => {
  if (n <= 0) return 0;
  const a = Float64Array.from({ length: n }, (_, i) => v[i]);
  a.sort();
  return a[n >> 1];
};

// ---------------------------------------------------------------------------
// The audit print. Everything the keyer derived, so a run can be checked by a human
// rather than believed.
// ---------------------------------------------------------------------------

function report(r: KeyResult, label: string) {
  const b = r.backing;
  console.log(`\ncutouts: ${label} — ${r.width}x${r.height}`);

  console.log('\n  BACKING, estimated from the image itself');
  console.log(`    colour at frame centre   ${b.hex}  rgb(${b.centre.map((v) => v.toFixed(1)).join(', ')})`);
  console.log(`    gradient across frame    R ${b.tilt[0].toFixed(1)}  G ${b.tilt[1].toFixed(1)}  B ${b.tilt[2].toFixed(1)} levels  (limit 28.0)`);
  console.log(`    residual sigma           R ${b.residual[0].toFixed(2)}  G ${b.residual[1].toFixed(2)}  B ${b.residual[2].toFixed(2)} levels  (limit 6.00)`);
  console.log(`    variance used by the key ${b.measuredNoise.toFixed(3)} levels measured` +
    (b.noise > b.measuredNoise ? `, raised to the ${b.noise.toFixed(2)} floor` : ''));
  console.log(`    border band              ${b.bandPx}px, ${b.sampled.toLocaleString()} samples, ${pct(b.inliers / b.sampled, 1)} background`);
  console.log(`    per edge                 ${b.edges.map((e) => `${e.name} ${pct(e.inliers / Math.max(e.total, 1), 0)}`).join('   ')}`);
  if (b.clipped > 0.001) {
    console.log(`    NOTE                     ${pct(b.clipped, 1)} of the backing is clipped at the end of the scale;`);
    console.log('                             its evenness cannot be measured below the clip.');
  }

  console.log('\n  ALPHA');
  const w = r.histogram;
  console.log(`    transparent (a = 0)      ${pct(w.transparent)}`);
  for (let i = 0; i < 10; i++) {
    const lo = (i / 10).toFixed(1);
    const hi = ((i + 1) / 10).toFixed(1);
    const bar = '#'.repeat(Math.min(40, Math.round(w.bins[i] * 4000)));
    console.log(`    ${lo} - ${hi}                ${pct(w.bins[i], 3).padStart(8)}  ${bar}`);
  }
  console.log(`    opaque (a = 1)           ${pct(w.opaque)}`);
  console.log(`    partial coverage         ${pct(w.partial)}  (limit 12.00%)`);
  console.log(`    figure                   ${pct(r.figureFraction)} of the frame`);
  console.log(`    median |B - F| in band   ${r.medianSeparation.toFixed(3)} of 1.0 in linear light,` +
    ` ${r.medianSnr.toFixed(0)}x the measured backing noise`);
  console.log(`    ill-conditioned fringe   ${pct(r.illConditioned, 1)}  (limit 50.0%) — where the subject`);
  console.log(`                             is within ${DEFAULTS.sepLoSnr}x the backing noise and the solve cannot speak`);
  console.log(`    clipped fringe           ${pct(r.clippedFringe, 1)} — where the plate is clipped at the`);
  console.log('                             backing\'s own end and the equation carries nothing at all');
  console.log(`    soft edge, measured      ${r.softBand.medianPx.toFixed(1)}px median, ${r.softBand.p99Px.toFixed(1)}px at the 99th, ` +
    `${r.softBand.maxPx.toFixed(1)}px worst${r.softBand.maxPx >= r.softBand.capPx ? ' — AT THE CEILING' : ''}`);
  console.log(`                             how far partial coverage reaches inside the silhouette, of ` +
    `${r.softBand.capPx}px measurable.`);
  console.log('                             Nothing is settled opaque inside it, whatever its width.');
  console.log(`    interior depth           ${r.coreDepthPx.toFixed(2)}px; the floor under that verdict, not a substitute for it`);

  if (r.transfer.length) {
    console.log('\n  THE FALLBACK CURVE, fitted from the pixels where the equation does speak');
    console.log('    crude    ' + r.transfer.map((a) => a.crude.toFixed(2).padStart(6)).join(''));
    console.log('    solved   ' + r.transfer.map((a) => a.solved.toFixed(2).padStart(6)).join(''));
    console.log('    n        ' + r.transfer.map((a) => String(a.n).padStart(6)).join(''));
    console.log('    A crude distance key is a SILHOUETTE detector, not a coverage: read the two');
    console.log('    rows against each other and the gap is why it may not be blended in raw.');
  }

  // The property the whole solve exists to have, measured on the pixels it just wrote.
  console.log('\n  FRINGE PURITY — the delivered foreground against the subject\'s own colour,');
  console.log('  in sRGB luminance levels, by coverage. Positive is toward the backing, which is');
  console.log('  the only direction contamination can push. A correct asset is FLAT in coverage;');
  console.log('  one with backing left in it climbs as coverage falls.');
  console.log('    coverage ' + r.purity.map((b) => `${b.lo.toFixed(2)}-${b.hi.toFixed(2)}`.padStart(10)).join(''));
  console.log('    n        ' + r.purity.map((b) => String(b.n).padStart(10)).join(''));
  console.log('    mean d   ' + r.purity.map((b) => (b.n ? (b.mean >= 0 ? '+' : '') + b.mean.toFixed(1) : '-').padStart(10)).join(''));
  const worst = r.purity.filter((b) => b.n).reduce((m, b) => Math.max(m, b.mean), -Infinity);
  console.log(`    worst departure in the contamination direction: ${worst >= 0 ? '+' : ''}${worst.toFixed(1)} levels`);
  console.log(`    Below coverage ${DEFAULTS.directLo.toFixed(2)} the foreground IS the reference this is measured`);
  console.log('    against, so those buckets can only read near zero; they say the fade happened, not');
  console.log('    that the solve is right. `node scripts/check-mattes.ts` measures it independently.');

  if (r.touchesEdges.length) {
    console.log(`\n  WARNING: the figure runs off the ${r.touchesEdges.join(', ')} edge(s) of the frame.`);
    console.log('           Nothing here reconstructs what the camera did not see (DECISIONS §11);');
    console.log('           a clipped crown still needs a person.');
  }
  console.log(`\n  timings (ms)  ${Object.entries(r.timings).map(([k, v]) => `${k} ${v}`).join('  ')}`);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** The tightest box containing any non-zero alpha, as `build-cutouts.py` crops to. */
function alphaBbox(alpha: Uint8Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { left: 0, top: 0, width: w, height: h };
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function writeCutout(
  rgb: Uint8Array,
  alpha: Uint8Array,
  w: number,
  h: number,
  box: { left: number; top: number; width: number; height: number },
  file: string
) {
  const rgba = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const s = (y + box.top) * w + (x + box.left);
      const d = (y * box.width + x) * 4;
      rgba[d] = rgb[s * 3];
      rgba[d + 1] = rgb[s * 3 + 1];
      rgba[d + 2] = rgb[s * 3 + 2];
      rgba[d + 3] = alpha[s];
    }
  }
  // The same encode as build-cutouts.py: q92 colour, lossless alpha, slowest search.
  // DECISIONS §12 measured the floor these settings impose — VP8's 4:2:0 chroma
  // subsampling is an irreducible error that quality does not buy off — so changing the
  // first three would invalidate that sweep.
  //
  // `exact` is the fourth, and it is the one build-cutouts.py has always passed and this
  // file did not. Without it libwebp runs WebPCleanupTransparentArea, which flattens the
  // RGB under fully transparent pixels to whatever compresses best — measured on this
  // matte, it replaced the subject's colour with a flat 255 on 21% of the empty pixels
  // within four of the outline. That is the colour bleed thrown away at the last step:
  // VP8 is YUV 4:2:0, so the chroma of those pixels is averaged into the fringe beside
  // them, and white averaged into a fringe on a dark ground is a bright rim by another
  // route. It costs about 4% of the file and it is not optional.
  //
  // What proves it is not the self-test, which never encodes anything:
  // `scripts/check-mattes.ts`'s colour-bleed measurement, on the written file.
  await sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6, exact: true })
    .toFile(file);
  return statSync(file).size;
}

// ---------------------------------------------------------------------------
// --compare: this key against the committed hand pass.
//
// The two are NOT expected to be identical and one of them is not "right". The hand pass
// started from a matte a person pulled and then reconstructed the clipped crown
// (DECISIONS §11), which is why its canvas is taller; this pass starts from the
// photograph and reconstructs nothing. What the comparison is for is to say WHERE they
// differ and by how much, in numbers, so that a swap is a decision and not a surprise.
//
// Both files are compared, and they answer different questions. On the knockout,
// where both sides are the unsolved master, a difference is a difference in the MATTE.
// On the painted asset it is the matte plus the solve, and since both sides now run
// the same solve, a difference there that is not in the first comparison is the solve
// disagreeing about the same edge.
// ---------------------------------------------------------------------------

interface Plate {
  rgb: Uint8Array;
  alpha: Uint8Array;
  w: number;
  h: number;
}

async function loadPlate(file: string): Promise<Plate> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = data[i * info.channels];
    rgb[i * 3 + 1] = data[i * info.channels + 1];
    rgb[i * 3 + 2] = data[i * info.channels + 2];
    alpha[i] = data[i * info.channels + 3];
  }
  return { rgb, alpha, w: info.width, h: info.height };
}

/** Mean |Δα| over the overlap, in 0-255 levels, for one integer offset. `step` subsamples. */
function alphaCost(a: Plate, b: Plate, dx: number, dy: number, step: number) {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < b.h; y += step) {
    const ay = y + dy;
    if (ay < 0 || ay >= a.h) continue;
    for (let x = 0; x < b.w; x += step) {
      const ax = x + dx;
      if (ax < 0 || ax >= a.w) continue;
      const va = a.alpha[ay * a.w + ax];
      const vb = b.alpha[y * b.w + x];
      if (va === 0 && vb === 0) continue; // both background: carries no information
      sum += Math.abs(va - vb);
      count++;
    }
  }
  return { mean: count ? sum / count : Infinity, count };
}

function compareOne(mine: Plate, theirs: Plate, label: string) {
  // Register the two canvases first. The hand pass grew the frame upward to fit the
  // rebuilt crown, so an unregistered comparison would measure that shift and nothing
  // else. Coarse search on a 4px grid, then exact in a ±4 window around the winner.
  let best = { dx: 0, dy: 0, mean: Infinity };
  for (let dy = -32; dy <= 32; dy += 4) {
    for (let dx = -16; dx <= 16; dx += 4) {
      const c = alphaCost(mine, theirs, dx, dy, 4);
      if (c.mean < best.mean) best = { dx, dy, mean: c.mean };
    }
  }
  const coarse = { ...best };
  for (let dy = coarse.dy - 4; dy <= coarse.dy + 4; dy++) {
    for (let dx = coarse.dx - 4; dx <= coarse.dx + 4; dx++) {
      const c = alphaCost(mine, theirs, dx, dy, 1);
      if (c.mean < best.mean) best = { dx, dy, mean: c.mean };
    }
  }

  // Now the full-resolution accounting, split by what kind of pixel it is.
  const rows = 10;
  const rowSum = new Float64Array(rows);
  const rowN = new Float64Array(rows);
  let n = 0;
  let sum = 0;
  let max = 0;
  let over8 = 0;
  const bands = {
    core: { n: 0, sum: 0 },   // both call it solid
    fringe: { n: 0, sum: 0 }, // at least one calls it partial
    ground: { n: 0, sum: 0 }  // one calls it background, the other does not
  };
  let areaMine = 0;
  let areaTheirs = 0;
  // Signed, not absolute: |da| cannot tell a matte that is uniformly WIDER from one that
  // is merely noisy, and a choke is exactly the difference the hand pass applied
  // (DECISIONS §12). Alpha mass over boundary length is that choke, in px.
  let signedFringe = 0;
  let massMine = 0;
  let massTheirs = 0;
  let boundary = 0;
  const rgbDelta = [0, 0, 0];
  let rgbMax = 0;
  let rgbN = 0;
  const diffs: number[] = [];
  for (let y = 0; y < theirs.h; y++) {
    const ay = y + best.dy;
    if (ay < 0 || ay >= mine.h) continue;
    for (let x = 0; x < theirs.w; x++) {
      const ax = x + best.dx;
      if (ax < 0 || ax >= mine.w) continue;
      const ia = ay * mine.w + ax;
      const ib = y * theirs.w + x;
      const va = mine.alpha[ia];
      const vb = theirs.alpha[ib];
      if (va >= 128) areaMine++;
      if (vb >= 128) areaTheirs++;
      massMine += va / 255;
      massTheirs += vb / 255;
      if (vb >= 128 && (
        (x > 0 && theirs.alpha[ib - 1] < 128) ||
        (x < theirs.w - 1 && theirs.alpha[ib + 1] < 128) ||
        (y > 0 && theirs.alpha[ib - theirs.w] < 128) ||
        (y < theirs.h - 1 && theirs.alpha[ib + theirs.w] < 128)
      )) boundary++;
      if (va >= 250 && vb >= 250) {
        // Colour is only comparable where both are solid; a fringe pixel's RGB is
        // whatever each pass chose to put under a different alpha.
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(mine.rgb[ia * 3 + c] - theirs.rgb[ib * 3 + c]);
          rgbDelta[c] += d;
          if (d > rgbMax) rgbMax = d;
        }
        rgbN++;
      }
      if (va === 0 && vb === 0) continue;
      const d = Math.abs(va - vb);
      sum += d;
      n++;
      if (d > max) max = d;
      if (d > 8) over8++;
      if (diffs.length < 400000) diffs.push(d);
      const band = va >= 250 && vb >= 250 ? bands.core : va < 5 || vb < 5 ? bands.ground : bands.fringe;
      band.n++;
      band.sum += d;
      if (band === bands.fringe) signedFringe += va - vb;
      const r = Math.min(rows - 1, Math.floor((y / theirs.h) * rows));
      rowSum[r] += d;
      rowN[r]++;
    }
  }

  console.log(`\n  ${label}`);
  console.log(`    canvases                 keyed ${mine.w}x${mine.h}   committed ${theirs.w}x${theirs.h}`);
  console.log(`    best integer offset      dx ${best.dx >= 0 ? '+' : ''}${best.dx}, dy ${best.dy >= 0 ? '+' : ''}${best.dy} px (keyed − committed)`);
  console.log(`    compared                 ${n.toLocaleString()} px where either is not fully transparent`);
  console.log(`    mean |da|                ${(sum / Math.max(n, 1)).toFixed(2)} levels of 255  (${pct(sum / Math.max(n, 1) / 255, 2)})`);
  console.log(`    median |da|              ${median(diffs, diffs.length).toFixed(0)} levels`);
  console.log(`    max |da|                 ${max} levels`);
  console.log(`    |da| > 8 levels          ${pct(over8 / Math.max(n, 1), 2)} of those px`);
  for (const [name, b] of Object.entries(bands)) {
    console.log(
      `      ${name.padEnd(22)} ${pct(b.n / Math.max(n, 1), 1).padStart(6)} of them, mean |da| ${(b.sum / Math.max(b.n, 1)).toFixed(2)}`
    );
  }
  console.log(`    silhouette area          keyed ${areaMine.toLocaleString()} px, committed ${areaTheirs.toLocaleString()} px` +
    `  (${((100 * (areaMine - areaTheirs)) / Math.max(areaTheirs, 1)).toFixed(2)}%)`);
  console.log(`    signed mean da, fringe   ${(signedFringe / Math.max(bands.fringe.n, 1) >= 0 ? '+' : '')}` +
    `${(signedFringe / Math.max(bands.fringe.n, 1)).toFixed(2)} levels (keyed − committed)`);
  console.log(`    edge displacement        ${((massMine - massTheirs) / Math.max(boundary, 1) >= 0 ? '+' : '')}` +
    `${((massMine - massTheirs) / Math.max(boundary, 1)).toFixed(3)} px, from ${(massMine - massTheirs).toFixed(0)} px² of alpha mass` +
    ` over a ${boundary.toLocaleString()} px boundary`);
  console.log('                             positive = the keyed matte sits outside the committed one');
  console.log(`    colour where both solid  mean per channel R ${(rgbDelta[0] / Math.max(rgbN, 1)).toFixed(2)}` +
    `  G ${(rgbDelta[1] / Math.max(rgbN, 1)).toFixed(2)}  B ${(rgbDelta[2] / Math.max(rgbN, 1)).toFixed(2)} levels, max ${rgbMax}` +
    `  (${rgbN.toLocaleString()} px)`);
  console.log('    mean |da| down the frame');
  for (let r = 0; r < rows; r++) {
    const v = rowSum[r] / Math.max(rowN[r], 1);
    console.log(
      `      ${String(Math.round((100 * r) / rows)).padStart(3)}-${String(Math.round((100 * (r + 1)) / rows)).padStart(3)}%` +
        `   ${v.toFixed(2).padStart(6)}  ${'#'.repeat(Math.min(40, Math.round(v * 2)))}`
    );
  }
  return best;
}

async function compareToCommitted(result: KeyResult, masterRgb: Uint8Array) {
  console.log('\n  AGAINST THE COMMITTED HAND PASS');
  for (const [name, mineRgb] of [
    [OUT_MASTER, masterRgb],
    [OUT_ASSET, result.rgb]
  ] as [string, Uint8Array][]) {
    const file = resolve(ASSET_DIR, name);
    if (!existsSync(file)) {
      console.log(`    ${name}: not on disk — nothing to compare against.`);
      continue;
    }
    const theirs = await loadPlate(file);
    compareOne({ rgb: mineRgb, alpha: result.alpha, w: result.width, h: result.height }, theirs, name);
  }
}

// ---------------------------------------------------------------------------
// Self-test: synthetic frames with a KNOWN answer, and three backgrounds that must be
// refused. The refusals are the point — the happy path is checked by looking at the
// picture, the failure path is only ever checked by a test.
// ---------------------------------------------------------------------------

/** Deterministic value noise, so a self-test failure is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Synth {
  rgb: Uint8Array;
  w: number;
  h: number;
  alpha: Float32Array;
  fg: [number, number, number];
  backing: [number, number, number];
}

interface SynthOpts {
  w?: number;
  h?: number;
  noise?: number;
  /** Peak-to-peak across the frame is 1.5x this, so the keyer's `tilt` metric is 1.5x it. */
  tilt?: number;
  subject?: boolean;
  /** The backdrop. Anything from a white cyclorama to a dark studio wall. */
  backing?: [number, number, number];
  /** The subject. */
  fg?: [number, number, number];
  /** How much of the frame he fills; 1 is the reference framing. */
  scale?: number;
  /**
   * How wide the soft edge is, px. The default 3 is a shoulder against a cyclorama: the
   * silhouette is in focus and the transition is a pixel or two of the lens and the
   * sensor. Hair is not that, which is what `crownRamp` is for.
   */
  ramp?: number;
  /**
   * The ramp over the TOP ARC only, px — a crown of hair rather than a shoulder, blended
   * into `ramp` down the sides so the frame has both kinds of edge in it at once. This is
   * the case a keyer gets wrong invisibly: a wide ramp is still a ramp, and calling it
   * opaque leaves the backing inside the subject where no fringe audit looks.
   */
  crownRamp?: number;
}

function synth(o: SynthOpts): Synth {
  const w = o.w ?? 480;
  const h = o.h ?? 360;
  const noise = o.noise ?? 1.0;
  const tilt = o.tilt ?? 4;
  const subject = o.subject ?? true;
  const backing: [number, number, number] = o.backing ?? [250, 249, 246];
  const fg: [number, number, number] = o.fg ?? [64, 96, 150];
  const scale = o.scale ?? 1;
  const ramp = o.ramp ?? 3;
  const crownRamp = o.crownRamp ?? ramp;
  const rgb = new Uint8Array(w * h * 3);
  const alpha = new Float32Array(w * h);
  const rand = rng(20260805);
  const cx = w * 0.5;
  const cy = h * 0.62;
  const rx = w * 0.26 * scale;
  const ry = h * 0.34 * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // A soft-edged ellipse: signed distance in px, ramped over `ramp` — widening to
      // `crownRamp` over the top arc, smoothstepped down the sides so the frame carries a
      // sharp edge and a soft one at once. The ramp is centred on the silhouette, so it
      // reaches half its width outside the ellipse and half inside.
      let a = 0;
      if (subject) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const px = (1 - d) * Math.min(rx, ry);
        const u = Math.min(1, Math.max(0, ((cy - y) / ry - 0.35) / 0.3));
        const rw = ramp + (crownRamp - ramp) * (u * u * (3 - 2 * u));
        a = Math.min(1, Math.max(0, (px + rw / 2) / rw));
      }
      alpha[i] = a;
      for (let c = 0; c < 3; c++) {
        const B = backing[c] + tilt * (x / w - 0.5) + tilt * 0.5 * (y / h - 0.5);
        // Composite in LINEAR light, which is where the mixture is actually linear.
        const lin = a * srgbToLinear(fg[c]) + (1 - a) * srgbToLinear(B);
        const v = linearToSrgb(lin) + noise * (rand() - 0.5) * 2;
        rgb[i * 3 + c] = Math.round(Math.min(255, Math.max(0, v)));
      }
    }
  }
  return { rgb, w, h, alpha, fg, backing };
}

function selfTest(): number {
  let failures = 0;
  const ok = (name: string, pass: boolean, detail: string) => {
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}  —  ${detail}`);
    if (!pass) failures++;
  };
  const refuses = (name: string, s: Synth, fragment: string) => {
    try {
      key(s.rgb, s.w, s.h);
      ok(name, false, 'the keyer accepted a background it should have refused');
    } catch (e) {
      if (!(e instanceof UnkeyableError)) {
        ok(name, false, `threw ${(e as Error).name}: ${(e as Error).message}`);
        return;
      }
      const hit = e.message.includes(fragment);
      ok(name, hit, hit ? `refused: measured ${e.measured}, limit ${e.limit}` : `refused, but for the wrong reason: ${e.message}`);
    }
  };

  /**
   * Key a synthetic frame whose answer is known exactly, and check the three things a
   * caller depends on: the backing it found, the alpha it solved, and the unspilled
   * foreground colour it recovered. `alphaTol` and `fgTol` widen for the frames that are
   * legitimately harder — a backing this keyer is allowed to accept can still be noisy
   * enough that the last few levels of a soft edge are not recoverable.
   */
  const keys = (name: string, o: SynthOpts, e: { alphaTol: number; fgTol: number }) => {
    const s = synth(o);
    let r;
    try {
      r = key(s.rgb, s.w, s.h);
    } catch (err) {
      ok(name, false, `refused a background it should have keyed: ${(err as Error).message}`);
      return;
    }
    const dc = Math.max(...r.backing.centre.map((v, c) => Math.abs(v - s.backing[c])));
    let err = 0;
    let worst = 0;
    for (let i = 0; i < s.w * s.h; i++) {
      const d = Math.abs(r.alpha[i] / 255 - s.alpha[i]);
      err += d;
      if (d > worst) worst = d;
    }
    err /= s.w * s.h;
    // Foreground colour deep inside, where the answer is unambiguous. Asserted on the
    // MEAN, not on the worst pixel: the worst of 46,000 samples off a plate with grain on
    // it is an extreme-value statistic about the grain, and tightening a tolerance until
    // it passes would be fitting the test to the noise. The worst and the 99.9th
    // percentile are printed so a regression in the tail is still visible.
    const devs: number[] = [];
    let n = 0;
    for (let i = 0; i < s.w * s.h; i++) {
      if (s.alpha[i] < 0.999) continue;
      n++;
      for (let c = 0; c < 3; c++) devs.push(Math.abs(r.rgb[i * 3 + c] - s.fg[c]));
    }
    devs.sort((a, b) => a - b);
    const meanDev = devs.reduce((a, b) => a + b, 0) / Math.max(devs.length, 1);
    const p999 = devs[Math.min(devs.length - 1, Math.floor(devs.length * 0.999))] ?? 0;
    const pass = dc < 2.5 && err < e.alphaTol && meanDev < e.fgTol;
    ok(
      name,
      pass,
      `backing ${r.backing.hex} off by ${dc.toFixed(2)}, mean |da| ${err.toFixed(4)} (worst ${worst.toFixed(2)}), ` +
        `fg off by ${meanDev.toFixed(2)} mean / ${p999} p99.9 / ${devs[devs.length - 1]} worst over ` +
        `${n.toLocaleString()} px, tilt ${Math.max(...r.backing.tilt).toFixed(1)}, ` +
        `residual ${r.backing.measuredNoise.toFixed(2)}, median SNR ${r.medianSnr.toFixed(0)}x, ` +
        `worst fringe purity ${fmtPurity(r)}`
    );
    return r;
  };

  /** The worst departure from the subject's own colour, in the contamination direction. */
  const fmtPurity = (r: KeyResult) => {
    const v = r.purity.filter((b) => b.n).map((b) => b.mean);
    return v.length ? `${Math.max(...v) >= 0 ? '+' : ''}${Math.max(...v).toFixed(1)} lv` : 'n/a';
  };

  console.log('cutouts: self-test — synthetic frames with a known answer\n');
  console.log('  ACCEPTS — the reference framing, and four other photographs it must also key\n');

  // The reference: a gently tilted, mildly noisy white cyclorama, John's own situation.
  const ref = keys('white cyclorama, reference framing', {}, { alphaTol: 0.01, fgTol: 1.5 });
  if (ref) {
    // THE PROPERTY THE WHOLE SOLVE EXISTS TO HAVE, on a frame whose answer is known: the
    // foreground must be the subject's colour at EVERY coverage, not just deep inside.
    // This replaces the old "the two treatments differ" assertion, which checked that a
    // ground-specific de-lighting had been applied — the thing that was removed.
    const worstPurity = Math.max(...ref.purity.filter((b) => b.n).map((b) => b.mean));
    const flattest = Math.min(...ref.purity.filter((b) => b.n).map((b) => b.mean));
    ok(
      'the fringe carries the subject, not the backing',
      worstPurity < 6 && flattest > -6,
      `foreground departs from the subject's own colour by ${flattest.toFixed(1)} to ` +
        `${worstPurity >= 0 ? '+' : ''}${worstPurity.toFixed(1)} levels across all coverage ` +
        `(a white backing left IN the fringe reads +100 and up at the bottom)`
    );
    ok(
      'the interior depth scales with width',
      Math.abs(ref.coreDepthPx - (DEFAULTS.coreDepth * 480) / DEFAULTS.refWidth) < 1e-6,
      `${ref.coreDepthPx.toFixed(3)}px at 480px wide, ${DEFAULTS.coreDepth}px at ${DEFAULTS.refWidth}px`
    );
  }

  // A DIFFERENT BACKING TINT. Nothing in the keyer knows what colour a backdrop is; this
  // is the test that says so, because a hard-coded 255 would pass the case above.
  keys('warm cream backdrop, subject at 0.6x', { backing: [236, 228, 212], scale: 0.6 }, { alphaTol: 0.01, fgTol: 1.5 });

  // A MID-GREY backdrop, subject filling much more of the frame. Both ends of the
  // "how much of the border is background" gate move at once.
  keys('mid grey backdrop, subject at 1.35x', { backing: [138, 140, 143], scale: 1.35 }, { alphaTol: 0.012, fgTol: 1.5 });

  // A DARK backdrop with a light subject. Nothing in the output is allowed to know which
  // way round that is any more — there is one asset and no de-lighting — but the SOLVE
  // still has to work with the inequality reversed: the gamut bound's "spill only pulls
  // toward B" is now a pull DOWNWARD, and an implementation that had quietly assumed a
  // bright backing would show it here as a foreground error.
  keys(
    'dark studio wall, light subject',
    { backing: [34, 33, 38], fg: [206, 178, 152] },
    { alphaTol: 0.012, fgTol: 1.5 }
  );

  // GRADIENT AND GRAIN WITHIN TOLERANCE. tilt 16 measures 24 of the 28 levels allowed
  // (the synthetic's peak-to-peak is 1.5x its parameter), and uniform noise of +/-7.5
  // levels measures about 5.6 of the 6 allowed — the robust sigma is 1.4826xMAD, which
  // reads a uniform distribution high because it is calibrated on a Gaussian one. This
  // is the worst backdrop the keyer will still accept, keyed on purpose rather than by
  // luck.
  keys(
    'gradient and grain just inside tolerance',
    { backing: [206, 202, 196], tilt: 16, noise: 7.5 },
    { alphaTol: 0.03, fgTol: 4 }
  );

  console.log('\n  THE SOFT EDGE — the pixels every check above is blind to, by construction\n');

  /**
   * A MATTE THAT CALLS A MIXTURE OPAQUE IS WRONG IN A PLACE NOTHING ELSE LOOKS.
   *
   * Once alpha is 1 the pixel has left the fringe, and every safeguard in the pipeline is
   * keyed off that same verdict: the gamut bound in `keyer.ts` skips it and hands back the
   * plate, `r.purity` buckets only 0.02 < a < 0.98 so it reads +0 levels and sees nothing,
   * and `keys()` above samples the foreground only where the SYNTHETIC alpha is already
   * 0.999 — which excludes the bad pixels by definition. So the error is invisible to all
   * three at once, and the thing that made it invisible is the error itself.
   *
   * This asserts on exactly that set: TRUE coverage partial, SOLVED coverage opaque.
   *
   * `minTrue` 0.90 is twice the measurement's own resolution. `keyer.ts` calls a pixel
   * solid when the distance from the backing has stopped rising to within `keyLo` (3)
   * multiples of the measured backing noise, which is a coverage of keyLo/SNR — about 5%
   * on these frames — so a pixel called opaque at 0.95 true coverage is the method working
   * as specified and one at 0.65 is not. `fgTol` 12 levels follows from it: a pixel at 0.90
   * coverage over a white cyclorama can carry at most a tenth of the 158 levels between
   * this subject and that backing, so ~16 levels at the very floor and well under it on
   * average. Both are bounds on what the METHOD admits, not tolerances fitted to a run.
   *
   * `alphaTol` is here so the assertion cannot be passed by a matte that dodges the tail
   * by going transparent instead: an empty over-declared set is only good news if the
   * frame was keyed correctly as well.
   */
  const softEdge = (name: string, o: SynthOpts, e: { minTrue: number; fgTol: number; alphaTol: number }) => {
    const s = synth(o);
    let r: KeyResult;
    try {
      r = key(s.rgb, s.w, s.h);
    } catch (err) {
      ok(name, false, `refused a frame it should have keyed: ${(err as Error).message}`);
      return;
    }
    const LUMA = [0.2126, 0.7152, 0.0722];
    const lum = (v: ArrayLike<number>, j: number) => LUMA[0] * v[j] + LUMA[1] * v[j + 1] + LUMA[2] * v[j + 2];
    const want = lum(s.fg, 0);
    // Positive is TOWARD the backing, which is the only direction contamination can push;
    // on a dark backdrop that is downward, so the sign follows the backing.
    const toward = lum(s.backing, 0) > want ? 1 : -1;
    let n = 0;
    let sumTrue = 0;
    let minTrue = 1;
    let sumDev = 0;
    let worstDev = 0;
    let mad = 0;
    for (let i = 0; i < s.w * s.h; i++) {
      mad += Math.abs(r.alpha[i] / 255 - s.alpha[i]);
      if (r.alpha[i] / 255 < 0.995 || s.alpha[i] >= 0.995) continue;
      n++;
      sumTrue += s.alpha[i];
      if (s.alpha[i] < minTrue) minTrue = s.alpha[i];
      const dev = toward * (lum(r.rgb, i * 3) - want);
      sumDev += dev;
      if (dev > worstDev) worstDev = dev;
    }
    mad /= s.w * s.h;
    const meanDev = n ? sumDev / n : 0;
    const pass = minTrue >= e.minTrue && meanDev < e.fgTol && mad < e.alphaTol;
    ok(
      name,
      pass,
      `${n.toLocaleString()} px solved opaque are really partial — true coverage ` +
        `${n ? (sumTrue / n).toFixed(3) : 'n/a'} mean / ${n ? minTrue.toFixed(3) : 'n/a'} lowest (floor ${e.minTrue}), ` +
        `their foreground ${meanDev >= 0 ? '+' : ''}${meanDev.toFixed(1)} mean / ` +
        `${worstDev >= 0 ? '+' : ''}${worstDev.toFixed(1)} worst levels toward the backing (limit ${e.fgTol}), ` +
        `soft band ${r.softBand.medianPx.toFixed(1)}/${r.softBand.p99Px.toFixed(1)}/${r.softBand.maxPx.toFixed(1)}px ` +
        `median/p99/max of ${r.softBand.capPx}px measurable, mean |da| ${mad.toFixed(4)}`
    );
  };

  // The reference frame again, read the other way round. Its 3px ramp is narrower than the
  // interior depth, so this used to be the case that looked fine: 169 px of it were solved
  // opaque at a true coverage down to 0.65, carrying +79 levels of cyclorama.
  softEdge('a 3px edge is not opaque before it is opaque', {}, { minTrue: 0.9, fgTol: 12, alphaTol: 0.01 });

  // A CROWN OF HAIR: 24px of ramp over the top arc, on a cyclorama one level off clipping.
  // Both halves matter. The wide ramp is wider than the interior depth, so a settle-to-1
  // gated on depth swallows the whole thing; and the near-clipped backing is where the
  // measured noise hits its floor, which is the regime where a per-pixel rise of a third
  // of a level has to be read as a ramp anyway.
  softEdge(
    'a 24px crown on a near-clipped cyclorama stays a ramp',
    { backing: [253, 253, 252], crownRamp: 24 },
    { minTrue: 0.9, fgTol: 12, alphaTol: 0.01 }
  );

  console.log('\n  REFUSES — the path that matters, because a bad matte does not announce itself\n');
  refuses('a noisy backing', synth({ noise: 40 }), 'too uneven');
  refuses('a backing gradient just over tolerance', synth({ backing: [206, 202, 196], tilt: 24 }), 'varies too much');
  refuses('an unevenly lit backing', synth({ tilt: 80 }), 'varies too much');
  refuses('a frame with no subject', synth({ subject: false }), 'No subject found');
  // A subject the same colour as the backdrop: the equation alpha = (C-B).(F-B)/||F-B||^2
  // has nothing to divide by, and the honest answer is to say so rather than to guess.
  refuses(
    'a subject the colour of the backdrop',
    synth({ backing: [188, 186, 182], fg: [188, 186, 182], noise: 3 }),
    'No subject found'
  );

  console.log(`\ncutouts: self-test ${failures === 0 ? 'passed' : `FAILED (${failures})`}`);
  return failures;
}

// ---------------------------------------------------------------------------
// Which photograph
// ---------------------------------------------------------------------------

/**
 * What the CMS recorded, if anything.
 *
 * Sveltia writes the public path — `/img/portrait/whatever.jpg` — into
 * `home.hero.portrait` when John uploads, and the file lands in `SRC_DIR`. So
 * the field is the record of WHICH photograph is his, and the folder is where
 * it physically is; they arrive together and this reads the first.
 *
 * It matters because the field would otherwise be decoration: a box John fills
 * in that changes nothing, which is the one thing an editor must never be. The
 * folder scan below still stands, for a photograph dropped in by hand, and
 * still refuses to guess between two.
 */
function sourceFromContent(): string | null {
  // The hero is its own file since the Home entry was split into one editor
  // page per section. This read used to be `src/content/home.json` and
  // `home.hero?.portrait`, and when that file was split the catch below
  // swallowed the miss: the script fell back to scanning the folder, the build
  // stayed green, and the CMS field simply stopped being obeyed. A field that
  // does nothing is the failure this repo keeps removing, so it is worth
  // saying that `scripts/gen-assets.ts` gates this step on the same path —
  // they agree, and if either moves again the gate re-keys and this refuses.
  let hero: { portrait?: string };
  try {
    hero = JSON.parse(readFileSync(resolve(root, 'src/content/home/hero.json'), 'utf8'));
  } catch {
    // The content file is svelte-check's business, not this script's.
    return null;
  }
  const declared = hero.portrait?.trim();
  if (!declared) return null;

  const p = resolve(root, 'static', declared.replace(/^\//, ''));
  if (!existsSync(p)) {
    console.error(
      `cutouts: the CMS says his photograph is ${declared}, and ${rel(p)} is not there.\n` +
        '         Nothing was keyed. Re-upload it, or clear the field to keep the portrait already in place.'
    );
    process.exit(1);
  }
  return p;
}

function findSource(): string | null {
  if (SOURCE_ARG) {
    const p = resolve(root, SOURCE_ARG);
    if (!existsSync(p)) {
      console.error(`cutouts: --source ${SOURCE_ARG} does not exist.`);
      process.exit(1);
    }
    return p;
  }
  const declared = sourceFromContent();
  if (declared) return declared;
  if (!existsSync(SRC_DIR)) return null;
  let files: string[];
  try {
    files = readdirSync(SRC_DIR).filter((f) => PHOTO_EXT.test(f));
  } catch (e) {
    console.error(`cutouts: cannot read ${rel(SRC_DIR)} — ${(e as Error).message}`);
    process.exit(1);
  }
  if (files.length === 0) return null;
  if (files.length > 1) {
    // Which of two portraits is THE portrait is not a question a build may answer by
    // sorting filenames.
    console.error(
      `cutouts: ${rel(SRC_DIR)} holds ${files.length} images (${files.join(', ')}).\n` +
        '         It must hold exactly one — the portrait. Remove the others.'
    );
    process.exit(1);
  }
  return resolve(SRC_DIR, files[0]);
}

// ---------------------------------------------------------------------------

if (SELF_TEST) {
  process.exit(selfTest() === 0 ? 0 : 1);
}

const source = findSource();
if (!source) {
  console.log(
    `cutouts: no photograph in ${rel(SRC_DIR)} — nothing to key.\n` +
      '         The committed cut-outs stand until John uploads one through the CMS.'
  );
  process.exit(0);
}

const masterPath = resolve(MASTER_DIR, OUT_MASTER);
const assetPath = resolve(OUT_DIR, OUT_ASSET);
console.log(`cutouts: keying ${rel(source)}`);

const { data, info } = await sharp(source).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);

let result: KeyResult;
try {
  result = key(rgb, info.width, info.height);
} catch (e) {
  if (e instanceof UnkeyableError) {
    console.error(`\ncutouts: REFUSING TO KEY ${rel(source)}\n`);
    console.error(`  ${e.message}\n`);
    console.error(`  measured: ${e.measured}`);
    console.error(`  limit:    ${e.limit}\n`);
    console.error('  Nothing was written. The previously generated cut-outs, if any, still stand.');
    process.exit(1);
  }
  throw e;
}

report(result, rel(source));

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(MASTER_DIR, { recursive: true });
mkdirSync(dirname(AUDIT_FILE), { recursive: true });
const box = alphaBbox(result.alpha, result.width, result.height);
// The master is the PHOTOGRAPH's own pixels under the solved matte — nothing keyed out of
// its fringe, which is exactly what makes it a control. The asset is the solve.
const masterBytes = await writeCutout(rgb, result.alpha, result.width, result.height, box, masterPath);
const assetBytes = await writeCutout(result.rgb, result.alpha, result.width, result.height, box, assetPath);

console.log('\n  OUTPUT');
console.log(`    cropped to alpha         ${box.width}x${box.height} at (${box.left}, ${box.top})`);
console.log(`    ${OUT_MASTER.padEnd(24)} ${(masterBytes / 1024).toFixed(0)} KB   ${rel(masterPath)}   the unsolved master; nothing paints it`);
console.log(`    ${OUT_ASSET.padEnd(24)} ${(assetBytes / 1024).toFixed(0)} KB   ${rel(assetPath)}   THE asset, on every ground`);

if (COMPARE) await compareToCommitted(result, rgb);

// The audit trail, in the shape a person would want to diff two keyings by. It is NOT
// the gate — `src/lib/generated/build-manifest.json` is — so nothing reads it back and
// deleting it costs nothing but the record.
const audit = {
  note:
    'Written by scripts/gen-cutouts.ts: the numbers the keyer derived from the photograph ' +
    'named below. A record, not a gate — scripts/build-gate.ts decides whether the keying ' +
    'has to happen at all. scripts/check-mattes.ts DOES read `source`, `crop` and ' +
    '`backing.plane` back, because reproducing the photograph is a statement about a ' +
    'specific picture, a specific alignment and a specific backing. Do not edit.',
  source: rel(source),
  keyedAt: new Date().toISOString(),
  outputs: {
    master: rel(masterPath),
    asset: rel(assetPath),
    masterBytes,
    assetBytes
  },
  /** Where the written files sit in the SOURCE photograph's frame, after the alpha crop. */
  crop: { left: box.left, top: box.top, width: box.width, height: box.height },
  derived: {
    sourceSize: `${result.width}x${result.height}`,
    outputSize: `${box.width}x${box.height}`,
    backing: {
      hex: result.backing.hex,
      centre: result.backing.centre.map((v) => Number(v.toFixed(2))),
      // The fitted plane itself, per channel, in the SOURCE frame's normalised
      // coordinates: value = c + gx·xn + gy·yn with xn, yn in [-1, 1] across the frame.
      // `tilt` is a peak-to-peak magnitude and has thrown the signs away, so it cannot be
      // used to reconstruct B(x, y) and the reproduction check needs B(x, y).
      plane: result.backing.plane.map((pl) => ({
        c: Number(pl.c.toFixed(4)),
        gx: Number(pl.gx.toFixed(4)),
        gy: Number(pl.gy.toFixed(4))
      })),
      tilt: result.backing.tilt.map((v) => Number(v.toFixed(2))),
      residualSigma: result.backing.residual.map((v) => Number(v.toFixed(3))),
      measuredNoise: Number(result.backing.measuredNoise.toFixed(3)),
      noiseUsed: Number(result.backing.noise.toFixed(3)),
      borderInlierFraction: Number((result.backing.inliers / result.backing.sampled).toFixed(4)),
      clippedFraction: Number(result.backing.clipped.toFixed(4))
    },
    alpha: {
      transparent: Number(result.histogram.transparent.toFixed(5)),
      opaque: Number(result.histogram.opaque.toFixed(5)),
      partial: Number(result.histogram.partial.toFixed(5)),
      bins: result.histogram.bins.map((v) => Number(v.toFixed(6)))
    },
    figureFraction: Number(result.figureFraction.toFixed(5)),
    illConditionedFringe: Number(result.illConditioned.toFixed(4)),
    clippedFringe: Number(result.clippedFringe.toFixed(4)),
    medianSeparation: Number(result.medianSeparation.toFixed(4)),
    medianSnr: Number(result.medianSnr.toFixed(1)),
    interiorDepthPx: Number(result.coreDepthPx.toFixed(3)),
    softEdgePx: {
      median: Number(result.softBand.medianPx.toFixed(2)),
      p99: Number(result.softBand.p99Px.toFixed(2)),
      max: Number(result.softBand.maxPx.toFixed(2)),
      measurableTo: result.softBand.capPx
    },
    fallbackCurve: result.transfer.map((t) => ({
      crude: Number(t.crude.toFixed(4)),
      solved: Number(t.solved.toFixed(4)),
      n: t.n
    })),
    fringePurity: result.purity.map((b) => ({
      coverage: `${b.lo.toFixed(2)}-${b.hi.toFixed(2)}`,
      n: b.n,
      meanLevels: Number(b.mean.toFixed(2))
    })),
    figureTouchesFrameEdges: result.touchesEdges
  }
};
writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 2) + '\n');
console.log(`    audit record             ${rel(AUDIT_FILE)}\n`);
console.log(`cutouts: keyed ${basename(source)}.`);
if (extname(source).toLowerCase() === '.webp' || extname(source).toLowerCase() === '.png') {
  // Nothing wrong with it — just worth knowing that a lossless source is being re-encoded.
  console.log('cutouts: note — the source is lossless; the outputs are lossy WebP (see DECISIONS §12).');
}
