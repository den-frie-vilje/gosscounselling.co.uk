/**
 * The generated-asset pipeline, and the list of what it is allowed to skip.
 *
 *     node scripts/gen-assets.ts              # run whatever is stale, skip the rest
 *     node scripts/gen-assets.ts --force      # run everything
 *     node scripts/gen-assets.ts --only og    # one step, still gated
 *     node scripts/gen-assets.ts --list       # print the dependency table and stop
 *
 * This file is the DATA: which steps exist, what each one reads, what each one writes.
 * `scripts/build-gate.ts` is the mechanism. The record is one committed manifest,
 * `src/lib/generated/build-manifest.json`, so a fresh CI checkout reaches the same
 * conclusion as a laptop that has built a hundred times.
 *
 * WHY THIS EXISTS. Three steps in this build are expensive and were unconditional:
 * keying the portrait (~17 s), rendering the OG cards through satori and resvg, and
 * measuring the cut-out for the page's geometry. None of their inputs change on an
 * ordinary copy edit, so an ordinary deploy was paying for all three every time. Worse,
 * `static/img/john-cutout*.webp` and `src/lib/generated/portrait-geometry.json` are
 * COMMITTED, so an unconditional rebuild put a fresh binary in every deploy's diff whether
 * or not the picture had changed.
 *
 * THE ORDER IS THE DEPENDENCY ORDER. cut-out → geometry (measured from the cut-out) →
 * OG cards (composited from both). A step that is skipped leaves its outputs exactly as
 * they were, so the step after it is skipped too, and the whole chain collapses to five
 * hashes and three lines of output.
 *
 * EACH STEP RUNS AS A CHILD PROCESS, on purpose. `scripts/gen-og.ts` and
 * `scripts/check-portrait-fit.ts` are top-level scripts that do their work on import and
 * exit with a status; importing them would run them and take the process down with them.
 * Spawning also keeps every one of them runnable on its own, which is how they are
 * debugged.
 *
 * THE PORTRAIT ASSETS ARE MATCHED, NOT NAMED. `PORTRAIT_ASSETS` is a pattern over the top
 * level of `static/img/`, and the gate records whatever it finds. The delivered cut-out is
 * being reworked from a light/dark pair into a single straight-alpha asset as this is
 * written: a gate that hard-coded `john-cutout.webp` and `john-cutout-dark.webp` would be
 * wrong the moment that lands, and wrong SILENTLY, which is the failure mode a cache has
 * to be designed against.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MissingInputError, runSteps } from './build-gate.ts';
import type { Ref, Step } from './build-gate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(root, 'src/lib/generated/build-manifest.json');

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const LIST = argv.includes('--list');
const onlyAt = argv.indexOf('--only');
const ONLY = onlyAt >= 0 && onlyAt + 1 < argv.length ? argv[onlyAt + 1].split(',') : undefined;

/**
 * The hero portrait assets, whatever they are called this week. The top level of
 * `static/img/` holds nothing else — the logos, the OG cards and the responsive photo
 * variants are all in subdirectories — so "an image file directly in static/img" is a
 * complete and rename-proof description of the set.
 */
const PORTRAIT_ASSETS: Ref = { dir: 'static/img', match: /\.(webp|avif|png|jpe?g)$/i, label: 'the portrait assets' };

/** What the CMS writes when John replaces his photograph. Absent until he does. */
const PORTRAIT_SOURCE: Ref = { dir: 'static/img/portrait', match: /\.(jpe?g|png|webp|tiff?)$/i, label: 'his photograph' };

/** Rendered OG cards. Git-ignored, so a fresh checkout re-renders them and says why. */
const OG_CARDS: Ref = { dir: 'static/img/og', match: /\.(png|jpe?g|webp)$/i, label: 'the OG cards' };

function node(script: string, args: string[] = []) {
  const r = spawnSync(process.execPath, [resolve(root, script), ...args], { stdio: 'inherit', cwd: root });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    // The step has already printed why. Exiting with its status keeps a refusal from
    // `gen-cutouts.ts` a red build rather than a warning nobody reads.
    console.error(`\ngen-assets: ${script} exited ${r.status}. Nothing further was run, and the manifest was not updated for it.`);
    process.exit(r.status ?? 1);
  }
}

const STEPS: Step[] = [
  {
    name: 'cutouts',
    describe: 'Keying his portrait is the most expensive thing in the build.',
    // The keyer's own source counts: a change to the physics has to re-key, or the fix
    // ships everywhere except in the asset it was written for.
    inputs: ['scripts/keyer.ts', 'scripts/gen-cutouts.ts'],
    optional: [PORTRAIT_SOURCE],
    outputs: [PORTRAIT_ASSETS],
    run: () => node('scripts/gen-cutouts.ts')
  },
  {
    name: 'portrait-geometry',
    describe: 'The page\'s hero geometry is solved from the cut-out\'s own alpha.',
    inputs: ['scripts/check-portrait-fit.ts', 'src/lib/portrait.config.json', PORTRAIT_ASSETS],
    outputs: ['src/lib/generated/portrait-geometry.json'],
    run: () => node('scripts/check-portrait-fit.ts')
  },
  {
    name: 'og',
    describe: 'Each social card is a satori layout rendered through resvg.',
    inputs: [
      'scripts/gen-og.ts',
      // Whole files rather than the four fields the renderer reads. Coarser on purpose:
      // it can only ever re-render when it did not have to, never fail to when it did,
      // and a field-level dependency would have to be kept in step with someone else's
      // script by hand.
      'src/content/site.json',
      'src/content/home.json',
      'src/lib/generated/portrait-geometry.json',
      // The three .woff faces satori embeds live in node_modules, which is not a place to
      // hash from — it need not exist, and it is not what a clone carries. The lockfile is
      // the committed statement of which font files those will be.
      'pnpm-lock.yaml',
      PORTRAIT_ASSETS
    ],
    outputs: [OG_CARDS],
    run: () => node('scripts/gen-og.ts')
  }
];

if (LIST) {
  console.log('gen-assets: the gated steps, in dependency order\n');
  for (const s of STEPS) {
    const show = (r: Ref) => (typeof r === 'string' ? r : `${r.dir}/ matching ${r.match}`);
    console.log(`  ${s.name}`);
    console.log(`    ${s.describe}`);
    console.log(`    reads   ${s.inputs.map(show).join('\n            ')}`);
    if (s.optional) console.log(`    reads?  ${s.optional.map(show).join('\n            ')}  (may be absent)`);
    console.log(`    writes  ${s.outputs.map(show).join('\n            ')}\n`);
  }
  process.exit(0);
}

try {
  await runSteps(STEPS, { root, manifest: MANIFEST, force: FORCE, only: ONLY });
} catch (e) {
  if (e instanceof MissingInputError) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
