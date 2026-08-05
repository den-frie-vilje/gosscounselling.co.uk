<!--
  A section of the scroll.

  The sections are told apart by their ground and by a hairline, never by a
  box: that is the layout John picked out of the two prototypes, and this
  component is what keeps it consistent as the page grows.

  `surface` chooses the ground. `rule` draws the hairline for two sections
  that share one, which is how a change of subject reads on an unchanged
  ground.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    surface?: 'paper' | 'mist' | 'sand' | 'deep';
    /** Draw a hairline above the section. For neighbours on the same ground. */
    rule?: boolean;
    kicker?: string;
    heading?: string;
    intro?: string;
    /** Renders the heading as an <h1>. The home page's first section only. */
    h1?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    id,
    surface = 'paper',
    rule = false,
    kicker,
    heading,
    intro,
    h1 = false,
    class: klass = '',
    children
  }: Props = $props();

  const grounds: Record<string, string> = {
    paper: 'bg-paper text-ink',
    mist: 'bg-mist text-ink',
    sand: 'bg-sand text-ink',
    deep: 'bg-deep text-on-deep'
  };
</script>

<section {id} class="section-y {grounds[surface]} {klass}">
  <div class="container-page">
    {#if rule}
      <hr class="rule mb-14" />
    {/if}

    {#if kicker || heading || intro}
      <div class="section-head">
        {#if kicker}
          <p class="t-kicker led m-0 mb-3.5" class:on-deep={surface === 'deep'}>{kicker}</p>
        {/if}
        {#if heading}
          {#if h1}
            <h1 class="t-h2">{heading}</h1>
          {:else}
            <h2 class="t-h2">{heading}</h2>
          {/if}
        {/if}
        {#if intro}
          <p class="mt-4 mb-0 text-[18px]" class:intro-deep={surface === 'deep'} class:intro-light={surface !== 'deep'}>
            {intro}
          </p>
        {/if}
      </div>
    {/if}

    {@render children()}
  </div>
</section>

<style>
  .on-deep {
    color: var(--color-on-deep-kicker);
  }
  .intro-light {
    color: var(--color-muted);
  }
  .intro-deep {
    color: var(--color-on-deep-muted);
  }
  section :global(h1),
  section :global(h2) {
    color: inherit;
  }
</style>
