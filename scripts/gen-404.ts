/**
 * Make `build/404.html` a real page.
 *
 * adapter-static's `fallback` writes the SPA shell there — 1,664 bytes with no
 * content in it. That is fine for the STATUS, which is the half that matters
 * to a crawler, and useless for the visitor: this site works without
 * JavaScript everywhere else, and a blank page at every mistyped address is
 * not a page.
 *
 * So `/404/` is a prerendered route like any other, and this copies its output
 * over the shell once the build has produced both. Root-relative asset paths
 * are identical at either depth, so nothing needs rewriting.
 *
 * `404.html` at the root is also what Netlify, Cloudflare Pages and GitHub
 * Pages serve with a 404 status without being told to, which is why it is that
 * name and not something prettier: the copy-to-host workflow hands this same
 * build/ to a host where deploy/nginx.conf does not exist.
 *
 * Runs in `postbuild`, and fails the build rather than leaving the shell in
 * place — a silent fallback here would be invisible until someone typed a bad
 * URL in production.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'build/404/index.html');
const TARGET = resolve(root, 'build/404.html');

if (!existsSync(SOURCE)) {
  console.error(
    `gen-404: ${SOURCE.replace(root + '/', '')} is missing — the /404/ route did not prerender.\n` +
      '  Without it build/404.html stays the empty SPA shell, so a mistyped address serves a blank page.'
  );
  process.exit(1);
}

const html = readFileSync(SOURCE, 'utf8');

// The shell is the thing being replaced, so "did it work" is a size question.
// A real page carries the header, the footer and the contact buttons; the
// shell is under 2 KB. 4 KB is comfortably between them and nowhere near
// either, so this catches a prerender that silently produced nothing.
const MIN_BYTES = 4096;
if (html.length < MIN_BYTES) {
  console.error(
    `gen-404: the prerendered /404/ page is only ${html.length} bytes, which is shell-sized.\n` +
      `  Expected at least ${MIN_BYTES}. Something rendered, but not the page.`
  );
  process.exit(1);
}

const before = existsSync(TARGET) ? statSync(TARGET).size : 0;
writeFileSync(TARGET, html);
console.log(
  `gen-404: build/404.html is the real page now (${(html.length / 1024).toFixed(1)} KB, was ${(before / 1024).toFixed(1)} KB of shell).`
);
