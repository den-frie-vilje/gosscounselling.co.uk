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

  IT SHOWS HIM ONLY WHAT IS HIS. Findings our own tooling owns go to the build
  log, not here — see scripts/run-gates.ts. Greying them into this bar was
  tried and was worse than saying nothing: the first time John opened the
  editor he read that our tooling was not cutting the edges of his photograph
  properly, which is a fault he cannot see, cannot act on and did not cause.

  And it stays hidden until somebody is signed in, which static/admin/gate-status.js
  decides. Before that the screen is a sign-in form, and a notice about his
  website floating over it is alarming rather than useful.

  THE CLOSE IS CSS, NOT JAVASCRIPT, and it has to be. This route sets
  `csr = false` (src/routes/admin/+page.ts:8) so that Sveltia has the browser
  to itself, which means nothing here hydrates and an `onclick` is a handler
  that never runs — it shipped that way once and the × did nothing. An inline
  script is not the alternative either: the page's own CSP is `script-src
  'self'`. So the control is a checkbox, hidden but focusable, and the × is its
  label. It works before, during and after Sveltia loads, and it cannot be
  broken by anything Sveltia does to the DOM.
-->
<script lang="ts">
  import status from '$lib/generated/gate-status.json';

  // `forJohn` only. `forUs` is in the same record and is for the build log.
  const mine = status.forJohn ?? [];
</script>

{#if mine.length}
  <!-- Starts hidden, and stays hidden until static/admin/gate-status.js sees
       that somebody is signed in. The first thing at /admin is a sign-in
       screen, and a notice about his website floating over it before he has
       identified himself is alarming rather than helpful. -->
  <div data-gate-status hidden>
    <!-- The checkbox comes FIRST and is a sibling: `:checked ~ .gates` is the
         whole mechanism, and a sibling combinator only looks forwards. -->
    <input
      class="dismiss"
      type="checkbox"
      id="gate-status-dismiss"
      aria-label="Close this notice"
    />
    <aside class="gates">
      <div class="inner">
        <p class="lede">
          Your last save published. {mine.length === 1
            ? 'One thing'
            : `${mine.length} things`} worth a look:
        </p>
        <ul>
          {#each mine as finding}
            <li>{finding}</li>
          {/each}
        </ul>
      </div>
      <label class="x" for="gate-status-dismiss" aria-hidden="true">&times;</label>
    </aside>
  </div>
{/if}

<style>
  /* Hidden but focusable: `display: none` would take it out of the tab order
     and leave a keyboard user unable to dismiss anything. */
  .dismiss {
    position: fixed;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
  .dismiss:checked ~ .gates {
    display: none;
  }

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



  .x {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }
  .x:hover {
    background: rgb(255 255 255 / 0.12);
  }
  /* The focus ring belongs on the × even though the focus is on the checkbox,
     which is the one thing the hidden-control pattern has to remember to do. */
  .dismiss:focus-visible ~ .gates .x {
    background: rgb(255 255 255 / 0.12);
    outline: 2px solid #cdfa16;
    outline-offset: 2px;
  }
</style>
