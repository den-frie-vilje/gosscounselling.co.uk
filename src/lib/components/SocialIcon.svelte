<!--
  Monochrome social glyph, keyed by a lowercase platform id, drawn in
  `currentColor` so it takes the colour of the link it sits in.

  Paths come from `src/lib/generated/social-icons.ts`, written out of the
  Simple Icons package (CC0) by scripts/gen-social-icons.ts. They are not
  transcribed by hand: a dropped decimal in a brand mark is not something
  anyone would catch by looking.

  IT NEVER RENDERS NOTHING. The old version drew a glyph or an empty element,
  on the reasoning that a missing mark beside a working link is a smaller
  failure than a wrong one — which was true right up until a platform with no
  mark in Simple Icons was added, and then the link had no visible content at
  all. Simple Icons does not carry LinkedIn, at LinkedIn's own request, so this
  is not hypothetical. Without a glyph it sets the platform's name instead, and
  the link stays a link.
-->
<script lang="ts">
  import { SOCIAL_BY_ID } from '$lib/generated/social-icons';

  interface Props {
    platform: string;
    class?: string;
  }
  let { platform, class: klass = '' }: Props = $props();

  const known = $derived(SOCIAL_BY_ID[platform]);
  const path = $derived(known?.path ?? null);
  // An id nobody declared is still shown, spelled as it was written. It means
  // the content and this file have got out of step, and a visible oddity gets
  // fixed where an invisible one does not.
  const text = $derived(known?.title ?? platform);
</script>

{#if path}
  <svg
    class={klass}
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d={path} />
  </svg>
{:else}
  <span class="wordmark {klass}" aria-hidden="true">{text}</span>
{/if}

<style>
  /* Sized to sit on the same line as the 20px glyphs beside it rather than to
     be read on its own. */
  .wordmark {
    display: inline-block;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 20px;
    white-space: nowrap;
  }
</style>
