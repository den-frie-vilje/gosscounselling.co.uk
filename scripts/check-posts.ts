/**
 * A draft must not be in the build.
 *
 *     pkgx node scripts/check-posts.ts
 *     pkgx node scripts/check-posts.ts --self-test
 *
 * Two kinds of unpublished post, and only one of them is a leak.
 *
 * A DRAFT is private. `stripDraftPosts` in vite.config.ts empties its file on
 * the way into the bundle and `src/lib/content` drops what is left, so it has
 * no page, is in no sitemap, and its words are in no built file at all — not
 * the HTML, and not the JavaScript chunks either, which is the harder half.
 * This
 * script is the proof of that, and the proof is the point: the source of this
 * site is public, so a draft that reached the build would be published twice
 * over, and the mechanism that removes it is worth exactly as much as the
 * check that it did.
 *
 * A post PUBLISHED with a date in the future is not private, it is early. It
 * is deliberately in the build, and the listings hold it back in the browser
 * until its moment passes (DECISIONS.md §22). Finding its text here is
 * correct, so this script does not look at it at all, and the self-test
 * asserts that in both directions: a draft marker that must be caught, and a
 * scheduled marker that must not be.
 *
 * Fail-closed by construction, the same discipline as scripts/check-cms.ts.
 * A missing build, an empty build, or a build whose files could not be read
 * are failures rather than a quiet pass. And the detector is proven against a
 * canary on EVERY run, not only under `--self-test`, so "no drafts found"
 * can never mean "nothing was examined": there is always at least one post
 * examined, because this script writes one itself.
 *
 * Mock content is a different question and a different script; see
 * scripts/check-mock.ts.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** One file per post, one entry per post in the editor. The folder is read
 *  rather than a list of files being kept somewhere: a post John writes is a
 *  new file, and a check that only covered the ones somebody remembered to
 *  list would not cover the drafts that matter most. */
const POSTS_DIR = 'src/content/posts';
const BUILD = 'build';

interface Post {
  slug?: string;
  title: string;
  publishAt: string;
  status: string;
  excerpt: string;
  body: string;
}

interface Finding {
  post: string;
  file: string;
  needle: string;
}

interface Audit {
  findings: Finding[];
  /** Drafts with nothing distinctive enough to search the build for. */
  blind: Post[];
  draftsExamined: number;
  filesScanned: number;
}

/**
 * One comparable form for both sides.
 *
 * The build is HTML, so an apostrophe may have become `&#39;` and a line may
 * have been wrapped where the JSON has a space. Comparing raw strings would
 * miss both and report a clean pass on a leak, which is the failure mode this
 * whole script exists to prevent.
 */
