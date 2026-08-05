/**
 * The sections that are actually on the page, and the order they are in.
 *
 * The header has to agree with the page about two things: which sections
 * exist, and what order they come in. Keeping either in step by hand is the
 * bug, not the fix, and both have already gone wrong.
 *
 * Existence went first. The header used to derive an element id by
 * string-slicing each nav item's href, so the moment the hrefs changed shape,
 * from `#help` to `/#help` for cross-page anchors, every lookup silently
 * missed and nothing was ever highlighted. Nothing errored. It just stopped.
 *
 * Order went second. The nav listed Blog last while its section sits above the
 * contact band, so the bar read in one order and the page in another.
 *
 * So a section registers itself as it renders, handing over its own element,
 * and this module answers two questions about the result: is this section
 * here, and does the bar's written order match the page's real one.
 *
 * The order is neither decided nor checked here. Sorting the bar by live
 * document positions was the first attempt and it only worked on the home
 * page: on a post or the blog index none of those sections exist, so there
 * was nothing to sort by and the bar rearranged itself on navigation. An
 * order that depends on which page you are looking at is not an order.
 *
 * So the order is written down in `nav` and gated at BUILD time by
 * scripts/check-nav.ts, which reads the page's markup and the array and
 * refuses a build where they disagree. This is a static site; a question that
 * can be settled once during the build has no business being asked in every
 * browser on every load.
 *
 * What remains here is the runtime half that a static read cannot do: which
 * sections are actually on THIS page right now, for the highlight to track,
 * and a dev warning when one a nav item points at never turns up.
 *
 * Registration is an attachment rather than `onMount` + `getElementById`,
 * which is what Svelte 5 recommends for exactly this (`{@attach ...}`): the
 * node arrives as an argument, and the teardown runs when it goes.
 */
import { SvelteMap } from 'svelte/reactivity';

/** id → the element, in a reactive Map so a caller reading it inside a
 *  `$derived` re-runs. A plain `$state(new Map())` would not: Svelte 5 proxies
 *  objects and arrays, not Maps and Sets, so mutating one notifies nobody. */
const sections = new SvelteMap<string, HTMLElement>();

/**
 * Attachment factory. `<section {id} {@attach registerSection(id)}>`.
 */
export function registerSection(id: string) {
  return (node: Element) => {
    sections.set(id, node as HTMLElement);
    return () => {
      // Only if it is still ours: on a swap the replacement registers before
      // the old one tears down, and deleting blindly would drop the new node.
      if (sections.get(id) === node) sections.delete(id);
    };
  };
}

/** Is this section on the page right now? */
export function hasSection(id: string): boolean {
  return sections.has(id);
}

/** The element, for a caller that needs to measure it. */
export function sectionEl(id: string): HTMLElement | undefined {
  return sections.get(id);
}

/**
 * Dev-only. Report nav ids that no section ever claimed.
 *
 * This is the whole point of the registry: the failure it replaces was
 * silent, so its replacement has to be noisy. Called from the header once the
 * page has settled.
 */
export function warnUnregistered(navIds: string[]): void {
  if (!import.meta.env.DEV) return;
  const missing = navIds.filter((id) => id && !sections.has(id));
  if (missing.length === 0) return;
  console.warn(
    `[nav] ${missing.length} nav item(s) point at a section that is not on this page: ${missing.join(', ')}. ` +
      `Registered here: ${[...sections.keys()].join(', ') || '(none)'}. ` +
      `If this is the home page, the nav and the sections have drifted apart.`
  );
}
