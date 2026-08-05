/**
 * The placeholders John can write inside his copy, and what they stand for.
 *
 * This is $lib/phone.ts finished. That module stopped three copies of the
 * phone number living in three CMS FIELDS; it did nothing about the three
 * copies that were still living inside his PROSE, where a grep for `Href`
 * never looked:
 *
 *   hero.ctaPrimary   "Call 07776 153 426"                      — plain text
 *   hero.reassure     "[WhatsApp](https://wa.me/447776153426)"  — a link
 *   fees.note.body    "[Get in touch](mailto:info@goss…)"       — a link
 *
 * Change the number under Contact details and all three keep the old one. The
 * hero button then READS one number and DIALS another, which is the worst of
 * the three failures because it looks fine; and the WhatsApp link is a working
 * link to whoever holds that number now. Exactly the harm the phone work was
 * done to prevent, one layer down.
 *
 * So: he writes `{phone}` and `{whatsapp}` and the build fills them in.
 * `scripts/check-contact.ts` refuses a token this file does not know, and
 * refuses his number, his address or a wa.me link written out longhand
 * anywhere except contact.json — because a token nobody is made to use is a
 * convention, not a guarantee.
 *
 * Pure and dependency-free, so the gate can import it from plain node.
 */

/**
 * Every placeholder the site understands.
 *
 * `year` is here but is not resolved with the others: it belongs to the
 * footer note and is filled in at render time by `footerNote()`, because the
 * year a page is looked at is not a property of the content. It is listed
 * because the gate's vocabulary has to be the whole vocabulary — otherwise
 * the gate reports the one token that has always worked as an unknown one.
 */
export const TOKENS = {
  phone: 'the phone number, written the way you wrote it',
  email: 'the email address, written the way you wrote it',
  tel: 'a link that dials the phone number',
  mailto: 'a link that opens a new email',
  whatsapp: 'a link that opens WhatsApp',
  year: 'the current year (in the footer note only)'
} as const;

export type TokenName = keyof typeof TOKENS;

export const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];

/** A `{word}` placeholder. Deliberately narrow — letters only — so a brace
 *  that turns up in ordinary prose is not mistaken for one of these. */
const TOKEN = /\{([a-z]+)\}/gi;

/** Every placeholder name in a string, in the order they appear, duplicates
 *  and all. The gate uses this to check them against `TOKENS`. */
export function findTokens(text: string): string[] {
  return [...String(text ?? '').matchAll(TOKEN)].map((m) => m[1]);
}

export type TokenValues = Partial<Record<TokenName, string | null>>;

/**
 * Fill in the placeholders a caller has values for, and leave the rest alone.
 *
 * Leaving the rest alone is what lets the content pass through this on load
 * carrying `{year}`, which nothing here can answer, without it being mangled
 * into an empty string on the way to the footer.
 *
 * A value of `null` means the token has no honest answer at all — today only
 * `{whatsapp}`, when the number John typed will not make a wa.me address.
 * Substituting an empty string there would leave `[WhatsApp]()`, a link that
 * looks live and goes nowhere, so a markdown link built on a null token loses
 * its LINK and keeps its words. That is the same choice ContactBand makes
 * when it drops the WhatsApp row: there is no honest fallback for a wa.me
 * address, and the text is still true without one.
 */
export function resolveTokens(text: string, values: TokenValues): string {
  let out = String(text ?? '');

  for (const [name, value] of Object.entries(values) as [TokenName, string | null][]) {
    if (value === null) {
      // `[words]({token})` → `words`. Then any bare use of it goes, because
      // a sentence with a hole in it beats a sentence with `{whatsapp}` in it.
      out = out.replaceAll(new RegExp(`\\[([^\\]]*)\\]\\(\\{${name}\\}\\)`, 'g'), '$1');
      out = out.replaceAll(`{${name}}`, '');
      continue;
    }
    if (value === undefined) continue;
    out = out.replaceAll(`{${name}}`, value);
  }

  return out;
}

/**
 * The same substitution over a whole content tree, strings only.
 *
 * Applied to every content file rather than to the handful of fields that
 * happen to carry a token today: the point of a placeholder is that John can
 * put one where he needs it, and a resolver that only looks in the three
 * places we thought of is a resolver that fails silently in the fourth.
 *
 * One field is beyond its reach and it is worth knowing which:
 * `scripts/gen-og.ts` builds the share card from the raw JSON, in plain node,
 * before the app is ever compiled. A token in the fields that card reads
 * would be drawn as literal braces onto an image, so the gate forbids one
 * there rather than this function pretending to have covered it.
 */
export function resolveDeep<T>(value: T, values: TokenValues): T {
  if (typeof value === 'string') return resolveTokens(value, values) as T;
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, values)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveDeep(v, values)])
    ) as T;
  }
  return value;
}
