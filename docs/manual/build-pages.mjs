#!/usr/bin/env node
// Set manual.md in the Den Frie Vilje whitepaper template.
//
//   pnpm add -D cupertino-files      # once; not needed by the site build
//   node docs/manual/build-pages.mjs
//
// Reads  template/whitepaper-template.pages  and  manual.md
// Writes Editing-your-website.pages
//
// The markdown is the source. When the text changes it changes in manual.md
// and this script is run again.
//
// Geometry is never set. The template's letterhead sits in the `Adresse`
// style at indent 0 and the body in styles indented 113.4 pt; that indent is
// the letterhead/body separation and it rides on the named styles. This
// script only fills styles the template already defines, so the separation is
// preserved by construction. Pictures are fitted to the body measure
// (399.6 pt) — the picture scales, never the margin.

import { PagesDocument, findDrawableCore, tsdSchema, RawMessage } from "cupertino-files";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template", "whitepaper-template.pages");
const SOURCE = join(HERE, "manual.md");
const OUTPUT = join(HERE, "Editing-your-website.pages");
// The site on the front page. `docs/manual/capture.sh site` makes it.
const SITE_PICTURE = join(HERE, "images", "00-homepage.png");
const CONTENTS_TITLE = "Contents";

const LETTERHEAD_DATE = "06-08-2026";
const LOGO_ID = "291868"; // the letterhead mark, sized by the template, not by us

// The title is one paragraph in the house pattern: the name in the title
// weight, a line break — not a new paragraph, so it stays one block — and the
// site in bold under it.
const TITLE_SITE = "gosscounselling.co.uk";
const LINE_BREAK = String.fromCharCode(0x2028); // the break the letterhead itself uses

// The running footer names the document: "den frie vilje - <subject>", then
// the page fields. Only the subject is replaced, so the page numbers — which
// are fields, not text — are left untouched.
const TEMPLATE_SUBJECT = "the dynamic media facility";
const FOOTER_SUBJECT = "editing your website";

// Template slots that are kept and refilled rather than rebuilt, so the head
// matter keeps its own direct styling.
const SLOT_DATE = 5;
const SLOT_TITLE = 8;
const SLOT_SUBTITLE = 10;
const SLOT_BYLINE = 11;
const SLOT_FIRST_FREE = 12;

// ---------------------------------------------------------------- inline

/** Strip inline markers, returning the plain text and the spans to format. */
function inline(md) {
  let text = "";
  const bold = [];
  const italic = [];
  let i = 0;
  while (i < md.length) {
    if (md.startsWith("**", i)) {
      const end = md.indexOf("**", i + 2);
      if (end !== -1) {
        const inner = inline(md.slice(i + 2, end));
        const base = text.length;
        bold.push([base, base + inner.text.length]);
        for (const [s, e] of inner.italic) italic.push([base + s, base + e]);
        text += inner.text;
        i = end + 2;
        continue;
      }
    }
    if (md[i] === "*" && md[i + 1] !== "*") {
      const end = md.indexOf("*", i + 1);
      if (end !== -1) {
        const inner = inline(md.slice(i + 1, end));
        const base = text.length;
        italic.push([base, base + inner.text.length]);
        text += inner.text;
        i = end + 1;
        continue;
      }
    }
    if (md[i] === "`") {
      const end = md.indexOf("`", i + 1);
      if (end !== -1) {
        text += md.slice(i + 1, end); // no code style in the template; set plain
        i = end + 1;
        continue;
      }
    }
    text += md[i];
    i += 1;
  }
  return { text, bold, italic };
}

// ---------------------------------------------------------------- block

/**
 * Parse manual.md into blocks.
 * Each block is { kind, md?, src?, alt? }, kind one of:
 * title | subtitle | byline | h2 | h3 | body | bullet | numbered | image
 */
