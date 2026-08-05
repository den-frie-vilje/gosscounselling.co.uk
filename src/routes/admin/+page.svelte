<svelte:head>
  <title>John Goss — Admin</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta
    http-equiv="content-security-policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com; font-src 'self' data:; connect-src 'self' https://api.github.com https://github.com https://avatars.githubusercontent.com https://*.githubusercontent.com; worker-src 'self' blob:; base-uri 'self';"
  />
  <!-- Sveltia's own faces, served from here rather than from Google.
       It injects <link> tags to fonts.googleapis.com for Material Symbols —
       which IS its entire icon set — and for Merriweather Sans and Noto Sans
       Mono. The CSP below allows neither the stylesheet nor the font file, so
       every icon in the editor was missing: John opened it and found buttons
       with no symbols on them.

       Opening the CSP to Google would have fixed it in one line and undone the
       reason the bundle is vendored at all, and it would mean a request to
       Google every time he edits his own site. So the same families are served
       from /admin/fonts/ under the names Sveltia asks for, and its own links
       are left to be blocked: by the time they fail, the faces they wanted are
       already loaded. The console says so, four times, and that is the sound
       of the policy working. -->
  <link rel="stylesheet" href="/admin/fonts.css" />
  <!-- Classic, non-module script: Sveltia ships a UMD bundle. It is vendored
       into static/admin/ by scripts/copy-sveltia.ts at prebuild rather than
       loaded from a CDN, so the editor has no third-party runtime dependency
       and no floating semver tag. -->
  <script src="/admin/sveltia-cms.js"></script>
</svelte:head>
