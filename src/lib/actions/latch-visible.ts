/**
 * Latch an element opaque, and never let it go back.
 *
 * Used for the mobile hero portrait. The hide and the fade are pure CSS on a
 * scroll-driven `view()` timeline, so there is no hydration blink: the element
 * is never briefly visible before a script decides otherwise. This action
 * decides the two cases the timeline alone gets wrong.
 *
 * **He must never appear PARTLY faded on first paint.** A view timeline
 * resolves to wherever the element already sits in its range, so a page opened
 * with him half across the viewport bottom, which is any reload part-way down
 * the page, or a link to an anchor, or a restored scroll position, renders him
 * at some arbitrary opacity and simply leaves him there. It reads as a
 * rendering fault rather than as an effect.
 *
 * So the rule is decided by WHEN, not by how much:
 *
 *   at load, visible at all  → fully opaque immediately, no fade
 *   at load, not yet visible → leave the timeline alone; he fades in on the
 *                              scroll, which is the case the effect is for
 *
 * The distinction has to be time-based because an IntersectionObserver cannot
 * tell "the page opened here" from "the reader has just scrolled to here" by
 * ratio alone: both arrive as a callback at a low ratio. The observer's first
 * callback fires with the current state right after `observe()`, so that one
 * is the load, and every later one is a scroll.
 *
 * Once he has been properly seen, the latch also stops the fade running
 * backwards and re-hiding him every time the reader returns to the top.
 *
 * An action rather than an `$effect` that assigns state: latching is a one-way
 * DOM side effect on a specific node, not a derivation, and Svelte 5 treats
 * writing state inside an effect as the loop-shaped mistake even where this
 * particular one could not loop.
 */
export function latchVisible(
  node: HTMLElement,
  options: { className?: string; ratio?: number } = {}
) {
  const className = options.className ?? 'is-revealed';
  /** How far in he must come, once scrolling, before the latch closes. */
  const ratio = options.ratio ?? 0.5;

  if (typeof IntersectionObserver === 'undefined') {
    // No observer means no latch, so leave him visible rather than hidden: the
    // failure to avoid is a permanently invisible portrait.
    node.classList.add(className);
    return {};
  }

  let first = true;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // The load. Any part of him already on screen means the page did not
        // open above him, so there is no scroll for him to fade in on and he
        // must simply be here.
        const atLoad = first && entry.intersectionRatio > 0;
        if (atLoad || entry.intersectionRatio >= ratio) {
          node.classList.add(className);
          observer.disconnect();
        }
      }
      first = false;
    },
    // 0 as well as `ratio`, so the first callback carries a real ratio rather
    // than only firing once he is already half in. Without it the load case
    // cannot be detected at all.
    { threshold: [0, ratio] }
  );
  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
