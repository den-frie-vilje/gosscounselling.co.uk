/**
 * Markdown → HTML for first-party, CMS-authored prose.
 *
 * Trust boundary: every string passed here originates in this repo's own
 * content JSON (edited through the GitHub-backed Sveltia admin) and is baked
 * into the static build at prerender time. `{@html}` of this output carries
 * the same trust as the rest of the source. No runtime user-generated
 * markdown flows through here, and there is no third-party feed on this site
 * that could introduce any.
 */
import { marked } from 'marked';

marked.use({
  gfm: true,
  // Clamp every heading into the [h2, h3] band so a body can never emit a
  // second page-level <h1> — the page title owns the only one.
  walkTokens(token) {
    if (token.type === 'heading') {
      token.depth = token.depth <= 2 ? 2 : 3;
    }
  },
  renderer: {
    // Off-site links open in a new tab with a safe rel; in-page and relative
    // links keep default behaviour. `tel:` and `mailto:` are the primary
    // calls to action here, so they must stay in the same tab.
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      const title = token.title ? ` title="${token.title}"` : '';
      const external = /^https?:\/\//i.test(token.href);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${token.href}"${title}${attrs}>${text}</a>`;
    }
  }
});

/**
 * Collapse a redundant leading bullet inside a list item. Sveltia's rich-text
 * editor (and the habit of starting each line with "- ") emits items like
 * `- - Six…` or `- **- Supervision**`: a list marker whose text also begins
 * with a bullet. CommonMark reads that as a NESTED list, rendering an empty
 * outer bullet with an indented child. Strip the inner marker, keeping any
 * leading emphasis, so the list renders flat. Only a marker immediately
 * following the outer one on the same line is touched; genuine nested lists,
 * indented on their own line, are left alone.
 */
function normalizeSveltiaLists(md: string): string {
  return md.replace(/^([ \t]*[-*+][ \t]+)([*_~]{0,3})[-*+][ \t]+/gm, '$1$2');
}

/**
 * Render a block-level markdown string to an HTML fragment: headings,
 * paragraphs, lists, blockquotes, links, emphasis.
 */
export function renderMarkdown(md: string): string {
  return marked.parse(normalizeSveltiaLists((md ?? '').trim()), { async: false });
}

/**
 * Render an inline markdown string (emphasis and links only, no paragraph
 * wrapper). For short strings that sit inside an existing block, such as the
 * reassurance line under the hero buttons.
 */
export function renderInline(md: string): string {
  return marked.parseInline((md ?? '').trim(), { async: false });
}

/**
 * The first paragraph of a markdown body as plain text, for a meta
 * description a page has not been given one for.
 *
 * Derived rather than written: a description is a visitor-facing string, and
 * the rule on this site is that those come from John (DECISIONS.md §19). His
 * own opening sentences are already the honest answer to "what is this page",
 * so the fallback reuses them instead of inventing a summary of them.
 */
export function firstParagraph(md: string, max = 155): string {
  const text = (md ?? '')
    .trim()
    .split(/\n\s*\n/)[0]
    // Headings, emphasis, list markers and link syntax, kept simple because
    // the input is this repo's own prose and not arbitrary markdown.
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}
