<!--
  The home page: one scroll carrying everything.

  John's brief was one page with all the information on it, and no booking
  system of any kind. So every section that would normally hide behind a link
  (fees included, in full) is here, and the only conversion is a phone call,
  an email or a WhatsApp message.

  The design is the two prototypes he chose, combined: Clear Water's blue,
  bold opening band and divided-not-boxed layout, lightened with Quiet
  Practice's warm ground and air. Nothing on this page is a card.
-->
<script lang="ts">
  import { contact, home, site } from '$lib/content';
  import { buildPageSeo, faqNode, reviewNodes } from '$lib/seo/structured-data';
  import { renderInline } from '$lib/markdown';
  import { reveal } from '$lib/actions/reveal';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import FaqAccordion from '$lib/components/FaqAccordion.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';
  import Testimonials from '$lib/components/Testimonials.svelte';
  import Icon from '$lib/components/Icon.svelte';

  const seo = buildPageSeo({
    path: '/',
    title: home.seo.title,
    description: home.seo.description,
    graph: [faqNode(), ...reviewNodes()]
  });
</script>

<SeoHead {seo} />

<!-- Hero. The one dark, bold band at the top; everything below it is light,
     which is the shape John asked for. -->
<section id="top" class="hero">
  <div class="wash" aria-hidden="true"></div>
  <div class="wash2" aria-hidden="true"></div>
  <div class="container-page">
    <div class="heroGrid">
      <div class="heroCopy">
        <p class="eyebrow">{home.hero.eyebrow}</p>
        <h1 class="t-display text-white">{home.hero.title}</h1>
        <p class="lede t-lead">{home.hero.lead}</p>

        <div class="actions">
          <a href={contact.phoneHref} class="btn btn-bright">
            <Icon name="phone" size={19} />
            {home.hero.ctaPrimary}
          </a>
          <a href={contact.emailHref} class="btn btn-ghost">
            <Icon name="mail" size={19} />
            {home.hero.ctaSecondary}
          </a>
        </div>

        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <p class="reassure">{@html renderInline(home.hero.reassure)}</p>
      </div>

      <!-- His shoulders are cut by the edges of the source photograph, so the
           image is always wider than its frame: the visible cut is made by
           the frame on desktop and by the viewport on a phone, never left
           hanging mid-section. -->
      <figure class="heroFig">
        <img src="/img/john-cutout-dark.webp" alt={home.hero.portraitAlt} width="900" height="900" />
      </figure>
    </div>
  </div>
</section>

<!-- What happens when you get in touch. -->
<Section
  surface="mist"
  kicker={home.steps.kicker}
  heading={home.steps.heading}
  intro={home.steps.intro}
