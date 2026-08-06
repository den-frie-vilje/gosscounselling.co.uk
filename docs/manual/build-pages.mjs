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

import { PagesDocument } from "cupertino-files";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template", "whitepaper-template.pages");
const SOURCE = join(HERE, "manual.md");
const OUTPUT = join(HERE, "Editing-your-website.pages");

const BODY_MEASURE = 399.6; // pageWidth - body indent - right margin
const LETTERHEAD_DATE = "06-08-2026";

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
      blocks.push({ kind: "numbered", md: numbered[2] });
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

const titleBlock = blocks.find((b) => b.kind === "title");
const subtitleBlock = blocks.find((b) => b.kind === "subtitle");
const bylineBlock = blocks.find((b) => b.kind === "byline");
const rest = blocks.filter((b) => !["title", "subtitle", "byline"].includes(b.kind));

// 1. Head matter: refill the template's own slots, keeping their styling.
doc.paragraph(SLOT_DATE).text = LETTERHEAD_DATE;
doc.paragraph(SLOT_TITLE).text = inline(titleBlock.md).text;
doc.paragraph(SLOT_SUBTITLE).text = inline(subtitleBlock.md).text;
doc.paragraph(SLOT_BYLINE).text = inline(bylineBlock.md).text;

// 2. Clear the template's sample body, keeping everything above it.
{
  const paras = doc.paragraphs();
  doc.range(paras[SLOT_FIRST_FREE].start, paras[paras.length - 1].end).delete();
}

// 3. Append the manual, recording the spans to format and where pictures go.
const STYLE = { h2: "Heading 2", h3: "Heading 3", body: "Normal", bullet: "Normal", numbered: "Normal" };
const LIST = { bullet: "Bullet", numbered: "Numbered List" };
const formatting = [];
const pictures = [];

for (const block of rest) {
  if (block.kind === "image") {
    const index = doc.appendParagraph("", "Normal");
    doc.paragraph(index).setListStyle("None");
    pictures.push({ index, src: block.src, alt: block.alt });
    continue;
  }
  const { text, bold, italic } = inline(block.md);
  const index = doc.appendParagraph(text, STYLE[block.kind]);
  // An appended paragraph inherits list membership from the one above, so
  // every paragraph states its own — otherwise the first list turns the rest
  // of the document, headings included, into list items.
  doc.paragraph(index).setListStyle(LIST[block.kind] ?? "None");
  for (const [s, e] of bold) formatting.push({ index, s, e, format: { bold: true } });
  for (const [s, e] of italic) formatting.push({ index, s, e, format: { italic: true } });
}

// 4. Character formatting. No text length changes, so offsets stay valid.
for (const { index, s, e, format } of formatting) {
  const start = doc.paragraphs()[index].start;
  doc.range(start + s, start + e).format(format);
}

// 5. Pictures last, back to front: each insert shifts only what follows it.
for (const picture of [...pictures].reverse()) {
  const bytes = new Uint8Array(readFileSync(join(HERE, picture.src)));
  doc.insertInlineImage(doc.paragraphs()[picture.index].start, bytes, {
    fileName: picture.src.split("/").pop(),
    maxWidth: BODY_MEASURE,
  });
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

const counts = {
  paragraphs: paras.length,
  headings: paras.filter((p) => p.styleName === "Heading 2").length,
  subheadings: paras.filter((p) => p.styleName === "Heading 3").length,
  listItems: listedCount,
  pictures: (text.match(/￼/g) ?? []).length,
  markdownLeft: (text.match(/\*\*|^#{1,3} |^- |^> /gm) ?? []).length,
};
const expectedListItems = rest.filter((b) => b.kind === "bullet" || b.kind === "numbered").length;
const expectedPictures = rest.filter((b) => b.kind === "image").length + 1; // + the logo

const trailingBlank = text.endsWith("\n");
const footerStale = doc
  .sections()
  .some((s) => s.templates().some((t) => [...t.headers, ...t.footers].some((x) => x && x.text.includes(TEMPLATE_SUBJECT))));

console.log("wrote", OUTPUT);
console.log("  page setup unchanged :", geometryKept);
console.log("  style indents kept   :", indentKept);
console.log("  paragraphs           :", counts.paragraphs);
console.log("  chapter headings     :", counts.headings, "| sub-headings:", counts.subheadings);
console.log("  list items           :", counts.listItems, "expected", expectedListItems);
console.log("  headings in a list   :", strayLists);
console.log("  pictures (incl logo) :", counts.pictures, "expected", expectedPictures);
console.log("  markdown left over   :", counts.markdownLeft);
console.log("  trailing blank para  :", trailingBlank);
console.log("  footers renamed      :", footersRenamed, "| stale subject left:", footerStale);

const ok =
  geometryKept &&
  indentKept &&
  counts.markdownLeft === 0 &&
  strayLists === 0 &&
  counts.listItems === expectedListItems &&
  counts.pictures === expectedPictures &&
  !trailingBlank &&
  !footerStale;

if (!ok) {
  console.error("FAILED a check");
  process.exit(1);
}
