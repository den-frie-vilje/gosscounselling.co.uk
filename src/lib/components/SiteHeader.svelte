<!--
  The sticky header.

  Bold, because that is what John singled out in the prototype he chose: the
  nav sits in the display face at full weight, and the call button is solid
  teal rather than an outline. It never wraps. The brand, the links and the
  button are all `nowrap`, and the parts arrive one at a time:

    < 520px   brand + burger. The number would cost the brand its second line.
    >= 520px  + the call button, labelled "Call"
    >= 1000px the inline nav replaces the burger

  The button's label is the exception: it grows from "Call" to the whole
  number when the number measurably fits, not at a width someone typed. See
  `fitCallLabel`.

  Below 1000px the menu is a full-page panel carrying the contact details as
  well as the links, because on a phone "how do I reach him" and "where do I
  go" are the same question.
-->
<script lang="ts">
  import { flushSync, onMount } from 'svelte';
  import { inPageOrder, sectionEl, warnUnregistered } from '$lib/nav-sections.svelte';
  import { blogNavItem, contact, livePosts, nav, site } from '$lib/content';
  import { publishClock } from '$lib/publish-clock.svelte';
  import Icon from './Icon.svelte';

  // The blog is in the bar only while there is something to read on it, and
  // it arrives on the same clock the listings use, so a post published for a
  // future date brings its link with it rather than waiting for a rebuild.
  const clock = publishClock();
  const listed = $derived(livePosts(clock.value).length ? [...nav, blogNavItem] : nav);
  // In the order the page puts them, not the order they were typed in. The
  // blog sat last in the bar while its section sits above the contact band;
  // sorting by the real document positions means that particular mistake is
  // no longer available. See nav-sections.svelte.ts.
  const items = $derived(inPageOrder(listed));

  interface Props {
    /** Bound out so the layout can `inert` the page behind an open menu. */
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();
  let toggleBtn = $state<HTMLButtonElement | undefined>();
  let panel = $state<HTMLElement | undefined>();

  // ---- the call button's label ----
  // "Call" or the whole number, decided by whether the number fits rather than
  // by a width someone typed. It was a breakpoint twice, and it was wrong both
  // times: the bar carries a variable number of links (the blog joins it the
  // day John publishes), the brand is his own name, and the number is his to
  // change, so no fixed px can be right for every combination of the three. At
  // 1008px the row overflowed by 33px while the label still read as the full
  // number, which is the bug that ended this argument.
  //
  // So: try the long label, look at the row, and keep it only if nothing
  // overflowed. The starting state is the short one, which means the label
  // before hydration, and forever without JavaScript, is the one that always
  // fits. Growing it is the enhancement.
  let row = $state<HTMLElement | undefined>();
  let numberFits = $state(false);

  function fitCallLabel() {
    if (!row) return;
    numberFits = true;
    flushSync();
    // Sub-pixel layout rounds; a whole pixel of overflow is a real one.
    if (row.scrollWidth > row.clientWidth + 1) numberFits = false;
  }

  function close() {
    open = false;
  }

  // Esc closes the panel and returns focus to the control that opened it
  // (WCAG 2.1.2 No Keyboard Trap, 2.4.3 Focus Order).
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      open = false;
      toggleBtn?.focus();
    }
  }

  // ---- the morphing underline ----
  // One bar, shared by every nav item, that slides and stretches from one to
  // the next rather than each link owning its own. It follows the pointer
  // while the pointer is in the nav, and otherwise follows the section the
  // reader is actually in.
  let navList = $state<HTMLElement | undefined>();
  const links: HTMLAnchorElement[] = [];
  let active = $state(-1);
  let hovered = $state(-1);
  let barX = $state(0);
  let barW = $state(0);
  let barOn = $state(false);
  // Suppresses the slide on the very first placement, so the bar does not
  // travel in from the left edge on load.
  let barPlaced = $state(false);

  // An attachment, not an action: the bar can reorder, and an attachment
  // re-runs with the new index where `use:` would have held the old one.
  function linkRef(index: number) {
    return (node: Element) => {
      links[index] = node as HTMLAnchorElement;
      return () => {
        if (links[index] === node) delete links[index];
      };
    };
  }

  /** Which section the reader is in: the last one whose top has crossed a
   *  line two thirds of the way down the viewport.
   *
   *  Tuned from both ends. The sticky header's own edge meant the bar only
   *  moved once the previous section had left the screen entirely, and the nav
   *  read as lagging behind the page. Three quarters down handed over as soon
   *  as a section appeared at the bottom, before anyone was reading it. A
   *  quarter down was late again: you had to scroll a section almost to the
   *  top before the nav admitted you were in it. Two thirds is Ole's call, and
   *  it means a section takes the bar once it is a third of the way onto the
   *  screen.
   *
   *  Read from the sections themselves rather than from a scroll offset, so it
   *  stays right whatever the content does. */
  const HANDOVER = 0.66;

  function readSection() {
    const line = (window.innerHeight || document.documentElement.clientHeight) * HANDOVER;
    let found = -1;
    for (let i = 0; i < items.length; i++) {
      const id = items[i].id;
      // Only sections that actually registered, and the element comes from
      // the registry rather than from `getElementById`, so there is one
      // answer to "where is this section" and the bar cannot be reading a
      // different one from the sorter. A nav item whose section is not on
      // this page has nothing to track; it does not silently match nothing,
      // which is what the old href-slicing did.
      if (!id) continue;
      const el = sectionEl(id);
      if (el && el.getBoundingClientRect().top <= line) found = i;
    }
    active = found;
  }

  function place() {
    const index = hovered >= 0 ? hovered : active;
    const el = links[index];
    if (!el || !navList) {
      barOn = false;
      return;
    }
    const a = el.getBoundingClientRect();
    const b = navList.getBoundingClientRect();
    barX = a.left - b.left;
    barW = a.width;
    barOn = true;
  }

  // Measuring the DOM after it has updated is the legitimate use of an
  // effect; the first placement and the transition it must not animate are
  // handled once, on mount, rather than by assigning state in here.
  $effect(() => {
    void hovered;
    void active;
    place();
  });

  onMount(() => {
    // After the sections have mounted and registered. In dev this is the only
    // thing standing between a drifted nav and nobody noticing for a week.
    warnUnregistered(items.map((i) => i.id).filter((id): id is string => Boolean(id)));
    fitCallLabel();
    readSection();
    place();
    requestAnimationFrame(() => (barPlaced = true));

    // Measured again once the real faces are in. Until then the row is laid
    // out in the fallback metrics, and Inter is wider than what the system
    // substitutes, so a label that fit during the swap can stop fitting.
    document.fonts?.ready.then(() => {
      fitCallLabel();
      place();
    });
  });

  // The panel is `display: none` from navfull up, so a viewport that grows
  // past it while the menu is open would leave a stale `aria-expanded="true"`
  // on a control nobody can see.
  function onResize() {
    if (open && window.matchMedia('(min-width: 62.5rem)').matches) open = false;
    fitCallLabel();
    readSection();
    place();
  }

  // When the panel opens, move focus into it so keyboard and screen-reader
  // users land on the menu rather than continuing behind it.
  $effect(() => {
    if (open) panel?.querySelector<HTMLAnchorElement>('a')?.focus();
  });