function parse(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let para = [];
  let headMatter = 0; // 0 before H1, 1 after H1 (subtitle/byline region)

  const flush = () => {
    if (!para.length) return;
    const lines = para;
    para = [];
    if (headMatter === 1) {
      // The lines under the H1 are the subtitle and the edition line: one
      // block each, not run together into a paragraph.
      for (const line of lines) {
        if (!line.trim()) continue;
        blocks.push({ kind: blocks.some((b) => b.kind === "subtitle") ? "byline" : "subtitle", md: line.trim() });
      }
      return;
    }
    const md = lines.join(" ").trim();
    if (md) blocks.push({ kind: "body", md });
  };

  let blankBefore = true; // a blank line closes a list item or quote

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^---\s*$/.test(line)) {
      // Section break between chapters: the template's own chapter spacing
      // carries it. Nothing is drawn.
      flush();
      if (headMatter === 1) headMatter = 2;
      blankBefore = true;
      continue;
    }
    if (!line.trim()) {
      flush();
      blankBefore = true;
      continue;
    }
    const wasBlankBefore = blankBefore;
    blankBefore = false;

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (image) {
      flush();
      blocks.push({ kind: "image", alt: image[1], src: image[2] });
      continue;
    }
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      flush();
      blocks.push({ kind: "title", md: h1[1] });
      headMatter = 1;
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      flush();
      blocks.push({ kind: "h2", md: h2[1] });
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      flush();
      blocks.push({ kind: "h3", md: h3[1] });
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      // An indented run of section names. Set as the template's bullet list,
      // one name per item, so the names can be matched against the screen.
      const prev = blocks[blocks.length - 1];
      if (!wasBlankBefore && prev && prev.kind === "quote-open") prev.md += " " + quote[1];
      else {
        flush();
        blocks.push({ kind: "quote-open", md: quote[1] });
      }
      continue;
    }
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      flush();
      // The number is kept as text. Pages' numbered lists run on from the
      // previous list in the document — chapter 4 would start at 9 — and
      // nothing here can restart one, so the source's own numbering is used.
      blocks.push({ kind: "numbered", md: numbered[2], number: numbered[1] });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flush();
      blocks.push({ kind: "bullet", md: bullet[1] });
      continue;
    }
    // A wrapped continuation line of the list item or quote just above.
    // A blank line ends that item, so only an unbroken run continues it.
    const prev = blocks[blocks.length - 1];
    if (!wasBlankBefore && !para.length && prev && (prev.kind === "numbered" || prev.kind === "bullet" || prev.kind === "quote-open")) {
      prev.md += " " + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flush();

  // Expand the collected quote runs into bullet items, splitting on the
  // separator the source uses.
  return blocks.flatMap((b) =>
    b.kind === "quote-open"
      ? b.md.split("·").map((name) => ({ kind: "bullet", md: name.trim() })).filter((x) => x.md)
      : [b],
  );
}

// ---------------------------------------------------------------- build

const doc = PagesDocument.load(new Uint8Array(readFileSync(TEMPLATE)));
const blocks = parse(readFileSync(SOURCE, "utf-8"));

// The body column, measured off the template rather than assumed. `leftIndent`
// is measured from the left page margin, not the page edge — so the column is
// the page less both margins less that indent. Pictures are fitted to it, so
// they line up with the text on both sides.
const page = doc.pageSetup();
const bodyIndent = doc.bodyOrUndefined.sheet().style("Normal")?.resolved?.()?.paragraph?.leftIndent ?? 0;
const BODY_LEFT = page.leftMargin + bodyIndent;   // page coordinate of the text's left edge
const BODY_MEASURE = page.pageWidth - BODY_LEFT - page.rightMargin; // the text column

const titleBlock = blocks.find((b) => b.kind === "title");
const subtitleBlock = blocks.find((b) => b.kind === "subtitle");
const bylineBlock = blocks.find((b) => b.kind === "byline");
const rest = blocks.filter((b) => !["title", "subtitle", "byline"].includes(b.kind));

// 1. Head matter: refill the template's own slots, keeping their styling.
doc.paragraph(SLOT_DATE).text = LETTERHEAD_DATE;
doc.paragraph(SLOT_SUBTITLE).text = inline(subtitleBlock.md).text;
doc.paragraph(SLOT_BYLINE).text = inline(bylineBlock.md).text;

// The title: the name, a line break, the site in bold — one paragraph, so it
// stays a single block in the title's own weight and size.
{
  const name = inline(titleBlock.md).text;
  doc.paragraph(SLOT_TITLE).text = name + LINE_BREAK + TITLE_SITE;
  const start = doc.paragraphs()[SLOT_TITLE].start + name.length + LINE_BREAK.length;
  doc.range(start, start + TITLE_SITE.length).format({ bold: true });
}

