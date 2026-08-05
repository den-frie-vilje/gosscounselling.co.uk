/**
 * Build the hero cut-out from whichever photograph is present.
 *
 *     node scripts/gen-cutouts.ts                 # key the photograph, if there is one
 *     node scripts/gen-cutouts.ts --self-test     # prove the failure path, on synthetic frames
 *     node scripts/gen-cutouts.ts --source docs/source-assets/John-Goss-1.jpg \
 *                                 --out-dir /tmp/audit   # audit a run without touching the assets
 *     node scripts/gen-cutouts.ts --source ... --out-dir /tmp/audit --compare
 *                                                 # and measure it against the committed pair
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

/** The two names the page asks for; see `src/routes/(site)/+page.svelte`. */
const OUT_LIGHT = 'john-cutout.webp';
const OUT_DARK = 'john-cutout-dark.webp';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};

const SELF_TEST = flag('--self-test');
const COMPARE = flag('--compare');
const OUT_DIR = resolve(root, opt('--out-dir') ?? 'static/img');
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

  if (r.agreement.length) {
    console.log('\n  CRUDE DISTANCE KEY vs KNOWN-BACKING SOLVE (median, well-conditioned pixels)');
    console.log('    crude    ' + r.agreement.map((a) => a.crude.toFixed(2).padStart(6)).join(''));
    console.log('    solved   ' + r.agreement.map((a) => a.solved.toFixed(2).padStart(6)).join(''));
    console.log('    n        ' + r.agreement.map((a) => String(a.n).padStart(6)).join(''));
  }

  console.log('\n  EDGE TREATMENT');
  console.log(`    edge band                full to ${r.edgeBand.in.toFixed(2)}px in, zero from ${r.edgeBand.out.toFixed(2)}px in`);
  console.log(`                             ${r.edgeBand.width.toFixed(2)}px wide, smootherstep (C2) between`);
  console.log(`    de-lighting belongs to   the ${r.delitIsFor} ground` +
    ` (backing is ${r.delitIsFor === 'dark' ? 'brighter' : 'darker'} than the subject)`);
  console.log(`    fitted psi in the band   max ${r.psiMax.toFixed(3)}, mean ${r.psiMean.toFixed(4)}`);
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
  // subsampling is an irreducible error that quality does not buy off — and chose the
  // edge band against it, so changing them here would invalidate that sweep.
  await sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(file);
  return statSync(file).size;
}

// ---------------------------------------------------------------------------
// --compare: this key against the committed, hand-tuned pair.
//
// The two are NOT expected to be identical and one of them is not "right". The hand pass
// started from a matte a person pulled and then reconstructed the clipped crown
// (DECISIONS §11), which is why its canvas is taller; this pass starts from the
// photograph and reconstructs nothing. What the comparison is for is to say WHERE they
// differ and by how much, in numbers, so that a swap is a decision and not a surprise.
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

