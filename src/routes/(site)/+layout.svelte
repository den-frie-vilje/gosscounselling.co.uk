<!--
  Public-site chrome. Lives in the `(site)` route group so the editor routes
  outside it, /admin and /publish, render bare.
-->
<script lang="ts">
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import StudioPanel from '$lib/dev/StudioPanel.svelte';

  let { children } = $props();

  // `import.meta.env.DEV` is a compile-time constant, so the panel and its
  // import are removed from the production bundle entirely rather than being
  // shipped behind a runtime check.
  const dev = import.meta.env.DEV;
</script>

<a href="#main" class="skip">Skip to content</a>

<div class="flex min-h-dvh flex-col">
  <SiteHeader />
  <main id="main" tabindex="-1" class="flex-1 scroll-mt-24 focus:outline-none">
    {@render children()}
  </main>
  <SiteFooter />
</div>

{#if dev}
  <StudioPanel />
{/if}

<style>
  /* Off-screen until focused, then a real, visible target at the top left. */
  .skip {
    position: absolute;
    left: -9999px;
  }
  .skip:focus {
    left: 12px;
    top: 12px;
    z-index: 100;
    background: var(--color-deep);
    color: var(--color-on-deep);
    padding: 10px 16px;
    border-radius: 4px;
    text-decoration: none;
  }
</style>
