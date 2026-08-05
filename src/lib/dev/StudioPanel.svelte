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
    /** Computed WCAG ratio against the deep ground. */
    onDeep: string;
    note: string;
  }

  // Ratios computed rather than guessed; see scripts/check-contrast.ts for the
  // same arithmetic. The accent marks structure, never text on a light ground,
  // so the deep ground is the pairing that has to hold.
  const ACCENTS: Accent[] = [
    {
      id: 'neon-green',
      name: 'Neon green',
      oklch: 'oklch(0.87 0.25 143)',
      hex: '#53fb53',
      onDeep: '11.21:1',
      note: 'Adjacent to the teal, so it reads as the same family turned up.'
    },
    {
      id: 'acid-lime',
      name: 'Acid lime',
      oklch: 'oklch(0.92 0.22 122)',
      hex: '#cdfa16',
      onDeep: '12.67:1',
      note: 'Yellower and brighter. The loudest of the five.'
    },
    {
      id: 'spring-mint',
      name: 'Spring mint',
      oklch: 'oklch(0.88 0.17 165)',
      hex: '#41fabb',
      onDeep: '11.45:1',
      note: 'Closest to the existing teal. Quietest, and the easiest to lose.'
    },
    {
      id: 'magenta',
      name: 'Electric magenta',
      oklch: 'oklch(0.72 0.29 349)',
      hex: '#ff21c1',
      onDeep: '4.57:1',
      note: 'Opposite the teal on the wheel. Maximum pop, least therapy.'
    },
    {
      id: 'uv-violet',
      name: 'UV violet',
      oklch: 'oklch(0.66 0.27 296)',
      hex: '#a759ff',
      onDeep: '4.04:1',
      note: 'Warmer against the blue than the greens, and calmer than magenta.'
    }
  ];

  const HEROES = [
    { id: 'stagger', name: 'Stagger', note: 'Each part in turn, reading order, John last.' },
    { id: 'block', name: 'One block', note: 'The column as one thing; he follows a beat behind.' },
    { id: 'uncover', name: 'Uncover', note: 'Nothing moves; the band uncovers in place.' },
    { id: 'none', name: 'None', note: 'Only the two pools behind him drift.' }
  ];

  let accent = $state('neon-green');
  let hero = $state('stagger');
  let open = $state(true);
  let heroRun = $state(0);

  function applyAccent(id: string) {
    accent = id;
    const chosen = ACCENTS.find((a) => a.id === id);
    if (!chosen) return;
    const root = document.documentElement;
    // Set the wide-gamut value where the display can show it, and the sRGB
    // hex where it cannot, so the panel previews what each screen would get.
    const supportsP3 = window.matchMedia('(color-gamut: p3)').matches;
    root.style.setProperty('--color-accent', supportsP3 ? chosen.oklch : chosen.hex);
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
              <span class="txt">
                <span class="nm">{a.name}</span>
                <span class="nt">{a.note}</span>
                <span class="nt">{a.hex} · {a.onDeep} on the deep ground</span>
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
