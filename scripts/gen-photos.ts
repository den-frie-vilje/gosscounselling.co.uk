/**
 * Build-time responsive photo pipeline (photographs only — everything in
 * `static/img/photos/`; the logos, the cutouts and the favicon live
 * elsewhere in `static/` and are never touched).
 *
 * For each photo, sharp downscales the source into AVIF + WebP `srcset`
 * widths plus a broadly-compatible JPEG fallback in
 * `static/img/photos/_gen/`, and records it in
 * `src/lib/photo-manifest.json` (consumed by `a Photo component (removed until his photographs arrive; the manifest shape is documented here)`). Sources are
 * never upscaled: only widths ≤ the source's own width are emitted, so a
 * small photo simply gets fewer variants.
 *
 * GATED: each source is content-hashed; a photo whose variants already
 * match its hash is skipped — so an ordinary deploy does zero image work
 * and only a genuinely changed/added photo is (re)processed. The hashes
 * live in a sidecar next to the variants rather than in the manifest,
 * because the manifest is the shape `a Photo component (removed until his photographs arrive; the manifest shape is documented here)` reads and the sidecar
 * is only meaningful while the (git-ignored) `_gen/` output survives.
 *
 * Runs in `prebuild` (the production/staging build a CMS photo change
 * triggers).
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = resolve(root, 'static/img/photos');
const GEN_DIR = resolve(SRC_DIR, '_gen');
const MANIFEST = resolve(root, 'src/lib/photo-manifest.json');
const CACHE = resolve(GEN_DIR, '.hashes.json');

/** Candidate widths (px); only those ≤ the source width are emitted. */
const TARGET_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600];
const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;

/** Exactly the shape `src/lib/components/a Photo component (removed until his photographs arrive; the manifest shape is documented here)` reads. */
interface Variant {
  type: string;
  srcset: string;
}
interface PhotoEntry {
  fallback: string;
  width: number;
  height: number;
  variants: Variant[];
}

const writeManifest = (m: Record<string, PhotoEntry>) =>
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');

// An absent `static/img/photos/` is the normal state of a fresh clone: git
// does not track empty directories, and John's photographs are still to
// come. That is "nothing to do", not a build failure.
if (!existsSync(SRC_DIR)) {
  writeManifest({});
  console.log(`photos: ${SRC_DIR} does not exist — wrote an empty manifest, nothing to do.`);
  process.exit(0);
}

// An EMPTY folder is fine; an UNREADABLE one is not — fail loudly rather
// than silently shipping a site with no photo variants.
let sources: string[];
try {
  sources = readdirSync(SRC_DIR).filter((f) => PHOTO_EXT.test(f));
} catch (e) {
  console.error(`photos: cannot read ${SRC_DIR} — ${(e as Error).message}`);
  process.exit(1);
}

if (sources.length === 0) {
  writeManifest({});
  console.log('photos: no photographs in static/img/photos — wrote an empty manifest, nothing to do.');
  process.exit(0);
}

mkdirSync(GEN_DIR, { recursive: true });

const prev: Record<string, PhotoEntry> = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : {};
const prevHashes: Record<string, string> = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, 'utf8'))
  : {};

const manifest: Record<string, PhotoEntry> = {};
const hashes: Record<string, string> = {};
let built = 0;

for (const file of sources) {
  const srcPath = resolve(SRC_DIR, file);
  const name = basename(file, extname(file));
  const key = `/img/photos/${file}`;
  const hash = createHash('sha256').update(readFileSync(srcPath)).digest('hex').slice(0, 12);
  hashes[key] = hash;
  const entry = prev[key];

  // Every path the manifest promises must actually be on disk — a
  // half-deleted `_gen/` must re-emit rather than ship broken <source>s.
  const filesExist = (e?: PhotoEntry) =>
    !!e &&
    e.variants
      .flatMap((v) => v.srcset.split(', ').map((s) => s.split(' ')[0]))
      .concat(e.fallback)
      .every((p) => existsSync(resolve(root, 'static' + p)));

  if (entry && prevHashes[key] === hash && filesExist(entry)) {
    manifest[key] = entry;
    continue;
  }

  const meta = await sharp(srcPath).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) {
    console.warn(`photos: skipping ${file} (no dimensions)`);
    delete hashes[key];
    continue;
  }

  // Never upscale past the source's own width; if the source is narrower
  // than every target, emit it at its native width so there is still a
  // fallback to point at.
  const widths = TARGET_WIDTHS.filter((w) => w <= srcW);
  if (widths.length === 0) widths.push(srcW);
  const maxW = Math.max(...widths);
  const maxH = Math.round((maxW * srcH) / srcW);

  for (const w of widths) {
    // Mild output sharpen restores acuity lost when downscaling — gentle
    // enough to avoid halos.
    const pipe = sharp(srcPath).resize({ width: w, kernel: 'lanczos3' }).sharpen({ sigma: 0.6 });
    await pipe.clone().avif({ quality: 60, effort: 4 }).toFile(resolve(GEN_DIR, `${name}-${w}.avif`));
    await pipe.clone().webp({ quality: 82 }).toFile(resolve(GEN_DIR, `${name}-${w}.webp`));
    if (w === maxW) {
      await pipe.clone().jpeg({ quality: 84, mozjpeg: true }).toFile(resolve(GEN_DIR, `${name}-${w}.jpg`));
    }
  }

  const srcset = (ext: string) =>
    widths.map((w) => `/img/photos/_gen/${name}-${w}.${ext} ${w}w`).join(', ');

  manifest[key] = {
    fallback: `/img/photos/_gen/${name}-${maxW}.jpg`,
    width: maxW,
    height: maxH,
    // Order matters: the browser takes the first <source> it can decode,
    // so AVIF (smallest) must precede WebP.
    variants: [
      { type: 'image/avif', srcset: srcset('avif') },
      { type: 'image/webp', srcset: srcset('webp') }
    ]
  };
  built++;
  console.log(`photos: ${file} → source ${srcW}px → ${widths.length} width(s) (max ${maxW})`);
}

writeManifest(manifest);
writeFileSync(CACHE, JSON.stringify(hashes, null, 2) + '\n');
console.log(`photos: ${sources.length} photo(s), ${built} (re)built.`);
