/**
 * The clock the listings read, and the reason it starts where it does.
 *
 * A post can be published with a date in the future. It is in the build from
 * the day it is written, and the listings have to start showing it the moment
 * its time passes, without a deploy.
 *
 * So the clock starts at the BUILD time and moves to the real one on mount.
 * That ordering matters twice over:
 *
 *   The server and the browser's first render agree, because both use
 *   `BUILD_TIME`. Reading `Date.now()` during initialisation instead would
 *   make the client's first pass disagree with the HTML it is hydrating.
 *
 *   The set of visible posts can only ever GROW, because the real time is
 *   never earlier than the build. A reader sees a post appear, and never sees
 *   one appear and then vanish. If that means the index is briefly emptier
 *   than it is about to be, that is the right way round.
 */
import { onMount } from 'svelte';
import { BUILD_TIME } from '$lib/content';

export interface PublishClock {
  readonly value: number;
}

/** Call during component initialisation, like any other rune-based helper. */
export function publishClock(): PublishClock {
  let now = $state(BUILD_TIME);

  onMount(() => {
    now = Date.now();
  });

  return {
    get value() {
      return now;
    }
  };
}
