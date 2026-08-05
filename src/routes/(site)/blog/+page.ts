/**
 * The blog index exists only once there is something published to put on it.
 *
 * `prerender` is computed, not a literal: with no published post the route is
 * not prerendered at all, so there is no `build/blog/` directory, nothing in
 * the sitemap and nothing in the navigation. The site launches without a
 * blog, which is what docs/information-architecture.md recommends, and gains
 * one the day John writes.
 *
 * A post that is published with a future date DOES bring the index into
 * being, because that post has to have somewhere to appear on the day.
 */
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { builtPosts } from '$lib/content';

export const prerender = builtPosts.length > 0;

export const load: PageLoad = () => {
  if (builtPosts.length === 0) error(404, 'Not found');
  return {};
};
