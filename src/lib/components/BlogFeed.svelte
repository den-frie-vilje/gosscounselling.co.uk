<!--
  The latest posts, on the home scroll.

  Renders nothing at all when nothing is live, the same way the testimonials
  rail does: a therapy site with an empty "from the blog" heading looks worse
  than one without the heading. So the section can sit in the page from the
  start and simply appear the day John publishes.

  It has to look deliberate at one post as well as at three, and a lone card
  in a three-column grid is the thing that gives a new blog away. So one post
  is a single wide row with the date beside it, which is the same shape the
  services use; two sit side by side; three sit in the three-column rhythm the
  step list already established, and only then is there a link to the index,
  because a link to "more" is a lie when the page shows everything there is.

  Nothing here is a card. The block is bounded by a hairline top and bottom
  and divided by the gap, exactly as the qualifications and the steps are.

  There is no "featured post" setting. The posts shown are the most recent,
  picked by the code, and what they show is the post's own title and excerpt.
  Anything else would be a second copy of a post's summary for John to keep in
  step with the first.
-->
<script lang="ts">
  import { BLOG_PATH, livePosts, postPath } from '$lib/content';
  import { publishClock } from '$lib/publish-clock.svelte';
  import { dateAttr, formatDate } from '$lib/date';
  import Section from './Section.svelte';
  import Icon from './Icon.svelte';

  const clock = publishClock();
  const live = $derived(livePosts(clock.value));
  const shown = $derived(live.slice(0, 3));
</script>

{#if shown.length}
  <Section surface="mist" heading="From the blog">
    <div
      class="feed"
      class:one={shown.length === 1}
      class:two={shown.length === 2}
      class:three={shown.length >= 3}
    >
      {#each shown as post (post.slug)}
        <article class="item mark-row">
          <p class="date mark">
            <time datetime={dateAttr(post.publishAt)}>{formatDate(post.publishAt)}</time>
          </p>
          <div class="min-w-0">
            <h3 class="t-h3"><a href={postPath(post)}>{post.title}</a></h3>
            <p class="excerpt">{post.excerpt}</p>
          </div>
        </article>
      {/each}
    </div>

    {#if live.length > shown.length || live.length >= 3}
      <p class="more">
        <a href={BLOG_PATH}>
          Read the blog
          <Icon name="arrow" size={18} />
        </a>
      </p>
    {/if}
  </Section>
{/if}

<style>
  /* A rule over the block and a rule under it. The columns are told apart by
     the gap, as the steps and the qualifications are; a vertical hairline
     between them would start drawing the boxes this design does not have. */
  .feed {
    margin-top: 52px;
    display: grid;
    border-top: 1px solid var(--color-line-cool);
  }
  .item {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 30px 0 32px;
    border-bottom: 1px solid var(--color-line-cool);
  }
  @media (min-width: 700px) {
    .feed.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 44px;
    }
  }
  @media (min-width: 860px) {
    .feed.three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      column-gap: 36px;
    }
  }
  /* One post is a row, not a column: the date moves beside the title and the
     copy runs at the reading measure, so a single post reads as a feature
     rather than as a grid with two holes in it. */
  @media (min-width: 820px) {
    .feed.one .item {
      grid-template-columns: auto 1fr;
      gap: 14px 40px;
    }
    .feed.one .date {
      /* Beside the title now, so the alignment rule has real work to do; a
         fixed fraction of the heading token keeps the ratio true across the
         whole clamp. See `.mark-row` in app.css. */
      --mark-ratio: 1.6;
    }
    .feed.one .excerpt {
      font-size: 18px;
    }
  }
  .date {
    margin: 0;
    /* Stacked above the title by default, where there is no shared baseline
       to correct for, so the marker shift resolves to zero. */
    --mark-ratio: 1;
    font-size: calc(var(--text-h3) / 1.6);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-gold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .item h3 a {
    color: inherit;
    text-decoration: none;
  }
  .item h3 a:hover {
    color: var(--color-teal);
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .excerpt {
    margin: 10px 0 0;
    max-width: 66ch;
    color: var(--color-muted);
    font-size: 16.5px;
  }
  .more {
    margin: 26px 0 0;
    font-size: 16px;
  }
  .more a {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--color-teal);
    font-weight: 600;
    text-decoration: none;
  }
  .more a:hover {
    color: var(--color-deep);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  /* The arrow leads, and it is the only thing that moves, as in the contact
     rows. */
  .more a :global(svg) {
    transition: transform var(--dur-base) var(--ease-brand);
  }
  .more a:hover :global(svg) {
    transform: translateX(4px);
  }
</style>
