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

/** `/counselling/individual/` → `counselling/individual`, which is the shape
 *  a rest parameter carries. */
const asParam = (path: string) => path.replace(/^\/|\/$/g, '');

export const entries: EntryGenerator = () =>
  detailServices().map((service) => ({ service: asParam(servicePath(service)) }));

export const load: PageLoad = ({ params }) => {
  const service = detailServices().find((s) => asParam(servicePath(s)) === params.service);
  if (!service) error(404, 'Not found');
  return { service };
};
