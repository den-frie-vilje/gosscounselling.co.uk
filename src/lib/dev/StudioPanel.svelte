<!--
  A small overlay for choosing between things that are easier to judge than to
  describe. DEV ONLY: it is mounted behind `import.meta.env.DEV`, so it is
  not in the built site at all, and there is no flag or query string that
  brings it back.

  It changes nothing in the repo. Every choice is written to the root element
  and remembered in localStorage, so a decision survives a reload and can be
  compared against the others in the same sitting. When one is settled it gets
  baked into `src/app.css` and this panel loses that section.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  interface Accent {
    id: string;
    name: string;
    /** Wide gamut. What a P3 display renders. */
    oklch: string;
    /** What sRGB falls back to. */
    hex: string;
    /** The darker sibling for light grounds, and its sRGB fallback. */
    inkOklch: string;
    inkHex: string;
    /** Computed WCAG ratio against the deep ground. */
    onDeep: string;
    note: string;
  }

  // Ratios computed rather than guessed; see scripts/check-contrast.ts for the
  // same arithmetic. The accent marks structure, never text on a light ground,
  // so the deep ground is the pairing that has to hold.
  const ACCENTS: Accent[] = [
    {
      id: 'acid-lime',
      inkOklch: 'oklch(0.55 0.14 100)',
      inkHex: '#857100',
      name: 'Acid lime',
      oklch: 'oklch(0.92 0.22 122)',
      hex: '#cdfa16',
      onDeep: '12.67:1',
      note: 'Greener and brighter than the pick.'
    },
    {
      id: 'lime-straw',
      inkOklch: 'oklch(0.54 0.14 98)',
      inkHex: '#826e00',
      name: 'Lime straw',
      oklch: 'oklch(0.91 0.2 110)',
      hex: '#ebeb00',
      onDeep: '12.03:1',
      note: 'The pick. Warm enough to sit with the sand and the gold.'
    },
    {
      id: 'lime-sand',
      inkOklch: 'oklch(0.53 0.13 96)',
      inkHex: '#7e6b05',
      name: 'Lime sand',
      oklch: 'oklch(0.9 0.17 102)',
      hex: '#f5e141',
      onDeep: '11.53:1',
      note: 'Sandier again, and the chroma starts coming down with it.'
    },
    {
      id: 'sand-lime',
      inkOklch: 'oklch(0.52 0.12 94)',
      inkHex: '#7a670f',
      name: 'Sand lime',
      oklch: 'oklch(0.88 0.14 96)',
      hex: '#f3d761',
      onDeep: '10.78:1',
      note: 'Closest to the sand ground. Warm, and no longer acid.'
    },
    {
      id: 'dry-sand',
      inkOklch: 'oklch(0.51 0.1 90)',
      inkHex: '#75641d',
      name: 'Dry sand',
      oklch: 'oklch(0.86 0.11 92)',
      hex: '#ebcf7a',
      onDeep: '10.07:1',
      note: 'The sandiest that still registers as an accent at all.'
    },
    {
      id: 'neon-green',
      inkOklch: 'oklch(0.52 0.15 145)',
      inkHex: '#0f7527',
      name: 'Neon green',
      oklch: 'oklch(0.87 0.25 143)',
      hex: '#53fb53',
      onDeep: '11.21:1',
      note: 'The green end, kept for comparison.'
    }
  ];

  // The circular plate behind John at 880px and up. His near-black shirt
  // separates from the current teal at only 1.82:1, which is why the
  // silhouette bleeds into its own ground; a light plate takes that to 7:1 or
  // better. Measured against the band and against the shirt.
  const PLATES = [
    { id: 'teal', name: 'Teal', css: '#164b5d', note: 'As it is. Shirt separates at 1.82:1.' },
    { id: 'olive', name: 'Olive', css: '#615a0f', note: 'The accent taken right down. 2.47:1.' },
    { id: 'drysand', name: 'Dry sand', css: '#b6a461', note: 'Light plate, plain matte. 7.03:1.' },
    { id: 'sand', name: 'Sand', css: '#dfca7d', note: 'Lighter still. 10.69:1, and the boldest.' }
  ];

  const HEROES = [
    { id: 'stagger', name: 'Stagger', note: 'Each part in turn, reading order, John last.' },
    { id: 'block', name: 'One block', note: 'The column as one thing; he follows a beat behind.' },
    { id: 'uncover', name: 'Uncover', note: 'Nothing moves; the band uncovers in place.' },
    { id: 'none', name: 'None', note: 'Only the two pools behind him drift.' }
  ];

  let accent = $state('lime-straw');
  let hero = $state('stagger');
  let open = $state(true);
  let plate = $state('teal');
  let heroRun = $state(0);

  function applyPlate(id: string) {
    plate = id;
    const chosen = PLATES.find((p) => p.id === id);
    if (!chosen) return;
    document.documentElement.setAttribute('data-plate', id);
    document.documentElement.style.setProperty('--plate', chosen.css);
    localStorage.setItem('studio.plate', id);
  }

  function applyAccent(id: string) {
    accent = id;
    const chosen = ACCENTS.find((a) => a.id === id);
    if (!chosen) return;
    const root = document.documentElement;
    // Set the wide-gamut value where the display can show it, and the sRGB
    // hex where it cannot, so the panel previews what each screen would get.
    const supportsP3 = window.matchMedia('(color-gamut: p3)').matches;
    root.style.setProperty('--color-accent', supportsP3 ? chosen.oklch : chosen.hex);
    // The pair moves together: the bright value only draws on the dark bands,
    // the ink value only on the light ones, and swapping one without the other
    // makes half the rules on the page vanish.
    root.style.setProperty('--color-accent-ink', supportsP3 ? chosen.inkOklch : chosen.inkHex);
    localStorage.setItem('studio.accent', id);
  }

  function applyHero(id: string) {
    hero = id;
    document.documentElement.setAttribute('data-hero', id);
    localStorage.setItem('studio.hero', id);
    // Re-run it, so a treatment can be compared without a reload: the keyed
    // block below is torn down and rebuilt, which restarts its animations.
    heroRun += 1;
  }

  // `onMount`, not `$effect`: restoring the last choice is a one-time side
  // effect on load, not a reactive derivation, and these setters assign state
  // of their own, which inside an effect is the loop-shaped mistake.
  onMount(() => {
    const savedAccent = localStorage.getItem('studio.accent');
    const savedHero = localStorage.getItem('studio.hero');
    applyPlate(localStorage.getItem('studio.plate') ?? 'teal');
    if (savedAccent) applyAccent(savedAccent);
    if (savedHero) applyHero(savedHero);
    else document.documentElement.setAttribute('data-hero', 'stagger');
  });
