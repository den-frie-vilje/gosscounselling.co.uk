/**
 * sitemap.xml — an unlinked endpoint route, so it is listed explicitly in
 * svelte.config.js `prerender.entries`; the crawler cannot discover it.
 */
import type { RequestHandler } from './$types';
import { sitemapResponse } from '$lib/seo/sitemap';

export const prerender = true;

export const GET: RequestHandler = () => sitemapResponse();
