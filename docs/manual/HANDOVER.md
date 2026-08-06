# Handover: set the manual in Ole's whitepaper template

For a session with access to Ole's Synology Drive. Everything else is in this folder.

---

## The job

`manual.md` is John Goss's manual for editing his own website — ten chapters, 2,079 words, nine
screen captures, all finished. **Set it in Ole's whitepaper Pages template and commit the `.pages`
file here.** Ole exports the PDF himself; do not try to produce one.

The text and the pictures are done. This is a typesetting job, not a writing one.

---

## Ole's instruction, verbatim

> use the cupertino-files npm package i've made and make me export the pdf manually from your
> created pages document

> make sure not to fuckup the margins that i use for letterhead and body seperation

**That second one is the constraint that matters.** His template's margins carry a letterhead area
separated from the body. Do not set page margins, do not adjust the body inset, do not "tidy" the
first page. Fill the template's existing styles and leave its geometry alone. If a picture does not
fit inside the body measure, scale the picture — never the margin.

---

## Where things are

```
docs/manual/
  manual.md          THE SOURCE. Ten chapters, an unnumbered opener and closer
  HANDOVER.md        this file
  README.md          status
  images/            nine captures, 1100px wide at 2x — see the table below
  capture.sh         how the public captures are taken
  capture-editor.mjs how the signed-in ones are taken, over the DevTools protocol
  template/          PUT OLE'S TEMPLATE HERE, copied off Synology Drive
  Editing-your-website.pages   the output — commit it here
```

**The template lives at**
`/Users/drexolek/Library/CloudStorage/SynologyDrive-ole/Den Frie Vilje/01-selskab/`

The session that wrote this could not read it: macOS TCC blocks `~/Library/CloudStorage` without
Full Disk Access, and the block persisted with the tool sandbox disabled. If you hit the same wall,
ask Ole to copy the file into `template/` rather than fighting it — and copy it there anyway once
you can, so the manual and the thing it is set in travel together and nobody repeats the search.

---

## Use cupertino-files. Not the iWork MCP

`/Users/drexolek/git/github/den-frie-vilje/cupertino-files` is Ole's own library: it reads and
writes `.pages` byte-for-byte, **without Pages installed and without a Mac**. Read
`skills/cupertino-files/SKILL.md` first.

Everything you do not touch is preserved byte-for-byte, which is the whole reason to start from his
template rather than building a document: page setup, margins, headers, footers and named styles
come along without being re-specified. That is also what protects the letterhead margins — as long
as you fill styles rather than set geometry.

The iWork MCP is the wrong tool and does not work on this machine: it drives Pages over AppleScript
and `pages_list_templates` failed outright. Do not spend time on it.

---

## How the text is shaped, and why

`manual.md` was written to survive this conversion without editing:

- **One H1** — the document title.
- **An H2 per chapter**, numbered 1–10, plus an unnumbered "Before you start" and "Still to come".
- **H3s inside chapters 5 and 6 only**, where a chapter genuinely has subsections. Nowhere else.
- **Short paragraphs**, no long runs.
- **Bold** on the words John must find on screen — button names, field labels, menu items. Keep
  them bold: he reads this next to the editor and matches the words up. That is also why the text
  quotes the editor's own labels exactly ("Publish on", not "Publish date"; "Hero", not "the top of
  the page"). **Do not paraphrase them.**
- `---` between chapters is a section break, not a rule to draw. Use the template's chapter spacing.
- Chapters 3 and 6 each carry one indented run listing section names. Set it as a list or an
  indented paragraph, whichever the template already has.

**Do not rewrite the prose.** Ole pushed back twice on the writing being too long and too chatty —
*"it's an interface, not a conversation"*, *"some of your labels are a whole book chapter"* — and
this text is what came out of that. Its plainness is the product, not an accident. Set it; do not
improve it.

---

## The nine captures

All from **staging**, 1100px wide at 2× scale, each already placed in `manual.md` where it belongs.

| # | File | Shows | Chapter |
| --- | --- | --- | --- |
| 01 | `01-sign-in.png` | The sign-in screen, GitHub button | 2 |
| 02 | `02-collections.png` | Home / Services / General / Blog, and Home's eight sections | 3 |
| 03 | `03-entry.png` | A section open, its fields, hints and Save | 3 |
| 04 | `04-save-button.png` | The entry's top bar: where you are, and Save | 4 |
| 07 | `07-undo.png` | An edit made, Save gone live, **Revert Changes** open | 5 |
| 08 | `08-history.png` | Saved versions, who and when | 5 |
| 05 | `05-picture-field.png` | The photograph field in Home → Hero | 6 |
| 06 | `06-all-assets.png` | All Assets — three photographs of John, indistinguishable | 6 |
| 09 | `09-account-menu.png` | Sign In with Mobile, and Sign Out | 9 |

Two of them make an argument the prose only summarises, so **place them beside their paragraph and
do not shrink them past legibility**: 06 (three files named `john-about`, `john-cutout`,
`john-goss`, nothing saying which is which, a Delete button on the same bar) and 07 (the undo, in
context).

**There is deliberately no picture of the sign-in QR code.** It encodes a live session for whoever
scans it; a screenshot of one committed to a public repository is a published credential. Chapter 9
describes that step in words. **Do not add one.**

---

## Two things in the text that are not settled

Both are flagged in the manual's closing section, where John can see them:

- **The live address.** The manual says "your site's address with `/admin` on the end" rather than
  naming a host, because production is not live. Staging is
  `https://gosscounselling-co-uk.stage.denfrievilje.dk/admin/`. **Do not name a production address
  that does not resolve.**
- **Whether saving publishes straight to the live site**, or whether a step sits between. That is a
  decision for Ole and John; it is written up with both shapes and a recommendation in
  `docs/emails/2026-08-06-site-walkthrough.md`.

Leave both as they are.

---

## When it is done

1. Commit `Editing-your-website.pages` and the template into this folder.
2. Update `README.md`'s status.
3. Tell Ole it is ready to export.

The markdown stays the source. If the text changes later it changes in `manual.md` first and the
Pages document is regenerated — which is why the conversion should be a script you commit, not a
sequence of edits nobody can repeat.
