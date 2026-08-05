<!--
  Single-source renderer for a page's `<svelte:head>` SEO payload. Pure
  rendering; the `PageSeo` shape is built by `$lib/seo/structured-data`.
-->
<script lang="ts">
  import type { PageSeo } from '$lib/seo/structured-data';

  interface Props {
    seo: PageSeo;
  }

  let { seo }: Props = $props();
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="author" content={seo.author} />
  <meta name="theme-color" content={seo.themeColor} />

  <link rel="canonical" href={seo.canonical} />

  <!-- Open Graph -->
  <meta property="og:site_name" content={seo.og.siteName} />
  <meta property="og:title" content={seo.og.title} />
  <meta property="og:description" content={seo.og.description} />
  <meta property="og:type" content={seo.og.type} />
  <meta property="og:locale" content="en_GB" />
  <meta property="og:url" content={seo.og.url} />
  <meta property="og:image" content={seo.og.image.url} />
  <meta property="og:image:alt" content={seo.og.image.alt} />
  <meta property="og:image:width" content={String(seo.og.image.width)} />
  <meta property="og:image:height" content={String(seo.og.image.height)} />
  <meta property="og:image:type" content={seo.og.image.type} />

  <!-- Twitter / X -->
  <meta name="twitter:card" content={seo.twitter.card} />
  <meta name="twitter:title" content={seo.twitter.title} />
  <meta name="twitter:description" content={seo.twitter.description} />
  <meta name="twitter:image" content={seo.twitter.image} />
  <meta name="twitter:image:alt" content={seo.og.image.alt} />

  <!-- Schema.org @graph -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<script type="application/ld+json">${seo.jsonLd}<\/script>`}
</svelte:head>
