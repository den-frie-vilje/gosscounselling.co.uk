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
