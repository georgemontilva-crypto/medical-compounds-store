/**
 * Age eligibility for ordering research compounds.
 *
 * The date of birth collected at checkout is only useful if it is actually
 * checked. These helpers are shared so the browser and the server reach the
 * same verdict from the same code — the client check is a courtesy that keeps
 * someone from filling in a whole form for nothing, and the server check is the
 * one that decides.
 *
 * Everything is computed in UTC from the calendar parts, never from a parsed
 * local Date. A birthday is a calendar fact: it should not land a day early or
 * late because the shopper's timezone is west of ours.
 */

/** Minimum age, in years, to place an order. */
export const MINIMUM_AGE = 21;

export const AGE_REQUIREMENT_MESSAGE = `You must be ${MINIMUM_AGE} or older to order.`;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Parses a `YYYY-MM-DD` string, rejecting anything that is not a real calendar
 * date. `2025-02-31` matches the shape but is not a day that exists, and would
 * otherwise roll forward into March and quietly pass as a birth date.
 */
export function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const asDate = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day;

  return roundTrips ? { year, month, day } : null;
}

/**
 * Whole years completed on `asOf`. Negative for a date of birth in the future,
 * which is what makes a future date fail the age check rather than sail past it.
 *
 * Returns null when the input is not a real date.
 */
export function ageOn(dateOfBirth: string, asOf: Date): number | null {
  const born = parseIsoDate(dateOfBirth);
  if (!born) return null;

  const nowYear = asOf.getUTCFullYear();
  const nowMonth = asOf.getUTCMonth() + 1;
  const nowDay = asOf.getUTCDate();

  let age = nowYear - born.year;
  // The birthday has not come round yet this year, so one fewer whole year.
  const beforeBirthday =
    nowMonth < born.month || (nowMonth === born.month && nowDay < born.day);
  if (beforeBirthday) age -= 1;

  return age;
}

/**
 * Whether someone born on `dateOfBirth` may order on `asOf`.
 *
 * The boundary is inclusive: the 21st birthday itself qualifies, the day before
 * it does not.
 */
export function isOfLegalAge(dateOfBirth: string, asOf: Date = new Date()): boolean {
  const age = ageOn(dateOfBirth, asOf);
  return age !== null && age >= MINIMUM_AGE;
}
