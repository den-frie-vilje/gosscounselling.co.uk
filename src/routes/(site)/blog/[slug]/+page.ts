/**
 * One page per post that is in the build.
 *
 * `entries()` enumerates `builtPosts`, which is published posts only. A draft
 * is not in that list, so it never gets a page and its slug 404s: drafts are
 * private, and the source of this site is public.
 *
 * A post published with a future date IS enumerated, and its page is built.
 * It has to be: nothing rebuilds the site at the moment its time passes, so
 * the page has to be there already for the index to start linking to it. The
 * listings are what hold it back, in the browser; the page itself is simply
 * not linked from anywhere until then, and is not in the sitemap.
 */
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { builtPosts, postSlug } from '$lib/content';

export const entries: EntryGenerator = () => builtPosts.map((post) => ({ slug: postSlug(post) }));

export const load: PageLoad = ({ params }) => {
  const post = builtPosts.find((p) => postSlug(p) === params.slug);
  if (!post) error(404, 'Not found');
  return { post };
};
