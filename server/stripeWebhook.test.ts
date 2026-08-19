import { describe, expect, it } from "vitest";
import {
  HANDLED_EVENT_TYPES,
  canExpiredSessionCancelOrder,
  isFullyRefunded,
  readOrderIdFromMetadata,
  type OrderPaymentState,
} from "./stripeWebhook";

/**
 * The handlers themselves talk to the database; what is worth pinning down is
 * the decision each one makes before it writes. These are the cases where
 * getting it wrong cancels a real order or reports a refund that did not fully
 * happen.
 */

const SESSION_ID = "cs_test_abc123";

function order(overrides: Partial<OrderPaymentState> = {}): OrderPaymentState {
  return {
    status: "pending",
    paymentStatus: "pending",
    paymentReference: SESSION_ID,
    ...overrides,
  };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

describe("readOrderIdFromMetadata", () => {
  it("reads the order id we attached", () => {
    expect(readOrderIdFromMetadata({ orderId: "1042", itemCount: "6" })).toBe(1042);
  });

  it("rejects missing, empty and non-numeric metadata", () => {
    expect(readOrderIdFromMetadata(null)).toBeNull();
    expect(readOrderIdFromMetadata({})).toBeNull();
    expect(readOrderIdFromMetadata({ orderId: "" })).toBeNull();
    expect(readOrderIdFromMetadata({ orderId: "not-a-number" })).toBeNull();
  });

  it("rejects ids that are not positive integers", () => {
    expect(readOrderIdFromMetadata({ orderId: "0" })).toBeNull();
    expect(readOrderIdFromMetadata({ orderId: "-3" })).toBeNull();
    expect(readOrderIdFromMetadata({ orderId: "12.5" })).toBeNull();
  });
});

// ─── Expired sessions ────────────────────────────────────────────────────────

describe("canExpiredSessionCancelOrder", () => {
  it("cancels an untouched order still waiting on this session", () => {
    expect(canExpiredSessionCancelOrder(order(), SESSION_ID)).toBe(true);
  });

  it("never cancels an order that was paid", () => {
    // markOrderPaid swaps paymentReference for the payment intent, so a paid
    // order fails on both counts — assert the payment status alone is enough.
    expect(canExpiredSessionCancelOrder(order({ paymentStatus: "paid" }), SESSION_ID)).toBe(false);
  });

  it("never cancels an order refunded or already failed", () => {
    expect(canExpiredSessionCancelOrder(order({ paymentStatus: "refunded" }), SESSION_ID)).toBe(
      false
    );
    expect(canExpiredSessionCancelOrder(order({ paymentStatus: "failed" }), SESSION_ID)).toBe(
      false
    );
  });

  it("does not overrule an admin who already moved the order on", () => {
    for (const status of ["confirmed", "processing", "shipped", "delivered"] as const) {
      expect(canExpiredSessionCancelOrder(order({ status }), SESSION_ID)).toBe(false);
    }
  });

  it("ignores a superseded session expiring later", () => {
    // The order moved on to a newer session; this stale one must not cancel it.
    const waitingOnNewerSession = order({ paymentReference: "cs_test_newer" });
    expect(canExpiredSessionCancelOrder(waitingOnNewerSession, SESSION_ID)).toBe(false);
  });

  it("ignores an order with no session recorded at all", () => {
    expect(canExpiredSessionCancelOrder(order({ paymentReference: null }), SESSION_ID)).toBe(
      false
    );
  });
});

// ─── Refunds ─────────────────────────────────────────────────────────────────

describe("isFullyRefunded", () => {
  it("recognises a full refund", () => {
    expect(isFullyRefunded({ amount: 24950, amount_refunded: 24950 })).toBe(true);
  });

  it("does not treat a partial refund as refunded", () => {
    expect(isFullyRefunded({ amount: 24950, amount_refunded: 1000 })).toBe(false);
  });

  it("does not treat an unrefunded charge as refunded", () => {
    expect(isFullyRefunded({ amount: 24950, amount_refunded: 0 })).toBe(false);
  });

  it("handles an over-refund defensively", () => {
    expect(isFullyRefunded({ amount: 24950, amount_refunded: 25000 })).toBe(true);
  });

  it("does not call a zero-amount charge refunded", () => {
    expect(isFullyRefunded({ amount: 0, amount_refunded: 0 })).toBe(false);
  });
});

// ─── Subscription list ───────────────────────────────────────────────────────

describe("HANDLED_EVENT_TYPES", () => {
  it("lists exactly the events the switch acts on", () => {
    expect([...HANDLED_EVENT_TYPES]).toEqual([
      "checkout.session.completed",
      "checkout.session.expired",
      "payment_intent.payment_failed",
      "charge.refunded",
    ]);
  });
});
