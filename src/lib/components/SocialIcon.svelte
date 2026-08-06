<!--
  Monochrome social glyph, keyed by a lowercase platform id, drawn in
  `currentColor` so it takes the colour of the link it sits in.

  Paths come from `src/lib/generated/social-icons.ts`, written out of the
  Simple Icons (CC0) and Bootstrap Icons (MIT) packages by
  scripts/gen-social-icons.ts. They are not transcribed by hand: a dropped
  decimal in a brand mark is not something anyone would catch by looking.

  THE VIEWBOX TRAVELS WITH THE PATH. The two sets draw on different grids —
  Simple Icons on 24, Bootstrap on 16 — so assuming 24 here would render a
  borrowed mark at two-thirds scale in the corner of its box. Every glyph
  carries the grid it was drawn on, and the width and height are fixed, so
  both fill the same optical square.

  AND SO DOES ITS WEIGHT. Filling the same square is not the same as reading
  the same. LinkedIn's mark is a filled rounded square where Facebook's is a
  filled disc, and a square holds 4/π the area of the circle inside it, so at
  20px it read as a black chip between two lighter marks. The generator
  measures what each mark actually inks and hands over a `scale`; see
  scripts/gen-social-icons.ts for why it only ever scales marks DOWN.

  IT NEVER RENDERS NOTHING. The old version drew a glyph or an empty element,
  on the reasoning that a missing mark beside a working link is a smaller
  failure than a wrong one — which was true right up until a platform with no
  mark was added, and then the link had no visible content at all. The name
  fallback below is what catches that. It is no longer LinkedIn's case — the
  second icon set covers that one — but it stays, because the next platform
  neither set carries will arrive without warning.
-->
<script lang="ts">
  import { SOCIAL_BY_ID } from '$lib/generated/social-icons';

  interface Props {
    platform: string;
    class?: string;
  }
  let { platform, class: klass = '' }: Props = $props();

  const known = $derived(SOCIAL_BY_ID[platform]);
  const path = $derived(known?.path ?? null);
  const viewBox = $derived(known?.viewBox ?? '0 0 24 24');

  // The optical correction, measured in the generator from how much of its box
  // each mark inks. Applied INSIDE the svg, around the viewBox's own centre,
  // so the element stays exactly 20 by 20 and the row's spacing does not shift
  // when a mark is scaled — only the drawing inside it does.
  const scale = $derived(known?.scale ?? 1);
  const transform = $derived.by(() => {
    if (scale === 1) return undefined;
    const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
    const cx = x + w / 2;
    const cy = y + h / 2;
    return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
  });
  // An id nobody declared is still shown, spelled as it was written. It means
  // the content and this file have got out of step, and a visible oddity gets
  // fixed where an invisible one does not.
  const text = $derived(known?.title ?? platform);
</script>

{#if path}
  <svg
    class={klass}
    {viewBox}
    width="20"
    height="20"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <g {transform}><path d={path} /></g>
  </svg>
{:else}
  <span class="wordmark {klass}" aria-hidden="true">{text}</span>
{/if}

<style>
  /* Sized to sit on the same line as the 20px glyphs beside it rather than to
     be read on its own. */
  .wordmark {
    display: inline-block;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 20px;
    white-space: nowrap;
  }
</style>
