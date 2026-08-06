# The manual

`manual.md` is John's manual and it is the source. Everything else here serves it.

- `images/` — nine screen captures, all taken and placed.
- `capture.sh` — the public captures, and `login` to sign a throwaway Chrome profile in once.
- `capture-editor.mjs` — the signed-in captures, by driving Chrome over the DevTools protocol.
  Read the note at its top before adding one; three of its lines are there because of an hour
  already spent.
- `template/whitepaper-template.pages` — Ole's whitepaper template, copied off Synology Drive.
- `build-pages.mjs` — sets `manual.md` in that template. Run it again when the text changes.
- `Editing-your-website.pages` — the typeset manual, eight pages.
- `HANDOVER.md` — the brief this was built from.

**Status: set and ready to export, once the front-page capture is taken.**

Ten chapters, 2,079 words, nine captures. `Editing-your-website.pages` is set in the whitepaper
template: title page, contents, then the chapters. One thing is outstanding — the picture of the
site on the front page. Take it and rebuild:

```
pnpm add -D cupertino-files      # once; the site build does not need it
docs/manual/capture.sh site      # the site itself → images/00-site.png
node docs/manual/build-pages.mjs
```

`capture.sh site` photographs the public home page from staging and needs no signed-in session.
It does not touch the nine editor captures, which came from an authenticated one and are not
retaken.

The build reports `front picture: MISSING` until that capture exists, and places it under the
title once it does.

The script checks itself as it writes: page setup and style indents unchanged, no markdown left in
the text, every list item and picture accounted for, no heading swept into a list, and the footer
renamed off the template's own subject. It exits non-zero if any of that fails.

Two things to know about the layout:

- **Pictures span the full measure between the page margins**, the width the template's own body
  picture uses. An anchored picture is drawn from the page margin whatever geometry it is given, so
  a picture narrowed to the text column leaves a gap beside it that the next paragraph flows into.
  Full measure is the width at which that cannot happen.
- **`Contents` is a plain list of the chapters, not a live table of contents.** Page numbers come
  from layout, which nothing outside Pages performs. For numbers that update, delete that list and
  use Insert ▸ Table of Contents: the chapters are on the named `Heading 1` style for exactly that
  reason, and the title is on a direct style so it will not be collected.
