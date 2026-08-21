import { describe, expect, it } from "vitest";
import { MINIMUM_AGE, isOfLegalAge } from "@shared/age";
import {
  EMPTY_BIRTH_DATE,
  MAX_AGE_YEARS,
  MONTH_NAMES,
  birthYearOptions,
  daysInMonth,
  fromIsoDate,
  toIsoDate,
  updateBirthDate,
} from "@shared/birthDate";

/**
 * These helpers only assemble a string; the age rule itself lives in age.ts and
 * is untouched. What matters here is that the string they produce is either a
 * real calendar date or empty — never something in between that would have to
 * be rejected further along.
 */

const NOW = new Date("2026-08-21T12:00:00.000Z");

// ─── Day counts ──────────────────────────────────────────────────────────────

describe("daysInMonth", () => {
  it("knows the long and short months", () => {
    expect(daysInMonth(1, 2001)).toBe(31);
    expect(daysInMonth(4, 2001)).toBe(30);
    expect(daysInMonth(12, 2001)).toBe(31);
  });

  it("handles February in ordinary and leap years", () => {
    expect(daysInMonth(2, 2001)).toBe(28);
    expect(daysInMonth(2, 2004)).toBe(29);
  });

  it("applies the century rule", () => {
    expect(daysInMonth(2, 1900)).toBe(28);
    expect(daysInMonth(2, 2000)).toBe(29);
  });

  it("offers the longest possibility while the month or year is unchosen", () => {
    // Narrowing is the next choice's job; hiding days before then is guessing.
    expect(daysInMonth(null, 2001)).toBe(31);
    expect(daysInMonth(2, null)).toBe(29);
  });

  it("is defensive about a nonsense month", () => {
    expect(daysInMonth(0, 2001)).toBe(31);
    expect(daysInMonth(13, 2001)).toBe(31);
  });
});

// ─── Year options ────────────────────────────────────────────────────────────

describe("birthYearOptions", () => {
  const years = birthYearOptions(NOW);

  it("starts at the newest year that could be old enough", () => {
    expect(years[0]).toBe(2026 - MINIMUM_AGE);
    expect(years[0]).toBe(2005);
  });

  it("runs back a century and stops", () => {
    expect(years[years.length - 1]).toBe(2026 - MAX_AGE_YEARS);
    expect(years).toHaveLength(MAX_AGE_YEARS - MINIMUM_AGE + 1);
  });

  it("is newest first, since that is where most shoppers look", () => {
    expect(years[0]).toBeGreaterThan(years[1]);
  });

  it("offers no year that is too young by any reading", () => {
    // Every offered year contains at least one eligible birthday: 31 December
    // of that year is the last day it could describe, and even that is old
    // enough or the year would not be here.
    for (const y of years) {
      expect(isOfLegalAge(`${y}-01-01`, NOW)).toBe(true);
    }
  });

  it("still lets through a year whose birthday has not arrived", () => {
    // The list cannot resolve this and is not supposed to: someone born on the
    // last day of the newest offered year is not 21 yet. The age check is what
    // catches that, and it still does.
    const newest = years[0];
    expect(isOfLegalAge(`${newest}-12-31`, NOW)).toBe(false);
  });
});

// ─── Assembling ──────────────────────────────────────────────────────────────

describe("toIsoDate", () => {
  it("pads month and day to two digits", () => {
    expect(toIsoDate({ year: 1990, month: 4, day: 7 })).toBe("1990-04-07");
    expect(toIsoDate({ year: 1990, month: 12, day: 25 })).toBe("1990-12-25");
  });

  it("is empty until all three parts are chosen", () => {
    expect(toIsoDate({ year: 1990, month: 4, day: null })).toBe("");
    expect(toIsoDate({ year: 1990, month: null, day: 7 })).toBe("");
    expect(toIsoDate({ year: null, month: 4, day: 7 })).toBe("");
    expect(toIsoDate(EMPTY_BIRTH_DATE)).toBe("");
  });

  it("is empty for a day the month cannot hold", () => {
    expect(toIsoDate({ year: 2001, month: 2, day: 29 })).toBe("");
    expect(toIsoDate({ year: 2001, month: 4, day: 31 })).toBe("");
  });

  it("accepts a real leap day", () => {
    expect(toIsoDate({ year: 2004, month: 2, day: 29 })).toBe("2004-02-29");
  });

  it("produces something the age check can read", () => {
    const iso = toIsoDate({ year: 1990, month: 4, day: 12 });
    expect(isOfLegalAge(iso, NOW)).toBe(true);
  });
});

