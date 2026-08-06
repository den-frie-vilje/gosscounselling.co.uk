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
<svelte:head>
  <title>John Goss — Admin</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta
    http-equiv="content-security-policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.github.com https://github.com https://avatars.githubusercontent.com https://*.githubusercontent.com; worker-src 'self' blob:; base-uri 'self';"
  />
  <!-- Classic, non-module script: Sveltia ships a UMD bundle. It is vendored
       into static/admin/ by scripts/copy-sveltia.ts at prebuild rather than
       loaded from a CDN, so the editor has no third-party runtime dependency
       and no floating semver tag. -->
  <script src="/admin/sveltia-cms.js"></script>
</svelte:head>
