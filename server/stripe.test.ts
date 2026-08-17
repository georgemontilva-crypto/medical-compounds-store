import { describe, expect, it } from "vitest";
import { buildCheckoutSessionParams } from "./stripe";
import { STATEMENT_DESCRIPTOR } from "./paymentDescriptor";

/**
 * The point of these tests: prove that the object actually handed to Stripe —
 * not an intermediate payload — carries no catalog text. paymentDescriptor.test.ts
 * covers the sanitizer itself; this covers the integration that uses it.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

const order = {
  id: 1042,
  total: "249.50",
  shippingEmail: "researcher@example.com",
};

/** Names shaped like the real catalog. */
const items = [
  { productName: "BPC-157 10mg", variationLabel: "10mg", quantity: 2 },
  { productName: "TB-500 5mg", variationLabel: "5mg", quantity: 1 },
  { productName: "Semaglutide 3mg", variationLabel: null, quantity: 3 },
];

const urls = {
  successUrl: "https://www.brighterdayslabs.com/checkout?payment=success&orderId=1042",
  cancelUrl: "https://www.brighterdayslabs.com/checkout?payment=cancelled&orderId=1042",
};

/** Every token a leak would most likely surface as. */
const FORBIDDEN_FRAGMENTS = [
  "BPC-157",
  "BPC",
  "TB-500",
  "Semaglutide",
  "10mg",
  "5mg",
  "3mg",
  "peptide",
  "research compound",
  "research chemical",
  "RUO",
  "sarm",
  "nootropic",
  "not for human consumption",
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildCheckoutSessionParams", () => {
  it("sends no catalog text anywhere in the Stripe params", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    const serialized = JSON.stringify(params).toLowerCase();

    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(serialized).not.toContain(fragment.toLowerCase());
    }
  });

  it("labels the line item with the generic order descriptor", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    const lineItems = params.line_items!;

    // One line for the whole order — never one per product.
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].price_data!.product_data!.name).toBe("Lab Supply Item — Order #1042");
  });

  it("charges the order total in cents", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    expect(params.line_items![0].price_data!.unit_amount).toBe(24950);
    expect(params.line_items![0].price_data!.currency).toBe("usd");
  });

  it("carries only the order id and item count as metadata", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    expect(params.metadata).toEqual({ orderId: "1042", itemCount: "6" });
  });

  it("uses the company statement descriptor, not the product", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    const intent = params.payment_intent_data!;
    expect(intent.statement_descriptor_suffix).toBe(STATEMENT_DESCRIPTOR);
  });

  it("sets the return URLs Stripe sends the shopper back to", () => {
    const params = buildCheckoutSessionParams(order, items, urls);
    expect(params.success_url).toBe(urls.successUrl);
    expect(params.cancel_url).toBe(urls.cancelUrl);
    expect(params.mode).toBe("payment");
  });

  it("throws rather than sending a leaked product name to Stripe", () => {
    // Simulates a future edit that reintroduces catalog text — the guard has to
    // fail loudly here, not quietly reach the merchant account.
    const leakyItems = [{ productName: "Lab Supply Item", variationLabel: null, quantity: 1 }];
    expect(() => buildCheckoutSessionParams(order, leakyItems, urls)).toThrow(
      /leaks product name/i
    );
  });

  it("does not block checkout over the shopper's own email address", () => {
    // A real customer writing from an address containing a restricted term must
    // still be able to pay — their address is not our catalog text.
    const shopper = { ...order, shippingEmail: "peptidefan@example.com" };
    expect(() => buildCheckoutSessionParams(shopper, items, urls)).not.toThrow();
    expect(buildCheckoutSessionParams(shopper, items, urls).customer_email).toBe(
      "peptidefan@example.com"
    );
  });

  it("omits customer_email when the order has none", () => {
    const guest = { ...order, shippingEmail: null };
    expect(buildCheckoutSessionParams(guest, items, urls).customer_email).toBeUndefined();
  });
});
