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

  const HEROES = [
    { id: 'stagger', name: 'Stagger', note: 'Each part in turn, reading order, John last.' },
    { id: 'block', name: 'One block', note: 'The column as one thing; he follows a beat behind.' },
    { id: 'uncover', name: 'Uncover', note: 'Nothing moves; the band uncovers in place.' },
    { id: 'none', name: 'None', note: 'Only the two pools behind him drift.' }
  ];

  let hero = $state('stagger');
  // Starts closed: it is a tool, not part of the page being judged.
  let open = $state(false);
  let heroRun = $state(0);
  let lineup = $state(false);

  // Lifts the head layer above the plate at half opacity and rings the
  // circle, so the registration is visible rather than inferred.
  function toggleLineup() {
    lineup = !lineup;
    if (lineup) document.documentElement.setAttribute('data-lineup', '');
    else document.documentElement.removeAttribute('data-lineup');
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
    // The accent lived here too, until Ole settled on acid lime and it moved
    // into src/app.css. Clear the override a previous sitting may have left on
    // the root element, or the panel would go on quietly showing a colour the
    // tokens no longer have.
    localStorage.removeItem('studio.accent');
    document.documentElement.style.removeProperty('--color-accent');
    document.documentElement.style.removeProperty('--color-accent-ink');

    const savedHero = localStorage.getItem('studio.hero');
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
      <p class="head">Debug</p>
      <ul>
        <li>
          <button type="button" class:on={lineup} onclick={toggleLineup}>
            <span class="txt">
              <span class="nm">Line up the portrait</span>
              <span class="nt">
                Head layer on top at half opacity, with the plate's circle drawn over it.
              </span>
            </span>
          </button>
        </li>
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
