<!--
  Public-site chrome. Lives in the `(site)` route group so the editor routes
  outside it, /admin and /publish, render bare.
-->
<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';

  let { children } = $props();

  /* Smooth scrolling is for MOVING WITHIN a page, not for arriving at one.
     `html { scroll-behavior: smooth }` in app.css is what makes the nav glide
     down to a section, and it is right for that — but it also caught
     SvelteKit's own scroll-to-top on a navigation, so following a service or a
     blog link animated the whole page back up before the new one appeared.
     That reads as the site losing its place, not as polish.

     So it is turned off for the duration of a navigation that CHANGES the
     path, and left alone for one that only changes the fragment, which is the
     in-page case.

     RESTORED TWO WAYS, and that is not belt-and-braces for its own sake. The
     right moment is the frame after the navigation — SvelteKit applies its
     scroll while `afterNavigate` runs, and putting the property back any
     earlier hands the animation straight back — but `requestAnimationFrame`
     does not fire in a tab the browser has throttled or backgrounded. Measured
     exactly that: the suppression went on and never came off, which would have
     left smooth scrolling dead for the rest of the session, on every anchor,
     silently. The timeout is later than ideal and cannot be paused. */
  let suppressed = false;

  function restoreScrollBehaviour() {
    document.documentElement.style.scrollBehavior = '';
  }

  beforeNavigate(({ from, to }) => {
    if (!to || from?.url.pathname === to.url.pathname) return;
    document.documentElement.style.scrollBehavior = 'auto';
    suppressed = true;
  });

  afterNavigate(() => {
    if (!suppressed) return;
    suppressed = false;
    requestAnimationFrame(restoreScrollBehaviour);
    setTimeout(restoreScrollBehaviour, 120);
  });

  // The open menu is an opaque, full-viewport panel, so everything behind it
  // has to leave the tab order and the accessibility tree. `inert` on the
  // page is the documented shape for this and it also fixes find-in-page and
  // pointer hit-testing; trapping focus by script would fix neither. The
  // header and the panel are siblings of these, so they stay live.
  let menuOpen = $state(false);
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
