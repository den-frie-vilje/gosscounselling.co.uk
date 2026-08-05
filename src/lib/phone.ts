/**
 * A phone number as John writes it, turned into the forms machines need.
 *
 * He types one thing: `07776 153 426`. The site needs three — that, a `tel:`
 * link a phone can dial, and a `wa.me` address — and until now he typed all
 * three into the CMS. Two of them are derivable from the first, so asking for
 * them was asking him to keep three fields in step and to get `+44` and a
 * dropped leading zero right by hand. The same goes for the email address and
 * its `mailto:`.
 *
 * The rule this follows is the one already written down for URLs: external
 * addresses are John's to write, and anything the code can work out from what
 * he has already said is the code's job.
 *
 * No dependency for this. A full E.164 library carries every country's dialling
 * plan, and this site has one number in one country; what it needs is a
 * conversion that is right for UK numbers and REFUSES anything it does not
 * recognise, rather than one that is right for the world and quietly wrong at
 * the edges.
 */

/** John's practice is in Milton Keynes. Stated once, here. */
const UK = '44';

export interface PhoneParse {
  /** `+447776153426`, for `tel:`. Null when the number is not recognisable. */
  e164: string | null;
  /** Why it was refused. Null when it parsed. */
  problem: string | null;
}

/**
 * UK national or international, however it is spaced or punctuated.
 *
 * Accepts `07776 153 426`, `+44 7776 153426`, `(01908) 123456`, `44 7776…`.
 * Refuses anything else rather than guessing: a wrong `tel:` link is worse
 * than a missing one, because it dials.
 */
export function parsePhone(input: string): PhoneParse {
  const raw = (input ?? '').trim();
  if (!raw) return { e164: null, problem: 'the number is empty' };

  // Everything a person might put in a written number, and nothing else. A
  // letter is a typo or a vanity number, and neither is dialable here.
  if (/[a-z]/i.test(raw)) {
    return { e164: null, problem: `"${raw}" has letters in it` };
  }
  const digits = raw.replace(/[\s()\-.]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) {
    return { e164: null, problem: `"${raw}" has characters that are not part of a phone number` };
  }

  let national: string;
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    national = digits.slice(1); // 07776… → 7776…
  } else if (digits.startsWith(UK)) {
    national = digits.slice(UK.length); // 447776… or +447776…
  } else if (digits.startsWith(`00${UK}`)) {
    national = digits.slice(2 + UK.length);
  } else {
    return {
      e164: null,
      problem: `"${raw}" is not a UK number: it starts with neither 0 nor ${UK}`
    };
  }

  // Lengths, from Ofcom's National Telephone Numbering Plan. Mobiles (07…)
  // are always 10 digits after the leading zero; geographic numbers are 9 or
  // 10, because a handful of areas — Brampton, Dumfries and a few others —
  // still carry five-digit subscriber numbers. Checking mobiles strictly is
  // what catches the typo that matters here, since John's number is a mobile
  // and a nine-digit mobile is always a dropped digit.
  const isMobile = national.startsWith('7');
  const min = isMobile ? 10 : 9;
  if (national.length < min || national.length > 10) {
    const want = isMobile ? '10' : '9 or 10';
    return {
      e164: null,
      problem: `"${raw}" has ${national.length} digits after the country code; a UK ${isMobile ? 'mobile' : 'number'} has ${want}`
    };
  }

  return { e164: `+${UK}${national}`, problem: null };
}

/** `tel:+447776153426`, or the number as typed if it could not be parsed —
 *  a link that does nothing is better than one that dials someone else. */
export function telHref(phone: string): string {
  const { e164 } = parsePhone(phone);
  return e164 ? `tel:${e164}` : `tel:${phone.replace(/\s/g, '')}`;
}

/** `https://wa.me/447776153426` — the same number, no plus, no spaces, which
 *  is the only form wa.me takes. */
export function whatsappHref(phone: string): string | null {
  const { e164 } = parsePhone(phone);
  return e164 ? `https://wa.me/${e164.slice(1)}` : null;
}

/** Does this look like an address a person can be reached at? Deliberately
 *  loose: the job is to catch a missing @ or a stray space, not to adjudicate
 *  RFC 5322, which permits addresses no one has ever typed on purpose. */
export function parseEmail(input: string): { ok: boolean; problem: string | null } {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, problem: 'the address is empty' };
  if (/\s/.test(raw)) return { ok: false, problem: `"${raw}" has a space in it` };
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(raw)) {
    return { ok: false, problem: `"${raw}" is not an email address` };
  }
  return { ok: true, problem: null };
}

/** `mailto:info@…`. */
export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}
