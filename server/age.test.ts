import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { AGE_REQUIREMENT_MESSAGE, MINIMUM_AGE, ageOn, isOfLegalAge, parseIsoDate } from "@shared/age";

/**
 * Age is the one thing on this form that is not a preference. Selling to
 * someone under 21 is a compliance failure, so the boundary is pinned down
 * from both sides — the birthday itself qualifies, the day before it does not —
 * and the same boundary is asserted again through the router, where a client
 * that never ran our form still has to meet it.
 */

// ─── Fixed reference date ────────────────────────────────────────────────────
// A literal "now" so these cases mean the same thing on every future run.
const NOW = new Date("2026-08-20T12:00:00.000Z");

/** A birth date exactly `years` and `dayOffset` days away from NOW. */
function birthDate(years: number, dayOffset = 0): string {
  const d = new Date(
    Date.UTC(NOW.getUTCFullYear() - years, NOW.getUTCMonth(), NOW.getUTCDate() + dayOffset)
  );
  return d.toISOString().slice(0, 10);
}

// ─── The boundary ────────────────────────────────────────────────────────────

describe("isOfLegalAge — the 21st birthday boundary", () => {
  it("accepts someone turning 21 today", () => {
    expect(isOfLegalAge(birthDate(MINIMUM_AGE), NOW)).toBe(true);
  });

  it("rejects someone one day short of 21", () => {
    // Born a day later than the cutoff, so the birthday is still a day away.
    expect(isOfLegalAge(birthDate(MINIMUM_AGE, 1), NOW)).toBe(false);
  });

  it("accepts someone who turned 21 yesterday", () => {
    expect(isOfLegalAge(birthDate(MINIMUM_AGE, -1), NOW)).toBe(true);
  });

  it("accepts comfortably older applicants", () => {
    expect(isOfLegalAge("1980-01-01", NOW)).toBe(true);
    expect(isOfLegalAge(birthDate(60), NOW)).toBe(true);
  });

  it("rejects someone clearly too young", () => {
    expect(isOfLegalAge(birthDate(12), NOW)).toBe(false);
    expect(isOfLegalAge(birthDate(20), NOW)).toBe(false);
  });
});

// ─── Future and nonsense dates ───────────────────────────────────────────────

describe("isOfLegalAge — dates that are not a lived birthday", () => {
  it("rejects a date of birth in the future", () => {
    expect(isOfLegalAge(birthDate(-1), NOW)).toBe(false);
    expect(isOfLegalAge("2099-12-31", NOW)).toBe(false);
  });

  it("rejects tomorrow", () => {
    expect(isOfLegalAge(birthDate(0, 1), NOW)).toBe(false);
  });

  it("rejects a calendar date that does not exist", () => {
    // Matches the YYYY-MM-DD shape but would otherwise roll into March.
    expect(isOfLegalAge("1990-02-31", NOW)).toBe(false);
    expect(isOfLegalAge("1990-13-01", NOW)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isOfLegalAge("", NOW)).toBe(false);
    expect(isOfLegalAge("1990", NOW)).toBe(false);
    expect(isOfLegalAge("01/01/1990", NOW)).toBe(false);
  });
});

