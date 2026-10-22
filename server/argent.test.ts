import { describe, expect, it } from "vitest";
import {
  ARGENT_DESCRIPTOR_MAX_LENGTH,
  assertValidArgentDescriptor,
  buildArgentClientConfig,
  orderPaymentReference,
  parsePaymentIntent,
  referenceMatchesOrder,
  verifyArgentPayment,
  type ArgentPaymentIntent,
} from "./argent";
import { findRestrictedTerms } from "./paymentDescriptor";
import fs from "fs";
import path from "path";

const readSource = (relative: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "..", relative), "utf-8");

/**
 * These tests are the integration's security boundary.
 *
 * With PaymentJS the amount and the "it succeeded" signal both originate in
 * the shopper's browser. Everything that stops that from being a way to buy a
 * $500 order for a dollar lives in the pure functions below, which is why
 * they are pure: each refusal can be proven without a network.
 */

const order = { id: 8042, total: "249.50" };
const expectedCents = 24950;

function intent(overrides: Partial<ArgentPaymentIntent> = {}): ArgentPaymentIntent {
  return {
    id: "pymnt_abc123",
    completed: true,
    amountInMinorUnits: expectedCents,
    currencyCode: "USD",
    reference: orderPaymentReference(order.id),
    status: "completed",
    paymentId: "pay_abc123",
    ...overrides,
  };
}

describe("the reference binds a payment to one order", () => {
  it("is stable for an order", () => {
    expect(orderPaymentReference(8042)).toBe(orderPaymentReference(8042));
  });

  it("differs between orders", () => {
    expect(orderPaymentReference(8042)).not.toBe(orderPaymentReference(8043));
  });

  it("carries a signature, not just the order number", () => {
    // A bare "bdl-8042" would let anyone construct another order's reference,
    // which is the whole attack this prevents.
    const reference = orderPaymentReference(8042);
    expect(reference.startsWith("bdl-8042-")).toBe(true);
    expect(reference.length).toBeGreaterThan("bdl-8042-".length + 8);
  });

  it("rejects a reference built by hand", () => {
    expect(referenceMatchesOrder("bdl-8042-0000000000000000", 8042)).toBe(false);
    expect(referenceMatchesOrder("bdl-8042", 8042)).toBe(false);
    expect(referenceMatchesOrder("", 8042)).toBe(false);
  });

  it("rejects another order's valid reference", () => {
    expect(referenceMatchesOrder(orderPaymentReference(8043), 8042)).toBe(false);
  });

  it("accepts its own", () => {
    expect(referenceMatchesOrder(orderPaymentReference(8042), 8042)).toBe(true);
  });
});

describe("verification refuses everything that is not this order, paid in full", () => {
  it("accepts a completed payment for the right order and amount", () => {
    expect(verifyArgentPayment(intent(), order).ok).toBe(true);
  });

  it("refuses a payment that was not captured", () => {
    const verdict = verifyArgentPayment(intent({ completed: false }), order);
    expect(verdict).toMatchObject({ ok: false, reason: "not-completed" });
  });

  it("refuses a payment for less than the order total", () => {
    // The attack the whole module exists for: the browser submits its own
    // amount, so a dollar must not settle a $249.50 order.
    const verdict = verifyArgentPayment(intent({ amountInMinorUnits: 100 }), order);
    expect(verdict).toMatchObject({ ok: false, reason: "wrong-amount" });
  });

  it("refuses a payment for more than the order total", () => {
    const verdict = verifyArgentPayment(intent({ amountInMinorUnits: expectedCents + 1 }), order);
    expect(verdict).toMatchObject({ ok: false, reason: "wrong-amount" });
  });

  it("refuses a real payment that belongs to a different order", () => {
    // Pay for a cheap order, then present that payment against an expensive
    // one. The reference is what catches it.
    const borrowed = intent({ reference: orderPaymentReference(8043) });
    const verdict = verifyArgentPayment(borrowed, order);
    expect(verdict).toMatchObject({ ok: false, reason: "wrong-order" });
  });

  it("refuses a payment in another currency", () => {
    const verdict = verifyArgentPayment(intent({ currencyCode: "EUR" }), order);
    expect(verdict).toMatchObject({ ok: false, reason: "wrong-currency" });
  });

  it("compares in minor units, so cents are not rounded away", () => {
    const odd = { id: 9001, total: "19.99" };
    const paid = intent({ amountInMinorUnits: 1999, reference: orderPaymentReference(9001) });
    expect(verifyArgentPayment(paid, odd).ok).toBe(true);
    expect(verifyArgentPayment({ ...paid, amountInMinorUnits: 1998 }, odd)).toMatchObject({
      reason: "wrong-amount",
    });
  });
});

