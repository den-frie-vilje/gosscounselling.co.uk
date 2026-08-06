<!--
  Testimonials, one at a time.

  Renders nothing at all when the list is empty, so the section can sit in the
  page from the start and simply appear the day John adds the first one. No
  empty state and no "coming soon": a therapy site with a blank testimonial
  rail looks worse than one without the rail.

  Set as a quotation rather than as content in a box. No cards, because
  nothing on this page is a card; no index numbers, because a quote is not an
  item in a sequence; and no star ratings, because nobody has given John a
  score and inventing one would be a lie.

  No heading and no standing note: a quotation introduced by a sentence telling
  you it is a quotation is weaker than the quotation. The kicker stays, because
  every other section on the page has one and it labels rather than introduces.

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

  /* ---- dragging ----
     A horizontal drag moves between quotes. Pointer events rather than touch
     events, so a mouse and a pen do the same thing as a finger without a
     second code path.

     VERTICAL IS THE PAGE'S. `touch-action: pan-y` on the rail tells the
     browser up front that only horizontal gestures are ours, so a scroll that
     starts on a quote scrolls the page — on a phone the rail is most of the
     screen, and a carousel that swallows vertical drags is a trap. The
     direction test below is the same rule in JavaScript, for the pointer
     types `touch-action` does not cover.

     The quotes are stacked in one grid cell and crossfade, so there is no
     track to slide: the CURRENT quote follows the finger and fades as it
     goes, and on release either its neighbour takes over or it returns. */
  let dragging = $state(false);
  let drag = $state(0);
  let startX = 0;
  let startY = 0;
  /** null until the gesture has declared itself horizontal or vertical. */
  let horizontal: boolean | null = null;

  /** Enough travel to be a decision rather than a twitch: a proportion of the
   *  rail, floored so a narrow screen still needs a real movement. */
  function threshold(el: HTMLElement): number {
    return Math.max(44, el.getBoundingClientRect().width * 0.12);
  }

  function onPointerDown(event: PointerEvent) {
    if (!many || event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    horizontal = null;
    dragging = true;
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (horizontal === null) {
      // Wait for enough movement to tell the two apart; 8px is about where a
      // deliberate gesture separates from the noise of putting a finger down.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (!horizontal) {
        // Theirs. Let go entirely rather than half-tracking it.
        dragging = false;
        drag = 0;
        return;
      }
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    // Damped, so the quote moves with the finger without travelling as far as
    // it does: this is a hand-over, not a pane being pushed off screen.
    drag = dx * 0.55;
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return;
    const el = event.currentTarget as HTMLElement;
    const dx = event.clientX - startX;
    dragging = false;
    if (horizontal && Math.abs(dx) > threshold(el)) {
      go(dx < 0 ? index + 1 : index - 1);
    }
    drag = 0;
    horizontal = null;
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
      <p class="t-kicker kick">{testimonials.kicker}</p>

      <!-- `aria-roledescription` names the pattern for screen readers, and the
           live region announces the new quote when the controls move it.

           The arrow-key handler is on the BUTTONS rather than on this group.
           A group is not interactive, so a key listener on it is unreachable
           for anyone who cannot put focus there, and the buttons are where a
           keyboard user's focus already is. -->
      <div
        class="quotes"
        class:dragging
        style="--drag: {drag}px"
        role="group"
        aria-roledescription="carousel"
        aria-label={testimonials.kicker}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
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
  /* Centred with the quotes rather than ranged left like the other section
     kickers: a left-ranged label over a centred quote reads as a mistake. */
  .kick {
    margin: 0;
    text-align: center;
  }
  .quotes {
    margin-top: 28px;
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
    transform: translateX(var(--drag, 0px));
    transition:
      opacity var(--dur-base) var(--ease-brand),
      transform var(--dur-base) var(--ease-brand),
      visibility 0s;
  }
  /* While the finger is down the quote tracks it exactly — a transition here
     would make it lag behind the touch, which reads as the page being slow
     rather than as easing. It comes back on release, which is what makes the
     return a movement rather than a jump. */
  .quotes.dragging .quote.is-current {
    transition: none;
  }
  /* Only horizontal gestures are ours. Declared to the browser rather than
     only handled in JavaScript, so a vertical scroll that starts on a quote is
     never delayed while a script decides whether to keep it. */
  .quotes {
    touch-action: pan-y;
  }
  @media (prefers-reduced-motion: reduce) {
    .quote,
    .quote.is-current {
      transition: none;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .quote,
    .quote.is-current {
      transition: visibility 0s;
    }
  }

  /* The display face, at reading size. It has come down twice: from 38px,
     which put a quotation almost level with the h2 above it, and then from
     26px, which still read as a heading in its own right. It now tops out
     just under the lead, so a quote is plainly a voice inside the page rather
     than a section announcing itself.

     The measure widens as the size comes down, so the line count stays
     roughly where it was rather than the quote becoming a narrow column.
     Weight stays at 400: a quotation carries by being set well rather than by
     being made bold. */
  blockquote {
    margin: 0 auto;
    max-width: 42ch;
    font-family: var(--font-display);
    font-size: clamp(19px, 1.8vw, 23px);
    /* Book italic: Fraunces' drawn italic at its regular weight, loaded as a
       real face in app.css rather than left to the browser to shear. */
    font-style: italic;
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
