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
  import { contact, livePosts, postPath, site } from '$lib/content';
  import { publishClock } from '$lib/publish-clock.svelte';
  import { buildPageSeo } from '$lib/seo/structured-data';
  import { dateAttr, formatDate } from '$lib/date';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';

  const clock = publishClock();
  const posts = $derived(livePosts(clock.value));

  // The description used to be `site.description` verbatim — the home page's
  // own 147 characters, about fees and session lengths, on a page that lists
  // none. Two pages sharing a description is two pages telling a search engine
  // they are the same page, and the one that loses is this one.
  //
  // So it is assembled instead, and only out of sentences that are already
  // published elsewhere on the site: his name, the job title from
  // `site.schema`, and the location line from the contact block. Every clause
  // is his and stays his when he edits it. The two words that are ours are
  // "Writing from", which name the page rather than claim anything — the same
  // footing as "Blog" and "From the blog" (docs/copy-to-confirm.md §5), and
  // recorded there with the rest of them for him to overrule.
  const seo = buildPageSeo({
    path: '/blog/',
    title: `Blog | ${site.name}, ${site.tagline}`,
    description: `Writing from ${site.name}, ${site.schema.jobTitle}. ${contact.locationNote}`,
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
            {#if post.image}
              <!-- Below the words, not beside them: the row is a title and a
                   sentence, and a picture in the left column would fight the
                   date for the same job. `alt=""` when he left the
                   description empty, which is how a screen reader is told to
                   pass over decoration rather than read a filename aloud.
                   Dimensions are unknown at build time, so `aspect-ratio`
                   holds the space instead and the row cannot jump. -->
              <a class="shot" href={postPath(post)} tabindex="-1" aria-hidden="true">
                <img src={post.image} alt={post.imageAlt ?? ''} loading="lazy" decoding="async" />
              </a>
            {/if}
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
  /* The picture is a second link to the same post, so it is out of the tab
     order and hidden from assistive tech: the title above it already goes
     there, and two stops on one row is noise to anyone tabbing through. */
  .shot {
    display: block;
    margin-top: 18px;
    max-width: 560px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-mist);
    aspect-ratio: 16 / 9;
  }
  .shot img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

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