describe("reading the API's answer", () => {
  // Shaped like the real Retrieve a Payment Intent response: a decimal
  // amount, currency as an object, payment as an id.
  const good = {
    id: "pymnt_abc123",
    status: "completed",
    amount: 249.5,
    currency: { id: "cur_1", code: "USD", name: "US Dollar", symbol: "$" },
    reference: orderPaymentReference(order.id),
    payment: "pay_abc123",
  };

  it("reads a flat response", () => {
    expect(parsePaymentIntent("pymnt_abc123", good).completed).toBe(true);
  });

  it("unwraps a response nested under data or payment_intent", () => {
    expect(parsePaymentIntent("pymnt_abc123", { data: good }).completed).toBe(true);
    expect(parsePaymentIntent("pymnt_abc123", { payment_intent: good }).completed).toBe(true);
  });

  it("reads the amount as a decimal figure, not as minor units", () => {
    // The single most expensive mistake available here: the API reports
    // "amount": 249.50, and reading that as minor units would settle a
    // $249.50 order against $2.50.
    expect(parsePaymentIntent("pymnt_abc123", good).amountInMinorUnits).toBe(24950);
    expect(parsePaymentIntent("x", { ...good, amount: 123 }).amountInMinorUnits).toBe(12300);
    expect(parsePaymentIntent("x", { ...good, amount: "249.50" }).amountInMinorUnits).toBe(24950);
    expect(parsePaymentIntent("x", { ...good, amount: 0.99 }).amountInMinorUnits).toBe(99);
  });

  it("reads the currency from the object a retrieve returns", () => {
    expect(parsePaymentIntent("x", good).currencyCode).toBe("USD");
    // …and from the plain string a create takes.
    const flat = { ...good, currency: undefined, currency_code: "usd" };
    expect(parsePaymentIntent("x", flat).currencyCode).toBe("USD");
  });

  it("keeps the payment id, which is what a refund is taken against", () => {
    expect(parsePaymentIntent("x", good).paymentId).toBe("pay_abc123");
    // The create response nests it instead.
    expect(parsePaymentIntent("x", { ...good, payment: { id: "pay_nested" } }).paymentId).toBe(
      "pay_nested"
    );
    expect(parsePaymentIntent("x", { ...good, payment: undefined }).paymentId).toBeNull();
  });

  it("treats completed, and only completed, as money captured", () => {
    expect(parsePaymentIntent("x", { ...good, status: "completed" }).completed).toBe(true);
    // Every other documented status, plus one nobody has seen. A scheduled
    // retry and an unfinished 3DS step are not payments to ship against.
    for (const status of [
      "pending",
      "requires_action",
      "in_progress",
      "draft",
      "failed",
      "weird",
    ]) {
      expect(parsePaymentIntent("x", { ...good, status }).completed).toBe(false);
    }
  });

  it("throws rather than guessing when the shape is unrecognisable", () => {
    // Their server API is not documented yet, so the response shape is the
    // most likely thing to be wrong. It must fail loudly rather than produce
    // an intent that happens to read as unpaid — or worse, as paid.
    expect(() => parsePaymentIntent("x", null)).toThrow();
    expect(() => parsePaymentIntent("x", "ok")).toThrow();
    expect(() => parsePaymentIntent("x", {})).toThrow();
    expect(() => parsePaymentIntent("x", { ...good, amount: undefined })).toThrow();
    expect(() => parsePaymentIntent("x", { ...good, reference: undefined })).toThrow();
    expect(() => parsePaymentIntent("x", { ...good, status: undefined })).toThrow();
  });

  it("does not accept a non-numeric amount", () => {
    expect(() => parsePaymentIntent("x", { ...good, amount: "lots" })).toThrow();
  });
});

