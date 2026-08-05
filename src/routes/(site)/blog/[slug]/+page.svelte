<!--
  A post.

  Set as one column of prose on the page's own ground, with the date as the
  kicker over the title, which is the same head the rest of the scroll uses.
  The contact band closes it, because a post is often the entry point to the
  site rather than the home page.
-->
<script lang="ts">
  import { BLOG_PATH, postPath } from '$lib/content';
  import { blogPostingNode, buildPageSeo } from '$lib/seo/structured-data';
  import { dateAttr, formatDate } from '$lib/date';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props();

  const post = $derived(data.post);

  const seo = $derived(
    buildPageSeo({
      path: postPath(post),
      title: post.seo?.title ?? post.title,
      description: post.seo?.description ?? post.excerpt,
      // The home card. A per-post card would need per-post `og` copy, and
      // that is copy John would have to write for every post he publishes.
      image: '/img/og/home.png',
      graph: [
        blogPostingNode({
          path: postPath(post),
          title: post.title,
          description: post.excerpt,
          publishAt: post.publishAt
        })
      ]
    })
  );
</script>

<SeoHead {seo} />

<Section h1 heading={post.title}>
  <!-- Under the title rather than over it, and a real `<time>`: the date is
       information about the post, not a label for the section, so it is not
       the Section's kicker. -->
  <p class="posted">
    <time datetime={dateAttr(post.publishAt)}>{formatDate(post.publishAt)}</time>
  </p>

  <Prose md={post.body} class="prose-lead mt-9" />

  <p class="back">
    <a href={BLOG_PATH}>
      <span class="arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
      All posts
    </a>
  </p>
</Section>

<ContactBand />

<style>
  .posted {
    margin: 18px 0 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
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
  .arrow {
    transform: rotate(180deg);
    transition: transform var(--dur-base) var(--ease-brand);
  }
  .back a:hover .arrow {
    transform: rotate(180deg) translateX(4px);
  }
</style>
