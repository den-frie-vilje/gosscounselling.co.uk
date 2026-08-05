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
 * So the page states both. A section registers itself as it renders, handing
 * over its own element, and the header asks this module where things are
 * rather than being told. `inPageOrder` sorts the nav by the real document
 * positions of the real nodes, which means the sequence is not something
 * anyone can get wrong: it is read off the page every time.
 *
 * Registration is an attachment rather than `onMount` + `getElementById`,
 * which is what Svelte 5 recommends for exactly this (`{@attach ...}`): the
 * node arrives as an argument, and the teardown runs when it goes.
 */
import { SvelteMap } from 'svelte/reactivity';

/** id → the element, in a reactive Map so `inPageOrder` recomputes. A plain
 *  `$state(new Map())` would not: Svelte 5 proxies objects and arrays, not
 *  Maps and Sets, so mutating one never notifies anybody. */
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
 * The nav, in the order the page puts its sections.
 *
 * Items whose section is on this page are sorted among themselves by document
 * position and dealt back into the slots those items already occupied. Items
 * with no section here — a link to another page, on a page that has none of
 * these sections — keep their place untouched. So a nav of only external
 * links comes back exactly as it went in, and one of only sections comes back
 * in page order.
 */
export function inPageOrder<T extends { id: string | null }>(items: T[]): T[] {
  const slots: number[] = [];
  const placed: T[] = [];

  items.forEach((item, i) => {
    if (item.id && sections.has(item.id)) {
      slots.push(i);
      placed.push(item);
    }
  });
  if (placed.length < 2) return items;

  placed.sort((a, b) => {
    const ea = sections.get(a.id as string);
    const eb = sections.get(b.id as string);
    if (!ea || !eb) return 0;
    // DOCUMENT_POSITION_FOLLOWING: b comes after a, so a sorts first.
    return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  const out = [...items];
  slots.forEach((slot, k) => (out[slot] = placed[k]));
  return out;
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
