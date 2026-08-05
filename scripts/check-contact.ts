/**
 * Gate: the number and the address John typed can actually be reached.
 *
 * The site no longer asks him for `mailto:`, `tel:` and the wa.me address — it
 * works all three out from the number and the email he writes. That is a
 * better editor, and it moves the failure: a typo in one field now breaks
 * three links at once instead of one.
 *
 * So it is checked at build time. A malformed number fails the build here,
 * where a person is looking at the output, rather than shipping a Call button
 * that dials nothing, or worse, dials somebody else.
 *
 * Run by `pnpm check`. Self-tested against known-good and known-bad numbers,
 * including the near-misses that a hand-written `tel:` used to get wrong: the
 * dropped leading zero, the missing country code, the doubled one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parsePhone, parseEmail, telHref, whatsappHref, mailtoHref } from '../src/lib/phone.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contact = JSON.parse(readFileSync(resolve(root, 'src/content/contact.json'), 'utf8')) as {
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

console.log(
  `check-contact: "${contact.phone}" dials ${telHref(contact.phone)}, ` +
    `writes to ${whatsappHref(contact.phone)}, and ${mailtoHref(contact.email)} is reachable.`
);
