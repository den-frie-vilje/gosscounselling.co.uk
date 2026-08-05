<!--
  The blog index.

  Rows on hairlines, the same idiom as the services on the home page: nothing
  on this site is a card, and a list of posts is exactly the shape that
  usually becomes one. The date is the marker beside the title and is aligned
  on its type through `.mark-row`, like every other marker here.

  What it shows is decided by the publish clock, not by the build: a post
  dated in the future is in this page's HTML and appears in the list the
  moment its time passes. See $lib/publish-clock.
-->
<script lang="ts">
  import { livePosts, postPath, site } from '$lib/content';
  import { publishClock } from '$lib/publish-clock.svelte';
  import { buildPageSeo } from '$lib/seo/structured-data';
  import { dateAttr, formatDate } from '$lib/date';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';

  const clock = publishClock();
  const posts = $derived(livePosts(clock.value));

  // The description is the site's own, and that is a placeholder rather than
  // a choice: a standfirst for the blog is copy, and copy here is John's to
  // write (DECISIONS.md §19, docs/copy-to-confirm.md). His site description
  // is at least true of the page.
  const seo = buildPageSeo({
    path: '/blog/',
    title: `Blog | ${site.name}`,
    description: site.description,
    image: '/img/og/home.png'
  });
</script>

<SeoHead {seo} />

<!-- An index with nothing live on it yet happens only while the first post is
     still scheduled. It must not be indexed in that state, and this literal
     is also what keeps `/blog/` out of the filesystem-derived sitemap:
     $lib/seo/sitemap reads page sources looking for exactly this meta, and
     src/routes/sitemap.xml/+server.ts adds the URL back once there is
     something live to advertise. -->
<svelte:head>
  {#if posts.length === 0}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>

<Section h1 heading="Blog">
  {#if posts.length}
    <div class="border-line mt-13 border-t">
      {#each posts as post (post.slug)}
        <article class="row mark-row">
          <p class="date mark">
            <time datetime={dateAttr(post.publishAt)}>{formatDate(post.publishAt)}</time>
          </p>
          <div class="min-w-0">
            <h2 class="t-h3">
              <a href={postPath(post)}>{post.title}</a>
            </h2>
            <p class="excerpt">{post.excerpt}</p>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</Section>

<!-- The same close as every other page: a post is often the entry point to
     the site, and so is the list of them. -->
<ContactBand />

<style>
  .row {
    min-width: 0;
    display: grid;
    gap: 8px 40px;
    padding: 36px 0;
    border-bottom: 1px solid var(--color-line);
  }
  @media (min-width: 820px) {
    .row {
      grid-template-columns: auto 1fr;
    }
  }
  /* A fixed fraction of the heading token, so the alignment ratio holds
     across the heading's whole clamp rather than at one viewport width. */
  .date {
    margin: 0;
    --mark-ratio: 1.6;
    font-size: calc(var(--text-h3) / 1.6);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .row h2 a {
    color: inherit;
    text-decoration: none;
  }
  .row h2 a:hover {
    color: var(--color-teal);
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .excerpt {
    margin: 10px 0 0;
    max-width: 66ch;
    color: var(--color-muted);
    font-size: 17px;
  }
</style>
