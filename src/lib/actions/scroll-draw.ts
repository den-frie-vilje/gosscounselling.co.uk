/**
 * Drive a `--draw-progress` custom property from how far an element has
 * travelled through the viewport, so a line can be drawn by the scroll rather
 * than by a timer.
 *
 * Three properties it holds deliberately:
 *
 *   It ratchets. The target only ever increases, so scrolling back up does
 *   not un-draw the line. A progress indicator that retracts reads as undoing
 *   something the reader has already done.
 *
 *   It smooths. The raw value from the scroll is stepped, because a scroll
 *   event fires per gesture rather than per frame, and a trackpad's flings
 *   land in lumps. The rendered value chases the target exponentially.
 *
 *   It smooths BY ELAPSED TIME, not per frame: the coefficient is
 *   `1 - exp(-dt / tau)`, so the settling time is the same on a 60Hz panel
 *   and a 120Hz one. A fixed per-frame fraction would make the line twice as
 *   fast on a ProMotion display.
 *
 * As with the reveal action, the element's resting state in CSS is the
 * FINISHED state, and `js-anim` (added here, before anything else) is what
 * walks it back. No JavaScript, an old browser, or reduced motion all leave
 * the line simply drawn.
 */

interface Options {
  /** Fraction of viewport height at which drawing begins. */
  start?: number;
  /** Fraction of viewport height at which it completes. */
  end?: number;
  /** Smoothing time constant in milliseconds. Larger is lazier. */
  tau?: number;
}

export function scrollDraw(node: HTMLElement, options: Options = {}) {
  const start = options.start ?? 0.82;
  const end = options.end ?? 0.45;
  const tau = options.tau ?? 130;

  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof IntersectionObserver === 'undefined') {
    return {};
  }

  node.classList.add('js-anim');
  node.style.setProperty('--draw-progress', '0');

  let target = 0;
  let current = 0;
  let last = 0;
  let frame = 0;
  let running = false;

  function measure(): number {
    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const startY = vh * start;
    const endY = vh * end;
    // The full travel is the element's own height plus the band between the
    // start and end lines, so a tall list draws over its whole length and a
    // short one still finishes.
    const distance = rect.height + (startY - endY);
    if (distance <= 0) return 1;
    return (startY - rect.top) / distance;
  }

  function tick(now: number) {
    const dt = last ? Math.min(now - last, 100) : 16;
    last = now;

    target = Math.max(target, Math.min(1, Math.max(0, measure())));
    current += (target - current) * (1 - Math.exp(-dt / tau));

    // Snap once the remaining error is under a tenth of a percent, so the
    // asymptote does not keep a rAF loop alive forever.
    if (Math.abs(target - current) < 0.001) current = target;
    node.style.setProperty('--draw-progress', current.toFixed(4));

    if (current >= 1) {
      running = false;
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function run() {
    if (running || current >= 1) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  // The loop only turns over while the list is on screen; the observer is
  // what starts it, and reaching 1 is what ends it for good.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) run();
      }
    },
    { threshold: 0 }
  );
  observer.observe(node);

  // A scroll that begins with the list already on screen needs a nudge, since
  // the observer only fires on a change of intersection.
  window.addEventListener('scroll', run, { passive: true });
  window.addEventListener('resize', run, { passive: true });
  run();

  return {
    destroy() {
      observer.disconnect();
      window.removeEventListener('scroll', run);
      window.removeEventListener('resize', run);
      if (frame) cancelAnimationFrame(frame);
    }
  };
}
