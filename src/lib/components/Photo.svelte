<!--
  A photograph, served responsively.

  `scripts/gen-photos.ts` writes AVIF and WebP variants plus a JPEG fallback
  for everything in `static/img/photos/` and records them in
  `photo-manifest.json`. A photo with no manifest entry falls back to a plain
  <img> of the original, so a picture dropped in through the CMS renders
  immediately and only gains its srcsets on the next build.
-->
<script lang="ts">
  import manifest from '$lib/photo-manifest.json';

  interface Variant {
    type: string;
    srcset: string;
  }
  interface Entry {
    fallback: string;
    width: number;
    height: number;
    variants: Variant[];
  }

  interface Props {
    src: string;
    alt: string;
    sizes?: string;
    class?: string;
    loading?: 'lazy' | 'eager';
    fetchpriority?: 'high' | 'low' | 'auto';
  }

  let {
    src,
    alt,
    sizes = '100vw',
    class: klass = '',
    loading = 'lazy',
    fetchpriority = 'auto'
  }: Props = $props();

  const entry = $derived((manifest as Record<string, Entry>)[src]);
</script>

{#if entry}
  <picture>
    {#each entry.variants as variant (variant.type)}
      <source type={variant.type} srcset={variant.srcset} {sizes} />
    {/each}
    <img
      src={entry.fallback}
      {alt}
      width={entry.width}
      height={entry.height}
      class={klass}
      {loading}
      {fetchpriority}
      decoding="async"
    />
  </picture>
{:else}
  <img {src} {alt} class={klass} {loading} {fetchpriority} decoding="async" />
{/if}
