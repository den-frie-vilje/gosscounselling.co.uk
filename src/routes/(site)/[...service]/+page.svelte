<!--
  A service's own page.

  It opens with the SAME `body` the home page shows, and only then adds the
  detail. That is the point of the shape: the summary lives in exactly one
  place, so the front page and the top of this page cannot drift apart, and
  John writes the longer material without touching what is already published.

  The design is the home page's: divided by ground and hairline, nothing
  boxed, one Prose body on the page's own ground. The contact band closes it
  because a detail page is often the entry point rather than the home page,
  and it must carry the phone number in its own right
  (docs/information-architecture.md, "Internal linking").
-->
<script lang="ts">
  import { home, servicePath, site } from '$lib/content';
  import { breadcrumbNode, buildPageSeo } from '$lib/seo/structured-data';
  import { firstParagraph } from '$lib/markdown';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import Photo from '$lib/components/Photo.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props();

  const service = $derived(data.service);
  const detail = $derived(service.detail);

  // One markdown string, not two Prose blocks: concatenated, the summary and
  // the detail are set as one continuous body, so `.prose-lead`'s opening-ink
  // rule and the paragraph rhythm apply across the join rather than restarting
  // at it.
  const body = $derived(`${service.body}\n\n${detail?.body ?? ''}`);

  /* One level down. There is no index of services to point at — the front
     page's "How I can help" IS that list — so the trail goes Home, then here,
     and does not invent a middle crumb for a page that does not exist. */
  const trail = $derived([{ label: 'Home', href: '/' }, { label: service.title }]);

  const seo = $derived(
    buildPageSeo({
      graph: [breadcrumbNode(trail)],
      path: servicePath(service),
      title: detail?.seo?.title ?? `${service.title} | ${site.name}`,
      description: detail?.seo?.description ?? firstParagraph(service.body),
      // The home card, deliberately. A per-page card would need a per-page
      // `og` block of copy, and copy for these pages is John's to write.
      image: '/img/og/home.png'
    })
  );
</script>

<SeoHead {seo} />

<Section h1 kicker={service.who} heading={service.title}>
  {#snippet above()}
    <Breadcrumbs {trail} />
  {/snippet}
  {#if detail?.photo}
    <!-- Under the heading and above the body, which is where the blog post
         puts its picture, for the same reason: it belongs to the page rather
         than announcing it. `alt=""` when he left the description empty — the
         honest signal for decoration. It is the first thing painted here, so
         it is NOT lazy, and the figure's aspect-ratio holds its space so the
         words below do not jump when it lands. -->
    <figure class="shot">
      <Photo
        src={detail.photo}
        alt={detail.photoAlt ?? ''}
        sizes="(max-width: 640px) 100vw, 66ch"
        loading="eager"
      />
    </figure>
  {/if}

  <Prose md={body} class="prose-lead mt-10" />

  <p class="back">
    <!-- Labelled with the section's own heading from the content, so the
         link back says what the reader will find and nobody has written a
         second name for it. -->
    <a href="/#help">
      <span class="arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
      {home.services.heading}
    </a>
  </p>
</Section>

<ContactBand />

<style>
  /* The blog post's picture treatment, at the same measure the body gets, so
     the picture is the width of the column it belongs to rather than of the
     page. `font-size` travels with `max-width` deliberately: `ch` is the
     width of a "0" in the element's OWN font, so 66ch on a figure inheriting a
     different size is not 66ch of body text. */
  .shot {
    margin: 40px 0 0;
    font-size: 18px;
    max-width: 66ch;
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-mist);
    aspect-ratio: 16 / 9;
  }
  .shot :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* On a phone the measure is the screen, so the picture runs edge to edge. */
  @media (max-width: 640px) {
    .shot {
      margin-top: 30px;
      max-width: none;
      border-radius: 8px;
    }
  }

  .back {
    margin: 48px 0 0;
    padding-top: 28px;
    border-top: 1px solid var(--color-line);
    font-size: 16px;
  }
  .back a {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--color-teal);
    font-weight: 600;
    text-decoration: none;
  }
  .back a:hover {
    color: var(--color-deep);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  /* The arrow leads and points back, the same gesture the contact rows use,
     turned around. */
  .arrow {
    transform: rotate(180deg);
    transition: transform var(--dur-base) var(--ease-brand);
  }
  .back a:hover .arrow {
    transform: rotate(180deg) translateX(4px);
    color: var(--color-accent-ink);
  }
</style>
