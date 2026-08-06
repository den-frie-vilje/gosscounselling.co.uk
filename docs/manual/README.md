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

**Status: done, ready to export.**

Ten chapters, 2,079 words, nine captures. `Editing-your-website.pages` is set in the whitepaper
template and needs only Ole's own export to PDF.

The markdown stays the source. To change the manual, edit `manual.md` and run:

```
pnpm add -D cupertino-files      # once; the site build does not need it
node docs/manual/build-pages.mjs
```

The script checks itself as it writes: page setup and style indents unchanged, no markdown left in
the text, every list item and picture accounted for, no heading swept into a list, and the footer
renamed off the template's own subject. It exits non-zero if any of that fails.

One thing to look at before sending: chapter 5 and 6 use `Heading 3`, a style the whitepaper itself
never used, and the template sets it in Palatino among Proforma body text. If it reads as foreign,
restyle `Heading 3` once in Pages — it is a named style, so every sub-heading follows.
