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
            <span class="h">{contact.hoursNote}</span>
          </span>
        </a>
      </li>
      <li>
        <a href={contact.emailHref}>
          <span class="ico"><Icon name="mail" /></span>
          <span class="txt">
            <span class="k">Email</span>
            <span class="v">{contact.email}</span>
            <span class="h">I read everything myself.</span>
          </span>
        </a>
      </li>
      <li>
        <a href={contact.whatsappHref}>
          <span class="ico"><Icon name="whatsapp" /></span>
          <span class="txt">
            <span class="k">WhatsApp</span>
            <span class="v">{contact.phone}</span>
            <span class="h">Often the easiest, if you would rather write than talk.</span>
          </span>
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
  .kicker-deep {
    color: var(--color-on-deep-kicker);
  }
  li + li {
    margin-top: 12px;
  }
  a,
  .place {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px 22px;
    text-decoration: none;
    color: inherit;
    background: rgb(255 255 255 / 0.07);
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 5px;
  }
  a:hover {
    background: rgb(255 255 255 / 0.12);
  }
  a:hover .v {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .ico {
    flex: none;
    width: 46px;
    height: 46px;
    border-radius: 5px;
    display: grid;
    place-items: center;
    background: rgb(23 162 196 / 0.22);
    border: 1px solid rgb(130 201 220 / 0.5);
    color: #bfe6f1;
  }
  .txt {
    min-width: 0;
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
    margin-top: 5px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(17px, 2.4vw, 21px);
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .h {
    display: block;
    margin-top: 4px;
    font-size: 14.5px;
    color: var(--color-on-deep-muted);
  }
  @media (max-width: 479px) {
    .v {
      font-size: 16.5px;
    }
    .ico {
      width: 40px;
      height: 40px;
    }
    a,
    .place {
      gap: 14px;
      padding: 18px 16px;
    }
  }
</style>
