import { MINIMUM_AGE } from "./age";

/**
 * Composing a date of birth from month, day and year parts.
 *
 * A native `<input type="date">` is built for picking a date in context — next
 * Tuesday, an available slot — and its calendar only moves a month at a time.
 * A birth date is not picked, it is recalled, and it sits thirty or forty years
 * back; reaching it that way takes hundreds of clicks. Three selects reach it
 * in three.
 *
 * The output contract is unchanged: whatever the shopper touches, what leaves
 * here is the same `YYYY-MM-DD` string the age check has always received, or an
 * empty string while the date is still incomplete. Nothing in age.ts needs to
 * know this module exists.
 */

export interface BirthDateParts {
  year: number | null;
  month: number | null;
  day: number | null;
}

export const EMPTY_BIRTH_DATE: BirthDateParts = { year: null, month: null, day: null };

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The oldest birth year offered. Beyond this the list is noise. */
export const MAX_AGE_YEARS = 100;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * How many days the chosen month has, so the day list never offers the 31st of
 * a thirty-day month.
 *
 * Falls back to the longest possibility while the month or year is still
 * unchosen: narrowing the list is the job of a later choice, and hiding days
 * before then would be guessing.
 */
export function daysInMonth(month: number | null, year: number | null): number {
  if (month === null || month < 1 || month > 12) return 31;
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return DAYS_PER_MONTH[month - 1];
}

/**
 * Birth years worth offering, newest first.
 *
 * Stops at the newest year that could belong to someone old enough. That makes
 * the age requirement a shape of the control rather than a rejection after the
 * fact — an eleven-year-old finds no year to pick.
 *
 * It cannot enforce the rule on its own: somebody born in the newest year
 * offered turns the age only on their birthday, so part of that year is still
 * too young. That remainder is what the age check catches, and it stays exactly
 * where it was.
 */
export function birthYearOptions(asOf: Date = new Date()): number[] {
  const thisYear = asOf.getUTCFullYear();
  const newest = thisYear - MINIMUM_AGE;
  const oldest = thisYear - MAX_AGE_YEARS;

  const years: number[] = [];
  for (let y = newest; y >= oldest; y--) years.push(y);
  return years;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The parts as the `YYYY-MM-DD` string everything downstream expects.
 *
 * Empty until all three are chosen, so a half-answered date stays indisputably
 * blank and the form's own `required` handling still catches it — rather than
 * becoming a malformed string that has to be rejected further along.
 */
export function toIsoDate(parts: BirthDateParts): string {
  const { year, month, day } = parts;
  if (year === null || month === null || day === null) return "";
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > daysInMonth(month, year)) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Splits a stored `YYYY-MM-DD` back into parts; all null if unparseable. */
export function fromIsoDate(iso: string | null | undefined): BirthDateParts {
  if (!iso) return EMPTY_BIRTH_DATE;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return EMPTY_BIRTH_DATE;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year)) {
    return EMPTY_BIRTH_DATE;
  }
  return { year, month, day };
}

/**
 * Applies a change to one part, dropping a day the new month cannot hold.
 *
 * Picking the 31st and then switching to February has to resolve somehow.
 * Clearing the day says so plainly; silently moving it to the 28th would put a
 * date on file that nobody chose.
 */
export function updateBirthDate(
  parts: BirthDateParts,
  patch: Partial<BirthDateParts>
): BirthDateParts {
  const next = { ...parts, ...patch };
  if (next.day !== null && next.day > daysInMonth(next.month, next.year)) {
    next.day = null;
  }
  return next;
}
