import { beforeEach, describe, expect, it } from "vitest";
import {
  QUOTE_TTL_MS,
  cartFingerprint,
  clearQuotes,
  quoteCount,
  resolveQuotedRate,
  storeQuote,
} from "./shippingQuotes";
import type { ShippingRate } from "./ups";

/**
 * This is the seam that keeps the browser from naming its own shipping price.
 * Every case below is a way somebody could try to pay less than they were
 * quoted, or a way an honest shopper could drift out of a quote's scope.
 */

const rate = (serviceCode: string, amount: number): ShippingRate => ({
  serviceCode,
  serviceName: `Service ${serviceCode}`,
  amount,
  carrierAmount: amount,
  currency: "USD",
  transitDays: 2,
});

const RATES = [rate("03", 11.01), rate("02", 17.43)];
const CART = [{ productId: 1, variationId: undefined, quantity: 2 }];
const ZIP = "10118";

beforeEach(() => clearQuotes());

// ─── Fingerprint ─────────────────────────────────────────────────────────────

describe("cartFingerprint", () => {
  it("is stable for the same cart and destination", () => {
    expect(cartFingerprint(CART, ZIP)).toBe(cartFingerprint(CART, ZIP));
  });

  it("ignores the order lines were added in", () => {
    // Reordering a basket is not a change worth making somebody re-quote for.
    const a = [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 3 },
    ];
    const b = [
      { productId: 2, quantity: 3 },
      { productId: 1, quantity: 1 },
    ];
    expect(cartFingerprint(a, ZIP)).toBe(cartFingerprint(b, ZIP));
  });

  it("changes when a quantity changes", () => {
    // The parcel gets heavier; the old price no longer describes it.
    expect(cartFingerprint([{ productId: 1, quantity: 2 }], ZIP)).not.toBe(
      cartFingerprint([{ productId: 1, quantity: 3 }], ZIP)
    );
  });

  it("changes when a product or variation changes", () => {
    expect(cartFingerprint([{ productId: 1, quantity: 1 }], ZIP)).not.toBe(
      cartFingerprint([{ productId: 2, quantity: 1 }], ZIP)
    );
    expect(cartFingerprint([{ productId: 1, variationId: 5, quantity: 1 }], ZIP)).not.toBe(
      cartFingerprint([{ productId: 1, variationId: 6, quantity: 1 }], ZIP)
    );
  });

  it("changes when the destination changes", () => {
    // Rates are a function of distance; a quote for one postcode is not a
    // quote for another.
    expect(cartFingerprint(CART, "10118")).not.toBe(cartFingerprint(CART, "90210"));
  });
});

// ─── Resolution ──────────────────────────────────────────────────────────────

describe("resolveQuotedRate", () => {
  it("returns the price this server quoted for the chosen service", () => {
    const id = storeQuote(RATES, cartFingerprint(CART, ZIP));
    const found = resolveQuotedRate(id, "03", cartFingerprint(CART, ZIP));
    expect(found.ok).toBe(true);
    if (found.ok) expect(found.rate.amount).toBe(11.01);
  });

  it("refuses a quote id it never issued", () => {
    const found = resolveQuotedRate("made-up-id", "03", cartFingerprint(CART, ZIP));
    expect(found).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses when the cart changed after quoting", () => {
    // The heart of it: quote a light parcel, add ten more vials, then try to
    // pay the light parcel's shipping.
    const id = storeQuote(RATES, cartFingerprint(CART, ZIP));
    const heavier = cartFingerprint([{ productId: 1, quantity: 12 }], ZIP);
    expect(resolveQuotedRate(id, "03", heavier)).toEqual({ ok: false, reason: "cart_changed" });
  });

  it("refuses when the destination changed after quoting", () => {
    const id = storeQuote(RATES, cartFingerprint(CART, ZIP));
    const elsewhere = cartFingerprint(CART, "99501");
    expect(resolveQuotedRate(id, "03", elsewhere)).toEqual({ ok: false, reason: "cart_changed" });
  });

  it("refuses a service that was not among the offers", () => {
    // Nothing stops a client naming Next Day Air; it just has no price here.
    const id = storeQuote(RATES, cartFingerprint(CART, ZIP));
    expect(resolveQuotedRate(id, "01", cartFingerprint(CART, ZIP))).toEqual({
      ok: false,
      reason: "service_not_quoted",
    });
  });

  it("never returns a price the caller supplied", () => {
    // There is no parameter for one. Stated as a test so the shape cannot
    // quietly grow one later.
    const id = storeQuote([rate("03", 11.01)], cartFingerprint(CART, ZIP));
    const found = resolveQuotedRate(id, "03", cartFingerprint(CART, ZIP));
    if (found.ok) expect(found.rate.amount).toBe(11.01);
    expect(resolveQuotedRate.length).toBe(3);
  });
});

// ─── Lifetime ────────────────────────────────────────────────────────────────

describe("quote lifetime", () => {
  it("keeps a quote for a sensible stretch of a checkout", () => {
    expect(QUOTE_TTL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
    expect(QUOTE_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("issues a distinct id per quote", () => {
    const a = storeQuote(RATES, "hash-a");
    const b = storeQuote(RATES, "hash-b");
    expect(a).not.toBe(b);
    expect(quoteCount()).toBe(2);
  });

  it("keeps quotes independent of one another", () => {
    const a = storeQuote([rate("03", 11.01)], "hash-a");
    const b = storeQuote([rate("03", 25.0)], "hash-b");
    const foundA = resolveQuotedRate(a, "03", "hash-a");
    const foundB = resolveQuotedRate(b, "03", "hash-b");
    if (foundA.ok) expect(foundA.rate.amount).toBe(11.01);
    if (foundB.ok) expect(foundB.rate.amount).toBe(25.0);
  });

  it("does not let one quote's id unlock another's cart", () => {
    const a = storeQuote([rate("03", 11.01)], "hash-a");
    expect(resolveQuotedRate(a, "03", "hash-b").ok).toBe(false);
  });

  it("stays bounded under repeated quoting", () => {
    // A crawler quoting in a loop must not grow this without limit.
    for (let i = 0; i < 700; i++) storeQuote(RATES, `hash-${i}`);
    expect(quoteCount()).toBeLessThanOrEqual(500);
  });
});
