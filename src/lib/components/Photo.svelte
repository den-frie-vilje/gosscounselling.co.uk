<!--
  A photograph, at the size the browser actually needs it.

  `scripts/gen-photos.ts` has been in `prebuild` since the site was scaffolded,
  downscaling everything in `static/img/photos/` into AVIF and WebP srcsets
  with a JPEG fallback and recording them in `src/lib/photo-manifest.json`. It
  had no consumer: the component that read it was removed while John's
  photographs were still to come, and the manifest sat empty. This is that
  consumer, restored now that a photograph he can replace goes through it.

  Pass the PUBLIC path — `/img/photos/john-about.webp`, which is exactly what
  the CMS writes into the field. That string is the manifest's own key, so
  there is nothing to translate and nothing to keep in step.

  UNKNOWN PATHS STILL RENDER. A photograph uploaded a moment ago in `pnpm dev`,
  before `prebuild` has run, is not in the manifest yet; nor is anything
  outside `static/img/photos/`. Both fall back to a plain `<img>` at the path
  given, which is the original file — heavier than it needs to be, and visible,
  which is the right way round. A missing photograph must never be a blank
  space where his face was.
-->
<script lang="ts">
  import manifest from '$lib/photo-manifest.json';

  interface Props {
    /** Public path, e.g. `/img/photos/john-about.webp`. */
    src: string;
    alt: string;
    /** The `sizes` attribute. Give the CSS width the photo is drawn at, so the
     *  browser picks a width instead of assuming the full viewport. */
    sizes?: string;
    class?: string;
    loading?: 'lazy' | 'eager';
  }

  let { src, alt, sizes = '100vw', class: klass = '', loading = 'lazy' }: Props = $props();

  const entry = $derived((manifest as Record<string, PhotoEntry | undefined>)[src]);

  interface PhotoEntry {
    fallback: string;
    width: number;
    height: number;
    variants: { type: string; srcset: string }[];
  }
</script>

{#if entry}
  <picture>
    <!-- Order is the generator's: AVIF before WebP, because the browser takes
         the first source it can decode and AVIF is the smaller. -->
    {#each entry.variants as variant (variant.type)}
      <source type={variant.type} srcset={variant.srcset} {sizes} />
    {/each}
    <img
      src={entry.fallback}
      {alt}
      {loading}
      class={klass}
      width={entry.width}
      height={entry.height}
      decoding="async"
    />
  </picture>
{:else}
  <img {src} {alt} {loading} class={klass} decoding="async" />
{/if}
