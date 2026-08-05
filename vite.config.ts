import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Drafts never enter the bundle.
 *
 * Filtering them in `$lib/content` is not enough, and the first build with a
 * draft in it proved it: a JSON import becomes a module holding the WHOLE
 * array, and no amount of downstream filtering lets a bundler drop the
 * entries nobody reads, because "nobody reads them" is a fact about the data
 * rather than about the code. That build shipped the draft's title, summary
 * and body inside `_app/immutable/chunks/*.js`, on every page of the site.
 *
 * So the file is filtered on its way in, before Vite's own JSON plugin turns
 * it into a module. What is left is all that any code, on either side, could
 * ever see. A post published with a date in the future IS left in, on
 * purpose: that one is early rather than private, and the listings hold it
 * back in the browser (DECISIONS.md §22).
 *
 * It fails the build rather than passing through anything it cannot parse,
 * and scripts/check-posts.ts is the proof, run against the built output after
 * every build.
 */
function stripDraftPosts(): Plugin {
  return {
    name: 'strip-draft-posts',
    // Before `vite:json`, which would otherwise have turned the text into
    // JavaScript by the time this ran.
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0];
      if (!/\/src\/content\/(mock\/)?posts\.json$/.test(path)) return null;

      let data: { posts?: { status?: string }[] };
      try {
        data = JSON.parse(code);
      } catch (error) {
        this.error(`${path} is not valid JSON: ${(error as Error).message}`);
        return null;
      }

      const posts = (data.posts ?? []).filter((post) => post.status === 'published');
      return { code: JSON.stringify({ ...data, posts }), map: null };
    }
  };
}

export default defineConfig({
  plugins: [stripDraftPosts(), tailwindcss(), sveltekit()],
  server: {
    // Bound to every interface on purpose: the dev preview has to be
    // reachable from a phone on the LAN, not just from this machine.
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  }
});