function normalise(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Enough of a post to be unmistakable, and long enough not to match by
 *  accident: the title, the summary, each paragraph of the body, and the
 *  slug, which is what a leaked page's directory would be called. */
function needlesFor(post: Post): string[] {
  // `?? ''` on every one of them, not just the body. A post missing `title` or
  // `excerpt` used to reach `normalise(undefined)` and take the whole run down
  // with a stack trace — which is the worst possible failure for this script,
  // because a crashed gate proves nothing and reads, in CI, like a broken build
  // rather than like an unchecked draft. `checkable()` below reports the same
  // post as a problem, so nothing is quietly skipped either.
  const candidates = [post.title ?? '', post.excerpt ?? '', ...(post.body ?? '').split(/\n\s*\n/)];
  const needles = candidates.map(normalise).filter((n) => n.length >= 24);
  const slug = (post.slug ?? '').trim();
  if (slug.length >= 8) needles.push(normalise(slug));
  return [...new Set(needles)];
}

/**
 * A draft this script cannot actually check.
 *
 * If every field it would search for is missing or too short to be
 * distinctive, then finding nothing in the build says nothing at all. The rest
 * of this file is built on refusing to pass on an absence — the canaries exist
 * so that "zero drafts examined" and "zero files scanned" both FAIL — and this
 * is the same rule one level down: an unsearchable draft is not a clean draft.
 */
function unsearchable(post: Post): boolean {
  return needlesFor(post).length === 0;
}

function isDraft(post: Post): boolean {
  return post.status !== 'published';
}

function audit(posts: Post[], files: Map<string, string>): Audit {
  const findings: Finding[] = [];
  const drafts = posts.filter(isDraft);
  const blind = drafts.filter(unsearchable);
  const haystack = [...files].map(([path, text]) => [path, normalise(text)] as const);

  for (const draft of drafts) {
    for (const needle of needlesFor(draft)) {
      for (const [path, text] of haystack) {
        if (text.includes(needle)) {
          findings.push({ post: draft.title, file: path, needle });
        }
      }
    }
  }

  return { findings, blind, draftsExamined: drafts.length, filesScanned: files.size };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function report(result: Audit, label: string): boolean {
  for (const b of result.blind) {
    console.error(
      `UNSEARCHABLE  the draft "${b.title ?? b.slug ?? '(untitled)'}" has no title, summary, body or slug\n` +
        '  long enough to look for. Finding nothing in the build would prove nothing, so this is a\n' +
        '  failure rather than a pass. Give it a title, or delete it.'
    );
  }
  for (const f of result.findings) {
    console.error(`LEAKED    ${f.file}\n  carries "${f.needle.slice(0, 60)}…" from the draft "${f.post}"`);
  }
  if (result.filesScanned === 0) {
    console.error(`${label}: scanned zero built files. That is a failure, not a pass.`);
    return false;
  }
  if (result.draftsExamined === 0) {
    console.error(`${label}: examined zero posts. That is a failure, not a pass.`);
    return false;
  }
  if (result.blind.length) {
    console.error(
      `\n${label}: ${result.blind.length} draft(s) could not be searched for at all.`
    );
    return false;
  }
  if (result.findings.length) {
    console.error(
      `\n${label}: ${result.findings.length} leak(s) from ${result.draftsExamined} draft(s) across ${result.filesScanned} built file(s).`
    );
    return false;
  }
  console.log(
    `${label}: ${result.draftsExamined} draft(s) checked against ${result.filesScanned} built file(s); none of their text is in the build.`
  );
  return true;
}

// ---- the canary -----------------------------------------------------------
// Run on EVERY invocation, not only under --self-test. It proves the detector
// still detects, and it guarantees that the number of posts examined is never
// zero: a checker that reports success having looked at nothing is worse than
// no checker, because it is believed.
// Both carry an apostrophe, and both are wrapped mid-sentence when they are
// planted in the canary build, so the run also proves the normalisation: a
// leak in real output arrives HTML-escaped and line-wrapped, and a check that
// only matched raw JSON strings would report a clean pass on one.
const DRAFT_MARK = "canary draft sentence that must not survive a build, it's the leak";
const SCHEDULED_MARK = "canary scheduled sentence that must be ignored, it's due later";

function canaryPosts(): Post[] {
  return [
    {
      slug: 'canary-draft',
      title: 'Canary draft',
      publishAt: '2020-01-01T00:00:00Z',
      status: 'draft',
      excerpt: DRAFT_MARK,
      body: DRAFT_MARK
    },
    {
      slug: 'canary-scheduled',
      title: 'Canary scheduled',
      publishAt: '2999-01-01T00:00:00Z',
      status: 'published',
      excerpt: SCHEDULED_MARK,
      body: SCHEDULED_MARK
    }
  ];
}

/** The same words a page would carry: apostrophes as entities, and a line
 *  break where the JSON has a space. The words themselves are untouched. */
function asPageWouldCarryIt(text: string): string {
  return text.replace(/'/g, '&#39;').replace(' must ', ' must\n      ');
}

/** A build file that contains BOTH markers. */
function canaryBuild(): Map<string, string> {
  return new Map([
    [
      'canary/index.html',
      `<p>${asPageWouldCarryIt(DRAFT_MARK)}</p>\n<p>${asPageWouldCarryIt(SCHEDULED_MARK)}</p>`
    ]
  ]);
}

function canary(): boolean {
  let ok = true;

  const result = audit(canaryPosts(), canaryBuild());
  const caughtDraft = result.findings.some((f) => f.needle.includes('not survive a build'));
  const quietOnScheduled = !result.findings.some((f) => f.needle.includes('due later'));
  console.log(`canary: draft text in a build ${caughtDraft ? 'CAUGHT' : 'MISSED'}`);
  console.log(
    `canary: scheduled text in a build ${quietOnScheduled ? 'CORRECTLY IGNORED' : 'WRONGLY REPORTED'}`
  );
  ok &&= caughtDraft && quietOnScheduled;

  // The can't-read path. A checker that loops over what it fetched and starts
  // from an optimistic default passes when the fetch returns nothing, because
  // the loop runs zero times.
  const empty = audit(canaryPosts(), new Map());
  const failsClosed = !report(empty, 'canary(empty build)');
  console.log(`canary: empty build ${failsClosed ? 'FAILS CLOSED' : 'FAILED OPEN'}`);
  ok &&= failsClosed;

  // And a run with no posts at all must not report a pass either.
  const noPosts = audit([], canaryBuild());
  const noPostsFails = !report(noPosts, 'canary(no posts)');
  console.log(`canary: zero posts examined ${noPostsFails ? 'FAILS CLOSED' : 'FAILED OPEN'}`);
  ok &&= noPostsFails;

  return ok;
}

// ---- run ------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  process.exit(canary() ? 0 : 1);
}

if (!canary()) {
  console.error('check-posts: the checker failed its own canary. Nothing else it says is worth reading.');
  process.exit(1);
}

/* An absent folder is not a failure: it is the state this site ships in,
   before John has written anything. A folder that is there and will not parse
   IS a failure — a post that cannot be read is a post whose draft status
   cannot be known, and guessing is how a draft gets published. The canary
   below guarantees there is always at least one draft examined either way. */
let posts: Post[] = [];
if (existsSync(POSTS_DIR)) {
  const files = readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
  for (const name of files) {
    const path = join(POSTS_DIR, name);
    try {
      posts.push(JSON.parse(readFileSync(path, 'utf8')) as Post);
    } catch (error) {
      console.error(`check-posts: could not read ${path}: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}

if (!existsSync(BUILD)) {
  console.error(`check-posts: no ${BUILD}/ directory. Run the build first; a check that examined nothing is not a pass.`);
  process.exit(1);
}

const files = new Map<string, string>();
for (const path of walk(BUILD)) {
  // utf8 throughout: Node substitutes the replacement character for bytes
  // that are not valid UTF-8 rather than throwing, so a font or an image
  // costs nothing, and the text files, which are the ones that could carry a
  // leak, are read correctly.
  files.set(path, readFileSync(path, 'utf8'));
}

// The canary drafts join the real ones, so `draftsExamined` is never zero
// even with an empty posts folder, which is the state this site ships in.
// Their text is not in the real build, so a clean run stays clean.
const result = audit([...posts, ...canaryPosts()], files);
process.exit(report(result, 'check-posts') ? 0 : 1);
