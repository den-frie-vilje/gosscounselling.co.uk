# Handover: turn the manual into a Pages document

For a session with access to Ole's Synology Drive. Everything else you need is in this folder.

---

## The job

`manual.md` in this folder is John Goss's manual for editing his own website. Set it in **Ole's
whitepaper Pages template** and commit the result here, next to its source.

Ole has the template on Synology Drive. This session could not see it — it is not in this repo,
not in `~/Library/Application Support/iWork/Templates`, not in the Pages container's template
folder, and the iWork MCP could not reach Pages on this machine. **Finding it is your first step,
and copying it into `template/` here is your second**, so the manual and the thing it is set in
travel together and the next person does not repeat this search.

---

## Everything lives in this folder

```
docs/manual/
  manual.md       the text. THE SOURCE OF TRUTH — see "do not rewrite" below
  HANDOVER.md     this file
  README.md       status, and what is still missing
  capture.sh      how the automatable screen captures are taken
  images/         the captures
  template/       Ole's whitepaper template — YOU create this and put it here
  Editing-your-website.pages   the output — commit it here
```

---

## Use cupertino-files, not the iWork MCP

`/Users/drexolek/git/github/den-frie-vilje/cupertino-files` is Ole's own library: it reads and
writes `.pages` byte-for-byte **without Pages being installed and without a Mac**. It has a skill
at `skills/cupertino-files/SKILL.md` — read that first.

The iWork MCP in this session is the wrong tool and does not work here: it drives Pages over
AppleScript and `pages_list_templates` failed outright. Do not spend time on it.

Anything you do not touch is preserved byte-for-byte, which is the whole reason to start from
Ole's template rather than building a document from nothing: his page setup, margins, headers,
footers and named styles come along without being re-specified.

---

## How the text is shaped, and why

`manual.md` was written to survive this conversion without editing:

- **One H1**, the document title.
- **An H2 per chapter**, numbered 1–8, plus an unnumbered opener and closer.
- **No H3s and no nested lists** — one level only, so it maps onto a template's named styles
  without inventing any.
- **Short paragraphs**, no long runs.
- **Bold** for the terms John has to find on screen (button names, field labels). Those are not
  decoration; keep them bold, because he reads the manual next to the editor and matches them up.
- `---` between chapters is a section break, not a rule to draw. Use the template's own chapter
  spacing.

**Do not rewrite the prose.** Ole pushed back twice today on the writing being too long and too
chatty — "it's an interface, not a conversation", "some of your labels are a whole book chapter" —
and this text is the result of that. It is deliberately plain and deliberately short. Set it; do
not improve it.

---

## The screen captures

`images/01-sign-in.png` is done. It is the editor's sign-in screen taken from **staging**, at
1100px wide and 2× scale.

**Four are missing**, and they need a signed-in editor, which `capture.sh` cannot have:

| # | What | Where |
| --- | --- | --- |
| 02 | The collection list — Home / Services / General / Blog in the sidebar, Home's eight sections listed | `/admin/` after signing in |
| 03 | An entry open for editing — "Home > How I can help" is a good one: it shows a field, its hint, and the Save button top right | click any Home entry |
| 04 | The Save button, close up, after a change has made it active | same screen |
| 05 | A picture field with its chooser | Home → Hero, "Your photograph" |

Take them at the same **1100px wide, 2× scale** so they sit together on the page. Chapter 2 is
where 01 already sits; 02–03 belong in chapter 3, 04 in chapter 4, 05 in chapter 5.

Two things `capture.sh` records at the top and are worth repeating, because both cost an hour:

1. **Capture the editor from staging, never from localhost.** On localhost Sveltia offers a "Work
   with Local Repository" button that exists nowhere else. A manual showing John a button he will
   never see is worse than no picture.
2. **Headless Chrome needs a real user-agent.** The NAS in front of staging answers Chrome's own
   headless UA with a Synology "page not found" in Danish, and you will screenshot that instead.

---

## Two things in the text that are not settled yet

Both are flagged in the manual's closing section, where John can see them, rather than hidden:

- **The live address.** The manual says "your site's address with `/admin` on the end" throughout
  rather than naming a host, because the production address is not live yet. The staging editor is
  at `https://gosscounselling-co-uk.stage.denfrievilje.dk/admin/`.
- **Whether saving publishes straight to the live site**, or whether a step sits in between. That
  is a decision for Ole and John — it is written up in
  `docs/emails/2026-08-06-site-walkthrough.md` with both shapes and a recommendation.

Leave both as they are. Do not name a production address that does not resolve.

---

## When it is done

Commit the `.pages` file and the template into this folder, and update `README.md`'s status
section to say what is done and what is not. The markdown stays the source: if the text changes
later, it changes in `manual.md` first and the Pages document is regenerated from it.
