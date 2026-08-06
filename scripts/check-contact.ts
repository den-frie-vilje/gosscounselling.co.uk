/**
 * Gate: John can be reached on what he typed, and it is typed in one place.
 *
 * Two things, because they are two halves of the same failure.
 *
 * FIRST, the number and the address have to work. The site no longer asks him
 * for `mailto:`, `tel:` and the wa.me address — it works all three out from
 * the number and the email he writes. That is a better editor, and it moves
 * the failure: a typo in one field now breaks three links at once instead of
 * one. So a malformed number fails the build here, where a person is looking
 * at the output, rather than shipping a Call button that dials nothing, or
 * worse, dials somebody else.
 *
 * SECOND, and this is the newer half, they have to be typed ONCE. Deriving
 * the hrefs stopped three copies of the number living in three CMS fields and
 * did nothing about the three that were still living inside his PROSE: the
 * hero button read "Call 07776 153 426" as literal text, the line beneath it
 * linked to a literal wa.me address, and the low-income note mailed a literal
 * address. Nothing checked those, because nothing was looking for a phone
 * number inside a sentence. Change the number and the button reads one and
 * dials another. They are now `{phone}`, `{whatsapp}` and `{mailto}`
 * ($lib/copy-tokens), and this script is what keeps them that way: it refuses
 * a placeholder that does not exist, refuses one in the three fields the
 * share-card generator reads raw, and refuses the number, the address or a
 * wa.me link written out longhand in any content file but contact.json.
 *
 * Run by `pnpm check`. Self-tested throughout: known-good and known-bad
 * numbers, including the near-misses a hand-written `tel:` used to get wrong,
 * and injected faults for each of the content rules, because a checker that
 * has never been seen to fail is not a checker.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePhone, parseEmail, telHref, whatsappHref, mailtoHref } from '../src/lib/phone.ts';
import { findTokens, TOKENS, TOKEN_NAMES } from '../src/lib/copy-tokens.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const contact = readJson('src/content/contact.json') as {
  phone: string;
  email: string;
};

// ---- self-test ----
// The cases that matter are the ones a person gets wrong by hand.
const GOOD: Array<[string, string]> = [
  ['07776 153 426', '+447776153426'],
  ['07776153426', '+447776153426'],
  ['+44 7776 153 426', '+447776153426'],
  ['+447776153426', '+447776153426'],
  ['44 7776 153426', '+447776153426'],
  ['(01908) 123456', '+441908123456'],
  ['01908 123 456', '+441908123456']
];
const BAD = [
  '', // empty
  '7776 153 426', // the leading zero dropped, and no country code
  '+1 415 555 0123', // not a UK number
  '07776 15342', // too short
  '07776 153 426 7 8', // too long
  'ring me' // not a number at all
];

for (const [input, expected] of GOOD) {
  const { e164, problem } = parsePhone(input);
  if (e164 !== expected) {
    console.error(
      `check-contact: SELF-TEST FAILED — "${input}" became ${e164 ?? `nothing (${problem})`}, expected ${expected}.`
    );
    process.exit(1);
  }
}
for (const input of BAD) {
  const { e164 } = parsePhone(input);
  if (e164 !== null) {
    console.error(`check-contact: SELF-TEST FAILED — "${input}" was accepted as ${e164}.`);
    process.exit(1);
  }
}
if (parseEmail('info@gosscounselling.co.uk').ok !== true) {
  console.error('check-contact: SELF-TEST FAILED — a valid address was refused.');
  process.exit(1);
}
for (const bad of ['', 'info at example.com', 'info@example', 'in fo@example.com']) {
  if (parseEmail(bad).ok) {
    console.error(`check-contact: SELF-TEST FAILED — "${bad}" was accepted as an address.`);
    process.exit(1);
  }
}

// ---- the copy ----
//
// Everything below works on (path, string) pairs pulled out of the content
// JSON, so the rules can be stated once and self-tested against a made-up
// object rather than against whatever happens to be in the repo today.

/**
 * The posts, one file each.
 *
 * Read from the folder rather than written down here: a post is a file John
 * makes in the editor, so a list somebody has to remember to extend is a list
 * that will be one post short exactly when it matters. An absent folder is
 * the state the site ships in and is not an error; the fail-closed check is
 * further down, on the copy actually read.
 */
