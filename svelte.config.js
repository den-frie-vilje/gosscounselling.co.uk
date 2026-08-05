import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // The shell for a path that did not prerender — which, on a site where
      // every route prerenders, means a path that does not exist.
      //
      // It was `200.html`, and nginx fell through to it, so every typo and
      // every stale link answered HTTP 200 with an empty page. A crawler
      // reading that has been told the page exists and is blank, which is
      // worse than being told it is gone. `404.html` is also the filename
      // Netlify, Cloudflare Pages and GitHub Pages serve with a 404 status
      // without being configured to, which matters because the copy-to-host
      // workflow hands the same build/ to a host where deploy/nginx.conf
      // does not exist.
      fallback: '404.html',
      // Allow non-prerenderable routes without failing the static build.
      strict: false
    }),
    prerender: {
      // `*` crawls all reachable + static page routes. sitemap.xml and
      // robots.txt are unlinked endpoint routes the crawler can't
      // discover, so list them explicitly.
      entries: ['*', '/sitemap.xml', '/robots.txt']
    }
  }
};

export default config;
