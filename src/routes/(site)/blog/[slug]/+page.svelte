<!--
  A post.

  Set as one column of prose on the page's own ground, with the date as the
  kicker over the title, which is the same head the rest of the scroll uses.
  The contact band closes it, because a post is often the entry point to the
  site rather than the home page.
-->
<script lang="ts">
  import { BLOG_PATH, livePosts, postPath, postSlug, site } from '$lib/content';
  import { publishClock } from '$lib/publish-clock.svelte';
  import { blogPostingNode, breadcrumbNode, buildPageSeo } from '$lib/seo/structured-data';
  import { dateAttr, formatDate } from '$lib/date';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import Section from '$lib/components/Section.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Prose from '$lib/components/Prose.svelte';
  import ContactBand from '$lib/components/ContactBand.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props();

  const post = $derived(data.post);

  /* Two levels down, which is the deepest this site goes: the post is inside
     the blog, and the blog is inside the site. One array, handed both to the
     component and to the BreadcrumbList, so the trail a reader sees and the
     trail a crawler reads are the same object. */
  const trail = $derived([
    { label: 'Home', href: '/' },
    { label: 'Blog', href: BLOG_PATH },
    { label: post.title }
  ]);

  /**
   * The post before and after this one, on the same clock the listings use.
   *
   * `livePosts` and not the whole set, so a post scheduled for next week is
   * not linked to from here before it exists — it would 404 for a reader and
   * be a dead link for a crawler. It is a `$derived` on the clock for the same
   * reason the listings are: the moment a scheduled post's time passes, it
   * joins the sequence without a rebuild.
   *
   * `builtPosts` is newest first, so the NEXT post in the array is the older
   * one. The labels say "Older" and "Newer" rather than "Previous" and "Next",
   * because previous and next are ambiguous about which way time runs and a
   * reader should not have to work it out.
   */
  const around = $derived.by(() => {
    const posts = livePosts(publishClock().value);
    const i = posts.findIndex((p) => postSlug(p) === postSlug(post));
    if (i < 0) return { newer: null, older: null };
    return { newer: posts[i - 1] ?? null, older: posts[i + 1] ?? null };
  });

  const seo = $derived(
    buildPageSeo({
      path: postPath(post),
      // The site name is appended, as it is on the home page and on a service
      // page. Without it a post's tab and its search result read as a stray
      // headline belonging to nobody, which is the opposite of what a post is
      // for: it is often the first page of his that anyone sees. A post that
      // sets its own `seo.title` is left exactly as written.
      title: post.seo?.title ?? `${post.title} | ${site.name}`,
      description: post.seo?.description ?? post.excerpt,
      // `article`, not the site-wide `website`. It is the one page here that
      // is a piece of writing with a date rather than part of the furniture,
      // and the `BlogPosting` node below already says so to search engines;
      // this says the same thing to everything that reads Open Graph instead.
      ogType: 'article',
      // The home card. A per-post card would need per-post `og` copy, and
      // that is copy John would have to write for every post he publishes.
      image: '/img/og/home.png',
      graph: [
        breadcrumbNode(trail),
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
  {#snippet above()}
    <Breadcrumbs {trail} />
  {/snippet}
  <!-- Under the title rather than over it, and a real `<time>`: the date is
       information about the post, not a label for the section, so it is not
       the Section's kicker. -->
  <p class="posted">
    <time datetime={dateAttr(post.publishAt)}>{formatDate(post.publishAt)}</time>
  </p>

  {#if post.image}
    <!-- Between the date and the body: it belongs to the post rather than
         announcing it, so it is not above the title. `alt=""` when he left the
         description empty — the honest signal for decoration, and better than
         reading a filename at somebody. It is the widest thing on the page and
         the first thing painted, so it is NOT lazy here, and `aspect-ratio`
         holds its space so the words below it do not jump when it lands. -->
    <figure class="shot mt-9">
      <img src={post.image} alt={post.imageAlt ?? ''} decoding="async" />
    </figure>
  {/if}

  <Prose md={post.body} class="prose-lead mt-9" />

  <!-- After the content, which is where a reader who has finished is. A real
       <nav> with a name, so someone using a screen reader can reach it as a
       landmark rather than finding three loose links at the end of an
       article. -->
  <nav class="after" aria-label="More posts">
    <p class="back">
      <a href={BLOG_PATH}>
        <span class="arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        All posts
      </a>
    </p>

    {#if around.newer || around.older}
      <ul class="sequence">
        {#if around.older}
          <li class="older">
            <a href={postPath(around.older)}>
              <span class="dir">Older post</span>
              <span class="what">{around.older.title}</span>
            </a>
          </li>
        {/if}
        {#if around.newer}
          <li class="newer">
            <a href={postPath(around.newer)}>
              <span class="dir">Newer post</span>
              <span class="what">{around.newer.title}</span>
            </a>
          </li>
        {/if}
      </ul>
    {/if}
  </nav>
</Section>

<ContactBand />

<style>
  .after {
    margin-top: 44px;
    padding-top: 28px;
    border-top: 1px solid var(--color-line);
  }
  /* Two links, and the newer one is on the right whether or not there is an
     older one to its left — `margin-left: auto` on the item rather than
     `space-between` on the list, which would centre a lone link. The first and
     last posts each have only one neighbour, and that is the ordinary case at
     the ends of a short blog rather than an edge case. */
  .sequence {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 40px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
  }
  .sequence .newer {
    margin-left: auto;
    text-align: right;
  }
  .sequence a {
    display: block;
    max-width: 34ch;
    text-decoration: none;
    color: inherit;
  }
  .dir {
    display: block;
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-gold);
  }
  .what {
    display: block;
    margin-top: 6px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
    line-height: var(--leading-heading-small);
    color: var(--color-ink);
  }
  .sequence a:hover .what {
    color: var(--color-teal);
    text-decoration: underline;
    text-underline-offset: 5px;
  }

  .shot {
    /* `margin: 0` here silently beat the `mt-9` on the element — a scoped
       class outranks a utility — and left the picture jammed against the date
       by four pixels. The spacing is stated here instead of in two places. */
    margin: 36px 0 0;
    /* The same measure `.prose-clear` gives the body, so the picture is the
       width of the column it belongs to rather than the width of the page.
       Full-bleed it was 871px against 749px of text and read as the subject of
       the page rather than as part of the post.

       `font-size` with it, and that is not decoration: `ch` is the width of a
       "0" in the element's OWN font, so 66ch on a figure inheriting a
       different size came out 708px against the body's 749. The unit only
       means the same thing if the font does. */
    font-size: 18px;
    max-width: 66ch;
    border-radius: 10px;
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
  /* On a phone the measure is the screen, so the picture is simply full width.
     The margin is the room to the date and the title above it — 36px was set
     against a picture inset in a column, and reads tight once it runs edge to
     edge. */
  @media (max-width: 640px) {
    .shot {
      margin-top: 28px;
      max-width: none;
      border-radius: 8px;
      aspect-ratio: 16 / 9;
    }
  }

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
