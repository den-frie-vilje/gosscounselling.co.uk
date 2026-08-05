/**
 * robots.txt — per-environment content, prerendered at build time (unlinked
 * endpoint route; listed in svelte.config.js prerender.entries).
 *
 * Production build (PUBLIC_ALLOW_INDEXING=true in `.env.production`): allow
 * crawling, disallow the ROBOTS_DISALLOW paths, advertise the sitemap.
 *
 * Staging and dev builds (PUBLIC_ALLOW_INDEXING=false): disallow everything,
 * no sitemap advert. Staging carries John's name, phone number and fee list
 * on a public hostname; it must never enter an index. Belt and braces with
 * deploy/Caddyfile.staging's `X-Robots-Tag: noindex, nofollow` — the baked
 * file is the primary strap because it deploys atomically with the image, and
 * the header is the backstop.
 *
 * `$env/static/public`, not dynamic: mode-file-sourced at build time and loud
 * on a missing declaration. Fail-closed on top, so only the literal "true"
 * bakes the indexable variant.
 */
import type { RequestHandler } from './$types';
import { PUBLIC_ALLOW_INDEXING } from '$env/static/public';
import { SITE_URL } from '$lib/seo/structured-data';
import { ROBOTS_DISALLOW } from '$lib/seo/robots';

export const prerender = true;

export const GET: RequestHandler = () => {
  const allowIndexing = PUBLIC_ALLOW_INDEXING === 'true';

  const body = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        ''
      ].join('\n')
    : [
        '# Staging build. Crawlable ON PURPOSE, so that the noindex on every',
        '# response is actually read. Nothing here may enter an index.',
        'User-agent: *',
        'Allow: /',
        ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
        ''
      ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
