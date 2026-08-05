// Every route is prerendered to static HTML by default. Individual routes
// can still narrow this (the CMS host and the publish page opt out).
export const prerender = true;

// Every page prerenders to `<path>/index.html` rather than `<path>.html`, so
// the build is a plain directory tree any static host can serve without a
// rewrite rule. The site is going to a third-party static host as well as the
// nginx image, and a URL that only resolves because of nginx's `try_files` is
// a URL that is broken there.
export const trailingSlash = 'always';