// 2. Clear the template's sample body, keeping everything above it. Its own
// pictures are detached first: deleting the text takes their anchor away but
// leaves the image and its data behind, unreferenced and invisible, inside a
// document that goes to a client. The logo, anchored up in the letterhead, is
// above the cut and stays.
{
  const body = doc.bodyOrUndefined;
  const from = doc.paragraphs()[SLOT_FIRST_FREE].start;
  for (const attachment of body.attachments()) {
    if (attachment.index >= from) body.removeAttachment(attachment.objectId);
  }
  const paras = doc.paragraphs();
  doc.range(paras[SLOT_FIRST_FREE].start, paras[paras.length - 1].end).delete();
}

// 3. Headings keep the paragraph they introduce, set on the named styles
// rather than per paragraph: `format()` on a paragraph parents it on an
// anonymous style, which still looks right but is no longer *called*
// `Heading 1` — and a table of contents collects by style name. Setters merge,
// so the indents and everything else the template defines are untouched.
const sheet = doc.bodyOrUndefined.sheet();
for (const name of ["Heading 1", "Heading 2"]) sheet.style(name)?.setParagraph({ keepWithNext: true });

// A page-opening variant, so the paragraphs that start a page keep a named
// style too rather than becoming anonymous.
const OPENER = "Heading 1 opener";
doc.createParagraphStyle({
  name: OPENER,
  copyOf: "Heading 1",
  paragraph: { keepWithNext: true, pageBreakBefore: true },
});

// 4. The front page: the site under the title, then the contents on its own
// page. `SITE_PICTURE` is optional — run `capture.sh site` to make it.
const frontPictures = [];
if (existsSync(SITE_PICTURE)) {
  doc.paragraph(doc.appendParagraph("", "Normal")).setListStyle("None");
  doc.paragraph(doc.appendParagraph("", "Normal")).setListStyle("None");
  const index = doc.appendParagraph("", "Normal");
  doc.paragraph(index).setListStyle("None");
  frontPictures.push({ index, src: "images/00-homepage.png" });
}

const contentsHeading = doc.appendParagraph(CONTENTS_TITLE, OPENER);
doc.paragraph(contentsHeading).setListStyle("None");
for (const chapter of blocks.filter((b) => b.kind === "h2")) {
  const line = doc.appendParagraph(inline(chapter.md).text, "Normal");
  doc.paragraph(line).setListStyle("None");
}

// 4. Append the manual, recording the spans to format and where pictures go.
// Chapters take Heading 1 — 14 pt GalaxiePolaris with space above it, the
// template's real section heading. Their sub-headings take Heading 2 under it.
const STYLE = { h2: "Heading 1", h3: "Heading 2", body: "Normal", bullet: "Normal", numbered: "Normal" };
const LIST = { bullet: "Bullet" }; // ordered lists carry their own numbers as text
const formatting = [];
const pictures = [...frontPictures];
const firstChapter = rest.find((b) => b.kind === "h2");

for (const block of rest) {
  if (block.kind === "image") {
    // An empty line above and below, which is all the spacing a picture needs.
    doc.paragraph(doc.appendParagraph("", "Normal")).setListStyle("None");
    const index = doc.appendParagraph("", "Normal");
    doc.paragraph(index).setListStyle("None");
    doc.paragraph(doc.appendParagraph("", "Normal")).setListStyle("None");
    pictures.push({ index, src: block.src, alt: block.alt });
    continue;
  }
  const { text, bold, italic } = inline(block.md);
  // The first chapter opens the page after the contents.
  const style = block === firstChapter ? OPENER : STYLE[block.kind];
  const prefix = block.number ? block.number + ".  " : "";
  const index = doc.appendParagraph(prefix + text, style);
  // An appended paragraph inherits list membership from the one above, so
  // every paragraph states its own — otherwise the first list turns the rest
  // of the document, headings included, into list items.
  doc.paragraph(index).setListStyle(LIST[block.kind] ?? "None");
  const shift = prefix.length;
  for (const [s, e] of bold) formatting.push({ index, s: s + shift, e: e + shift, format: { bold: true } });
  for (const [s, e] of italic) formatting.push({ index, s: s + shift, e: e + shift, format: { italic: true } });
}

