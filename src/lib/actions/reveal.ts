/**
 * Add a class the first time an element comes into view, once, and never
 * take it away.
 *
 * Written to fail in the right direction. The element's resting state in CSS
 * is the FINISHED state, so with no JavaScript, an ancient browser, or a
 * reduced-motion preference, the page simply looks the way it is meant to end
 * up. This action's only job is to walk it back to the starting state and let
 * it play, which it does by adding `js-anim` to the element before it
 * observes: a stylesheet keys the "before" state off that class, so the
 * unanimated state can never be what a visitor is left looking at.
 *
 * Used once, for the connector between the three steps. Not a scroll-reveal
 * harness: text on this site is present when the page is.
 */
export function reveal(node: HTMLElement, options: { className?: string } = {}) {
  const className = options.className ?? 'is-revealed';

  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof IntersectionObserver === 'undefined') {
    return {};
  }

  // Only now does the element take its starting state, so a visitor whose
  // browser never reaches this line sees the finished one.
  node.classList.add('js-anim');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        node.classList.add(className);
        observer.disconnect();
      }
    },
    // A little way in, so the line does not start drawing while it is still
    // a sliver at the bottom of the viewport.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
