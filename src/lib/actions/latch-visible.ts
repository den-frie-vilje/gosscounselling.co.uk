/**
 * Add a class the first time an element is at least `ratio` in view, and
 * never take it away.
 *
 * Used to latch the mobile hero cutout opaque. The hide and the fade are pure
 * CSS on a scroll-driven `view()` timeline, so there is no hydration blink:
 * the element is never briefly visible before a script decides otherwise.
 * This only stops the fade being able to run backwards, which would re-hide
 * him every time the reader scrolls back to the top.
 *
 * An action rather than an `$effect` that assigns state: latching is a
 * one-way DOM side effect on a specific node, not a derivation, and Svelte 5
 * treats writing state inside an effect as the loop-shaped mistake even when
 * this particular one could not loop.
 */
export function latchVisible(node: HTMLElement, options: { className?: string; ratio?: number } = {}) {
  const className = options.className ?? 'is-revealed';
  const ratio = options.ratio ?? 0.5;

  if (typeof IntersectionObserver === 'undefined') {
    // No observer means no latch, so leave it visible rather than leaving it
    // hidden: the failure to avoid is a permanently invisible portrait.
    node.classList.add(className);
    return {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= ratio) {
          node.classList.add(className);
          observer.disconnect();
        }
      }
    },
    { threshold: [ratio] }
  );
  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
