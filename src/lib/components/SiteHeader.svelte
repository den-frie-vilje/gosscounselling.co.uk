<!--
  The sticky header.

  Bold, because that is what John singled out in the prototype he chose: the
  nav sits in the display face at full weight, and the call button is solid
  teal rather than an outline. It never wraps. The brand, the links and the
  button are all `nowrap`, and the parts arrive one breakpoint at a time:

    < 520px   brand + burger. The number would cost the brand its second line.
    >= 520px  + the call button, labelled "Call"
    >= 860px  + the button's label grows to the full number
    >= 1000px the inline nav replaces the burger

  Below 1000px the menu is a full-page panel carrying the contact details as
  well as the links, because on a phone "how do I reach him" and "where do I
  go" are the same question.
-->
<script lang="ts">
  import { contact, nav, site } from '$lib/content';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let toggleBtn = $state<HTMLButtonElement | undefined>();
  let panel = $state<HTMLElement | undefined>();

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

  // When the panel opens, move focus into it so keyboard and screen-reader
  // users land on the menu rather than continuing behind it.
  $effect(() => {
    if (open) panel?.querySelector<HTMLAnchorElement>('a')?.focus();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<header
  class="border-line bg-paper sticky top-0 z-60 border-b"
  class:menu-open={open}
>
  <div class="container-page flex min-h-[72px] flex-nowrap items-center gap-5">
    <a href="#top" class="brand" onclick={close}>
      {site.name}
      <span>{site.tagline}</span>
    </a>

    <!-- The inline bar, from 1000px up. -->
    <nav class="ml-auto hidden navfull:block" aria-label="Sections">
      <ul class="flex list-none items-center gap-7 p-0">
        {#each nav as item (item.href)}
          <li>
            <a href={item.href} class="navlink">{item.label}</a>
          </li>
        {/each}
        <li>
          <a href={contact.phoneHref} class="btn btn-primary !px-5 !py-3 !text-[15.5px]">
            <Icon name="phone" size={17} />
            {contact.phone}
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
      <span class="navwide:hidden">Call</span>
      <span class="hidden navwide:inline">{contact.phone}</span>
    </a>

    <button
      bind:this={toggleBtn}
      type="button"
      class="burgerbtn navfull:hidden"
      aria-expanded={open}
      aria-controls="site-menu"
      aria-label={open ? 'Close menu' : 'Open menu'}
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
<div
  bind:this={panel}
  id="site-menu"
  class="menupanel navfull:hidden"
  class:is-open={open}
  inert={!open}
>
  <div class="container-page">
    <ul class="m-0 list-none p-0">
      {#each nav as item (item.href)}
        <li>
          <a href={item.href} onclick={close}>{item.label}</a>
        </li>
      {/each}
    </ul>

    <div class="menucontact">
      <p class="k">{contact.menuHeading}</p>
      <a href={contact.phoneHref} onclick={close}>{contact.phone}</a>
      <a href={contact.emailHref} onclick={close}>{contact.email}</a>
      <a href={contact.whatsappHref} onclick={close}>WhatsApp</a>
      <p class="place">{contact.location}</p>
    </div>
  </div>
</div>

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

  /* The rule under a nav link wipes in from the left rather than appearing
     all at once, so the link reads as being underlined by the pointer. Drawn
     as a pseudo-element and scaled, which the compositor can do on its own;
     a transition on border-colour cannot express direction. */
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
  }
  .navlink::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--color-teal);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-brand);
  }
  .navlink:hover::after,
  .navlink:focus-visible::after {
    transform: scaleX(1);
  }

  .barcta {
    display: none;
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
