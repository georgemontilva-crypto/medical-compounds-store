import { describe, expect, it } from "vitest";
import { fulfillmentView, isAwaitingPayment, paymentView } from "@shared/orderStatus";

describe("paymentView", () => {
  it("reports a paid order as paid, whatever fulfillment is doing", () => {
    for (const status of ["pending", "processing", "shipped", "delivered"]) {
      const view = paymentView({ paymentStatus: "paid", status });
      expect(view.key).toBe("paid");
      expect(view.payable).toBe(false);
    }
  });

  it("separates an order still awaiting payment from one that was closed unpaid", () => {
    const open = paymentView({ paymentStatus: "pending", status: "pending" });
    const closed = paymentView({ paymentStatus: "pending", status: "cancelled" });

    expect(open.key).toBe("awaiting");
    expect(open.payable).toBe(true);
    expect(closed.key).toBe("unpaid-closed");
    expect(closed.payable).toBe(false);
  });

  it("keeps a declined order payable, because another card still settles it", () => {
    const view = paymentView({ paymentStatus: "failed", status: "pending" });
    expect(view.key).toBe("failed");
    expect(view.payable).toBe(true);
  });

  it("never offers to take payment on an order that is paid, refunded or cancelled", () => {
    expect(isAwaitingPayment({ paymentStatus: "paid", status: "shipped" })).toBe(false);
    expect(isAwaitingPayment({ paymentStatus: "refunded", status: "delivered" })).toBe(false);
    expect(isAwaitingPayment({ paymentStatus: "failed", status: "cancelled" })).toBe(false);
  });

  it("never gives payment and fulfillment the same label for the same order", () => {
    // The whole point: two badges reading "pending" in the same colour is what
    // made somebody ask whether the order had been paid.
    const cases = [
      { paymentStatus: "pending", status: "pending" },
      { paymentStatus: "paid", status: "pending" },
      { paymentStatus: "paid", status: "shipped" },
      { paymentStatus: "failed", status: "pending" },
      { paymentStatus: "refunded", status: "delivered" },
      { paymentStatus: "pending", status: "cancelled" },
    ];
    for (const order of cases) {
      expect(paymentView(order).adminLabel).not.toBe(fulfillmentView(order).label);
    }
  });
});

describe("fulfillmentView", () => {
  it("reports an unpaid order as on hold rather than as a fulfillment stage", () => {
    // Guards against a parcel going out against an order nobody paid for: an
    // admin who set the status to "processing" by hand on an unpaid order must
    // not see it read as ready to pack.
    expect(fulfillmentView({ paymentStatus: "pending", status: "processing" }).label).toBe(
      "On hold"
    );
    expect(fulfillmentView({ paymentStatus: "failed", status: "confirmed" }).label).toBe("On hold");
  });

  it("shows the real stage once the order is paid", () => {
    expect(fulfillmentView({ paymentStatus: "paid", status: "pending" }).label).toBe("Not started");
    expect(fulfillmentView({ paymentStatus: "paid", status: "shipped" }).label).toBe("Shipped");
    expect(fulfillmentView({ paymentStatus: "paid", status: "delivered" })).toEqual({
      label: "Delivered",
      tone: "positive",
    });
  });

  it("shows a cancelled order as cancelled rather than as unpaid", () => {
    expect(fulfillmentView({ paymentStatus: "pending", status: "cancelled" }).label).toBe(
      "Cancelled"
    );
  });

  it("falls back to the raw status rather than rendering nothing", () => {
    expect(fulfillmentView({ paymentStatus: "paid", status: "on_hold" }).label).toBe("on_hold");
  });
});
