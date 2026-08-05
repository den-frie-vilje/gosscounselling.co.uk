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
  import { site } from '$lib/content';
  import { buildPageSeo } from '$lib/seo/structured-data';
  import { servicePath } from '$lib/content';
  import { firstParagraph } from '$lib/markdown';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
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

  const seo = $derived(
    buildPageSeo({
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
  <Prose md={body} class="prose-lead mt-10" />

  <p class="back">
    <a href="/#help">
      <span class="arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
      All the ways I work
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
  }
</style>