</script>

{#key heroRun}
  <span class="hidden"></span>
{/key}

<aside class="studio" class:closed={!open}>
  <button type="button" class="tab" onclick={() => (open = !open)}>
    {open ? '×' : 'Studio'}
  </button>

  {#if open}
    <div class="body">
      <p class="head">Second accent</p>
      <ul>
        {#each ACCENTS as a (a.id)}
          <li>
            <button type="button" class:on={accent === a.id} onclick={() => applyAccent(a.id)}>
              <span class="sw" style="background: {a.oklch}"></span>
              <span class="sw sw-ink" style="background: {a.inkOklch}"></span>
              <span class="txt">
                <span class="nm">{a.name}</span>
                <span class="nt">{a.note}</span>
                <span class="nt">{a.hex} on dark · {a.inkHex} on light · {a.onDeep}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>

      <p class="head">Portrait plate</p>
      <ul>
        {#each PLATES as p (p.id)}
          <li>
            <button type="button" class:on={plate === p.id} onclick={() => applyPlate(p.id)}>
              <span class="sw" style="background: {p.css}"></span>
              <span class="txt">
                <span class="nm">{p.name}</span>
                <span class="nt">{p.note}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>

      <p class="head">Hero entrance</p>
      <ul>
        {#each HEROES as h (h.id)}
          <li>
            <button type="button" class:on={hero === h.id} onclick={() => applyHero(h.id)}>
              <span class="txt">
                <span class="nm">{h.name}</span>
                <span class="nt">{h.note}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
      <p class="foot">
        Dev only. Choices are remembered here, not committed. Reload to replay the entrance.
      </p>
    </div>
  {/if}
</aside>

<style>
  .studio {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 90;
    width: min(320px, calc(100vw - 28px));
    font-family: var(--font-sans);
    color: #e9f2f4;
  }
  .studio.closed {
    width: auto;
  }
  .tab {
    display: block;
    margin-left: auto;
    background: #0a2833;
    color: #82c9dc;
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 999px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .body {
    margin-top: 8px;
    background: #0a2833;
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 10px;
    padding: 14px;
    max-height: min(70vh, 620px);
    overflow-y: auto;
    box-shadow: 0 14px 40px rgb(4 20 26 / 0.45);
  }
  .head {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #82c9dc;
  }
  .head:not(:first-child) {
    margin-top: 18px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  li button {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    padding: 8px;
    color: inherit;
    cursor: pointer;
  }
  li button:hover {
    background: rgb(255 255 255 / 0.06);
  }
  li button.on {
    border-color: rgb(130 201 220 / 0.6);
    background: rgb(255 255 255 / 0.09);
  }
  .sw {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.25);
  }
  .sw-ink {
    width: 14px;
    height: 26px;
    margin-left: -6px;
  }
  .txt {
    min-width: 0;
  }
  .nm {
    display: block;
    font-size: 13.5px;
    font-weight: 600;
  }
  .nt {
    display: block;
    font-size: 11.5px;
    line-height: 1.45;
    color: #a9c4cc;
  }
  .foot {
    margin: 14px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #7e9aa3;
  }
</style>
