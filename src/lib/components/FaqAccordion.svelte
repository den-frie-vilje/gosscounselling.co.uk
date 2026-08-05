<!--
  The FAQ, as native <details> elements: keyboard-operable and openable with
  no script at all, which also means it still works if the JS never arrives.
  The same items feed the FAQPage structured data, so the page and the markup
  search engines read cannot drift apart.
-->
<script lang="ts">
  import type { FaqItem } from '$lib/content';
  import Prose from './Prose.svelte';

  interface Props {
    items: FaqItem[];
  }

  let { items }: Props = $props();
</script>

<div class="border-line mt-10 border-t">
  {#each items as item (item.q)}
    <details>
      <summary>{item.q}</summary>
      <div class="body">
        <Prose md={item.a} />
      </div>
    </details>
  {/each}
</div>

<style>
  details {
    border-bottom: 1px solid var(--color-line);
  }
  summary {
    cursor: pointer;
    list-style: none;
    padding: 22px 44px 22px 0;
    position: relative;
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 600;
    color: var(--color-ink);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::marker {
    content: '';
  }
  /* A plus that becomes a minus: two bars, and the upright is dropped when
     the item opens. Drawn rather than typed so it cannot pick up the font's
     own idea of where a plus sign sits. */
  summary::after {
    content: '';
    position: absolute;
    right: 8px;
    top: 30px;
    width: 14px;
    height: 2px;
    background: var(--color-teal);
  }
  summary::before {
    content: '';
    position: absolute;
    right: 14px;
    top: 24px;
    width: 2px;
    height: 14px;
    background: var(--color-teal);
  }
  /* The upright collapses into the crossbar rather than disappearing, so the
     plus becoming a minus is one movement instead of a swap. */
  summary::before {
    transform-origin: center;
    transition: transform var(--dur-base) var(--ease-brand);
  }
  details[open] summary::before {
    transform: scaleY(0);
  }

  /* The answer opens to its own height. `interpolate-size` is what makes a
     transition to `auto` possible at all; without it (Firefox, older Safari)
     the answer simply appears, which is the behaviour a <details> has always
     had and is not a regression. No JavaScript measures anything. */
  details::details-content {
    block-size: 0;
    overflow: hidden;
    transition:
      block-size var(--dur-base) var(--ease-brand),
      content-visibility var(--dur-base) allow-discrete;
  }
  details[open]::details-content {
    block-size: auto;
  }

  .body {
    padding-bottom: 24px;
  }
</style>
