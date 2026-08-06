/**
 * Sveltia bundle prebuild copy.
 *
 * Copies the version-pinned Sveltia CMS bundle from
 * `node_modules/@sveltia/cms/dist/sveltia-cms.js` to
 * `static/admin/sveltia-cms.js`, where SvelteKit's static adapter
 * picks it up and serves it at `/admin/sveltia-cms.js`.
 *
 * Self-hosting (vs. a CDN `<script src>`) removes the supply-chain
 * dependency on an external host + floating semver tag. The version is
 * pinned via `package.json` devDependencies; the copied bundle is a
 * build artefact (git-ignored under `static/admin/`).
 *
 * Runs as the `prebuild` lifecycle hook before `vite build`. Node 25
 * strips TypeScript types natively, so this runs as
 * `node scripts/copy-sveltia.ts` with no build step.
 */

import { copyFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SRC = 'node_modules/@sveltia/cms/dist/sveltia-cms.js';
const DST = 'static/admin/sveltia-cms.js';

if (!existsSync(SRC)) {
  console.error(`prebuild: ${SRC} not found — did pnpm install run?`);
  process.exit(1);
}

mkdirSync(dirname(DST), { recursive: true });
copyFileSync(SRC, DST);

const { size } = statSync(DST);
const sizeKb = (size / 1024).toFixed(1);
console.log(`prebuild: copied Sveltia bundle (${sizeKb} KB) → ${DST}`);
