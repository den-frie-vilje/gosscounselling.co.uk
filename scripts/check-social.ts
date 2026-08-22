/**
 * Gate: the editor offers only platforms the site can draw, and only writes
 * ones it has.
 *
 *     node scripts/check-social.ts
 *
 * Three lists have to agree, and none of them can see the others:
 *
 *   src/lib/cms/config.yml            what John may CHOOSE
 *   src/lib/generated/social-icons.ts  what the footer can DRAW
 *   src/content/social.json            what he has actually chosen
 *
 * The failure they guard against is quiet in both directions. A platform in
 * the dropdown with no entry in the generated table puts a link in the footer
 * whose logo does not exist — and because SocialIcon now falls back to the
 * platform's NAME rather than to nothing, that failure is no longer even
 * visible as a gap: it just reads as a word where every neighbour is a mark. A
 * platform written into the content that the dropdown does not offer is the
 * same drift from the other end, and would survive until somebody opened the
 * editor and re-saved.
 *
 * Run by `pnpm check`. Self-tested below: it proves it can see each fault
 * before it reports the absence of one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const CONFIG = 'src/lib/cms/config.yml';
const TABLE = 'src/lib/generated/social-icons.ts';
const CONTENT = 'src/content/social.json';

/** The `value:` of every option in the platform select. */
function offered(configText: string): string[] {
  const at = configText.indexOf('name: platform');
  if (at < 0) return [];
  const block = configText.slice(at, configText.indexOf('name: label', at));
  return [...block.matchAll(/value:\s*([a-z0-9_-]+)/g)].map((m) => m[1]);
}

/** Every id in the generated table, and which of them have a mark. */
function drawable(tableText: string): { ids: string[]; withMark: string[] } {
  const rows = [...tableText.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'[^}]*?path:\s*(null|")/g)];
  return {
    ids: rows.map((m) => m[1]),
    withMark: rows.filter((m) => m[2] !== 'null').map((m) => m[1])
  };
}

/** Every platform he has actually saved. */
function chosen(contentText: string): string[] {
  const json = JSON.parse(contentText) as { profiles?: { platform?: string }[] };
  return (json.profiles ?? []).map((p) => p.platform ?? '');
}

function check(configText: string, tableText: string, contentText: string) {
  const problems: string[] = [];
  const menu = offered(configText);
  const { ids, withMark } = drawable(tableText);
  const used = chosen(contentText);

  // Fails closed: reading nothing is a failure, not a pass.
  if (menu.length === 0) problems.push(`read no platform options from ${CONFIG}`);
  if (ids.length === 0) problems.push(`read no platforms from ${TABLE}`);

  for (const p of menu) {
    if (!ids.includes(p)) {
      problems.push(
        `the editor offers "${p}" and ${TABLE} has no entry for it — ` +
          'the footer would print the id where every neighbour is a logo. ' +
          'Add it to PLATFORMS in scripts/gen-social-icons.ts and re-run that script.'
      );
    }
  }
  for (const p of used) {
    if (!menu.includes(p)) {
      problems.push(
        `${CONTENT} uses "${p}" and the editor does not offer it — ` +
          'saving that entry in the CMS would silently change it.'
      );
    }
  }
  return { problems, menu, ids, withMark, used };
}

// ---- self-test ----
const configText = read(CONFIG);
const tableText = read(TABLE);
const contentText = read(CONTENT);

const faults: [string, ReturnType<typeof check>][] = [
  [
    'a platform offered with no glyph table entry',
    check(
      configText.replace('{ label: Facebook, value: facebook },', '{ label: Facebook, value: facebook },\n{ label: Orkut, value: orkut },'),
      tableText,
      contentText
    )
  ],
  [
    'a platform in the content the editor does not offer',
    check(configText, tableText, JSON.stringify({ profiles: [{ platform: 'friendster', url: 'https://example.com' }] }))
  ],
  ['nothing readable at all', check('', tableText, contentText)]
];

let ok = true;
for (const [name, result] of faults) {
  const caught = result.problems.length > 0;
  console.log(`self-test: ${name} ${caught ? 'CAUGHT' : 'MISSED'}`);
  ok &&= caught;
}
if (!ok) {
  console.error('check-social: SELF-TEST FAILED — a checker that cannot fail is not a checker.');
  process.exit(1);
}

const { problems, menu, withMark, used } = check(configText, tableText, contentText);
if (problems.length > 0) {
  for (const p of problems) console.error(`check-social: ${p}`);
  process.exit(1);
}
const wordmarks = menu.filter((p) => !withMark.includes(p));
console.log(
  `check-social: ${menu.length} platform(s) offered, all drawable; he uses ${used.length}` +
    (wordmarks.length ? `. Drawn as a name rather than a logo: ${wordmarks.join(', ')}.` : '.')
);
