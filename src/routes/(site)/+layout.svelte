<!--
  Public-site chrome. Lives in the `(site)` route group so the editor routes
  outside it, /admin and /publish, render bare.
-->
<script lang="ts">
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import StudioPanel from '$lib/dev/StudioPanel.svelte';

  let { children } = $props();

  // The open menu is an opaque, full-viewport panel, so everything behind it
  // has to leave the tab order and the accessibility tree. `inert` on the
  // page is the documented shape for this and it also fixes find-in-page and
  // pointer hit-testing; trapping focus by script would fix neither. The
  // header and the panel are siblings of these, so they stay live.
  let menuOpen = $state(false);

  // `import.meta.env.DEV` is a compile-time constant, so the panel and its
  // import are removed from the production bundle entirely rather than being
  // shipped behind a runtime check.
  const dev = import.meta.env.DEV;
</script>

<a href="#main" class="skip">Skip to content</a>

<div class="flex min-h-dvh flex-col">
  <SiteHeader bind:open={menuOpen} />
  <main id="main" tabindex="-1" class="flex-1 scroll-mt-24 focus:outline-none" inert={menuOpen}>
    {@render children()}
  </main>
  <div inert={menuOpen}>
    <SiteFooter />
  </div>
</div>

{#if dev}
  <StudioPanel />
{/if}

<style>
  /* The page must not scroll behind the panel. */
  :global(html:has(#site-menu.is-open)) {
    overflow: hidden;
  }

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