describe("fromIsoDate", () => {
  it("splits a stored date back into parts", () => {
    expect(fromIsoDate("1990-04-07")).toEqual({ year: 1990, month: 4, day: 7 });
  });

  it("is empty for anything unparseable", () => {
    expect(fromIsoDate("")).toEqual(EMPTY_BIRTH_DATE);
    expect(fromIsoDate(null)).toEqual(EMPTY_BIRTH_DATE);
    expect(fromIsoDate("07/04/1990")).toEqual(EMPTY_BIRTH_DATE);
    expect(fromIsoDate("1990-4-7")).toEqual(EMPTY_BIRTH_DATE);
  });

  it("is empty for a date that looks right but never happened", () => {
    expect(fromIsoDate("2001-02-29")).toEqual(EMPTY_BIRTH_DATE);
    expect(fromIsoDate("1990-13-01")).toEqual(EMPTY_BIRTH_DATE);
  });

  it("round-trips with toIsoDate", () => {
    const iso = "1985-11-30";
    expect(toIsoDate(fromIsoDate(iso))).toBe(iso);
  });
});

// ─── Editing ─────────────────────────────────────────────────────────────────

describe("updateBirthDate", () => {
  it("applies the part that changed and leaves the rest", () => {
    const start = { year: 1990, month: 4, day: 7 };
    expect(updateBirthDate(start, { month: 5 })).toEqual({ year: 1990, month: 5, day: 7 });
  });

  it("clears a day the new month cannot hold", () => {
    // Rather than sliding it to the 28th, which would file a date nobody chose.
    const start = { year: 2001, month: 1, day: 31 };
    expect(updateBirthDate(start, { month: 2 })).toEqual({ year: 2001, month: 2, day: null });
  });

  it("clears 29 February when the year stops being a leap year", () => {
    const start = { year: 2004, month: 2, day: 29 };
    expect(updateBirthDate(start, { year: 2005 })).toEqual({ year: 2005, month: 2, day: null });
  });

  it("keeps 29 February when the new year is also a leap year", () => {
    const start = { year: 2004, month: 2, day: 29 };
    expect(updateBirthDate(start, { year: 2008 })).toEqual({ year: 2008, month: 2, day: 29 });
  });

  it("keeps a day the new month can hold", () => {
    const start = { year: 2001, month: 1, day: 15 };
    expect(updateBirthDate(start, { month: 2 })).toEqual({ year: 2001, month: 2, day: 15 });
  });

  it("lets a part be cleared back to nothing", () => {
    const start = { year: 1990, month: 4, day: 7 };
    expect(toIsoDate(updateBirthDate(start, { month: null }))).toBe("");
  });
});

// ─── The whole path ──────────────────────────────────────────────────────────

describe("choosing a date one part at a time", () => {
  it("stays empty until the last part lands, then yields the ISO string", () => {
    let parts = EMPTY_BIRTH_DATE;

    parts = updateBirthDate(parts, { month: 4 });
    expect(toIsoDate(parts)).toBe("");

    parts = updateBirthDate(parts, { year: 1990 });
    expect(toIsoDate(parts)).toBe("");

    parts = updateBirthDate(parts, { day: 12 });
    expect(toIsoDate(parts)).toBe("1990-04-12");
  });

  it("names twelve months in order", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe("January");
    expect(MONTH_NAMES[11]).toBe("December");
  });
});
