/**
 * Filesystem-derived sitemap.xml — zero per-page configuration.
 *
 * The URL list is every `+page.svelte` under src/routes, minus
 *   - the ROBOTS_DISALLOW prefixes ($lib/seo/robots — shared with the
 *     robots.txt route, so a disallowed path cannot be advertised here);
 *   - pages whose own source declares `<meta name="robots" … noindex …>`;
 *   - dynamic routes ([param]) — nothing generic can enumerate those; pass
 *     their concrete URLs via `extraPaths` from the endpoint.
 *
 * Entries are `<loc>`-only, which is all the spec requires. Google ignores
 * `<changefreq>` and `<priority>` entirely, and honours `<lastmod>` only when
 * it is consistently and verifiably accurate, which a whole-site build stamp
 * is not. Omitting beats lying.
 */
import { absUrl } from '$lib/seo/structured-data';
import { ROBOTS_DISALLOW } from '$lib/seo/robots';

const pageSources = import.meta.glob('/src/routes/**/+page.svelte', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/**
 * `/src/routes/(site)/foo/+page.svelte` → `/foo/`; group segments drop out.
 *
 * With the trailing slash, because `src/routes/+layout.ts` sets
 * `trailingSlash: 'always'` and every page prerenders to `<path>/index.html`.
 * `/foo` is not the address of anything here, and a sitemap that advertises
 * one URL while the page declares another as canonical is a sitemap arguing
 * with itself. The home page is `/` either way.
 */
function routePath(file: string): string {
  const segments = file
    .replace(/^\/src\/routes/, '')
    .replace(/\/\+page\.svelte$/, '')
    .split('/')
    .filter((seg) => seg && !(seg.startsWith('(') && seg.endsWith(')')));
  return segments.length ? `/${segments.join('/')}/` : '/';
}

const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

export function sitemapPaths(extraPaths: string[] = []): string[] {
  const paths = Object.entries(pageSources)
    .filter(([file]) => !file.includes('['))
    .filter(([, source]) => !NOINDEX.test(source))
    .map(([file]) => routePath(file))
    .filter((path) => !ROBOTS_DISALLOW.some((rule) => path.startsWith(rule)));
  return [...new Set([...paths, ...extraPaths])].sort();
}

export function sitemapResponse(extraPaths: string[] = []): Response {
  const urls = sitemapPaths(extraPaths)
    .map((path) => `  <url>\n    <loc>${absUrl(path)}</loc>\n  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}
