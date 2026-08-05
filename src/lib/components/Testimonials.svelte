<!--
  Testimonials.

  Renders nothing at all when the list is empty, so the section can sit in the
  page from the start and simply appear the day John adds the first one. No
  empty state, no "coming soon": a therapy site with a blank testimonial rail
  looks worse than one without the rail.

  Deliberately unrated and unboxed. There are no stars, because nobody has
  given John a score and inventing one would be a lie; and the quotes sit on
  the ground with a rule between them rather than in cards, to match the rest
  of the scroll.
-->
<script lang="ts">
  import { testimonials } from '$lib/content';
</script>

{#if testimonials.items.length > 0}
  <section id="testimonials" class="section-y bg-mist text-ink">
    <div class="container-page">
      <div class="section-head">
        <p class="t-kicker m-0 mb-3.5">{testimonials.kicker}</p>
        <h2 class="t-h2">{testimonials.heading}</h2>
        {#if testimonials.note}
          <p class="mt-4 mb-0 text-[18px] text-muted">{testimonials.note}</p>
        {/if}
      </div>

      <ul class="border-line-cool mt-12 list-none border-t p-0">
        {#each testimonials.items as item, i (item.quote)}
          <li class="border-line-cool border-b">
            <figure class="quotefig mark-row">
              <p class="num mark" aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
              <blockquote class="quote">{item.quote}</blockquote>
              <figcaption class="cap">
                {item.name}{#if item.detail} · {item.detail}{/if}
              </figcaption>
            </figure>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<style>
  /* The caption has to be an immediate child of the figure, so the number
     and the quote are laid out by named areas rather than by wrapping the
     quote and caption in a div. */
  .quotefig {
    margin: 0;
    padding-block: 36px;
    display: grid;
    gap: 16px;
    grid-template-areas:
      'num'
      'quote'
      'cap';
  }
  @media (min-width: 53.75rem) {
    .quotefig {
      grid-template-columns: auto 1fr;
      column-gap: 40px;
      row-gap: 16px;
      grid-template-areas:
        'num quote'
        '.   cap';
    }
  }
  .num {
    grid-area: num;
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    /* The quote runs clamp(20px, 2.4vw, 26px); the numeral is a fixed
       fraction of it so the alignment ratio holds across the clamp. */
    --mark-ratio: 1.6;
    font-size: calc(clamp(20px, 2.4vw, 26px) / 1.6);
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
  }
  .quote {
    grid-area: quote;
    margin: 0;
    min-width: 0;
    font-family: var(--font-display);
    font-size: clamp(20px, 2.4vw, 26px);
    line-height: 1.35;
    color: var(--color-ink);
    max-width: 44ch;
  }
  .cap {
    grid-area: cap;
    font-size: 15px;
    color: var(--color-muted);
  }
</style>
