<!--
  What a visitor sees at an address that is not here.

  One component, two entrances. `/404/` prerenders it to real HTML, which is
  what `build/404.html` is made from and what a static host serves when a URL
  does not resolve; `+error.svelte` renders the same thing when the client
  router fails to match a link inside the site. Two copies of an apology would
  be two copies to keep in step.

  It keeps the header and the footer, because someone who mistyped a URL, or
  followed a link from the old WordPress site that no longer resolves, needs a
  route to the phone number more than they need an apology.

  It does not quote the address back at them. That tells them nothing they did
  not just type, and echoing a URL into a page is how a static error page turns
  into a reflected-content problem.
-->
<script lang="ts">
  import { contact, home, nav } from '$lib/content';

  interface Props {
    /** The heading. Defaults to the one a missing page gets. */
    heading?: string;
  }
  let { heading = 'That page is not here' }: Props = $props();
</script>

<section class="section-y bg-paper text-ink">
  <div class="container-page">
    <h1 class="t-h2">{heading}</h1>
    <p class="text-muted mt-4 mb-0 max-w-[46ch] text-[18px]">
      The address you followed is not on this site. Everything is on the home page,
      or you can reach me directly.
    </p>

    <ul class="links mt-9 flex list-none flex-wrap gap-x-7 gap-y-3 p-0">
      {#each nav as item (item.href)}
        <li><a href={item.href}>{item.label}</a></li>
      {/each}
    </ul>

    <p class="mt-10 mb-0 flex flex-wrap gap-4">
      <a class="btn btn-primary" href={contact.phoneHref}>{home.hero.ctaPrimary}</a>
      <a class="btn btn-quiet" href={contact.emailHref}>{home.hero.ctaSecondary}</a>
    </p>
  </div>
</section>

<style>
  .links a {
    font-weight: 600;
  }
</style>
