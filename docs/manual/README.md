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

**Status: set and ready to export.** Regenerated 1 October 2026, the day the site went live:
chapter 2 teaches token sign-in as the live screen actually offers it, the opener and the closer
name the live address, and both public captures are from gosscounselling.co.uk. Ole exports the
PDF from the `.pages` himself.

When the text changes, rebuild:

```
pnpm install                      # cupertino-files is a devDependency
docs/manual/capture.sh public     # the sign-in screen, from the live site
docs/manual/capture.sh site       # the home page, from the live site
node docs/manual/build-pages.mjs
```

The two public captures come from the live site, which needs no signed-in session. The eight
editor captures came from an authenticated session on staging and are not retaken; the editor is
the same on both.

The script checks itself as it writes: page setup and style indents unchanged, no markdown left in
the text, every list item and picture accounted for, no heading swept into a list, and the footer
renamed off the template's own subject. It exits non-zero if any of that fails.

Two things to know about the layout:

- **Pictures sit in the text column**, the width of the words, with a blank line above and below.
  That takes one field: a picture inserted by cupertino-files carries no text-wrap archive, and
  Pages supplies a floating one the first time it saves, which is what made pictures draw from the
  page margin with text running up their side. `build-pages.mjs` writes the archive itself, with 0
  where Pages puts 4. `picture-placement-test.pages` is the document that settled it.
- **`Contents` is a plain list of the chapters, not a live table of contents.** Page numbers come
  from layout, which nothing outside Pages performs. For numbers that update, delete that list and
  use Insert ▸ Table of Contents: the chapters are on the named `Heading 1` style for exactly that
  reason, and the title is on a direct style so it will not be collected.
