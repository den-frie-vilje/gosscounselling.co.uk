/**
 * Dates, written the way they are read here.
 *
 * `en-GB`, so it is "5 August 2026" rather than the American order, and
 * formatted at prerender rather than in the browser so every visitor sees the
 * same string whatever their locale is set to. A date that reads differently
 * to different people is not a date anyone can quote back on the phone.
 */
const LONG = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London'
});

/** "5 August 2026", or an empty string if the date will not parse. */
export function formatDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : LONG.format(time);
}

/** The `datetime` attribute of a `<time>`: the date part, machine-readable. */
export function dateAttr(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10);
}
