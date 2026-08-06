# The manual

`manual.md` is the text of John's manual, and it is the source. Everything else here serves it.

- `images/` — the screen captures.
- `capture.sh` — how the ones that can be automated were taken. Read the note at the top before
  taking more; two of its lines are there because of an hour already spent.
- `template/` — Ole's whitepaper Pages template, once it is copied off Synology Drive. It lives
  here so the manual and the thing it is set in travel together.
- `HANDOVER.md` — the brief for the session that does the Pages setup.

**Status: preliminary, and two things are outstanding.**

1. **The signed-in editor screens are missing.** They need a GitHub session that `capture.sh` does
   not have, so they are taken by hand in a signed-in editor at the same 1100px width. What is
   wanted: the collection list, one entry open for editing, the Save button, and a picture field
   with its file picker.
2. **It is not yet the Pages document Ole asked for.** The intended shape is his whitepaper
   template, filled in with `cupertino-files` — which writes .pages without needing Pages
   installed. The template was not in this repo, in `~/Library/.../Templates`, or anywhere else
   searched, so the path is still to be supplied. The text is written to survive that conversion:
   one H1, H2 per chapter, short paragraphs, no nested lists.

Both are noted at the foot of the manual itself, where John can see them, rather than only here.
