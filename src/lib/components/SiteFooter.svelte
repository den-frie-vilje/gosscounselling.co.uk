<!--
  The footer. It shares the contact band's ground, so the two read as one dark
  close to the page rather than as two stacked bands.

  THREE VOICES, NOT ONE. The first version set everything — his name, his
  number, the copyright, the build stamp — at 14.5px in one muted grey and let
  a flex-wrap decide the order. Nothing was more important than anything else,
  so the eye had nowhere to land and the row read as a drawer of leftovers.
  Now there is a hierarchy, and it is the page's own:

    1. the lockup, in the display face, the same one the header opens with, so
       the page closes the way it began;
    2. the ways to reach him, in the sans at reading size, because after a
       whole page about whether to ring him this is the last chance to;
    3. the fine print — the copyright and the build stamp — below a hairline,
       small and quiet, because it is a legal line and a serial number rather
       than something anyone came here to read.

  The build stamp is deliberately fainter than the contrast floor and is not in
  check-contrast's table. It is not content: it is the git sha, here so that we
  can tell which build a page came from when John says "it still looks wrong".
  A reader who does not know what a sha is loses nothing by not seeing it.
-->
<script lang="ts">
  import { contact, footerNote, site, social } from '$lib/content';
  import SocialIcon from './SocialIcon.svelte';
  import { PUBLIC_BUILD_TIME, PUBLIC_GIT_SHA } from '$env/static/public';

  // Prerendered at build time. A `new Date()` here would bake the build
  // machine's date, so the year comes from the same moment the page does and
  // is refreshed by the next deploy, which is at least honest about what it
  // is. The CI build stamp below says when that was.
  const year = new Date().getFullYear();
  const buildDate = PUBLIC_BUILD_TIME ? PUBLIC_BUILD_TIME.slice(0, 10) : '';
</script>

<footer class="bg-deep text-on-deep-muted">
  <div class="container-page border-t border-white/15 pt-9 pb-12">
    <div class="top">
      <div>
        <!-- The header's lockup, on the dark ground. Not a link: the header's
             one goes to the top of the page and this sits at the bottom, where
             an anchor that throws the reader back up is a trapdoor. -->
        <p class="lockup">
          {site.name}<span>{site.tagline}</span>
        </p>

        <p class="reach">
          <a href={contact.phoneHref}>{contact.phone}</a>
          <span class="dot" aria-hidden="true">·</span>
          <a href={contact.emailHref}>{contact.email}</a>
        </p>
      </div>

      {#if social.profiles.length}
        <!-- Icon-only links, so each carries its own name for anyone who
             cannot see the glyph. They open in a new tab because they leave
             the site, and `noopener` because a link that opens a tab should
             not hand that tab a reference back to this one. -->
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
    </div>

    <div class="fine">
      <p class="m-0">{footerNote(year)}</p>
      {#if PUBLIC_GIT_SHA}
        <p class="stamp m-0">
          {PUBLIC_GIT_SHA.slice(0, 7)}{#if buildDate} · {buildDate}{/if}
        </p>
      {/if}
    </div>
  </div>
</footer>

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem 2.5rem;
  }

  /* 1. The lockup — the header's, at the header's proportions, on the dark. */
  .lockup {
    margin: 0;
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: #fff;
  }
  .lockup span {
    display: block;
    margin-top: 3px;
    font-family: var(--font-sans);
    font-size: 11.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-on-deep-kicker);
  }

  /* 2. The ways to reach him, at reading size rather than fine-print size. */
  .reach {
    margin: 1.1rem 0 0;
    font-size: 15.5px;
    line-height: 1.5;
    color: var(--color-on-deep);
  }
  .reach a {
    color: inherit;
    text-decoration-color: rgb(255 255 255 / 0.35);
    text-underline-offset: 4px;
    /* WCAG 2.5.8 asks for a 24 by 24 target and exempts a link sitting INSIDE
       a sentence, where the line already constrains it. These two are not in a
       sentence: they are the number and the address side by side with a middot
       between them, which is a pair of ADJACENT targets — exactly the case the
       spacing exception does not save. The padding is on the anchor rather
       than the line, so the text does not move; only the box it can be hit by
       grows. */
    display: inline-block;
    padding-block: 3px;
    transition: color var(--dur-fast) linear;
  }
  .reach a:hover {
    color: #fff;
    text-decoration-color: currentColor;
  }
  .dot {
    padding-inline: 0.15em;
    color: var(--color-on-deep-kicker);
  }

  .socials {
    --glyph: 20px;
    --target: 40px;

    display: flex;
    align-items: center;
    gap: 4px;
    list-style: none;
    padding: 0;
    /* The hit target is twice the glyph, so each end of the row carries half
       that difference as empty space and the first mark sits 10px in from
       wherever the row starts. On a phone the row is under his name and the
       indent is visible against it; on a desktop it is against the right
       margin instead. Pulling the row out by that half undoes it, so the
       glyphs — not their boxes — line up with the column. */
    margin: 0 calc((var(--glyph) - var(--target)) / 2);
  }
  /* The glyph is 20px inside a 40px target, which clears WCAG 2.5.8's 24 by 24
     without drawing a button around it. The box is square and fixed: a mark
     wider than 40 would push its neighbours out of the rhythm, and the rhythm
     is the only thing making three marks from two different icon sets read as
     one row. */
  .socials a {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--color-on-deep-kicker);
    transition: color var(--dur-fast) linear;
  }
  .socials a:hover,
  .socials a:focus-visible {
    color: #fff;
  }

  /* 3. The fine print, below its own hairline. */
  .fine {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.35rem 2rem;
    margin-top: 2.25rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgb(255 255 255 / 0.08);
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-on-deep-kicker);
  }

  /* Almost invisible on purpose — see the note at the top of this file. It
     comes up to legible on hover, which is the only time anyone wants it. */
  .stamp {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: rgb(255 255 255 / 0.16);
    transition: color var(--dur-fast) linear;
  }
  .stamp:hover {
    color: rgb(255 255 255 / 0.55);
  }
</style>
