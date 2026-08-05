/**
 * Admin route — the Sveltia CMS host.
 *
 * Sveltia manages its own client-side routing, so CSR is disabled and
 * SvelteKit renders a pre-baked static host page, leaving the browser to
 * Sveltia. Prerender locks it into the static build.
 */
export const csr = false;
export const prerender = true;
// Emit `admin/index.html` rather than `admin.html`, so the /admin/ directory —
// which also holds the vendored Sveltia bundle and config.yml — has a real
// index. Without this, nginx hits an index-less directory on /admin/ and
// returns 403 instead of the editor.
export const trailingSlash = 'always';
