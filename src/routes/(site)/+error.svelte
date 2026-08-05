<!--
  The client router's error state. Prerendered pages never reach this; it is
  for a link inside the site that fails to resolve after hydration. The static
  404 a host serves is /404/, prerendered from the same component.
-->
<script lang="ts">
  import { page } from '$app/state';
  import NotFound from '$lib/components/NotFound.svelte';

  const heading = $derived(
    page.status === 404 ? 'That page is not here' : 'Something went wrong'
  );
</script>

<svelte:head>
  <title>{heading} | John Goss</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<NotFound {heading} />