async function compareToCommitted(
  result: KeyResult,
  lightRgb: Uint8Array,
  darkRgb: Uint8Array
) {
  console.log('\n  AGAINST THE COMMITTED HAND-TUNED PAIR');
  for (const [name, mineRgb] of [
    [OUT_LIGHT, lightRgb],
    [OUT_DARK, darkRgb]
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
      // A soft-edged ellipse: signed distance in ellipse units, ramped over 3px.
      let a = 0;
      if (subject) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const px = (1 - d) * Math.min(rx, ry);
        a = Math.min(1, Math.max(0, (px + 1.5) / 3));
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
  const keys = (
    name: string,
    o: SynthOpts,
    e: { alphaTol: number; fgTol: number; delitIsFor?: 'dark' | 'light' }
  ) => {
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
      for (let c = 0; c < 3; c++) devs.push(Math.abs(r.ground[i * 3 + c] - s.fg[c]));
    }
    devs.sort((a, b) => a - b);
    const meanDev = devs.reduce((a, b) => a + b, 0) / Math.max(devs.length, 1);
    const p999 = devs[Math.min(devs.length - 1, Math.floor(devs.length * 0.999))] ?? 0;
    const pass =
      dc < 2.5 && err < e.alphaTol && meanDev < e.fgTol && (!e.delitIsFor || r.delitIsFor === e.delitIsFor);
    ok(
      name,
      pass,
      `backing ${r.backing.hex} off by ${dc.toFixed(2)}, mean |da| ${err.toFixed(4)} (worst ${worst.toFixed(2)}), ` +
        `fg off by ${meanDev.toFixed(2)} mean / ${p999} p99.9 / ${devs[devs.length - 1]} worst over ` +
        `${n.toLocaleString()} px, de-lit for the ${r.delitIsFor} ground, ` +
        `tilt ${Math.max(...r.backing.tilt).toFixed(1)}, residual ${r.backing.measuredNoise.toFixed(2)}, ` +
        `median SNR ${r.medianSnr.toFixed(0)}x`
    );
    return r;
  };

  console.log('cutouts: self-test — synthetic frames with a known answer\n');
  console.log('  ACCEPTS — the reference framing, and four other photographs it must also key\n');

  // The reference: a gently tilted, mildly noisy white cyclorama, John's own situation.
  const ref = keys('white cyclorama, reference framing', {}, { alphaTol: 0.01, fgTol: 1.5, delitIsFor: 'dark' });
  if (ref) {
    ok(
      'two treatments differ',
      Buffer.compare(Buffer.from(ref.ground), Buffer.from(ref.delit)) !== 0 || ref.psiMax === 0,
      `psi max ${ref.psiMax.toFixed(4)} — a spill-free synthetic legitimately needs no de-lighting`
    );
    ok(
      'edge band scales with width',
      Math.abs(ref.edgeBand.out - (DEFAULTS.edgeOut * 480) / DEFAULTS.refWidth) < 1e-6,
      `${ref.edgeBand.out.toFixed(3)}px at 480px wide, ${DEFAULTS.edgeOut}px at ${DEFAULTS.refWidth}px`
    );
  }

  // A DIFFERENT BACKING TINT. Nothing in the keyer knows what colour a backdrop is; this
  // is the test that says so, because a hard-coded 255 would pass the case above.
  keys('warm cream backdrop, subject at 0.6x', { backing: [236, 228, 212], scale: 0.6 }, { alphaTol: 0.01, fgTol: 1.5 });

  // A MID-GREY backdrop, subject filling much more of the frame. Both ends of the
  // "how much of the border is background" gate move at once.
  keys('mid grey backdrop, subject at 1.35x', { backing: [138, 140, 143], scale: 1.35 }, { alphaTol: 0.012, fgTol: 1.5 });

  // A DARK backdrop with a light subject, which inverts the de-lighting: the rim the
  // backdrop throws is now a DARK one, and psi has to come out negative. If the sign
  // logic were wrong this is where it would show.
  keys(
    'dark studio wall, light subject',
    { backing: [34, 33, 38], fg: [206, 178, 152] },
    { alphaTol: 0.012, fgTol: 1.5, delitIsFor: 'light' }
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

function findSource(): string | null {
  if (SOURCE_ARG) {
    const p = resolve(root, SOURCE_ARG);
    if (!existsSync(p)) {
      console.error(`cutouts: --source ${SOURCE_ARG} does not exist.`);
      process.exit(1);
    }
    return p;
  }
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

const lightPath = resolve(OUT_DIR, OUT_LIGHT);
const darkPath = resolve(OUT_DIR, OUT_DARK);
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
mkdirSync(dirname(AUDIT_FILE), { recursive: true });
const box = alphaBbox(result.alpha, result.width, result.height);
// The de-lighting goes to whichever ground the backing is NOT like; see keyer.ts §7.
const lightRgb = result.delitIsFor === 'light' ? result.delit : result.ground;
const darkRgb = result.delitIsFor === 'dark' ? result.delit : result.ground;
const lightBytes = await writeCutout(lightRgb, result.alpha, result.width, result.height, box, lightPath);
const darkBytes = await writeCutout(darkRgb, result.alpha, result.width, result.height, box, darkPath);

console.log('\n  OUTPUT');
console.log(`    cropped to alpha         ${box.width}x${box.height} at (${box.left}, ${box.top})`);
console.log(`    ${OUT_LIGHT.padEnd(24)} ${(lightBytes / 1024).toFixed(0)} KB   ${rel(lightPath)}`);
console.log(`    ${OUT_DARK.padEnd(24)} ${(darkBytes / 1024).toFixed(0)} KB   ${rel(darkPath)}`);

if (COMPARE) await compareToCommitted(result, lightRgb, darkRgb);

// The audit trail, in the shape a person would want to diff two keyings by. It is NOT
// the gate — `src/lib/generated/build-manifest.json` is — so nothing reads it back and
// deleting it costs nothing but the record.
const audit = {
  note:
    'Written by scripts/gen-cutouts.ts: the numbers the keyer derived from the photograph ' +
    'named below. A record, not a gate — scripts/build-gate.ts decides whether the keying ' +
    'has to happen at all. Do not edit.',
  source: rel(source),
  keyedAt: new Date().toISOString(),
  outputs: {
    light: rel(lightPath),
    dark: rel(darkPath),
    lightBytes,
    darkBytes
  },
  derived: {
    sourceSize: `${result.width}x${result.height}`,
    outputSize: `${box.width}x${box.height}`,
    backing: {
      hex: result.backing.hex,
      centre: result.backing.centre.map((v) => Number(v.toFixed(2))),
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
    medianSeparation: Number(result.medianSeparation.toFixed(4)),
    medianSnr: Number(result.medianSnr.toFixed(1)),
    edgeBandPx: {
      in: Number(result.edgeBand.in.toFixed(3)),
      out: Number(result.edgeBand.out.toFixed(3)),
      width: Number(result.edgeBand.width.toFixed(3))
    },
    delitIsFor: result.delitIsFor,
    psiMax: Number(result.psiMax.toFixed(4)),
    psiMean: Number(result.psiMean.toFixed(5)),
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
