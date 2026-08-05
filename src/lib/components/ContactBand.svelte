<!--
  The contact band, and the only conversion on the site.

  John's instruction was literal: no booking system of any kind, "I would much
  rather people just phone or email me". So the three rows are a phone call, an
  email and a WhatsApp message, each a real link the phone can act on. There is
  no form and no calendar, here or anywhere.

  Rows rather than three narrow cards, because the email address had nowhere to
  go in a column and broke mid-word.
-->
<script lang="ts">
  import { contact, home } from '$lib/content';
  import Icon from './Icon.svelte';
</script>

<section id="contact" class="section-y bg-deep text-on-deep">
  <div class="container-page">
    <div class="section-head">
      <p class="t-kicker kicker-deep m-0 mb-3.5">{home.contact.kicker}</p>
      <h2 class="t-h2 text-white">{home.contact.heading}</h2>
      <p class="text-on-deep-muted mt-4 mb-0 text-[18px]">{home.contact.intro}</p>
    </div>

    <ul class="mt-11 list-none p-0">
      <li>
        <a href={contact.phoneHref}>
          <span class="ico"><Icon name="phone" /></span>
          <span class="txt">
            <span class="k">Phone</span>
            <span class="v">{contact.phone}</span>
            <span class="h">{contact.phoneNote}</span>
          </span>
          <span class="go" aria-hidden="true"><Icon name="arrow" size={20} /></span>
        </a>
      </li>
      <li>
        <a href={contact.emailHref}>
          <span class="ico"><Icon name="mail" /></span>
          <span class="txt">
            <span class="k">Email</span>
            <span class="v">{contact.email}</span>
            <span class="h">{contact.emailNote}</span>
          </span>
          <span class="go" aria-hidden="true"><Icon name="arrow" size={20} /></span>
        </a>
      </li>
      <li>
        <a href={contact.whatsappHref}>
          <span class="ico"><Icon name="whatsapp" /></span>
          <span class="txt">
            <span class="k">WhatsApp</span>
            <span class="v">{contact.phone}</span>
            <span class="h">{contact.whatsappNote}</span>
          </span>
          <span class="go" aria-hidden="true"><Icon name="arrow" size={20} /></span>
        </a>
      </li>
      <li>
        <span class="place">
          <span class="ico"><Icon name="pin" /></span>
          <span class="txt">
            <span class="k">Where</span>
            <span class="v">{contact.location}</span>
            <span class="h">{contact.locationNote}</span>
          </span>
        </span>
      </li>
    </ul>
  </div>
</section>

<style>
  /* The accent, on things that are already here rather than on new marks.
     This band is the one thing the page is for, so it is where the loud
     colour earns its place. 12.03:1 on this ground. */
  .kicker-deep {
    color: var(--color-accent);
  }
  /* Rows on hairlines, not cards. The rest of the scroll divides its sections
     with a rule and a change of ground, and boxing the one thing the page is
     actually for made it the heaviest block on the page. The rules do the
     dividing here too; the glyph carries the distinction the border used to,
     and hover fills the row rather than outlining it. */
  ul {
    border-top: 1px solid rgb(255 255 255 / 0.16);
  }
  li {
    border-bottom: 1px solid rgb(255 255 255 / 0.16);
  }
  a,
  .place {
    display: flex;
    align-items: baseline;
    gap: 20px;
    padding: 22px 4px;
    text-decoration: none;
    color: inherit;
  }
  /* The fill is pulled out sideways by the container's own gutter, so the
     text does not move but the highlight breathes, and at narrow widths it
     runs clean to the screen edge instead of stopping short of it. */
  a {
    margin-inline: -16px;
    padding-inline: 16px;
    border-radius: 4px;
    transition: background-color var(--dur-base) var(--ease-brand);
  }
  a:hover {
    background: rgb(255 255 255 / 0.06);
  }
  a:hover .v {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  a:focus-visible {
    outline-offset: -2px;
  }
  .ico {
    flex: none;
    color: var(--color-accent);
    /* Optically aligned to the value's cap height rather than to the label
       above it, which is where the eye reads the row from. */
    transform: translateY(6px);
  }
  .txt {
    min-width: 0;
  }
  /* The arrow leads, and it is the only thing that moves. A row that goes
     somewhere reads as horizontal, so nothing here rises or lifts. */
  .go {
    flex: none;
    margin-left: auto;
    align-self: center;
    color: var(--color-accent);
    opacity: 0.5;
    transition:
      transform var(--dur-base) var(--ease-brand),
      opacity var(--dur-base) var(--ease-brand);
  }
  a:hover .go,
  a:focus-visible .go {
    transform: translateX(4px);
    opacity: 1;
  }
  .k {
    display: block;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-on-deep-kicker);
  }
  .v {
    display: block;
    margin-top: 6px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(19px, 2.8vw, 25px);
    line-height: 1.2;
    color: #fff;
    /* No `nowrap` + ellipsis. At 320px the address had 210px to live in and
       needed 237px, so it rendered as `info@gosscounselling.c…`: the mailto:
       still worked, but the address was no longer readable, which is the
       information loss SC 1.4.10 forbids. The rows exist so it has somewhere
       to go; let it use them. */
    overflow-wrap: anywhere;
  }
  .h {
    display: block;
    margin-top: 6px;
    font-size: 14.5px;
    color: var(--color-on-deep-muted);
  }
  @media (max-width: 479px) {
    .v {
      font-size: 17.5px;
    }
    a,
    .place {
      gap: 14px;
      padding-block: 18px;
    }
  }
</style>
