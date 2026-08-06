<!--
  The client router's error state. Prerendered pages never reach this; it is
  for a link inside the site that fails to resolve after hydration. The static
  404 a host serves is /404/, prerendered from the same component.
-->
<script lang="ts">
  import { page } from '$app/state';
  import NotFound from '$lib/components/NotFound.svelte';
  import { labels, site } from '$lib/content';

  const heading = $derived(
    page.status === 404 ? labels.notFound.heading : labels.notFound.errorHeading
  );
</script>

<svelte:head>
  <title>{heading} | {site.name}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<NotFound {heading} />
