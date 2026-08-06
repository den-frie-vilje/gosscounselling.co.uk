<!--
  What the build found, told to John where he works.

  The site's checks run on every publish and never block it — see
  scripts/run-gates.ts for why. That leaves a hole: the finding lands in a CI
  log, and John has no reason to know CI logs exist. This closes it. The build
  compiles its own gate record into the editor page, so the next time he opens
  /admin he is told, in his words, whether the last publish went through clean.

  It renders NOTHING when there is nothing to say, which is the normal case.
  When there is, it is a bar along the bottom rather than anything modal:
  Sveltia owns this screen and a dialog over its toolbar would be us
  interrupting his work to talk about ours. He can close it; it is information,
  not a task.

  `ours` findings are shown too, greyed rather than hidden. A problem he later
  spots on his own page having never been mentioned is worse than one he was
  told about and told was not his.
-->
<script lang="ts">
  import status from '$lib/generated/gate-status.json';

  let open = $state(true);

  const findings = status.findings ?? [];
  const mine = findings.filter((f) => f.owner === 'his');
</script>

{#if findings.length && open}
  <aside class="gates" class:none-of-his={!mine.length}>
    <div class="inner">
      <p class="lede">
        {#if mine.length}
          Your last save published. {mine.length === 1
            ? 'One thing'
            : `${mine.length} things`} worth a look:
        {:else}
          Your last save published, and looks right. One note from our side:
        {/if}
      </p>
      <ul>
        {#each findings as finding}
          <li class:ours={finding.owner === 'ours'}>
            {finding.message}
            {#if finding.owner === 'ours'}<span class="tag">nothing for you to do</span>{/if}
          </li>
        {/each}
      </ul>
    </div>
    <button type="button" onclick={() => (open = false)} aria-label="Close this notice">
      &times;
    </button>
  </aside>
{/if}

<style>
  /* Fixed rather than in the flow: Sveltia renders a full-screen application
     into this page and anything of ours in the document flow would be under
     it. z-index is above Sveltia's own layers, and the bar is short enough
     that its toolbar and the editor pane stay reachable. */
  .gates {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10000;
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    background: #10343c;
    color: #eaf2f3;
    font:
      400 0.875rem/1.5 ui-sans-serif,
      system-ui,
      sans-serif;
    box-shadow: 0 -8px 24px rgb(0 0 0 / 0.28);
  }

  /* Nothing of his is wrong, so the bar reports rather than asks. */
  .gates.none-of-his {
    background: #24343a;
  }

  .inner {
    flex: 1;
    min-width: 0;
  }

  .lede {
    margin: 0 0 0.35rem;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.3rem;
  }

  li.ours {
    color: #a9c0c5;
  }

  .tag {
    margin-left: 0.4rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.72rem;
    white-space: nowrap;
  }

  button {
    flex: none;
    padding: 0.1rem 0.5rem;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 1.25rem;
    line-height: 1.2;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: rgb(255 255 255 / 0.12);
  }
</style>