/** Every JSON file in a content folder, read rather than listed — so a post or
 *  a service John adds is scanned without anyone remembering to add it here. */
function jsonFilesIn(dir: string): string[] {
  if (!existsSync(resolve(root, dir))) return [];
  return readdirSync(resolve(root, dir))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `${dir}/${name}`);
}

const CONTENT = [
  'src/content/contact.json',
  'src/content/home.json',
  'src/content/site.json',
  'src/content/social.json',
  'src/content/testimonials.json',
  ...jsonFilesIn('src/content/posts'),
  ...jsonFilesIn('src/content/services')
];

/** The number and the address are John's to write HERE and nowhere else.
 *  Bare filename, because that is how a `where` reads: `contact.json:phone`. */
const SOURCE = 'contact.json';

/**
 * The fields `scripts/gen-og.ts` reads.
 *
 * That script builds the share card in plain node, straight from the JSON,
 * before the app is compiled — so it never sees a placeholder resolved. One
 * in these fields would be painted onto a 1200×630 PNG as literal braces and
 * nobody would notice until the site was shared. gen-og cannot be taught to
 * resolve them from here, so the answer is to forbid them there.
 */
const RAW_FIELDS = new Set([
  'site.json:name',
  'home.json:hero.eyebrow',
  'home.json:og.title',
  'home.json:seo.title'
]);

interface Found {
  /** `home.json:hero.ctaPrimary` — the file and the field, as John sees it. */
  where: string;
  text: string;
}

