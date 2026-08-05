/**
 * sitemap.xml — an unlinked endpoint route, so it is listed explicitly in
 * svelte.config.js `prerender.entries`; the crawler cannot discover it.
 *
 * $lib/seo/sitemap derives the static routes from the filesystem and refuses
 * to guess at dynamic ones. The concrete URLs behind `[...servicePath]` and
 * `/blog/[slug]` are passed in here, from the same content the pages
 * themselves are generated from, so a page and its sitemap entry cannot
 * disagree about whether it exists.
 *
 * Two deliberate omissions:
 *
 *   The blog index is advertised only while something is live on it. Its own
 *   source carries a conditional `noindex`, which is what keeps it out of the
 *   filesystem-derived list, so it is added back here rather than being
 *   listed the moment the route file exists.
 *
 *   A post published with a date in the future is in the build but is not
 *   advertised: it is not due yet. It joins the sitemap at the next build
 *   after its date, which the daily rebuild makes at most a day away.
 */
import type { RequestHandler } from './$types';
import { sitemapResponse } from '$lib/seo/sitemap';
import { BLOG_PATH, detailServices, postPath, publishedPosts, servicePath } from '$lib/content';

export const prerender = true;

export const GET: RequestHandler = () =>
  sitemapResponse([
    ...detailServices().map(servicePath),
    ...(publishedPosts.length ? [BLOG_PATH] : []),
    ...publishedPosts.map(postPath)
  ]);
