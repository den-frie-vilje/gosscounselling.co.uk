<!--
  Where you are, and the way back up.

  A post is often the entry point to this site — someone arrives on it from a
  search result having never seen the home page — so the first thing the page
  owes them is orientation: what is this, and what is it part of. That is a
  breadcrumb's whole job, and it is why this sits ABOVE the title rather than
  below the content. The "older / newer" links at the foot of a post answer a
  different question, asked at a different moment.

  A real <nav> with a name and an ordered list, which is what assistive tech
  expects to find and what lets it be skipped. The last crumb is the current
  page: it is `aria-current="page"` and it is NOT a link, because a link to
  where you already are is a thing to explain rather than a thing to use.

  The separator is a pseudo-element, so it is decoration the screen reader
  never reads: "Home slash Blog slash" is not how anyone would say it.

  THE LAST CRUMB IS NOT PRINTED. The trail reads "Home / Blog /" and stops,
  because the thing it would say next is the <h1> immediately below it, set
  three times the size. Printing it twice in two lines is the kind of
  repetition you stop seeing after a week and a reader never stops seeing.

  It is still IN the trail: `.vh` hides it from the eye and from nothing else,
  so a screen reader hears the whole path and so does the BreadcrumbList,
  which has no heading below it to finish the sentence. Same array, same items,
  one of them simply not drawn — the data does not fork, the rendering does.
-->
<script lang="ts">
  export interface Crumb {
    label: string;
    /** Absent on the last one, which is the page you are on. */
    href?: string;
  }

  interface Props {
    trail: Crumb[];
    class?: string;
  }
  let { trail, class: klass = '' }: Props = $props();
</script>

{#if trail.length > 1}
  <nav class="crumbs {klass}" aria-label="Breadcrumb">
    <ol>
      {#each trail as crumb, i (crumb.label + i)}
        <li>
          {#if crumb.href && i < trail.length - 1}
            <a href={crumb.href}>{crumb.label}</a>
          {:else}
            <span class="vh" aria-current="page">{crumb.label}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  .crumbs {
    margin-bottom: 18px;
  }
  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-sans);
    font-size: 13.5px;
    color: var(--color-crumb);
  }
  /* The separator belongs to the item that FOLLOWS it, so a trail never ends
     with one and a wrapped line never starts with an orphaned slash. */
  li + li::before {
    content: '/';
    margin-right: 8px;
    color: var(--color-line);
  }
  a {
    color: var(--color-crumb);
    text-decoration: none;
  }
  a:hover {
    color: var(--color-teal);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  /* The trailing separator is what is left of the last crumb, and it is the
     point: the path ends open, and the title underneath completes it. The
     rule below keeps the item from adding width once its label is hidden, so
     the slash sits where a slash should and not a space away from it. */
  li:last-child {
    display: inline;
  }
</style>