// 4. Character formatting. No text length changes, so offsets stay valid.
for (const { index, s, e, format } of formatting) {
  const start = doc.paragraphs()[index].start;
  doc.range(start + s, start + e).format(format);
}

// A picture arrives with `exterior_text_wrap` set to 4 — a floating wrap — so
// Pages draws it from the page margin rather than the text column, and lets
// the next paragraph run up its side. Apple writes 0 there for a picture that
// sits in the text. That one field is the whole difference; geometry and its
// flags are recomputed by layout and do not move it.
const { Drawable } = tsdSchema;
function setInline(imageId) {
  const object = doc.store.resolve(imageId);
  const core = object && findDrawableCore(object.message);
  if (!core) return false;
  // A freshly inserted picture carries no wrap archive at all, and Pages
  // supplies its own default — a floating wrap — the first time it saves the
  // document. Writing the archive here, with the shape Apple writes and 0
  // where it puts 4, is what keeps the picture in the text.
  let wrap = core.getMessage(Drawable.EXTERIOR_TEXT_WRAP);
  if (!wrap) wrap = RawMessage.create();
  wrap.setVarint(1, 0); // 0 sits in the text; 4 floats beside it
  wrap.setVarint(2, 2);
  wrap.setVarint(3, 1);
  wrap.setFloat(4, 0);
  wrap.setFloat(5, 0.5);
  wrap.setVarint(6, 0);
  core.setMessage(Drawable.EXTERIOR_TEXT_WRAP, wrap);
  object.message.markDirty();
  return true;
}

// 5. Pictures last, back to front: each insert shifts only what follows it.
for (const picture of [...pictures].reverse()) {
  const bytes = new Uint8Array(readFileSync(join(HERE, picture.src)));
  const { imageId } = doc.insertInlineImage(doc.paragraphs()[picture.index].start, bytes, {
    fileName: picture.src.split("/").pop(),
    maxWidth: BODY_MEASURE,
  });
  setInline(imageId);
}

// 6. The appends leave a trailing newline, and Pages draws the empty
// paragraph after it — inheriting the last bullet, so the manual would end on
// a bullet with nothing beside it.
{
  const body = doc.bodyOrUndefined;
  if (body.text.endsWith("\n")) body.deleteRange(body.text.length - 1, body.text.length);
}

// 7. The running footer still names the template's own whitepaper.
let footersRenamed = 0;
for (const section of doc.sections()) {
  for (const template of section.templates()) {
    for (const storage of [...template.headers, ...template.footers]) {
      if (storage && storage.text.includes(TEMPLATE_SUBJECT)) {
        storage.replaceAll(TEMPLATE_SUBJECT, FOOTER_SUBJECT);
        footersRenamed += 1;
      }
    }
  }
}

writeFileSync(OUTPUT, doc.save());

// ---------------------------------------------------------------- verify

const check = PagesDocument.load(new Uint8Array(readFileSync(OUTPUT)));
const before = PagesDocument.load(new Uint8Array(readFileSync(TEMPLATE)));
const geometryKept = JSON.stringify(check.pageSetup()) === JSON.stringify(before.pageSetup());
const indentKept = ["Normal", "Heading 2", "Title", "Adresse"].every((name) => {
  const a = before.bodyOrUndefined.sheet().style(name)?.resolved?.()?.paragraph?.leftIndent;
  const b = check.bodyOrUndefined.sheet().style(name)?.resolved?.()?.paragraph?.leftIndent;
  return a === b;
});
const text = check.bodyOrUndefined.text;
const paras = check.paragraphs();

// A heading or plain paragraph carrying list membership renders as a stray
// numbered or bulleted item. Count both the total and the headings caught up
// in one: the totals must match what the markdown actually asked for.
const isListed = (i) => {
  const list = check.paragraph(i).listStyleName;
  return Boolean(list) && list !== "None";
};
const listedCount = paras.filter((_, i) => isListed(i)).length;
const strayLists = paras.filter((p, i) => isListed(i) && (p.styleName ?? "").startsWith("Heading")).length;

