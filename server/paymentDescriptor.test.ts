import { describe, expect, it } from "vitest";
import {
  STATEMENT_DESCRIPTOR,
  assertPayloadIsSanitized,
  buildSanitizedProcessorPayload,
  findRestrictedTerms,
  getSanitizedOrderDescriptor,
  getSanitizedStatementDescriptor,
} from "./paymentDescriptor";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const order = { id: 1042, total: "249.50" };

/** Names shaped like the real catalog — this is what must never leak. */
const items = [
  { productName: "BPC-157 10mg", variationLabel: "10mg vial", quantity: 2 },
  { productName: "TB-500 5mg", variationLabel: "5mg vial", quantity: 1 },
  { productName: "Semaglutide 3mg", variationLabel: null, quantity: 3 },
];

/** Every token a leak would most likely surface as. */
const FORBIDDEN_FRAGMENTS = [
  "BPC-157",
  "BPC",
  "TB-500",
  "Semaglutide",
  "10mg",
  "5mg",
  "3mg",
  "vial",
  "peptide",
  "research compound",
  "RUO",
];

// ─── Descriptors ─────────────────────────────────────────────────────────────

describe("getSanitizedOrderDescriptor", () => {
  it("returns a generic label carrying only the order id", () => {
    expect(getSanitizedOrderDescriptor(order)).toBe("Lab Supply Item — Order #1042");
  });

  it("never varies with the products in the order", () => {
    expect(getSanitizedOrderDescriptor({ id: 7 })).toBe("Lab Supply Item — Order #7");
  });
});

describe("getSanitizedStatementDescriptor", () => {
  it("is the company name, not a product", () => {
    expect(getSanitizedStatementDescriptor()).toBe("BRIGHTER DAYS LABS");
  });

  it("satisfies Stripe's 5–22 character limit and forbidden characters", () => {
    expect(STATEMENT_DESCRIPTOR.length).toBeGreaterThanOrEqual(5);
    expect(STATEMENT_DESCRIPTOR.length).toBeLessThanOrEqual(22);
    expect(STATEMENT_DESCRIPTOR).not.toMatch(/[<>\\"'*]/);
  });
});

// ─── The core guarantee ──────────────────────────────────────────────────────

describe("buildSanitizedProcessorPayload", () => {
  const payload = buildSanitizedProcessorPayload(order, items);

  it("carries the correct amount in minor units", () => {
    expect(payload.amountInCents).toBe(24950);
  });

  it("aggregates item count without naming anything", () => {
    expect(payload.metadata).toEqual({ orderId: "1042", itemCount: "6" });
  });

  it("leaks no product name, variation label, or restricted term", () => {
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(
        serialized.includes(fragment.toLowerCase()),
        `payload must not contain "${fragment}" — got ${JSON.stringify(payload)}`
      ).toBe(false);
    }
  });

  it("passes its own sanitization guard", () => {
    expect(() => assertPayloadIsSanitized(payload, items)).not.toThrow();
  });
});

// ─── The guard itself must actually catch leaks ──────────────────────────────

describe("assertPayloadIsSanitized", () => {
  it("throws when a product name reaches the payload", () => {
    const leaky = {
      ...buildSanitizedProcessorPayload(order, items),
      description: "BPC-157 10mg x2 — Order #1042",
    };
    expect(() => assertPayloadIsSanitized(leaky, items)).toThrow(/leaks product name "BPC-157 10mg"/);
  });

  it("throws when a product name is buried in nested metadata", () => {
    const leaky = {
      ...buildSanitizedProcessorPayload(order, items),
      metadata: { orderId: "1042", lineItems: ["TB-500 5mg"] },
    };
    expect(() => assertPayloadIsSanitized(leaky, items)).toThrow(/leaks product name "TB-500 5mg"/);
  });

  it("throws when a variation label reaches the payload", () => {
    const leaky = { note: "Contents: 10mg vial" };
    expect(() => assertPayloadIsSanitized(leaky, items)).toThrow(/leaks variation label "10mg vial"/);
  });

  it("throws on restricted terms even when no product is named", () => {
    const leaky = { description: "Research Compound Order #1042" };
    expect(() => assertPayloadIsSanitized(leaky, items)).toThrow(/restricted term/);
  });

  it("accepts a payload with no order text at all", () => {
    expect(() => assertPayloadIsSanitized({ amountInCents: 100 }, items)).not.toThrow();
  });
});

describe("findRestrictedTerms", () => {
  it("flags the compliance-sensitive vocabulary", () => {
    expect(findRestrictedTerms("Peptide blend")).toContain("peptide");
    expect(findRestrictedTerms("For RUO only")).toContain("ruo");
    expect(findRestrictedTerms("Research Chemical")).toContain("research chemical");
  });

  it("does not flag ordinary company text", () => {
    expect(findRestrictedTerms("Lab Supply Item — Order #12")).toEqual([]);
    expect(findRestrictedTerms("BRIGHTER DAYS LABS")).toEqual([]);
  });

  it("does not match 'ruo' inside an unrelated word", () => {
    expect(findRestrictedTerms("Group order")).toEqual([]);
  });
});
