import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { COUNTRIES, DEFAULT_COUNTRY, isSupportedCountry } from "@shared/countries";

/**
 * The shipping address is the last thing checked before an order becomes a
 * Stripe charge, so a bad address here is a parcel that cannot be delivered
 * against money that has already moved.
 *
 * Every case below rejects at the input schema, before the resolver runs — no
 * database is touched. That is the point: the guard has to hold even when the
 * request never came from our own checkout form.
 */

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

/** A payload that differs from a valid one only in the shipping fields given. */
function orderInput(shippingOverrides: Record<string, unknown>) {
  return {
    items: [{ productId: 1, quantity: 1 }],
    researcherType: "private_researcher" as const,
    dateOfBirth: "1990-04-12",
    shipping: {
      firstName: "Jane",
      lastName: "Researcher",
      email: "jane@lab.example",
      address: "400 Science Park Dr",
      city: "Boston",
      state: "MA",
      zip: "02115",
      country: DEFAULT_COUNTRY,
      ...shippingOverrides,
    },
  };
}

/**
 * Asserts the call is turned away by the input schema, naming the field.
 *
 * Deliberately narrower than "it throws": a valid payload reaches the resolver
 * and blocks on the database, so a bare toThrow() would go green whether the
 * guard existed or not. BAD_REQUEST plus the field path can only come from zod.
 */
async function expectRejected(field: string, shippingOverrides: Record<string, unknown>) {
  const caller = appRouter.createCaller(makeCtx());
  // @ts-expect-error — deliberately malformed input; the schema is what's under test.
  const call = caller.orders.create(orderInput(shippingOverrides));

  const error = await call.then(
    () => null,
    (e: { code?: string; message: string }) => e
  );

  expect(error?.code).toBe("BAD_REQUEST");
  const issues: Array<{ path: Array<string | number> }> = JSON.parse(error?.message ?? "[]");
  expect(issues.map((i) => i.path.join("."))).toContain(`shipping.${field}`);
}

// ─── State and ZIP ───────────────────────────────────────────────────────────

describe("orders.create shipping — state and ZIP", () => {
  it("rejects a missing state", async () => {
    await expectRejected("state", { state: undefined });
  });

  it("rejects an empty state", async () => {
    await expectRejected("state", { state: "" });
  });

  it("rejects a missing ZIP", async () => {
    await expectRejected("zip", { zip: undefined });
  });

  it("rejects an empty ZIP", async () => {
    await expectRejected("zip", { zip: "" });
  });
});

// ─── Country ─────────────────────────────────────────────────────────────────

describe("orders.create shipping — country", () => {
  it("rejects a country that is not on the list", async () => {
    await expectRejected("country", { country: "Wakanda" });
  });

  it("rejects an empty country", async () => {
    await expectRejected("country", { country: "" });
  });

  it("rejects a country whose casing does not match the list", async () => {
    // The picker only ever emits exact list values, so anything else reached us
    // some other way and should not be stored as if it were canonical.
    await expectRejected("country", { country: "united states" });
  });
});

describe("isSupportedCountry", () => {
  it("accepts the default destination", () => {
    expect(isSupportedCountry(DEFAULT_COUNTRY)).toBe(true);
  });

  it("accepts every value the picker can produce", () => {
    for (const country of COUNTRIES) {
      expect(isSupportedCountry(country)).toBe(true);
    }
  });

  it("rejects invented, empty and mis-cased names", () => {
    expect(isSupportedCountry("Wakanda")).toBe(false);
    expect(isSupportedCountry("")).toBe(false);
    expect(isSupportedCountry("united states")).toBe(false);
  });

  it("offers the default destination as one of its options", () => {
    expect(COUNTRIES).toContain(DEFAULT_COUNTRY);
  });
});
