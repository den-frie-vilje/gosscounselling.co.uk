/**
 * Reveals the build's gate notice, but only once somebody is signed in.
 *
 * The notice itself is server-rendered by GateStatus.svelte and starts
 * `hidden`. Nothing here writes any of its content — this file decides only
 * WHEN it is shown, and it exists for one reason: the first thing John sees at
 * /admin is a sign-in screen, and a notice about his own website floating over
 * it before he has even identified himself is alarming rather than helpful.
 *
 * The signal is `sveltia-cms.user` in localStorage. Sveltia writes it when a
 * session starts and removes it on sign-out, so it means "signed in" without
 * this file knowing anything about Sveltia's markup. Reading its class names
 * instead was the alternative and it would break silently on the next version
 * bump; this key is the editor's own idea of who is here.
 *
 * A separate same-origin file rather than an inline script, because the page's
 * CSP is `script-src 'self'`. The admin route also sets `csr = false` so that
 * Sveltia has the browser to itself, which is why this is plain DOM rather
 * than anything of SvelteKit's — see src/routes/admin/+page.ts.
 *
 * No JavaScript, or a change to that key, means the notice never appears. That
 * is the safe direction: the findings are in the build log either way, and a
 * notice that fails closed is better than one that greets a stranger.
 */
(function () {
  var KEY = 'sveltia-cms.user';
  var root = document.querySelector('[data-gate-status]');
  if (!root) return;

  function signedIn() {
    try {
      return !!localStorage.getItem(KEY);
    } catch (e) {
      // Storage can be denied outright. Fail closed.
      return false;
    }
  }

  function sync() {
    if (!signedIn()) return false;
    root.hidden = false;
    return true;
  }

  if (sync()) return;

  // Signing in happens in THIS tab, and `storage` only fires in other tabs, so
  // the event alone would never arrive. Poll as well, slowly, and stop as soon
  // as it has fired once — this runs for the seconds between opening the page
  // and signing in, not for the length of the session.
  var timer = setInterval(function () {
    if (sync()) clearInterval(timer);
  }, 1000);
  window.addEventListener('storage', function () {
    if (sync()) clearInterval(timer);
  });
})();
