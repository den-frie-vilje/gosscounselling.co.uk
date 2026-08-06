/**
 * The gates, who they are allowed to stop, and how John hears about it.
 *
 * A gate that judges OUR CODE may stop anything. A gate that judges JOHN'S
 * CONTENT may stop US, but it must never stop HIM. He edits in Sveltia, saves,
 * and the site rebuilds and publishes itself; if a gate of ours fails on that
 * build, his change does not go live and the explanation is in a build log
 * nobody has told him exists. A site that refuses to publish because a nav
 * label came out two characters long is a worse site than one with a long nav
 * label.
 *
 * So the same scripts run in two modes:
 *
 *   strict     `pnpm check` — us, at a keyboard, before we commit. A content
 *              gate failing here is a finding we act on before pushing.
 *
 *   advisory   `--advisory`, which the deploy image uses on EVERY environment,
 *              production included. Every gate still runs and still prints
 *              everything it found; the run just does not fail the build.
 *
 * Advisory on production too, deliberately. Strict-on-production sounds like
 * the careful choice and is the opposite: production is where a blocked
 * publish costs the most, because his edit silently does not appear and the
 * live site keeps yesterday's words. These are consistency gates, not safety
 * gates. The safety gates — `check-posts` and `check-mock`, which prove a
 * draft's text and the dev-only stand-in content did not reach the output —
 * are a different kind of thing and block everywhere, in `pnpm check:build`.
 * Shipping a draft he has not published is worse than not shipping.
 *
 * AND THE FINDING IS WRITTEN DOWN. Every run records itself to
 * `src/lib/generated/gate-status.json`, which the build compiles into the
 * editor page: John opens /admin and sees, in his own words, whether the last
 * publish went through clean — rather than the answer living in a CI log. See
 * src/lib/components/GateStatus.svelte.
 *
 * HE IS ONLY SHOWN WHAT IS HIS. The record separates `forJohn` from `forUs`,
 * and the editor page renders the first only. Showing him ours as well was
 * tried, on the reasoning that a problem he later spots having never been
 * mentioned is worse than one he was told about — and it is exactly backwards
 * on a first visit. He opened the editor for the first time and read that our
 * tooling was not cutting the edges of his photograph properly: a fault he
 * cannot see on the page, cannot act on, and did not cause, phrased as
 * something wrong with his picture. What it bought him was doubt about a
 * photograph that looks fine. Ours stay in this log and in the record, for us.
 * If one of ours ever makes the page visibly wrong, that is not a banner —
 * that is us telling him.
 *
 * `svelte-check` and `check-contrast` are NOT in this file and stay strict on
 * every path. They judge code and design tokens, neither of which John can
 * change, so they cannot fail him.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const advisory = process.argv.includes('--advisory');

/**
 * The gates that read something John can type, upload, or delete.
 *
 * `owner` decides what the editor page says. `his` means there is a thing he
 * could change and be better off for changing, so we tell him what it is.
 * `ours` means the fault is in our tooling and there is nothing for him to do
 * — we still show it, because a silent problem he later notices on the page is
 * worse than one he was told about, but we say plainly that it is ours.
 *
 * `tellJohn` is written to be read by him, once, without context. No file
 * names, no gate names, no jargon: what is not right, and what happens next.
 */
const CONTENT_GATES = [
  {
    script: 'check-cms.ts',
    owner: 'ours',
    why: 'a field he filled in that the editor config does not describe',
    tellJohn: 'A field in this editor does not line up with how the site stores it.',
  },
  {
    script: 'check-nav.ts',
    owner: 'his',
    why: 'a section heading or nav label that is long, or one section too many',
    tellJohn:
      'The top menu is getting long. It still fits itself to the screen, but shorter section names would read better.',
  },
  {
    script: 'check-social.ts',
    owner: 'his',
    why: 'a profile on a platform we have no mark for',
    tellJohn:
      "One social profile has no logo, so the footer shows its name instead.",
  },
  {
    script: 'check-contact.ts',
    owner: 'his',
    why: 'a phone number or address typed in a shape we did not expect',
    tellJohn:
      'Your number or email could not be turned into a working link. Worth checking — the Call and Email buttons are built from it.',
  },
  {
    script: 'check-seo.ts',
    owner: 'ours',
    why: 'a social profile he added that our own notes have not verified yet',
    tellJohn:
      'A profile link is not verified yet, so search engines are not told about it. Your page is unaffected.',
  },
  {
    script: 'check-portrait-fit.ts',
    owner: 'his',
    why: 'a photograph whose crop puts his head somewhere new',
    tellJohn:
      'Your photograph sits differently in the circle than expected. Worth a look at the top of the page.',
  },
  {
    script: 'check-mattes.ts',
    owner: 'ours',
    why: "a photograph whose edges our keyer handles less well than his last one",
    tellJohn:
      'The photograph’s edges are not cut as cleanly as they should be.',
  },
] as const;

const results = CONTENT_GATES.map((gate) => {
  const run = spawnSync(process.execPath, [resolve(root, 'scripts', gate.script)], {
    stdio: 'inherit',
    cwd: root,
  });
  return { ...gate, ok: run.status === 0 };
});

const failed = results.filter((r) => !r.ok);

// The record, written on every run, pass or fail. `since` is the git SHA the
// run saw, so the editor page can say WHICH publish this describes rather than
// implying it is live news. No timestamp: the build is reproducible and a
// clock in a generated file makes every build differ from the last.
const sha =
  process.env.PUBLIC_GIT_SHA ||
  spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' })
    .stdout?.trim() ||
  '';

writeFileSync(
  resolve(root, 'src/lib/generated/gate-status.json'),
  JSON.stringify(
    {
      note: 'Written by scripts/run-gates.ts on every check. Read by the editor page so John hears about a problem where he works, rather than in a build log. Committed so a dev server has something to render.',
      sha,
      checked: results.length,
      // Split at the source rather than filtered at the page, so what he is
      // shown and what is ours to fix cannot drift apart.
      forJohn: failed.filter((f) => f.owner === 'his').map((f) => f.tellJohn),
      forUs: failed.filter((f) => f.owner === 'ours').map((f) => f.tellJohn),
    },
    null,
    2
  ) + '\n'
);

if (!failed.length) {
  console.log(`\ngates: all ${CONTENT_GATES.length} content gates pass.`);
  process.exit(0);
}

if (!advisory) {
  console.error(`\ngates: ${failed.length} of ${CONTENT_GATES.length} content gates FAILED.`);
  process.exit(1);
}

console.log(
  [
    '',
    '='.repeat(78),
    `gates: ${failed.length} of ${CONTENT_GATES.length} content gates failed, and the build CONTINUES.`,
    '',
    'These gates judge content rather than code, so they report and do not block:',
    'a failed publish is worse for John than the fault the gate found.',
    'Recorded to src/lib/generated/gate-status.json and shown to him on /admin.',
    '',
    ...failed.map((f) => `  ${f.script.replace(/^check-|\.ts$/g, '')} (${f.owner}) — ${f.why}`),
    '',
    'Run `pnpm check` locally to see these fail properly.',
    '='.repeat(78),
    '',
  ].join('\n')
);
process.exit(0);
