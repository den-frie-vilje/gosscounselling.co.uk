<!--
  Prerendered so `build/404.html` is a real page rather than an empty shell.

  adapter-static's `fallback` writes the SPA shell — 1,664 bytes of nothing —
  and a visitor without JavaScript would get a blank page at every mistyped
  address, on a site that otherwise works entirely without it. scripts/gen-404.ts
  copies this route's output over that shell after the build.

  `noindex` keeps it out of the sitemap, which excludes any page whose own
  source declares it (see src/lib/seo/sitemap.ts).
-->
<script lang="ts">
  import NotFound from '$lib/components/NotFound.svelte';
  import { labels, site } from '$lib/content';
</script>

<svelte:head>
  <title>{labels.notFound.heading} | {site.name}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<NotFound />