const written = paras.slice(SLOT_FIRST_FREE); // the appended manual, not the head matter
const counts = {
  paragraphs: paras.length,
  headings: written.filter((p) => p.styleName === "Heading 1" || p.styleName === OPENER).length - 1, // less the contents heading
  subheadings: written.filter((p) => p.styleName === "Heading 2").length,
  listItems: listedCount,
  pictures: (text.match(/￼/g) ?? []).length,
  markdownLeft: (text.match(/\*\*|^#{1,3} |^- |^> /gm) ?? []).length,
};
const expectedListItems = rest.filter((b) => b.kind === "bullet").length;
const expectedPictures = rest.filter((b) => b.kind === "image").length + frontPictures.length + 1; // + the logo
const expectedHeadings = rest.filter((b) => b.kind === "h2").length;
const expectedSubheadings = rest.filter((b) => b.kind === "h3").length;
const titleText = check.paragraphs()[SLOT_TITLE].text;
const titleShaped = titleText.includes(LINE_BREAK) && titleText.endsWith(TITLE_SITE);

const trailingBlank = text.endsWith("\n");

// Every picture must sit in the text, not float beside it.
const floating = check
  .drawables()
  .filter((x) => String(x.id) !== LOGO_ID)
  .filter((x) => {
    const core = findDrawableCore(check.store.resolve(x.id)?.message);
    const wrap = core?.getMessage(Drawable.EXTERIOR_TEXT_WRAP);
    return wrap ? Number(wrap.getVarint(1) ?? 0) !== 0 : true; // missing = Pages will float it
  }).length;

// A picture wider than the column overflows to the left of the text instead of
// lining up with it, so measure what was actually written.
const anchored = new Set(check.bodyOrUndefined.attachments().map((a) => String(a.drawableId)));
const bodyPictures = check.drawables().filter((d) => anchored.has(String(d.id)) && String(d.id) !== LOGO_ID);
const widest = bodyPictures.length ? Math.max(...bodyPictures.map((d) => d.geometry?.()?.width ?? 0)) : 0;
const picturesOverflow = widest > BODY_MEASURE + 0.5;
const strandedPictures = check.drawables().length - check.bodyOrUndefined.attachments().length;
const footerStale = doc
  .sections()
  .some((s) => s.templates().some((t) => [...t.headers, ...t.footers].some((x) => x && x.text.includes(TEMPLATE_SUBJECT))));

console.log("wrote", OUTPUT);
console.log("  page setup unchanged :", geometryKept);
console.log("  style indents kept   :", indentKept);
console.log("  paragraphs           :", counts.paragraphs);
console.log("  chapter headings     :", counts.headings, "expected", expectedHeadings, "| sub-headings:", counts.subheadings, "expected", expectedSubheadings);
console.log("  title shaped         :", titleShaped, JSON.stringify(titleText.replace(LINE_BREAK, " / ")));
console.log("  list items           :", counts.listItems, "expected", expectedListItems);
console.log("  headings in a list   :", strayLists);
console.log("  pictures (incl logo) :", counts.pictures, "expected", expectedPictures);
console.log("  markdown left over   :", counts.markdownLeft);
console.log("  trailing blank para  :", trailingBlank);
console.log("  footers renamed      :", footersRenamed, "| stale subject left:", footerStale);
console.log("  body column          :", BODY_MEASURE.toFixed(1), "pt | widest picture:", widest.toFixed(1), "pt");
// Detaching the template's own body picture removes its anchor, so it no
// longer draws, but the image object itself stays in the archive: there is no
// call to delete a drawable that no list owns. It is invisible and costs a few
// kilobytes, so it is reported rather than fatal.
console.log("  detached leftovers   :", strandedPictures, "(invisible)");
console.log("  pictures floating    :", floating, "(must be 0 — they belong in the text)");
console.log("  contents entries     :", expectedHeadings, "| front picture:", frontPictures.length ? "yes" : "MISSING — run capture.sh site");

const ok =
  geometryKept &&
  indentKept &&
  counts.markdownLeft === 0 &&
  strayLists === 0 &&
  counts.listItems === expectedListItems &&
  counts.pictures === expectedPictures &&
  !trailingBlank &&
  !footerStale &&
  !picturesOverflow &&
  floating === 0 &&
  titleShaped &&
  counts.headings === expectedHeadings &&
  counts.subheadings === expectedSubheadings;

if (!ok) {
  console.error("FAILED a check");
  process.exit(1);
}
