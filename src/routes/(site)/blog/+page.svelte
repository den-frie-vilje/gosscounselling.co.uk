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
  import { breadcrumbNode, buildPageSeo } from '$lib/seo/structured-data';
  import { dateAttr, formatDate } from '$lib/date';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
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
  /* One level down. The same array feeds the trail and the BreadcrumbList. */
  const trail = [{ label: 'Home', href: '/' }, { label: 'Blog' }];

  const seo = buildPageSeo({
    graph: [breadcrumbNode(trail)],
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
  {#snippet above()}
    <Breadcrumbs {trail} />
  {/snippet}
  {#if posts.length}
    <div class="list border-line mt-13 border-t">
      {#each posts as post (post.slug)}
        <article class="row mark-row">
          <p class="date mark">
            <time datetime={dateAttr(post.publishAt)}>{formatDate(post.publishAt)}</time>
          </p>
          <div class="min-w-0 text">
            {#if post.image}
              <!-- First in the cell and floated, so the title and the excerpt
                   wrap beside it. Under the date it hung in a narrow column
                   with nothing to sit against; in the text's own cell it has
                   something to be beside. Floated rather than given a track of
                   its own, because a track is reserved whether or not a post
                   has a picture, and a row without one would carry an empty
                   column's worth of nothing. -->
              <span class="shot">
                <img src={post.image} alt={post.imageAlt ?? ''} loading="lazy" decoding="async" />
              </span>
            {/if}
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
  /* THE WHOLE ROW GOES TO THE POST. One link still, the title, stretched over
     the row by a pseudo-element: a second real <a> around the picture would be
     a second tab stop and a second announcement of the same destination, and
     wrapping the row in one would put a heading inside a link. This way the
     link text stays the title, there is one stop, and the whole row is a
     target — which on a phone is the difference between hitting it and not. */
  .row {
    position: relative;
  }
  .row h2 a::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  /* A thumbnail in the date's column, under the date. Full width under the
     excerpt it made every row with a picture three times the height of one
     without, and the page stopped reading as a list.

     No placeholder and no reserved space when there is no picture: the element
     is simply not rendered, the row keeps its own height, and a list of posts
     without pictures looks like a list of posts rather than like one with
     holes in it. */
  .shot {
    display: block;
    float: right;
    width: 168px;
    margin: 4px 0 12px 28px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-mist);
    aspect-ratio: 4 / 3;
  }
  .shot img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* THE COLUMNS ARE THE LIST'S, NOT EACH ROW'S.
     Every article used to be its own grid with `auto 1fr`, so each row sized
     its own date column and every title started wherever that row's date
     happened to end: "1 July 2026" and "28 July 2026" are not the same width,
     and the titles stepped in and out down the page. One grid on the list, and
     the rows take their tracks from it with `subgrid`, so there is one column
     width for all of them and it is the widest date's.

     `subgrid` rather than putting the articles' children directly in the list
     grid, because the article is a real box: it carries the hairline between
     posts, and `display: contents` would throw that away. */
  .list {
    display: grid;
    grid-template-columns: 1fr;
  }
  .row {
    min-width: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px 40px;
    padding: 36px 0;
    border-bottom: 1px solid var(--color-line);
  }
  /* Stacked, the source order would read date, picture, title — the thumbnail
     sits in the markup where its column wants it, and in one column that puts
     it between the date and the thing it belongs to. The words come first and
     the picture follows them. */
  /* On a phone there is no room to wrap text beside anything, so it stops
     floating and runs the full width — under the words rather than over them.
     
     The cell becomes a flex column to do that. The picture has to come FIRST
     in the source for a float to wrap the text beside it on a wider screen,
     and with the float gone that source order put it between the date and the
     title, so the title was pushed below a photograph of a hedge. `order` puts
     it back where it reads, and only flex or grid can honour `order` — which
     is why the cell changes display here and nowhere else. */
  @media (max-width: 640px) {
    .text {
      display: flex;
      flex-direction: column;
    }
    .shot {
      float: none;
      order: 3;
      width: 100%;
      margin: 22px 0 0;
      aspect-ratio: 16 / 9;
    }
  }
  @media (min-width: 820px) {
    .list {
      grid-template-columns: auto 1fr;
    }
    .row {
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }
    /* Without subgrid the row keeps its own two tracks: the titles are back to
       stepping, which is a blemish, where a broken layout would not be. */
    @supports not (grid-template-columns: subgrid) {
      .row {
        grid-template-columns: auto 1fr;
      }
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
    color: var(--color-muted);
    font-size: 17px;
  }
</style>
