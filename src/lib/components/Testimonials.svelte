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

  /**
   * The strip, with a clone of the last quote before the first and a clone of
   * the first after the last.
   *
   * That is what makes the wrap seamless in BOTH directions: dragging left off
   * the end reveals a real quote rather than empty ground, and once the slide
   * has finished the position is reset to the equivalent real slide with the
   * transition off, so the jump is never rendered. Without the clones the only
   * options are a hard snap back across the whole strip or no wrap at all.
   */
  const slides = $derived(many ? [items[items.length - 1], ...items, items[0]] : items);

  /** Position in `slides`. 1 is the first real quote when there are clones. */
  let pos = $state(many ? 1 : 0);
  /** Which real quote that is, for the dots and the announcement. */
  const index = $derived(many ? (pos - 1 + items.length) % items.length : 0);
  /** Suppresses the transition for the one frame the wrap is corrected in. */
  let jumping = $state(false);

  function go(to: number) {
    pos = many ? to + 1 : 0;
  }

  function step(by: number) {
    pos += by;
  }

  /** After a slide finishes, step off a clone onto the real thing it copies. */
  function onTransitionEnd() {
    if (!many) return;
    if (pos !== 0 && pos !== slides.length - 1) return;
    jumping = true;
    pos = pos === 0 ? items.length : 1;
    // Two frames: one for the class to land, one for the browser to paint the
    // new position with it applied. One frame is enough on Chrome and is not
    // on Safari, which animates the correction.
    requestAnimationFrame(() => requestAnimationFrame(() => (jumping = false)));
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

    // Undamped: the strip is a strip, and it goes exactly as far as the finger
    // does. Damping made sense when a single quote was being nudged; on a track
    // it would mean the thing under your thumb is not the thing you are moving.
    drag = dx;
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return;
    const el = event.currentTarget as HTMLElement;
    const dx = event.clientX - startX;
    dragging = false;
    if (horizontal && Math.abs(dx) > threshold(el)) {
      step(dx < 0 ? 1 : -1);
    }
    drag = 0;
    horizontal = null;
  }

  // Left and right move between quotes while the focus is on any of the
  // controls, which is what a keyboard user tries before hunting for a button.
  function onKeydown(event: KeyboardEvent) {
    if (!many) return;
    if (event.key === 'ArrowLeft') {
      step(-1);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      step(1);
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
          <div
            class="track"
            class:jumping
            class:dragging
            style="--pos: {pos}; --drag: {drag}px"
            ontransitionend={onTransitionEnd}
          >
            {#each slides as item, i (i)}
              <!-- Every slide but the current one is hidden from assistive
                   tech. Two of them are clones of quotes already in the strip,
                   and a screen reader reading the same testimonial twice at
                   the seam would be worse than no carousel at all. -->
              <figure class="quote" aria-hidden={i !== pos}>
                <blockquote>{item.quote}</blockquote>
                <figcaption>
                  {item.name}{#if item.detail}<span class="detail"> · {item.detail}</span>{/if}
                </figcaption>
              </figure>
            {/each}
          </div>
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
  /* A strip that slides, not a stack that crossfades.

     The mask is the "fading edges": a quote does not hit a hard boundary and
     stop, it thins out into the ground it sits on. It is on the viewport
     rather than the track so it stays put while the strip moves under it —
     masking the track would drag the fade along with the quotes. */
  .viewport {
    overflow: hidden;
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 8%,
      #000 92%,
      transparent 100%
    );
  }
  /* The track is the viewport's width, and each slide is 100% of THAT, so a
     `translateX` of one slide is exactly `-100%` — percentages in a transform
     resolve against the element's own width, and this is the arrangement where
     that number means what it says. */
  .track {
    display: flex;
    width: 100%;
    transform: translateX(calc(var(--pos) * -100% + var(--drag, 0px)));
    transition: transform 460ms var(--ease-brand);
  }
  .track.dragging {
    transition: none;
  }
  /* The one frame where the position is corrected from a clone to the real
     slide it copies. Without this the correction is animated and the strip
     visibly rewinds. */
  .track.jumping {
    transition: none;
  }
  .quote {
    flex: 0 0 100%;
    margin: 0;
    padding: 0 4%;
    text-align: center;
  }
  /* Only horizontal gestures are ours. Declared to the browser rather than
     only handled in JavaScript, so a vertical scroll that starts on a quote is
     never delayed while a script decides whether to keep it. */
  .quotes {
    touch-action: pan-y;
  }
  @media (prefers-reduced-motion: reduce) {
    .track {
      transition: none;
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
  /* The accent on hover — in its LIGHT-GROUND form. `--color-accent` is the
     acid lime itself and measures about 1:1 against this band: on mist it is
     not a colour, it is an absence. The token is a pair for exactly this, and
     `--color-accent-ink` is the same hue family carried down until it reads.
     These arrows are the control rather than decoration beside one, so 3:1 is
     a floor rather than a preference — check-contrast gates the pairing. */
  .arrow:hover {
    color: var(--color-accent-ink);
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
