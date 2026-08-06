<!--
  Sveltia CMS admin host page.

  The bundle is self-hosted at /admin/sveltia-cms.js — version-pinned in
  package.json and copied into static/admin/ by scripts/copy-sveltia.ts at
  prebuild, so the editor has no floating CDN tag to be compromised through.

  ITS FONTS ARE GOOGLE'S, and deliberately. Sveltia injects its own <link>
  tags to fonts.googleapis.com for Material Symbols — which IS its entire icon
  set — plus Merriweather Sans and Noto Sans Mono. The CSP below allows those
  two hosts and nothing else new, which is the same policy chrishemmings.co.uk
  and skovbyesexologi.com run; this file was copied from them before that line
  was there, and John opened the editor to find buttons with no symbols on
  them.

  Vendoring those faces was tried and reverted. The privacy that matters here
  is JOHN'S CLIENTS', and they never see this page: the public site serves
  every font from its own origin, sets no cookies and calls nothing
  third-party, which is why it needs no consent banner. John is one person who
  knows he is signing into GitHub to edit his own website; sparing him a
  request to Google cost 3.9 MB of icon font in the build and a font pipeline
  to maintain, and bought nothing his visitors can tell the difference about.
-->
<script lang="ts">
  // The build's own report on the last publish, in John's words. Renders
  // nothing when there is nothing to say, which is the normal case.
  import GateStatus from '$lib/components/GateStatus.svelte';
  import { site } from '$lib/content';
</script>

<svelte:head>
  <title>{site.name} — Admin</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta
    http-equiv="content-security-policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.github.com https://github.com https://avatars.githubusercontent.com https://*.githubusercontent.com; worker-src 'self' blob:; base-uri 'self';"
  />
  <!-- Editor typography. Same-origin, so `style-src 'self'` above already
       covers it. See static/admin/editor.css for what it touches and why it
       is safe for it to stop applying. -->
  <link rel="stylesheet" href="/admin/editor.css" />
  <!-- Classic, non-module script: Sveltia ships a UMD bundle. It is vendored
       into static/admin/ by scripts/copy-sveltia.ts at prebuild rather than
       loaded from a CDN, so the editor has no third-party runtime dependency
       and no floating semver tag. -->
  <script src="/admin/sveltia-cms.js"></script>
  <!-- Reveals the gate notice, and only once somebody is signed in. Its own
       same-origin file because `script-src 'self'` forbids an inline one, and
       because this route sets `csr = false` so nothing of SvelteKit's runs
       here. See static/admin/gate-status.js. -->
  <script src="/admin/gate-status.js" defer></script>
</svelte:head>

<GateStatus />
