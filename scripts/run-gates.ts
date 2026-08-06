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
    tellJohn: 'One of the fields in this editor does not line up with how the site stores it.',
  },
  {
    script: 'check-nav.ts',
    owner: 'his',
    why: 'a section heading or nav label that is long, or one section too many',
    tellJohn:
      'The menu at the top of the page is getting long — either too many sections, or a section name that is longer than the bar likes. The page still works: the menu shortens itself to fit on smaller screens. Shorter section names would read better.',
  },
  {
    script: 'check-social.ts',
    owner: 'his',
    why: 'a profile on a platform we have no mark for',
    tellJohn:
      "One of your social profiles is on a service we have no logo for, so it shows as its name in the footer instead. That is fine — it is just worth knowing it will not look like the others.",
  },
  {
    script: 'check-contact.ts',
    owner: 'his',
    why: 'a phone number or address typed in a shape we did not expect',
    tellJohn:
      'Your phone number or email address is written in a way we could not turn into a working link. Worth checking, because the buttons people tap to reach you are built from it.',
  },
  {
    script: 'check-seo.ts',
    owner: 'ours',
    why: 'a social profile he added that our own notes have not verified yet',
    tellJohn:
      'One of your profile links has not been through our checks yet, so search engines are not being told about it for now. Nothing on your page is affected.',
  },
  {
    script: 'check-portrait-fit.ts',
    owner: 'his',
    why: 'a photograph whose crop puts his head somewhere new',
    tellJohn:
      'The photograph you uploaded sits differently in the circle than we expect — usually because there is more or less space above the head than in the last one. Have a look at the top of the page and see whether it looks right to you.',
  },
  {
    script: 'check-mattes.ts',
    owner: 'ours',
    why: "a photograph whose edges our keyer handles less well than his last one",
    tellJohn:
      'Our tooling is not cutting the edges of the photograph as cleanly as it should. The picture is on the page and most people will not see anything wrong; it is ours to fix, not yours.',
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
      findings: failed.map((f) => ({ owner: f.owner, message: f.tellJohn })),
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