describe("the statement descriptor fits what the API accepts", () => {
  it("accepts the one in use, which is exactly at the limit", () => {
    const config = buildArgentClientConfig(order, [
      { quantity: 1, productName: "x", variationLabel: null },
    ]);
    expect(config.descriptor.length).toBeLessThanOrEqual(ARGENT_DESCRIPTOR_MAX_LENGTH);
    expect(assertValidArgentDescriptor(config.descriptor)).toBe(config.descriptor);
  });

  it("rejects one character more", () => {
    // "BRIGHTER DAYS LABS" is 18 of an allowed 18. Any future edit to the
    // descriptor should fail here rather than at the processor.
    expect(() => assertValidArgentDescriptor("BRIGHTER DAYS LABSX")).toThrow(/19 characters/);
  });

  it("rejects punctuation the processor does not allow", () => {
    expect(() => assertValidArgentDescriptor("BRIGHTER-DAYS")).toThrow(/letters, numbers/);
  });
});

describe("what the processor is allowed to see", () => {
  const items = [
    { quantity: 2, productName: "BPC-157 10mg", variationLabel: "10mg" },
    { quantity: 1, productName: "NAD+ 1000mg", variationLabel: "1000mg" },
  ];

  it("sends the amount, the order reference and the company name — no catalog", () => {
    const config = buildArgentClientConfig(order, items);
    expect(config.amount).toBe(String(expectedCents));
    expect(config.currencyCode).toBe("USD");
    expect(config.descriptor).toBe("BRIGHTER DAYS LABS");
    expect(config.reference).toBe(orderPaymentReference(order.id));
  });

  it("carries no restricted term anywhere in the payload", () => {
    const config = buildArgentClientConfig(order, items);
    const { publicKey: _publicKey, ...describable } = config;
    for (const value of Object.values(describable)) {
      expect(findRestrictedTerms(String(value))).toEqual([]);
    }
    expect(JSON.stringify(describable)).not.toContain("BPC-157");
    expect(JSON.stringify(describable)).not.toContain("NAD+");
  });

  it("does not send products_purchased", () => {
    // PaymentJS renders that array in the hosted order summary, which would
    // put real compound names on the payment screen and in front of the
    // processor — the disclosure paymentDescriptor.ts exists to prevent.
    const config = buildArgentClientConfig(order, items);
    expect(JSON.stringify(config)).not.toContain("products_purchased");
    expect(config).not.toHaveProperty("metadata");
  });
});

describe("the integration fails closed", () => {
  it("never settles on the browser's word alone", () => {
    // The confirm endpoint must take a payment intent id and read everything
    // else back from the API. If it ever starts trusting an amount or a status
    // from the request body, this is the test that should stop it.
    const routers = readSource("server/routers.ts");
    const start = routers.indexOf("argentConfirm:");
    expect(start).toBeGreaterThan(-1);
    const body = routers.slice(start, routers.indexOf("}),\n  }),", start));

    expect(body).toContain("fetchPaymentIntent");
    expect(body).toContain("verifyArgentPayment");
    // The input schema takes an id and an order, and nothing about money.
    const schema = body.slice(0, body.indexOf(".mutation("));
    expect(schema).not.toMatch(/amount/i);
    expect(schema).not.toMatch(/status/i);
  });
});

describe("the cutover cannot break a shop with no Argent credentials", () => {
  const routers = readSource("server/routers.ts");

  it("falls back to Stripe rather than to nothing", () => {
    // Deploying this before the ArgentPlatforms variables are set must not
    // stop the shop taking money. The order of these branches is the whole
    // safety property: Argent when it can be verified, Stripe otherwise.
    const start = routers.indexOf("method: publicProcedure.query");
    expect(start).toBeGreaterThan(-1);
    const body = routers.slice(start, routers.indexOf("}),", start));

    expect(body.indexOf("isArgentServerConfigured")).toBeLessThan(
      body.indexOf("isStripeConfigured")
    );
    expect(body).toContain('"none"');
  });

  it("requires the server half, not just the public key", () => {
    // A public key alone would render a working card form the server could
    // never confirm a payment from.
    const start = routers.indexOf("method: publicProcedure.query");
    const body = routers.slice(start, routers.indexOf("}),", start));
    expect(body).toContain("isArgentClientConfigured()");
    expect(body).toContain("isArgentServerConfigured()");
  });
});
