<!--
  Testimonials, one at a time.

  Renders nothing at all when the list is empty, so the section can sit in the
  page from the start and simply appear the day John adds the first one. No
  empty state and no "coming soon": a therapy site with a blank testimonial
  rail looks worse than one without the rail.

  Set as a quotation rather than as content in a box. No cards, because
  nothing on this page is a card; no index numbers, because a quote is not an
  item in a sequence; and no star ratings, because nobody has given John a
  score and inventing one would be a lie. What is left is the sentence
  someone said, centred, in the display face, at a size that says it is worth
  reading.

  With one testimonial there are no controls at all. They appear only when
  there is somewhere to go, which is the same principle as the section itself.
-->
<script lang="ts">
  import { testimonials } from '$lib/content';

  const items = testimonials.items;
  const many = items.length > 1;
  let index = $state(0);

  function go(to: number) {
    index = (to + items.length) % items.length;
  }

  // Left and right move between quotes while the focus is on any of the
  // controls, which is what a keyboard user tries before hunting for a button.
  function onKeydown(event: KeyboardEvent) {
    if (!many) return;
    if (event.key === 'ArrowLeft') {
      go(index - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      go(index + 1);
      event.preventDefault();
    }
  }
</script>

{#if items.length > 0}
  <section id="testimonials" class="section-y bg-mist text-ink">
    <div class="container-page">
      <div class="head">
        <p class="t-kicker m-0 mb-3.5">{testimonials.kicker}</p>
        <h2 class="t-h2">{testimonials.heading}</h2>
        {#if testimonials.note}
          <p class="text-muted mt-4 mb-0 text-[18px]">{testimonials.note}</p>
        {/if}
      </div>

      <!-- `aria-roledescription` names the pattern for screen readers, and the
           live region announces the new quote when the controls move it.

           The arrow-key handler is on the BUTTONS rather than on this group.
           A group is not interactive, so a key listener on it is unreachable
           for anyone who cannot put focus there, and the buttons are where a
           keyboard user's focus already is. -->
      <div
        class="quotes"
        role="group"
        aria-roledescription="carousel"
        aria-label={testimonials.heading}
      >
        <div class="viewport" aria-live="polite" aria-atomic="true">
          {#each items as item, i (item.quote)}
            <figure class="quote" class:is-current={i === index} aria-hidden={i !== index}>
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                {item.name}{#if item.detail}<span class="detail"> · {item.detail}</span>{/if}
              </figcaption>
            </figure>
          {/each}
        </div>

        {#if many}
          <div class="controls">
            <button
              type="button"
              class="arrow"
              aria-label="Previous"
              onclick={() => go(index - 1)}
              onkeydown={onKeydown}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M15 5.5 8.5 12 15 18.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            <ul class="dots">
              {#each items as item, i (item.quote)}
                <li>
                  <button
                    type="button"
                    class="dot"
                    class:on={i === index}
                    aria-label={`Show quote ${i + 1} of ${items.length}`}
                    aria-current={i === index ? 'true' : undefined}
                    onclick={() => go(i)}
                    onkeydown={onKeydown}
                  ></button>
                </li>
              {/each}
            </ul>

            <button
              type="button"
              class="arrow"
              aria-label="Next"
              onclick={() => go(index + 1)}
              onkeydown={onKeydown}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M9 5.5 15.5 12 9 18.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </section>
{/if}

<style>
  /* The head is centred with the quotes rather than ranged left like every
     other section head on the page: a left-ranged head over a centred quote
     reads as a mistake rather than as a decision. */
  .head {
    max-width: 58ch;
    margin-inline: auto;
    text-align: center;
  }

  .quotes {
    margin-top: 44px;
  }

  /* The quotes are stacked in one grid cell rather than laid side by side, so
     the section is as tall as the LONGEST of them and does not jump as they
     change. A slide would need a track and a translate; this shows one thing
     at a time, and a cross-fade says that with no layout at all. */
  .viewport {
    display: grid;
  }
  .quote {
    grid-area: 1 / 1;
    margin: 0;
    text-align: center;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--dur-base) var(--ease-brand),
      visibility 0s linear var(--dur-base);
  }
  .quote.is-current {
    opacity: 1;
    visibility: visible;
    transition:
      opacity var(--dur-base) var(--ease-brand),
      visibility 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    .quote,
    .quote.is-current {
      transition: visibility 0s;
    }
  }

  /* The display face, at reading size rather than display size. It was
     clamping to 38px, against the section heading's own 42px, which put a
     quotation almost level with the h2 it sits under and made the section
     shout. It now tops out a little above the lead, which is where a quote
     belongs: larger than body copy, plainly smaller than the heading.

     The measure widens as the size comes down, so the line count stays
     roughly where it was rather than the quote becoming a narrow column.
     Weight stays at 400: a quotation carries by being set well rather than by
     being made bold. */
  blockquote {
    margin: 0 auto;
    max-width: 34ch;
    font-family: var(--font-display);
    font-size: clamp(19px, 2.1vw, 26px);
    font-weight: 400;
    line-height: 1.42;
    letter-spacing: -0.01em;
    color: var(--color-ink);
    text-wrap: balance;
  }
  figcaption {
    margin-top: 20px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-muted);
  }
  .detail {
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: none;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    margin-top: 36px;
  }
  /* 44px of touch target around a 20px glyph: the WCAG minimum, without
     drawing a button anyone has to look at. */
  .arrow {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--color-teal);
    cursor: pointer;
  }
  .arrow svg {
    width: 20px;
    height: 20px;
  }
  .arrow:hover {
    color: var(--color-deep);
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* The dot is 8px; the button around it is 24px so it can be hit, and the
     gap keeps those 24px circles from touching, which is what the target-size
     spacing exception asks for. */
  .dot {
    display: block;
    width: 24px;
    height: 24px;
    padding: 8px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .dot::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-muted);
    opacity: 0.4;
    transition:
      opacity var(--dur-fast) linear,
      background-color var(--dur-fast) linear;
  }
  .dot:hover::before {
    opacity: 0.7;
  }
  .dot.on::before {
    background: var(--color-teal);
    opacity: 1;
  }
</style>
