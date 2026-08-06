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
  import { contact, home, memberships, servicePath, services } from '$lib/content';
  import { buildPageSeo, faqNode, reviewNodes } from '$lib/seo/structured-data';
  import { renderInline } from '$lib/markdown';
  import { scrollDraw } from '$lib/actions/scroll-draw';
  import geometry from '$lib/generated/portrait-geometry.json';
  import { latchVisible } from '$lib/actions/latch-visible';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import FaqAccordion from '$lib/components/FaqAccordion.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';
  import Testimonials from '$lib/components/Testimonials.svelte';
  import BlogFeed from '$lib/components/BlogFeed.svelte';
  import Icon from '$lib/components/Icon.svelte';

  // Below 880px he goes full-bleed under the copy, so the fold cuts him at
  // the top of his head, which is comical rather than welcoming. He starts
  // transparent there and fades up as the page scrolls.
  //
  // The hide and the fade are pure CSS on a scroll-driven `view()` timeline,
  // so there is no hydration blink. `latchVisible` only stops the fade running
  // backwards once he has been seen.

  // Every one of these is measured off whichever cutout is in the repo, by
  // scripts/check-portrait-fit.ts, and written out for the page to read. They
  // are NOT typed into the stylesheet: while they were, the mask circle came
  // out 9.91px wider than the plate because a value had been copied from an
  // earlier run of that script. A number that lives in two places drifts, and
  // this is also what lets John replace his portrait through the CMS.
  const portraitVars = [
    `--plate-img-width: ${geometry.plateImgWidth}`,
    `--head-shift: ${geometry.headShift}`,
    `--push-in-scale: ${geometry.pushInScale}`,
    `--mask-size: ${geometry.maskSize}`,
    `--mask-position: ${geometry.maskPosition}`,
    `--layer-pad: ${geometry.layerPad}`,
    `--out-fade-start: ${geometry.outFadeStart}`,
    `--out-fade-end: ${geometry.outFadeEnd}`,
    `--matte-drop: ${geometry.matteDrop}`,
    `--disc-inset: ${geometry.discInset}`,
    `--disc-settle: ${geometry.discSettle}`
  ].join('; ');

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

        <!-- His own sentence, from the old site. Set apart from the lead
             above it, in the display face and hung off a quiet rule, so it
             reads as an aside rather than as a second sentence of the pitch. -->
        <p class="aside">{home.hero.aside}</p>

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

      <!-- From 880px his head breaks the top of the plate, and the way that is
           set up is the whole trick.

           Not a container and a second box behind it: that forces the outer
           box to be a rectangle, whose edge cuts his shoulders on the circle's
           tangent, and no amount of fading hides it. Instead, TWO IDENTICAL
           LAYERS, each carrying the whole figure at exactly the same size and
           position, with the circle as a MASK: one keeps what falls inside it,
           the other keeps what falls outside.

           Three things follow from that, and they are the three problems this
           had before:

           The layers are disjoint. No pixel is painted by both, so a fade on
           either one has nothing underneath to double with, and the seam that
           showed when two semi-transparent copies of the same man overlapped
           cannot occur.

           Their mask edges OVERLAP slightly rather than meeting exactly.
           Complementary edges sum to 1 in arithmetic, but Safari rounds each
           layer's coverage on its own and leaves a sub-pixel line of the
           ground along the circle. The overlap costs nothing, because both
           layers are fully opaque there and both are the same photograph in
           the same place.

           They move together, because the transform lives on their shared
           parent rather than on each of them. Synchronous by construction
           rather than by keeping two sets of keyframes in step.

           He is outside the circle almost all the way down (99.92%, measured),
           because he is drawn wider than the plate, so the outer layer also
           carries a vertical fade. It ends where he is back inside the circle
           and the layer paints nothing anyway, so that edge is invisible too.

           All the numbers are in scripts/check-portrait-fit.ts, derived from
           the cutout's own alpha channel, and the build fails if the tokens
           below drift from them. -->
      <div class="portrait" style={portraitVars}>
        <figure class="heroFig">
          <div class="plateBg" aria-hidden="true"></div>

          <div class="cuts">
            <!-- Below 880px there is no plate: he goes full-bleed on the deep
                 gradient, where the keyed matte is the correct one. -->
            <img
              use:latchVisible
              class="heroCut cutMobile"
              src="/img/john-cutout.webp"
              alt={home.hero.portraitAlt}
              width="900"
              height="900"
              fetchpriority="high"
              decoding="async"
            />

            <!-- ONE FILE, BOTH SIDES OF THE CIRCLE. That is the whole point of
                 the asset, and it is what makes the head crossing the disc's
                 edge stop being a special case: the two layers are the same
                 photograph in the same place at the same size, so across the
                 arc only the GROUND changes, which is what `F*a + B*(1-a)` is
                 for.

                 It took three goes to get there. The plain knockout
                 (assets/portrait/john-knockout.webp, still the master everything is measured
                 from) is matted against a white cyclorama and never de-spilled
                 in COLOUR, so its fringe carries the backdrop: at the drawn
                 size 31.9% of it composites BRIGHTER than the plate it sits
                 on, peaking +48.0, which a blend of a 97-luminance figure over
                 a 187 ground cannot produce at all. That was a bright rim
                 traced round him. The keyed matte that replaced it fixed the
                 rim by de-lighting the edge, and traded it for the opposite
                 fault: its foreground ran 24 to 41 levels DARKER than John's
                 own colour at every coverage down to 2%, so on the deep band
                 40.7% of the fringe sat more than 10 levels under him. A drawn-on
                 dark line, and Ole saw it on his upper head.

                 What ships now is solved rather than graded — the backing is
                 measured, so alpha follows from John's own colour and the
                 foreground follows in closed form from alpha; see
                 scripts/keyer.ts, solid_matte(). Nothing in the file
                 knows what it will be composited over. At the drawn size, of
                 the fringe pixels that depart from a composite of John's own
                 colour by more than 10 levels: knockout 61.0%, the old keyed
                 matte 40.9%, this 2.7% — and 2.1% through the hair, 2.4% at
                 the face and beard, 0.4% at the neck, 11.0% at the ears and
                 temples, where the surface is at a grazing angle and the plain
                 photograph is dark there too. -->
            <div class="layer layerIn">
              <img
                src="/img/john-cutout.webp"
                alt={home.hero.portraitAlt}
                width="900"
                height="900"
              />
            </div>

            <!-- Outside it: the same file. It is `aria-hidden` and alt-empty
                 because the layer above already names him. -->
            <div class="layer layerOut" aria-hidden="true">
              <img src="/img/john-cutout.webp" alt="" width="900" height="900" />
            </div>
          </div>
        </figure>
      </div>
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
       the sequence: it runs 1 to 3 down the discs where the steps stack, drawn
       by the scroll rather than by a timer, and it never retracts.

       It starts when the list's top passes 78% of the viewport and is complete
       by the time its bottom reaches the halfway line, so the line has arrived
       at step 3 while the reader is still looking at the section rather than
       finishing as it leaves. -->
  <ol class="stepList mark-row" use:scrollDraw={{ start: 0.78, end: 0.5 }}>
    {#each home.steps.items as step, i (step.title)}
      <li class="mark-row">
        <span class="disc mark mark-disc" aria-hidden="true">{i + 1}</span>
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
    {#each services as service, i (service.slug)}
      <article class="row mark-row">
        <p class="num mark" aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
        <div class="min-w-0">
          <h3 class="t-h3">{service.title}</h3>
          <p class="who">{service.who}</p>
        </div>
        <div class="min-w-0">
          <Prose md={service.body} class="prose-lead" />

          <!-- Only where the service has a page. A service with no `detail`
               body renders exactly as it always has, with nothing to click:
               a "More about" link to a page that has not been written is the
               teaser stub docs/content-coverage.md says not to carry over.
               The address is derived from the slug, never typed. -->
          {#if service.detail}
            <p class="moreabout">
              <a href={servicePath(service)}>
                More about {service.title.toLowerCase()}
                <Icon name="arrow" size={17} />
              </a>
            </p>
          {/if}
        </div>
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
    <ul class="quallist m-0 list-none p-0">
      {#each home.quals.items as qual (qual.title)}
        <li>
          <span>{qual.title}</span>
          <span class="detail">{qual.detail}</span>
        </li>
      {/each}
    </ul>

    <div class="bodies">
      <h3 class="t-h3 !text-[19px]">{home.quals.bodies.title}</h3>

      <!-- One chip each: the mark, a hairline, then the words it stands for,
           all on the same white ground. The mark used to sit on its own plate
           with the text outside it, and the two read as a rail of logos and a
           separate list of sentences; inside one chip, divided rather than
           boxed, the flower and the sentence are visibly the same claim.

           Every chip is the height of the tallest, and nobody had to measure
           the longest line to get it: `grid-auto-rows: 1fr` in a grid with no
           fixed height makes every row the size of the largest, so the longest
           note sets the height and the rest follow, at any breakpoint and
           whatever John types.

           The marks are white-ground artwork and all sit in the same column
           width, so a wide wordmark and a square flower are the same weight
           without recolouring either. The Professional Standards Authority's
           licence asks for its own colour and for clear space at least the
           height of its own head, and it gets both.

           His old site carried two NCPS files: the society lockup, and a
           second one pairing NCPS with the PSA. Those are two claims, not two
           versions of one, so the PSA stands on its own here rather than
           printing the NCPS flower twice. It is the claim that matters most:
           "counsellor" is not a protected title in the UK, so being on a
           PSA-accredited register is the real gate. -->
      <ul class="bodylist">
        {#each memberships as body (body.abbr + body.name)}
          <li class="chip">
            <span class="chipmark">
              <img src={body.logo} alt="" />
            </span>
            <span class="hair" aria-hidden="true"></span>
            <span class="words">
              <span class="bname">
                {#if body.href}
                  <a href={body.href} rel="noopener">{body.name}</a>
                {:else}
                  {body.name}
                {/if}
              </span>
              {#if body.note}<span class="bnote">{body.note}</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</Section>

<Testimonials />

<Section id="faq" kicker={home.faq.kicker} heading={home.faq.heading}>
  <FaqAccordion items={home.faq.items} />
</Section>

<!-- Renders nothing at all until there is a post to show, so the scroll is
     unchanged on the day the site launches without a blog. -->
<BlogFeed />

<ContactBand />

<style>
  /* ---- hero ---- */
  .hero {
    background: var(--color-deep);
    color: var(--color-on-deep);
    /* No bottom padding below 880px: he is a cutout going full-bleed there,
       so he lands directly on the next band rather than floating above an
       empty strip of it. */
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
      rgb(2 14 19 / 0.95) 0%,
      rgb(2 14 19 / 0.66) 45%,
      rgb(2 14 19 / 0.26) 70%,
      transparent 90%
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
      rgb(29 92 112 / 0.62) 0%,
      rgb(29 92 112 / 0.28) 55%,
      transparent 84%
    );
  }

  /* The two pools drift, and that is all they do.
     No change of colour or opacity: a light that flashes is a television
     studio, and this is a page about bereavement and erections. Movement and
     size, and nothing else.

     Size is Ole's, with his floor: never smaller than they were, so the swell
     only ever opens outward from the composition that was signed off. It is
     on its OWN period, not the drift's, because a pool that grows exactly
     when it moves is a heartbeat and a pool that grows on its own schedule is
     weather. That is why `translate` and `scale` are separate properties
     here rather than one `transform`: two properties take two animations, and
     two animations can disagree about time. All four periods are prime — 53,
     79, 67, 89 — so nothing in the pair lines up twice within any session
     anyone will sit through.

     Ole asked for more life, and the answer was mostly the PATH rather than
     the distance. Each pool used to shuttle between two points, and a
     straight line retraced at a constant rate reads as machinery no matter
     how slowly it is taken. They now wander a closed loop of five and four
     stops, in opposite directions, so the pair is never doing the same thing
     twice in a row and the eye cannot predict either one. Amplitude went from
     2.4% to about 4% and the cycles from 71s/97s to 53s/79s, which is still
     around 0.1% of the viewport a second — slower than a minute hand.

     The drift is `linear`, not `ease-in-out`: eased segments decelerate into
     every stop, and five little arrivals a cycle is the ticking this is meant
     to avoid. At this speed the corners between segments are far below what
     anyone can see. The swell IS eased, because it has one turn per cycle
     rather than five, and over a minute and a bit that turn is invisible.

     Contrast is unaffected by either. The worst case was computed at the
     pools' PEAK alpha, at the centre of the gradient; moving a pool cannot
     exceed that and neither can stretching one, because scaling changes where
     the falloff sits, never how dark the middle is.

     The pools carry more weight than they did, which was the point of the
     change, and the cost is computed rather than assumed. Compositing the
     lower pool at 0.62 over the flat band takes the muted hero copy from
     7.72:1 to about 6.5:1 and the hero link to about 5.2:1, both still clear
     of AA. Over the gradient's light end it goes the other way and IMPROVES
     the ratio, because there the pool darkens the ground rather than lifting
     it. */
  @media (prefers-reduced-motion: no-preference) {
    .wash {
      animation:
        drift-a 53s linear infinite,
        swell-a 67s ease-in-out infinite;
    }
    .wash2 {
      animation:
        drift-b 79s linear infinite,
        swell-b 89s ease-in-out infinite;
    }
  }
  /* 1 is the floor, never a step below it. */
  @keyframes swell-a {
    0%,
    100% {
      scale: 1;
    }
    50% {
      scale: 1.09;
    }
  }
  @keyframes swell-b {
    0%,
    100% {
      scale: 1;
    }
    50% {
      scale: 1.12;
    }
  }
  /* Clockwise, up and right first. */
  @keyframes drift-a {
    0%,
    100% {
      translate: 0 0;
    }
    20% {
      translate: 2.1% -1.4%;
    }
    40% {
      translate: 4% -0.5%;
    }
    60% {
      translate: 3.2% 1.7%;
    }
    80% {
      translate: 1.3% 1.5%;
    }
  }
  /* Anticlockwise, down and left, so at no point are both going the same way. */
  @keyframes drift-b {
    0%,
    100% {
      translate: 0 0;
    }
    25% {
      translate: -2.7% 1.3%;
    }
    50% {
      translate: -4% 3.4%;
    }
    75% {
      translate: -1.5% 3.8%;
    }
  }

  /* ---- the hero arriving ----
     The stagger: each part comes up a little after the one above it, in
     reading order, and John himself last and barely, because a cutout of a
     person sliding into place is the thing we are trying not to do. Three
     other treatments were built beside it and compared in the dev panel; this
     is the one Ole kept, so the others and the panel are gone rather than
     lingering behind an attribute nothing sets.

     Wrapped in `no-preference`, so the resting state is the FINISHED state:
     with reduced motion, or if these rules never apply at all, every element
     is simply present. `both` fill holds the opening state through the delay,
     so nothing flashes in before its turn. */
  @media (prefers-reduced-motion: no-preference) {
    .heroCopy > *,
    .portrait {
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
    .aside {
      animation-delay: 340ms;
    }
    .actions {
      animation-delay: 430ms;
    }
    .reassure {
      animation-delay: 510ms;
    }
    .portrait {
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
  .aside {
    margin: 24px 0 0;
    max-width: 40ch;
    padding-left: 16px;
    /* The same accent, at the same 4px as the step connector. */
    border-left: 4px solid var(--color-accent);
    font-family: var(--font-display);
    font-size: 16.5px;
    font-style: italic;
    line-height: 1.6;
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
  /* This paragraph goes through `renderInline`, which has no wrapper, so it
     never picks up `.prose-clear a`'s underline. Colour alone separates the
     link from its own sentence at 1.24:1, which is SC 1.4.1. */
  .reassure :global(a) {
    color: var(--color-on-deep-kicker);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .reassure :global(a:hover) {
    color: #fff;
  }
  .portrait {
    position: relative;
    align-self: end;
    min-width: 0;
  }
  .heroFig {
    margin: 0;
    /* `clip`, not `hidden`. `overflow: hidden` makes this a scroll container,
       and the portrait's fade uses a `view()` timeline whose source is the
       nearest such ancestor. This box has no scrollable overflow, so the
       timeline can go inactive, contribute nothing, and leave the underlying
       `opacity: 0` standing. `clip` clips without creating a scroller. */
    overflow: clip;
    display: block;
    position: relative;
  }
  /* Scoped to the mobile matte. The two masked layers own their own images
     now, and the absolute positioning these rules used to apply took those
     images out of flow, which collapsed both layers to zero height. */
  .cutMobile {
    width: 118%;
    max-width: none;
    margin-left: -9%;
    height: auto;
    display: block;
  }
  @media (max-width: 879px) {
    .portrait {
      align-self: end;
    }
    .plateBg,
    .layer {
      display: none;
    }
    .cutMobile {
      display: block;
    }
    .heroFig {
      width: 100vw;
      margin-left: calc(50% - 50vw);
      margin-top: 20px;
    }
    .cutMobile {
      width: 116vw;
      margin-left: -8vw;
    }
    /* He fades up as he is scrolled to, rather than greeting the reader with
       the top of his head. Guarded on the timeline's own support so that a
       browser without it never applies the `opacity: 0`: the failure mode to
       avoid is hiding him permanently, which is exactly what an unguarded
       hide would do. The latch class then wins over the animation for good.

       `:global()` on the latch class because the action adds it at runtime,
       and Svelte's scoper prunes any rule keyed off a class it cannot see in
       the markup: without it the latch compiles away and he re-hides on every
       scroll back to the top, while the stylesheet still reads as correct. */
    @supports (animation-timeline: view()) {
      .heroCut {
        opacity: 0;
        /* A duration, even though a view() timeline ignores it: Firefox
           declines to apply the animation at all without one, and it supports
           the timeline, so `@supports` passes and the bare `opacity: 0`
           would be all that was left. */
        animation: hero-cut-reveal 1ms linear both;
        animation-timeline: view();
        animation-range: entry 30% entry 55%;
      }
      /* Held at zero by the action when the page OPENS with a sliver of him
         showing. It overrides the timeline rather than deferring to it,
         because a timeline resolves to wherever this scroll position falls and
         would render him half-faded — the fault this whole arrangement exists
         to avoid. */
      .heroCut:global(.is-held) {
        opacity: 0;
        animation: none;
      }
      .heroCut:global(.is-revealed) {
        opacity: 1;
        animation: none;
        /* From held to opaque is a real fade, once, on the scroll that brings
           him in. The timeline does this itself in the ordinary case; this is
           for the case the timeline was taken away from. */
        transition: opacity 700ms var(--ease-brand);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .heroCut,
      .heroCut:global(.is-held),
      .heroCut:global(.is-revealed) {
        opacity: 1;
        animation: none;
        transition: none;
      }
    }
  }
  /* One matte on every ground, which is what a straight-alpha cutout with the
     backdrop taken out of its COLOUR as well as its matte is for. The plain
     knockout is still the master the geometry is measured from and the input
     scripts/keyer.ts keys, but nothing paints it: its fringe carries
     the white cyclorama, and over the plate that composites brighter than the
     plate itself. See the note on .layerIn in the markup for the numbers. */

  @keyframes hero-cut-reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* From 880px he settles INTO the plate, and the disc settles inward around
     him at the same time, over the same duration, from the same delay. Once,
     ending where it ends. Slow enough not to be watchable, which is the point.

     It is small on purpose. The plate crops him, so a scale is the only move
     available that does not slide him against his own frame, and anything
     faster or larger reads as a camera rather than as someone settling. The
     origin is the bottom centre, so he grows up and outward from where he
     stands rather than drifting off his own feet.

     The base translate is repeated in both keyframes because a transform is
     one property: a keyframe that sets only `scale()` would drop the centring
     and the head shift with it, and throw him half a width to the right. */
  @media (min-width: 880px) and (prefers-reduced-motion: no-preference) {
    /* On the IMAGES, not on the layers. The mask that cuts the circle lives on
       the layer, so scaling the layer scaled the circle with it and the disc's
       edge drifted away from the plate. The two images sit in identical boxes
       with identical transforms, so animating them separately is still exactly
       synchronous. */
    /* Scaled about its CENTRE, so he grows outward in both directions rather
       than rising off his own feet. */
    .layer img {
      transform: translateY(var(--matte-drop));
      transform-origin: center;
      animation: hero-cut-settle var(--settle-duration) var(--settle-ease) both;
      animation-delay: var(--settle-delay);
    }
    .heroFig {
      animation: disc-settle var(--settle-duration) var(--settle-ease) both;
      animation-delay: var(--settle-delay);
    }
  }
  /* A plain scale about the centre; the layers do the horizontal centring and
     the masks stay put on the plate. */
  @keyframes disc-settle {
    from {
      transform: scale(var(--disc-settle));
    }
    to {
      transform: scale(1);
    }
  }
  @keyframes hero-cut-settle {
    from {
      transform: translateY(var(--matte-drop)) scale(1);
    }
    to {
      transform: translateY(var(--matte-drop)) scale(var(--push-in-scale));
    }
  }
  /* Above 880px he is no longer leaning on the viewport, so a circular plate
     makes the crop instead. It is lighter than the band, not deeper: a darker
     plate sat barely 1.1:1 from the ground and did not register at all. */
  /* From 880px he stands on the plate rather than on the edge of the band,
     so the band needs floor under him: without it the plate sits on the join
     and the whole hero reads as having been cropped. */
  @media (min-width: 880px) {
    .hero {
      padding-bottom: clamp(56px, 7vw, 92px);
    }
    /* An inline-size container, so the head band can say how far down its own
       image has to sit: the plate is square, so the plate's HEIGHT is 100cqw.
       Without this there is no unit that names it, since a percentage inside
       the band resolves against the band's own height. */
    .portrait {
      container-type: inline-size;
      align-self: center;
      /* Every geometry token is set as an inline style from
         src/lib/generated/portrait-geometry.json, which is measured off the
         cutout itself. --out-fade-start and --out-fade-end used to be the two
         exceptions, hand-typed at 7% and 21%, and they were wrong: the fade
         began while the circle was still crossing his skull, so the same
         opaque skin was painted at full strength on the plate just inside the
         arc and at 0.63 over the deep band just outside it.

         Measured on the rendered hero, along rays through the arc, fitting the
         luminance profile either side and taking the gap between them — so a
         curving forehead reads as zero and only a STEP shows: 13.7 levels mean
         and 30.9 at p95, against a floor of 9.05/22.5 for the same rays on the
         figure painted ONCE with no circle at all. With the fade solved it is
         9.05/22.5 — identical to the floor, to three decimal places. The
         two-layer construction is now indistinguishable from a single layer,
         which is what it always claimed to be.

         This was Ole's "luminosity jumps on his upper head where the circle
         mask intersects", and it was on OPAQUE skin, so no matte could have
         fixed it. They are now solved from the silhouette in
         scripts/check-portrait-fit.ts and the build fails if the gap between
         his crown and his shoulders cannot hold them. */

      /* The two masks OVERLAP by this much rather than meeting exactly.
         Complementary edges sum to 1 in arithmetic, but Safari rounds each
         layer's coverage independently and leaves a sub-pixel line of the
         ground showing along the circle. Overlapping costs nothing: in the
         overlap band both layers are fully opaque and both are the same
         photograph in the same place, so painting twice is identical to
         painting once. */
      --mask-overlap: 1.5px;

      /* One duration and one delay for BOTH of the hero's slow moves: the
         disc settling inward and John pushing in. They are two halves of the
         same gesture, so they start together and land together; running them
         at 1.4s and 3.2s made the disc arrive while he was still growing,
         which read as two unrelated things happening near each other. Shared
         as tokens so they cannot drift apart again. */
      --settle-duration: 2600ms;
      --settle-delay: 180ms;
      /* Their own curve, not --ease-brand. That one is
         cubic-bezier(0.22, 1, 0.36, 1), which is right for a control
         responding to a click: it spends almost all its travel immediately.
         Measured here, both moves were finished 400ms into a 2600ms
         animation, so the duration was nearly all tail and the "slow" push-in
         was not slow at all. This curve spreads the travel across the whole
         duration and only eases at the very end. */
      --settle-ease: cubic-bezier(0.36, 0.06, 0.28, 1);

      /* The cutout's last four rows never reach full opacity: he was cut off
         by the bottom of the source frame, so the matte ramps out instead of
         ending. On the deep band that is invisible, but inside the sand plate
         the ground showed through them as a rim under his shirt. Dropping him
         by that much puts those rows below the circle, where the mask is
         already empty. Measured, not guessed, and against the IMAGE's own
         height, which is what a percentage in `translateY` resolves against. */
      --matte-drop: 0.34%;

      /* Room above the plate for the head to occupy. It is also what keeps
         the grid row tall enough that the pop is not clipped by the hero's
         own `overflow: clip`. */
    }
    /* The disc and its masks settle inward a little as the page arrives, so
       the circle reads as an object placed on the band rather than as a hole
       punched through it. It is on the plate box, so the masks scale with the
       disc exactly and stay aligned; John's own push-in runs the other way and
       at a different rate, which is what keeps the two from reading as one
       move. */
    .heroFig {
      aspect-ratio: 1;
      /* No clipping and no background here: the plate is its own layer now,
         so that the figure can paint outside the circle. */
      overflow: visible;
      align-self: center;
    }
    /* Inset by a sub-pixel, so the masked figure overlaps the disc's own edge
       rather than meeting it exactly. Meeting exactly leaves a hairline of the
       sand showing around him wherever the two antialiased edges round apart.
       Where he is transparent the disc's edge is the visible one, and it is
       three quarters of a pixel smaller than it was, which is nothing. */
    .plateBg {
      position: absolute;
      inset: var(--disc-inset);
      border-radius: 50%;
      /* The plate is the hero Call button's own hue, taken sandy: the same
         220.6 degrees, with the chroma dropped from 0.117 to about 0.05 and
         the lightness lifted. So it reads as the same family as the button
         rather than as a second, unrelated colour, and it stops the disc
         being the yellow it had drifted to.

         Off-centre, so the light falls from the upper left where the corner
         wash already pools and the disc reads as lit rather than as a flat
         swatch.

         It is light on purpose, and the reason is measured: against the old
         teal plate his near-black shirt separated at 1.82:1 and the
         silhouette bled into its own ground. Against this it is 12.28:1 at
         the pale end and 10.21:1 at the deep end. */
      /* Three layers rather than one ramp, so the disc has some play in it:
         a small warm highlight up and left, where the hero's own corner wash
         already pools; a cool counter-pool low and right, so the shading does
         not read as a single direction; and the body of the colour underneath
         them both. Each is soft and none is strong. The point is that the
         surface is not flat, not that anyone notices a gradient. */
      background:
        radial-gradient(52% 46% at 26% 18%, #b2d9e6 0%, rgb(178 217 230 / 0) 100%),
        radial-gradient(58% 54% at 78% 88%, #7ab0c6 0%, rgb(122 176 198 / 0) 100%),
        radial-gradient(118% 118% at 32% 22%, #9bcbdc 0%, #90c5d8 42%, #83bcd1 100%);
    }

    /* The shared parent. The push-in lives here, so both layers move as one. */
    .cuts {
      position: absolute;
      inset: 0;
    }
    .cutMobile {
      display: none;
    }
    .layer {
      position: absolute;
      left: 50%;
      bottom: 0;
      width: var(--plate-img-width);
      padding-top: var(--layer-pad);
      transform: translateX(calc(-50% + var(--head-shift)));
      mask-repeat: no-repeat;
      box-sizing: content-box;
    }
    .layer img {
      display: block;
      width: 100%;
      height: auto;
      max-width: none;
    }
    /* Keep what falls inside the circle, right out to its edge. Outside the
       tile the mask is empty, which `no-repeat` makes transparent, so nothing
       else is painted. */
    .layerIn {
      mask-image: radial-gradient(circle closest-side, #000 calc(100% - 0.25px), transparent 100%);
      mask-size: var(--mask-size);
      mask-position: var(--mask-position);
    }
    /* Keep what falls outside it: the whole box, faded out down the page,
       minus a circle a hair SMALLER than the one above. That difference is
       --mask-overlap, and it is what stops the ground showing through as a
       sub-pixel line along the join. */
    .layerOut {
      mask-image:
        linear-gradient(
          to bottom,
          #000 0 var(--out-fade-start),
          rgb(0 0 0 / 0) var(--out-fade-end)
        ),
        radial-gradient(
          circle closest-side,
          #000 calc(100% - var(--mask-overlap)),
          transparent calc(100% - var(--mask-overlap) + 0.75px)
        );
      mask-size: 100% 100%, var(--mask-size);
      mask-position: 0 0, var(--mask-position);
      mask-composite: subtract;
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
  /* No `align-items` here: the row is a `.mark-row`, and setting it would
     out-specify the principle and quietly top-align the disc again. */
  .stepList li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 18px;
    min-width: 0;
    position: relative;
  }
  /* Size, colour and stacking only: `.mark-disc` in app.css owns the shape
     and, more importantly, the baseline. */
  .disc {
    font-family: var(--font-display);
    font-weight: 600;
    /* 20px heading over a 15px numeral. Both Fraunces, so the ratio of sizes
       is the ratio of x-heights, which is what the alignment rule wants. */
    --mark-ratio: 1.3333;
    font-size: 15px;
    color: #fff;
    background: var(--color-teal);
    position: relative;
    z-index: 1;
  }
  .stepList h3 {
    margin-bottom: 8px;
  }

  /* The line between the discs, and only where they stack.

     4px, because a hairline beside a serif heading reads as a mistake. That
     is the measured width of the thickest stem in the heading's own type
     (cap H and I, Fraunces 600 at 20px): the connector should be at least as
     heavy as the letterforms it runs beside.

     One segment per gap, so it needs no knowledge of how tall any step's text
     is. Above 860px the three steps sit side by side, the sequence is already
     read left to right without help, and a rule running through it would be
     decoration; there is no line there at all.

     Its resting state is DRAWN. `js-anim`, which only the scroll-draw action
     adds, is what collapses it, so no JavaScript, an old browser or a
     reduced-motion preference all leave the line simply present. Both runtime
     hooks are wrapped in :global(): Svelte's scoper only sees classes written
     in the markup, so it prunes any rule keyed off one an action adds, and the
     animation silently does nothing while the stylesheet reads as correct. */
  @media (max-width: 859px) {
    .stepList li:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 34px;
      bottom: -28px;
      width: 4px;
      /* The light accent, by decision. Measured, it is 1.13:1 against this
         section's mist ground, where the ink sibling was 4.46:1: on a light
         ground this reads as a pale suggestion rather than a line. It is not
         an accessibility failure, because the numbered discs carry the
         sequence and the connector only decorates it, but it is very quiet.
         If it should actually be seen, the section needs a darker ground. */
      background: var(--color-accent);
      transform-origin: top center;
    }
    /* Each segment owns its own half of the travel, so the line reads 1 to 3
       rather than both halves growing at once. */
    .stepList:global(.js-anim) li:not(:last-child)::before {
      transform: scaleY(var(--seg, 0));
    }
    .stepList:global(.js-anim) li:nth-child(1)::before {
      --seg: clamp(0, calc(var(--draw-progress, 0) * 2), 1);
    }
    .stepList:global(.js-anim) li:nth-child(2)::before {
      --seg: clamp(0, calc((var(--draw-progress, 0) - 0.5) * 2), 1);
    }
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
    }
  }
  /* Sized as a fixed fraction of the heading token rather than in pixels, so
     the ratio the alignment rule needs stays true across the heading's whole
     clamp instead of only at one viewport width. */
  .num {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    --mark-ratio: 1.5;
    font-size: calc(var(--text-h3) / 1.5);
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
  }
  .who {
    margin: 8px 0 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-muted);
  }
  /* Hung under the body rather than beside the title, so the row is read as
     summary first and the link is where the reader arrives having decided
     they want more. The arrow leads and is the only thing that moves, as in
     the contact rows. */
  .moreabout {
    margin: 18px 0 0;
    font-size: 16px;
  }
  .moreabout a {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--color-teal);
    font-weight: 600;
    text-decoration: none;
  }
  .moreabout a:hover {
    color: var(--color-deep);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .moreabout a :global(svg) {
    transition: transform var(--dur-base) var(--ease-brand);
  }
  .moreabout a:hover :global(svg) {
    transform: translateX(4px);
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
  /* `.quallist li`, not `.quals li`. As `.quals li` it reached past its own
     list into the membership chips in the next column and overrode their
     layout — 0,1,1 beats the chips' 0,1,0 — so the chips silently laid out as
     flex rows with a hairline under each. A descendant selector that names the
     section rather than the list is a rule aimed at everything below it. */
  .quallist li {
    padding: 12px 0;
    border-bottom: 1px solid var(--color-line);
    display: flex;
    gap: 16px;
    justify-content: space-between;
    align-items: baseline;
  }
  .quallist .detail {
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
  .bodylist {
    list-style: none;
    margin: 22px 0 0;
    padding: 0;
    display: grid;
    gap: 12px;
    /* Every chip the height of the tallest, with nobody measuring the longest
       line to find out what that is. In a grid with no fixed height, `1fr`
       tracks all resolve to the size of the largest, so the chip with the most
       text sets the height and the others follow — at any breakpoint, and
       whatever John types into the CMS. */
    grid-auto-rows: 1fr;
  }
  /* The mark's column. One width for every mark, so a wide wordmark and a
     square flower carry the same weight; the artwork inside is fitted, never
     stretched. 104px holds the widest of them at a legible size, and its
     44px of height is the tallest any of them needs. */
  .chip {
    --mark-col: 104px;
    display: grid;
    grid-template-columns: var(--mark-col) 1px minmax(0, 1fr);
    align-items: center;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 0 0 1px rgb(15 50 64 / 0.07);
  }
  /* `.chipmark`, not `.mark`. `.mark` is taken: it is the alignment
     principle's marker class, worn by the numbered discs in the steps above,
     and a second meaning for it stretched those discs into 213px ellipses. A
     class name is an interface. */
  .chipmark {
    display: grid;
    place-items: center;
    /* The PSA's licence asks for clear space of at least the height of its own
       head on every side. This padding is that, and the others inherit it. */
    padding: 14px;
    height: 100%;
  }
  /* A fixed box with `contain`, not `max-height` with `auto`. The PSA's mark
     is an SVG with no intrinsic size, and against `width:auto;height:auto` it
     resolved to 0x0 and rendered nothing at all. A box the artwork is fitted
     INTO is also what makes the marks one size: 76 by 44 is the chip's column
     minus its clear space, and every mark gets the same one whatever its own
     aspect. */
  .chipmark img {
    display: block;
    width: 76px;
    height: 44px;
    object-fit: contain;
  }
  /* The divider, inset from the chip's own edges so it reads as a rule between
     two things rather than as a seam between two boxes. */
  .hair {
    align-self: stretch;
    margin-block: 12px;
    background: var(--color-line);
  }
  .words {
    min-width: 0;
    padding: 14px 16px;
  }
  .bname {
    display: block;
    font-weight: 600;
    font-size: 16px;
    color: var(--color-ink);
    text-wrap: balance;
  }
  /* Linked only when John has given the listing a URL. The chip does not
     become a link: the mark is not the listing, and a whole white card that
     is clickable in some rows and not in others is a worse promise than a
     linked name. */
  .bname a {
    /* Same 24px floor as the footer's, and for the same reason: the name of a
       register is not a link in a sentence, it is a target on its own. */
    display: inline-block;
    padding-block: 2px;
    color: inherit;
    text-decoration-color: var(--color-line);
    text-underline-offset: 3px;
  }
  .bname a:hover {
    text-decoration-color: currentcolor;
  }
  .bnote {
    display: block;
    margin-top: 3px;
    font-size: 14.5px;
    color: var(--color-muted);
  }
</style>
