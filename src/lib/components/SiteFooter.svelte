<!--
  The footer. It shares the contact band's ground, so the two read as one dark
  close to the page rather than as two stacked bands.
-->
<script lang="ts">
  import { contact, footerNote, social } from '$lib/content';
  import SocialIcon from './SocialIcon.svelte';
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
    {#if social.profiles.length}
      <!-- Icon-only links, so each carries its own name for anyone who cannot
           see the glyph. They open in a new tab because they leave the site,
           and `noopener` because a link that opens a tab should not hand that
           tab a reference back to this one. -->
      <ul class="socials">
        {#each social.profiles as profile (profile.url)}
          <li>
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={profile.label}
            >
              <SocialIcon platform={profile.platform} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    {#if PUBLIC_GIT_SHA}
      <p class="m-0 ml-auto opacity-70">
        build {PUBLIC_GIT_SHA.slice(0, 7)}{#if buildDate} · {buildDate}{/if}
      </p>
    {/if}
  </div>
</footer>

<style>
  .socials {
    display: flex;
    align-items: center;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* The glyph is 20px inside a 40px target: the WCAG minimum, without drawing
     a button around it. */
  .socials a {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--color-on-deep-muted);
    transition: color var(--dur-fast) linear;
  }
  .socials a:hover {
    color: #fff;
  }

  a {
    color: #d3e6ea;
  }
  a:hover {
    color: #fff;
  }
</style>