>
  <!-- The only thing on the page that waits to be scrolled to. The line is
       the sequence: it runs 1 to 3, down the discs where the steps stack and
       across them where they sit in a row, and it draws once. -->
  <ol class="stepList" use:reveal>
    {#each home.steps.items as step, i (step.title)}
      <li>
        <span class="disc" aria-hidden="true">{i + 1}</span>
        <div>
          <h3 class="t-h3">{step.title}</h3>
          <p class="text-muted m-0 text-[16.5px]">{step.body}</p>
        </div>
      </li>
    {/each}
  </ol>
</Section>

<!-- The services, as numbered rows on hairlines. Not cards: the rules do the
     dividing, which is the layout John preferred. -->
<Section
  id="help"
  kicker={home.services.kicker}
  heading={home.services.heading}
  intro={home.services.intro}
>
  <div class="border-line mt-13 border-t">
    {#each home.services.items as service, i (service.slug)}
      <article class="row">
        <p class="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
        <div class="min-w-0">
          <h3 class="t-h3">{service.title}</h3>
          <p class="who">{service.who}</p>
        </div>
        <Prose md={service.body} class="prose-lead min-w-0" />
      </article>
    {/each}
  </div>
</Section>

<!-- About. -->
<Section id="about" surface="mist" kicker={home.about.kicker} heading={home.about.heading}>
  <div class="aboutGrid">
    <Prose md={home.about.body} class="prose-lead" />
    <figure class="aboutPhoto">
      <img src="/img/john-portrait-round.webp" alt={home.about.photoAlt} width="600" height="600" />
    </figure>
  </div>
</Section>

<!-- Fees, in full. Two of the sites John chose put money up front, and his own
     site already published a range including the low-income offer; hiding it
     is the thing that makes therapy sites feel evasive. -->
<Section id="fees" kicker={home.fees.kicker} heading={home.fees.heading} intro={home.fees.intro}>
  <div class="fees">
    {#each home.fees.rows as row (row.title)}
      <div class="feerow">
        <h3 class="t-h3 !text-[19px]">{row.title}</h3>
        <dl class="lines">
          {#each row.lines as line (line.label)}
            <div class="line">
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/each}
  </div>

  <!-- Unboxed on purpose: boxing the low-income offer makes it look like an
       exception being managed, when the point is that asking is ordinary. -->
  <div class="note">
    <h3 class="t-h3 !text-[21px]">{home.fees.note.title}</h3>
    <Prose md={home.fees.note.body} class="mt-2.5" />
  </div>
</Section>

<!-- Training and accountability, on the warm ground. -->
<Section surface="sand" kicker={home.quals.kicker} heading={home.quals.heading}>
  <div class="quals">
    <ul class="m-0 list-none p-0">
      {#each home.quals.items as qual (qual.title)}
        <li>
          <span>{qual.title}</span>
          <span class="detail">{qual.detail}</span>
        </li>
      {/each}
    </ul>

    <div class="bodies">
      <h3 class="t-h3 !text-[19px]">{home.quals.bodies.title}</h3>
      <Prose md={home.quals.bodies.body} class="mt-3.5 !text-[16px]" />
      <!-- Other people's marks, monochrome until hovered, so they read as
           credentials rather than as brands competing with John's own.

           His old site carried two NCPS files: the society lockup, and a
           second one pairing the NCPS mark with the Professional Standards
           Authority's. They are two different claims, not two versions of
           one, so the PSA mark is shown on its own rather than printing the
           NCPS flower twice. It is the one that matters most here:
           "counsellor" is not a protected title in the UK, so being on a
           PSA-accredited register is the real gate. -->
      <div class="logos">
        <img src="/img/logos/NCPS_RGB.png" alt="National Counselling & Psychotherapy Society" />
        <img src="/img/logos/cosrt.png" alt="College of Sex & Relationship Therapists" />
        <img
          src="/img/logos/professional-standards-authority.png"
          alt="Professional Standards Authority accredited register"
        />
      </div>
    </div>
  </div>
</Section>

<Testimonials />

<Section id="faq" kicker={home.faq.kicker} heading={home.faq.heading}>
  <FaqAccordion items={home.faq.items} />
</Section>

<ContactBand />

<style>
  /* ---- hero ---- */
  .hero {
    background: var(--color-deep);
    color: var(--color-on-deep);
    padding-block: clamp(48px, 8vw, 82px) 0;
    position: relative;
    isolation: isolate;
    overflow: clip;
  }
  /* Below 880px he goes full-viewport and his near-black shirt meets the band
     directly; at a flat deep the two are barely 1.2:1 apart and the edge just
     bleeds. There the ground lifts, raked toward the lower left where the
     near shoulder sits and the problem is worst, which puts the shirt around
     3:1 against its own ground. No hero copy reaches down into the light end,
     so the text keeps its measured contrast. */
  @media (max-width: 879px) {
    .hero {
      background: linear-gradient(199deg, #08222c 0%, #0a2833 34%, #164b5d 72%, #236c84 100%);
    }
  }
  /* A very large, very quiet dark round behind the top left, so the corner
     has some weight and the eye starts there. */
  .wash {
    position: absolute;
    inset: -45% 20% -25% -35%;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(
      closest-side,
      rgb(2 14 19 / 0.9) 0%,
      rgb(2 14 19 / 0.55) 45%,
      rgb(2 14 19 / 0.18) 70%,
      transparent 88%
    );
  }
  /* A second pool, low and right, so the light never settles into a horizon. */
  .wash2 {
    position: absolute;
    inset: 30% -30% -35% 30%;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(
      closest-side,
      rgb(29 92 112 / 0.42) 0%,
      rgb(29 92 112 / 0.16) 55%,
      transparent 82%
    );
  }

  /* The two pools drift, and that is all they do.
     No pulsing, no scaling, no change of colour or opacity: a light that
     breathes in and out is a television studio, and this is a page about
     bereavement and erections. What is left is positional, under 2% of the
     viewport, over a minute a cycle, on two periods that do not share a
     factor so the pair never visibly repeats. Most visitors will not notice
     it; that is the intended amount. */
  @media (prefers-reduced-motion: no-preference) {
    .wash {
      animation: drift-a 71s ease-in-out infinite;
    }
    .wash2 {
      animation: drift-b 97s ease-in-out infinite;
    }
  }
  @keyframes drift-a {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(1.6%, -1.1%, 0);
    }
  }
  @keyframes drift-b {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(-1.3%, 1.5%, 0);
    }
  }

  /* ---- the hero arriving ----
     Each part comes up a little after the one above it, once, on first paint.
     The whole sequence is done inside a second.

     Wrapped in `no-preference` so the resting state is the FINISHED state:
     with reduced motion, or if the stylesheet's animations never run, every
     element is simply present. `both` fill holds the opening state through
     the delay, so nothing flashes in before its turn. */
  @media (prefers-reduced-motion: no-preference) {
    .heroCopy > *,
    .heroFig {
      animation: rise 620ms var(--ease-brand) both;
    }
    .eyebrow {
      animation-delay: 60ms;
    }
    .heroCopy h1 {
      animation-delay: 140ms;
    }
    .lede {
      animation-delay: 260ms;
    }
    .actions {
      animation-delay: 360ms;
    }
    .reassure {
      animation-delay: 440ms;
    }
    /* He arrives last and barely moves: a cutout of a person sliding into
       place would be the thing we are trying not to do. */
    .heroFig {
      animation-name: settle;
      animation-duration: 900ms;
      animation-delay: 200ms;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate3d(0, 12px, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
  @keyframes settle {
    from {
      opacity: 0;
      transform: translate3d(0, 6px, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
  /* A grid item's automatic minimum size is min-content, and the full-bleed
     figure inside is viewport-wide, so the track could not be narrower than
     the whole viewport and every line of hero copy came out viewport-wide on
     WebKit. minmax(0,1fr) pins the track to the container instead, so the
     figure overflows the track on its own negative margin and drags nothing
     with it. */
  .heroGrid {
    display: grid;
    gap: 44px;
    align-items: center;
    grid-template-columns: minmax(0, 1fr);
  }
  .heroGrid > * {
    min-width: 0;
  }
  @media (min-width: 880px) {
    .heroGrid {
      grid-template-columns: 1.1fr 0.9fr;
      gap: 64px;
    }
  }
  .eyebrow {
    margin: 0 0 20px;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-on-deep-kicker);
  }
  .lede {
    margin: 22px 0 0;
    max-width: 44ch;
    color: var(--color-on-deep-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
  }
  .reassure {
    margin-top: 18px;
    font-size: 15px;
    color: var(--color-on-deep-muted);
  }
  .reassure :global(a) {
    color: var(--color-on-deep-kicker);
  }
  .heroFig {
    margin: 0;
    align-self: end;
    overflow: hidden;
    display: block;
    position: relative;
  }
  .heroFig img {
    width: 118%;
    max-width: none;
    margin-left: -9%;
    height: auto;
    display: block;
  }
  @media (max-width: 879px) {
    .heroFig {
      width: 100vw;
      margin-left: calc(50% - 50vw);
      margin-top: 20px;
    }
    .heroFig img {
      width: 116vw;
      margin-left: -8vw;
    }
  }
  /* Above 880px he is no longer leaning on the viewport, so a circular plate
     makes the crop instead. It is lighter than the band, not deeper: a darker
     plate sat barely 1.1:1 from the ground and did not register at all. */
  @media (min-width: 880px) {
    .heroFig {
      aspect-ratio: 1;
      border-radius: 50%;
      background: #164b5d;
      align-self: center;
    }
    .heroFig img {
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 114%;
      margin-left: 0;
      transform: translateX(-50%);
    }
  }

  /* ---- the three-step sequence ---- */
  .stepList {
    list-style: none;
    margin: 52px 0 0;
    padding: 0;
    display: grid;
    gap: 28px;
  }
  @media (min-width: 860px) {
    .stepList {
      grid-template-columns: repeat(3, 1fr);
      gap: 36px;
    }
  }
  .stepList li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 18px;
    align-items: start;
    min-width: 0;
    position: relative;
  }
  .disc {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: #fff;
    background: var(--color-teal);
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-variant-numeric: tabular-nums;
    position: relative;
    z-index: 1;
  }
  .stepList h3 {
    margin-bottom: 8px;
  }

  /* The line between the discs: down them where the steps stack, across them
     where they sit in a row. One segment per gap, so it needs no knowledge of
     how tall any step's text is.

     Its resting state is DRAWN. `js-anim`, which only the reveal action adds,
     is what collapses it to nothing, so no JavaScript, an old browser or a
     reduced-motion preference all leave the line simply present.

     Both runtime classes are wrapped in :global(). Svelte's scoper only sees
     classes written in the markup, so it prunes any rule keyed off a class
     added by an action at runtime, and the animation silently does nothing
     while the stylesheet reads as correct. */
  .stepList li:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 16px;
    top: 34px;
    bottom: -28px;
    width: 2px;
    background: var(--color-teal);
    opacity: 0.32;
    transform-origin: top center;
  }
  @media (min-width: 860px) {
    .stepList li:not(:last-child)::before {
      left: 34px;
      right: -36px;
      top: 16px;
      bottom: auto;
      width: auto;
      height: 2px;
      transform-origin: left center;
    }
  }
  .stepList:global(.js-anim) li:not(:last-child)::before {
    transform: scaleY(0);
  }
  .stepList:global(.js-anim.is-revealed) li:not(:last-child)::before {
    transform: scaleY(1);
    transition: transform 520ms var(--ease-brand);
  }
  @media (min-width: 860px) {
    .stepList:global(.js-anim) li:not(:last-child)::before {
      transform: scaleX(0);
    }
    .stepList:global(.js-anim.is-revealed) li:not(:last-child)::before {
      transform: scaleX(1);
    }
  }
  /* The second segment waits for the first, so the line reads 1 to 3 rather
     than arriving all at once. */
  .stepList:global(.js-anim.is-revealed) li:nth-child(2)::before {
    transition-delay: 380ms;
  }

  /* ---- services as numbered rows ---- */
  .row {
    min-width: 0;
    display: grid;
    gap: 14px 40px;
    padding: 36px 0;
    border-bottom: 1px solid var(--color-line);
  }
  @media (min-width: 820px) {
    .row {
      grid-template-columns: auto 1fr 1.5fr;
      align-items: start;
    }
  }
  .num {
    margin: 0;
    padding-top: 6px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
  }
  .who {
    margin: 8px 0 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-muted);
  }

  /* ---- about ---- */
  .aboutGrid {
    display: grid;
    gap: 44px;
    align-items: start;
    margin-top: 44px;
  }
  @media (min-width: 860px) {
    .aboutGrid {
      grid-template-columns: 1fr auto;
      gap: 64px;
    }
  }
  /* The dark studio frame keeps its own background: auto-levelled, and only
     ever used small and round, where the heavy contrast reads as a portrait
     rather than a slab. */
  .aboutPhoto {
    margin: 0;
    width: min(300px, 62vw);
    justify-self: start;
    position: relative;
    isolation: isolate;
  }
  .aboutPhoto img {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 50%;
    display: block;
    box-shadow: 0 0 0 1px var(--color-line-cool);
    filter: brightness(1.1);
  }
  /* A toning done entirely in CSS; the file is untouched. The multiply layer
     is a pale tint of the page's own hue, so black stays black, and the
     darken layer has red and green at full so it can only ever pull the blue
     channel: the lights warm and nothing gets darker. */
  @supports (mix-blend-mode: multiply) {
    .aboutPhoto::before,
    .aboutPhoto::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      pointer-events: none;
    }
    .aboutPhoto::before {
      background: #e8f8fb;
      mix-blend-mode: multiply;
      opacity: 0.22;
    }
    .aboutPhoto::after {
      background: #ffffc3;
      mix-blend-mode: darken;
      opacity: 0.3;
    }
  }

  /* ---- fees ---- */
  .fees {
    margin-top: 48px;
    border-top: 2px solid var(--color-ink);
  }
  .feerow {
    display: grid;
    gap: 6px 32px;
    padding: 24px 0;
    border-bottom: 1px solid var(--color-line);
  }
  @media (min-width: 760px) {
    .feerow {
      grid-template-columns: 1fr auto;
      align-items: baseline;
    }
  }
  .lines {
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .line {
    display: flex;
    gap: 16px;
    justify-content: space-between;
    align-items: baseline;
  }
  @media (min-width: 760px) {
    .line {
      justify-content: flex-end;
    }
  }
  .lines dt {
    color: var(--color-muted);
    font-size: 16.5px;
  }
  .lines dd {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .note {
    margin-top: 40px;
    max-width: 64ch;
  }

  /* ---- qualifications ---- */
  .quals {
    display: grid;
    gap: 44px;
    margin-top: 48px;
  }
  @media (min-width: 840px) {
    .quals {
      grid-template-columns: 1.35fr 1fr;
    }
  }
  .quals li {
    padding: 12px 0;
    border-bottom: 1px solid var(--color-line);
    display: flex;
    gap: 16px;
    justify-content: space-between;
    align-items: baseline;
  }
  .quals .detail {
    color: var(--color-gold);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  /* A rule rather than a border and a fill: the membership block is set apart
     without becoming a box. */
  .bodies {
    min-width: 0;
    border-top: 3px solid var(--color-teal);
    padding-top: 24px;
  }
  .logos {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-top: 22px;
    flex-wrap: wrap;
  }
  .logos img {
    height: 46px;
    width: auto;
    filter: grayscale(1) contrast(0.85) opacity(0.72);
    transition: filter var(--dur-fast) ease;
  }
  .logos img:hover {
    filter: none;
  }
</style>