</script>

<svelte:window onkeydown={onKeydown} onresize={onResize} onscroll={readSection} />

<header
  class="border-line bg-paper sticky top-0 z-60 border-b"
  class:menu-open={open}
>
  <div
    bind:this={row}
    class="container-page flex min-h-[72px] flex-nowrap items-center gap-5"
  >
    <a href="/#top" class="brand" onclick={close}>
      {site.name}
      <span>{site.tagline}</span>
    </a>

    <!-- The inline bar, from 1000px up. -->
    <nav class="ml-auto hidden navfull:block" aria-label="Sections">
      <ul
        bind:this={navList}
        class="relative flex list-none items-center gap-7 p-0"
        onmouseleave={() => (hovered = -1)}
      >
        <span
          class="navbar-underline"
          class:on={barOn}
          class:placed={barPlaced}
          style="--bar-x: {barX}px; --bar-w: {barW}px"
          aria-hidden="true"
        ></span>
        {#each items as item, i (item.href)}
          <li>
            <a
              {@attach linkRef(i)}
              href={item.href}
              class="navlink"
              aria-current={active === i ? 'true' : undefined}
              onmouseenter={() => (hovered = i)}
              onfocus={() => (hovered = i)}
              onblur={() => (hovered = -1)}
            >
              {item.label}
            </a>
          </li>
        {/each}
        <li>
          <a href={contact.phoneHref} class="btn btn-primary callbtn !px-5 !py-3 !text-[15.5px]">
            <Icon name="phone" size={17} />
            <span class:hidden={numberFits}>Call</span>
            <span class="num" class:hidden={!numberFits}>{contact.phone}</span>
          </a>
        </li>
      </ul>
    </nav>

    <!-- The call button that rides alongside the burger below 1000px. -->
    <a
      href={contact.phoneHref}
      class="btn btn-primary barcta ml-auto !px-[18px] !py-[11px] !text-[15.5px] navfull:!hidden"
    >
      <Icon name="phone" size={17} />
      <span class:hidden={numberFits}>Call</span>
      <span class="num" class:hidden={!numberFits}>{contact.phone}</span>
    </a>

    <button
      bind:this={toggleBtn}
      type="button"
      class="burgerbtn navfull:hidden"
      aria-expanded={open}
      aria-controls="site-menu"
      aria-label="Menu"
      onclick={() => (open = !open)}
    >
      <span class="burger" class:is-open={open}></span>
    </button>
  </div>
</header>

<!--
  A sibling of the header rather than a child of the button, so the burger
  keeps its own place in the stacking order and the X appears exactly where
  the burger was instead of jumping. The panel wipes down from the top edge:
  it does not move, its clip travels, so the menu is uncovered in place. It
  stays in the DOM so the retraction can animate, and is `visibility:hidden`
  with `pointer-events:none` while closed, so it is out of the accessibility
  tree and cannot be tabbed into.
-->
<nav
  bind:this={panel}
  id="site-menu"
  class="menupanel navfull:hidden"
  class:is-open={open}
  inert={!open}
  aria-label="Menu"
>
  <div class="container-page">
    <ul class="m-0 list-none p-0">
      {#each items as item (item.href)}
        <li>
          <a href={item.href} onclick={close}>{item.label}</a>
        </li>
      {/each}
    </ul>

    <div class="menucontact">
      <h2 class="k">{contact.menuHeading}</h2>
      <a href={contact.phoneHref} onclick={close}>{contact.phone}</a>
      <a href={contact.emailHref} onclick={close}>{contact.email}</a>
      <a href={contact.whatsappHref} onclick={close}>WhatsApp</a>
      <p class="place">{contact.location}</p>
    </div>
  </div>
</nav>

<style>
  .brand {
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: var(--color-ink);
    text-decoration: none;
    white-space: nowrap;
  }
  .brand span {
    display: block;
    font-family: var(--font-sans);
    font-size: 11.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-muted);
    margin-top: 2px;
    white-space: nowrap;
  }
  /* Below 420px the second line costs the burger its breathing room. */
  @media (max-width: 419px) {
    .brand span {
      display: none;
    }
  }

  .navlink {
    position: relative;
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: var(--color-ink);
    text-decoration: none;
    white-space: nowrap;
    padding-block: 10px;
    transition: color var(--dur-base) var(--ease-brand);
  }
  .navlink[aria-current='true'] {
    color: var(--color-teal);
  }

  /* One bar for the whole nav, rather than one per link, in the bright accent.

     On this paper ground the bright value measures about 1:1, so the bar is
     decoration and cannot be the signal: the active link also takes the deep
     teal at 5.84:1 and carries `aria-current`, which is what actually conveys
     the state. WCAG 1.4.11 binds an indicator that is required to understand
     the state; it does not bind a second, redundant one.

     `left`/`width` rather than a transform: the bar has to STRETCH between
     items of different widths, and a translate alone cannot do that while a
     scaleX would squash nothing (it is a plain rectangle) but would still need
     the width baked in. Two animated properties on one 4px element is cheap,
     and it is the shape of the movement that matters here. */
  .navbar-underline {
    position: absolute;
    /* Tucked up into the link's own block padding rather than hanging below
       it: the padding is a touch target, not a gap the rule has to clear. */
    bottom: 4px;
    left: 0;
    height: 4px;
    border-radius: 2px;
    background: var(--color-accent);
    opacity: 0;
    transform: translate3d(var(--bar-x), 0, 0);
    width: var(--bar-w);
    pointer-events: none;
  }
  .navbar-underline.on {
    opacity: 1;
  }
  /* Only once it has a position: otherwise the first placement slides in from
     the left edge of the nav. */
  .navbar-underline.placed {
    transition:
      transform var(--dur-base) var(--ease-brand),
      width var(--dur-base) var(--ease-brand),
      opacity var(--dur-fast) linear;
  }

  /* A phone number is one thing. It never breaks across lines, in either
     button: half a number is not a number, and a wrapped one also drags the
     header's height around. Below the width where the whole thing fits, the
     button says "Call" instead, which is the collapse the staggered header
     was always meant to do. */
  .num {
    white-space: nowrap;
  }
  .callbtn {
    white-space: nowrap;
  }

  .barcta {
    display: none;
    white-space: nowrap;
  }
  @media (min-width: 32.5rem) {
    .barcta {
      display: inline-flex;
    }
  }

  /* No frame, no border, no circle: the mark alone. The 46px box is only the
     touch target, which stays at the WCAG minimum without being drawn. */
  .burgerbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin-left: auto;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
  }
  @media (min-width: 32.5rem) {
    .burgerbtn {
      margin-left: 0;
    }
  }
  /* Hidden here rather than by the `navfull:hidden` utility on the element:
     component styles are emitted after Tailwind's utilities, so at equal
     specificity `display: inline-flex` above wins and the burger stayed
     visible beside the full inline nav. */
  @media (min-width: 62.5rem) {
    .burgerbtn {
      display: none;
    }
  }
  .burger {
    display: inline-block;
    width: 22px;
    height: 2px;
    background: currentColor;
    position: relative;
    transition: background-color 0.18s ease 0.16s;
  }
  .burger::before,
  .burger::after {
    content: '';
    position: absolute;
    left: 0;
    width: 22px;
    height: 2px;
    background: currentColor;
    transition:
      top 0.18s ease 0.16s,
      transform 0.2s ease;
  }
  .burger::before {
    top: -7px;
  }
  .burger::after {
    top: 7px;
  }
  .burger.is-open {
    background: transparent;
    transition: background-color 0.12s ease;
  }
  .burger.is-open::before {
    top: 0;
    transform: rotate(45deg);
    transition:
      top 0.18s ease,
      transform 0.22s ease 0.16s;
  }
  .burger.is-open::after {
    top: 0;
    transform: rotate(-45deg);
    transition:
      top 0.18s ease,
      transform 0.22s ease 0.16s;
  }

  /* A deeper shade of the page's own ground, so the menu reads as a surface
     over the site rather than as the site with links on it. z-50 keeps it
     under the header's z-60, which is what leaves the burger on top. */
  .menupanel {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #e4eaec;
    overflow-y: auto;
    padding: 96px 0 56px;
    visibility: hidden;
    pointer-events: none;
    clip-path: inset(0 0 100% 0);
    transition:
      clip-path 0.44s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0s linear 0.44s;
  }
  .menupanel.is-open {
    visibility: visible;
    pointer-events: auto;
    clip-path: inset(0 0 0 0);
    transition:
      clip-path 0.44s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    .menupanel,
    .menupanel.is-open {
      transition: visibility 0s;
    }
  }
  .menupanel li + li {
    border-top: 1px solid var(--color-line-cool);
  }
  .menupanel ul a {
    display: block;
    padding: 18px 0;
    font-family: var(--font-display);
    font-size: clamp(24px, 6vw, 34px);
    font-weight: 600;
    line-height: 1.15;
    color: var(--color-ink);
    text-decoration: none;
  }
  .menupanel ul a:hover {
    color: var(--color-teal);
  }
  .menucontact {
    margin-top: 40px;
    padding-top: 28px;
    border-top: 2px solid var(--color-line-cool);
    display: grid;
    gap: 14px;
  }
  .menucontact .k {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-teal);
  }
  .menucontact a {
    font-family: var(--font-display);
    font-size: clamp(19px, 4.4vw, 24px);
    font-weight: 600;
    color: var(--color-ink);
    text-decoration: none;
  }
  .menucontact a:hover {
    color: var(--color-teal);
  }
  .menucontact .place {
    margin: 0;
    color: var(--color-muted);
    font-size: 16px;
  }
</style>
