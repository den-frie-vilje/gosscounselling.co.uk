/**
 * The service detail pages, all of them, from one route.
 *
 * A rest parameter rather than `/counselling/[slug]` plus a static
 * `/supervision`, because the addresses are two segments deep for client work
 * and one deep for supervision (docs/information-architecture.md), and a
 * static `/supervision/+page.svelte` would prerender and be advertised in the
 * sitemap on the day John has not written it. Nothing here exists until a
 * service has a `detail` body: `entries()` returns the empty list, so the
 * build produces no page, and `load` refuses anything it did not enumerate.
 *
 * Static routes outrank a rest parameter in SvelteKit's own ordering, so `/`,
 * `/blog`, `/blog/[slug]`, `/admin` and the two endpoint routes are all
 * matched before this one ever sees them.
 */
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { detailServices, servicePath } from '$lib/content';

/** `/counselling/individual/` → `counselling/individual`. Applied to BOTH
 *  sides of the comparison: `trailingSlash: 'always'` means the parameter can
 *  arrive with a slash still on it, and a rest parameter is matched as a
 *  string, so one stray slash is a 404 on a page that exists. */
const asParam = (path: string) => path.replace(/^\/+|\/+$/g, '');

/* Computed. `prerender.entries: ['*']` marks any route with an `entries()`
   export as prerenderable, and a marked route that produces nothing fails the
   build. With no service carrying a `detail` body there is nothing here to
   produce, so the route says so itself rather than the config being told to
   ignore unseen routes, which would swallow a genuine generation failure too. */
export const prerender = detailServices().length > 0;

export const entries: EntryGenerator = () =>
  detailServices().map((service) => ({ service: asParam(servicePath(service)) }));

export const load: PageLoad = ({ params }) => {
  const wanted = asParam(params.service);
  const service = detailServices().find((s) => asParam(servicePath(s)) === wanted);
  if (!service) error(404, 'Not found');
  return { service };
};