describe("ageOn", () => {
  it("counts whole years only", () => {
    expect(ageOn("2000-08-20", NOW)).toBe(26);
    expect(ageOn("2000-08-21", NOW)).toBe(25);
  });

  it("goes negative for a future date, which is what fails the check", () => {
    expect(ageOn("2027-08-20", NOW)).toBe(-1);
  });

  it("handles a 29 February birthday in a non-leap year", () => {
    // Turns 21 on 2025-03-01 by the "birthday has come round" rule.
    expect(ageOn("2004-02-29", new Date("2025-02-28T12:00:00.000Z"))).toBe(20);
    expect(ageOn("2004-02-29", new Date("2025-03-01T12:00:00.000Z"))).toBe(21);
  });

  it("returns null for an unparseable date", () => {
    expect(ageOn("nonsense", NOW)).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("accepts a real date", () => {
    expect(parseIsoDate("1990-04-12")).toEqual({ year: 1990, month: 4, day: 12 });
  });

  it("accepts a real leap day", () => {
    expect(parseIsoDate("2004-02-29")).toEqual({ year: 2004, month: 2, day: 29 });
  });

  it("rejects a leap day in a non-leap year", () => {
    expect(parseIsoDate("2005-02-29")).toBeNull();
  });
});

// ─── The server guard ────────────────────────────────────────────────────────

function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

/** A payload valid in every respect except the date of birth given. */
function orderInput(dateOfBirth: string) {
  return {
    items: [{ productId: 1, quantity: 1 }],
    researcherType: "private_researcher" as const,
    dateOfBirth,
    shipping: {
      firstName: "Jane",
      lastName: "Researcher",
      email: "jane@lab.example",
      address: "400 Science Park Dr",
      city: "Boston",
      state: "MA",
      zip: "02115",
      country: "United States",
    },
  };
}

/**
 * Asserts the router turned the order away over the date of birth.
 *
 * Checks the field path, not merely that something threw: a payload that gets
 * past the schema reaches the resolver and blocks on the database, so a bare
 * rejection would prove nothing about the guard.
 */
async function expectRejectedForAge(dateOfBirth: string) {
  const caller = appRouter.createCaller(makeCtx());
  // @ts-expect-error — deliberately ineligible input; the schema is under test.
  const call = caller.orders.create(orderInput(dateOfBirth));

  const error = await call.then(
    () => null,
    (e: { code?: string; message: string }) => e
  );

  expect(error?.code).toBe("BAD_REQUEST");
  const issues: Array<{ path: Array<string | number>; message: string }> = JSON.parse(
    error?.message ?? "[]"
  );
  expect(issues.map((i) => i.path.join("."))).toContain("dateOfBirth");
  return issues;
}

/**
 * Field paths named by a zod rejection, or `[]` when the message is not a zod
 * issue list. tRPC puts the serialised issues in `message` for schema failures
 * and a plain sentence there for everything the resolver raises.
 */
function zodIssuePaths(message: string): string[] {
  try {
    const issues: Array<{ path: Array<string | number> }> = JSON.parse(message);
    return Array.isArray(issues) ? issues.map((i) => i.path.join(".")) : [];
  } catch {
    return [];
  }
}

/** Relative to the real clock, since the router validates against `new Date()`. */
function birthDateFromToday(years: number, dayOffset = 0): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() + dayOffset)
  );
  return d.toISOString().slice(0, 10);
}

describe("orders.create — age requirement", () => {
  it("rejects an applicant one day short of 21", async () => {
    const issues = await expectRejectedForAge(birthDateFromToday(MINIMUM_AGE, 1));
    expect(issues.some((i) => i.message === AGE_REQUIREMENT_MESSAGE)).toBe(true);
  });

  it("rejects a clearly underage applicant", async () => {
    await expectRejectedForAge(birthDateFromToday(15));
  });

  it("rejects a date of birth in the future", async () => {
    await expectRejectedForAge(birthDateFromToday(-1));
    await expectRejectedForAge("2099-12-31");
  });

  it("rejects a date that is not a real calendar day", async () => {
    await expectRejectedForAge("1990-02-31");
  });

  it("lets someone turning exactly 21 today past the age check", async () => {
    // A payload that clears the schema carries on into the resolver, which needs
    // a database this suite has no business reaching — so the assertion is that
    // no age complaint comes back, not that the call succeeds. Schema rejections
    // land in about a millisecond, so a settled/pending race decides it cleanly.
    const caller = appRouter.createCaller(makeCtx());
    const call = caller.orders
      .create(orderInput(birthDateFromToday(MINIMUM_AGE)))
      .then(() => null)
      .catch((e: { code?: string; message: string }) => e);

    const pending = Symbol("still running");
    const outcome = await Promise.race([
      call,
      new Promise((resolve) => setTimeout(() => resolve(pending), 500)),
    ]);

    if (outcome !== pending && outcome !== null) {
      // Anything that came back is from the resolver, past the schema. Only a
      // zod rejection carries a JSON issue list; a plain message (an unknown
      // product, an unreachable database) is by definition not an age problem.
      const error = outcome as { code?: string; message: string };
      expect(zodIssuePaths(error.message)).not.toContain("dateOfBirth");
    }
  });
});