/** Every string in a parsed content file, with the path that reaches it. */
function strings(value: unknown, file: string, path = ''): Found[] {
  if (typeof value === 'string') return [{ where: `${file}:${path}`, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => strings(item, file, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      strings(v, file, path ? `${path}.${k}` : k)
    );
  }
  return [];
}

/** Just the digits, so `07776 153 426`, `(07776) 153426` and `+44 7776 153 426`
 *  all reduce to something the same substring test can catch. */
const digitsOf = (text: string) => text.replace(/\D/g, '');

interface Rules {
  /** John's number in E.164, e.g. `+447776153426`. */
  e164: string;
  email: string;
}

/**
 * The three content rules, in one place.
 *
 * Returns a problem per offending string rather than throwing on the first,
 * because a person fixing this wants the whole list.
 */
export function checkCopy(found: Found[], rules: Rules): string[] {
  const problems: string[] = [];
  // `7776153426` — the number without country code or leading zero, which is
  // the part that survives every way of writing it down.
  const national = rules.e164.replace(/^\+\d\d/, '');

  const known = TOKEN_NAMES as string[];

  for (const { where, text } of found) {
    const [file] = where.split(':');

    for (const token of findTokens(text)) {
      if (!known.includes(token)) {
        problems.push(
          `${where} uses {${token}}, which is not one of the placeholders this site knows.\n` +
            `    Try one of: ${TOKEN_NAMES.map((t) => `{${t}}`).join(', ')}.`
        );
        continue;
      }
      if (RAW_FIELDS.has(where)) {
        problems.push(
          `${where} uses {${token}}, and this field is read straight from the file by ` +
            'scripts/gen-og.ts to draw the share card.\n' +
            '    It would be printed onto the image as literal braces. Write it out here.'
        );
      }
    }

    if (file === SOURCE) continue;

    if (text.toLowerCase().includes(rules.email.toLowerCase())) {
      problems.push(
        `${where} writes the email address out in full.\n` +
          '    Use {email} for the address, or {mailto} for a link to it, so changing it in ' +
          'contact.json changes it here too.'
      );
    }
    if (national.length >= 7 && digitsOf(text).includes(national)) {
      problems.push(
        `${where} writes the phone number out in full.\n` +
          '    Use {phone} for the number, or {tel} for a link that dials it. A number spelled ' +
          'out here keeps its old value when contact.json changes, and the button then reads ' +
          'one number and dials another.'
      );
    }
    if (/wa\.me\//i.test(text)) {
      problems.push(
        `${where} contains a wa.me address.\n` +
          '    Use {whatsapp}. A wa.me link built from a stale number is a WORKING link to ' +
          "whoever holds that number now, which is the one failure here that cannot be seen " +
          'on the page.'
      );
    }
  }

  return problems;
}

// ---- self-test, part two ----
// One made-up content file per rule, so each is proven to fail before the
// real files are allowed to pass.
const RULES: Rules = { e164: '+447776153426', email: 'info@gosscounselling.co.uk' };
const FAULTS: Array<[string, Found[]]> = [
  ['an unknown placeholder', [{ where: 'home.json:hero.ctaPrimary', text: 'Call {phon}' }]],
  ['a placeholder in a share-card field', [{ where: 'home.json:og.title', text: 'Ring {phone}' }]],
  [
    'the number written out',
    [{ where: 'home.json:hero.ctaPrimary', text: 'Call 07776 153 426' }]
  ],
  [
    'the number written out in another shape',
    [{ where: 'home.json:faq.items[0].a', text: 'Ring me on +44 7776 153426.' }]
  ],
  [
    'the email written out',
    [{ where: 'home.json:fees.note.body', text: '[Write](mailto:info@gosscounselling.co.uk)' }]
  ],
  [
    'a wa.me link',
    [{ where: 'home.json:hero.reassure', text: '[WhatsApp](https://wa.me/447776153426)' }]
  ]
];
for (const [label, fault] of FAULTS) {
  if (checkCopy(fault, RULES).length === 0) {
    console.error(`check-contact: SELF-TEST FAILED — ${label} was not caught.`);
    process.exit(1);
  }
}
// And the other way round: the shapes that must NOT trip it, or the gate is
// one John cannot work with. A postcode has digits; a fee has digits; the
// source file is allowed to hold the real thing.
const INNOCENT: Found[] = [
  { where: 'contact.json:phone', text: '07776 153 426' },
  { where: 'contact.json:email', text: 'info@gosscounselling.co.uk' },
  { where: 'home.json:hero.ctaPrimary', text: 'Call {phone}' },
  { where: 'home.json:fees.rows[0].lines[0].value', text: '£70–90' },
  { where: 'contact.json:location', text: 'Bletchley, Milton Keynes MK3' },
  { where: 'site.json:footerNote', text: '© {year} John Goss' },
  { where: 'home.json:faq.items[0].a', text: 'Some 2015 training, 90 minutes, 60 sessions.' }
];
const falseAlarms = checkCopy(INNOCENT, RULES);
if (falseAlarms.length) {
  console.error('check-contact: SELF-TEST FAILED — ordinary copy was reported as a problem:');
  for (const p of falseAlarms) console.error(`  ${p}`);
  process.exit(1);
}

// ---- the real thing ----
const phone = parsePhone(contact.phone);
if (!phone.e164) {
  console.error(
    `check-contact: the phone number in src/content/contact.json cannot be dialled — ${phone.problem}.\n` +
      '  Write it however you would say it, e.g. 07776 153 426. The links are made from it.'
  );
  process.exit(1);
}
const email = parseEmail(contact.email);
if (!email.ok) {
  console.error(
    `check-contact: the email address in src/content/contact.json is not usable — ${email.problem}.`
  );
  process.exit(1);
}

/* Fail-closed, the same way check-cms does: a run that read no strings has
   proved nothing, and reporting a pass on it is worse than not running. */
const found = CONTENT.flatMap((path) =>
  strings(readJson(path), path.replace('src/content/', ''))
);
if (found.length === 0) {
  console.error('check-contact: read no copy at all from src/content. That is a failure, not a pass.');
  process.exit(1);
}

const problems = checkCopy(found, { e164: phone.e164, email: contact.email });
if (problems.length) {
  for (const p of problems) console.error(`check-contact: ${p}`);
  console.error(`\ncheck-contact: ${problems.length} problem(s) in the copy.`);
  process.exit(1);
}

const used = new Set(found.flatMap(({ text }) => findTokens(text)));
console.log(
  `check-contact: "${contact.phone}" dials ${telHref(contact.phone)}, ` +
    `writes to ${whatsappHref(contact.phone)}, and ${mailtoHref(contact.email)} is reachable.\n` +
    `check-contact: ${found.length} strings of copy, none of them a second copy of either. ` +
    `Placeholders in use: ${[...used].map((t) => `{${t}}`).join(', ') || 'none'}.` +
    `\n  (the vocabulary is ${TOKEN_NAMES.length}: ${Object.entries(TOKENS)
      .map(([name, what]) => `{${name}} — ${what}`)
      .join('; ')})`
);
