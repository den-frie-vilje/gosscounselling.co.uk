<!--
  The footer. It shares the contact band's ground, so the two read as one dark
  close to the page rather than as two stacked bands.
-->
<script lang="ts">
  import { contact, footerNote } from '$lib/content';
  import { PUBLIC_BUILD_TIME, PUBLIC_GIT_SHA } from '$env/static/public';

  // Prerendered at build time. A `new Date()` here would bake the build
  // machine's date, so the year comes from the same moment the page does and
  // is refreshed by the next deploy, which is at least honest about what it
  // is. The CI build stamp below says when that was.
  const year = new Date().getFullYear();
  const buildDate = PUBLIC_BUILD_TIME ? PUBLIC_BUILD_TIME.slice(0, 10) : '';
</script>

<footer class="bg-deep text-on-deep-muted pb-14 text-[14.5px]">
  <div class="container-page flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-7">
    <p class="m-0">{footerNote(year)}</p>
    <p class="m-0">
      <a href={contact.phoneHref}>{contact.phone}</a>
      <span aria-hidden="true"> · </span>
      <a href={contact.emailHref}>{contact.email}</a>
    </p>
    {#if PUBLIC_GIT_SHA}
      <p class="m-0 ml-auto opacity-70">
        build {PUBLIC_GIT_SHA.slice(0, 7)}{#if buildDate} · {buildDate}{/if}
      </p>
    {/if}
  </div>
</footer>

<style>
  a {
    color: #d3e6ea;
  }
  a:hover {
    color: #fff;
  }
</style>
