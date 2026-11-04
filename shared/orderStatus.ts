/**
 * One vocabulary for "where is this order", shared by the admin and the buyer.
 *
 * An order carries two independent states — whether it has been paid for, and
 * how far along fulfillment is — and both of them spell their waiting state
 * "pending". Rendered as two identical badges side by side, the admin table
 * asked the reader to remember which column meant which, and the question it
 * produced was the obvious one: "was this order paid?". The answer was in the
 * next column over, in the same colour, saying the same word.
 *
 * So the words are set here, once, and they say what they mean. Payment and
 * fulfillment never share a label, and they never share a tone: an unpaid
 * order reads as amber in the payment column and plain grey in the other,
 * because fulfillment of an order nobody has paid for has not begun and should
 * not look like it is underway.
 */

/** How a badge should read. The client maps these onto its palette. */
export type StatusTone = "positive" | "attention" | "critical" | "info" | "neutral";

export type PaymentView = {
  /** Stable key for tests and conditionals; never shown to anyone. */
  key: "paid" | "awaiting" | "failed" | "refunded" | "unpaid-closed";
  /** For the shop's own screens, where "Paid" is the fact that matters. */
  adminLabel: string;
  /** For the buyer, who is being told something about their own money. */
  customerLabel: string;
  tone: StatusTone;
  /** Whether this order can still be paid — the Complete Payment button. */
  payable: boolean;
};

export type FulfillmentView = {
  label: string;
  tone: StatusTone;
};

type OrderStates = { paymentStatus: string; status: string };

/**
 * What the payment column should say.
 *
 * Note the two different ways of being unpaid. An order still open is
 * "Awaiting payment" and can be paid; one whose checkout expired is closed,
 * and calling that "pending" invites someone to go chasing a sale that the
 * system already gave up on.
 */
export function paymentView(order: OrderStates): PaymentView {
  if (order.paymentStatus === "paid") {
    return {
      key: "paid",
      adminLabel: "Paid",
      customerLabel: "Payment received",
      tone: "positive",
      payable: false,
    };
  }

  if (order.paymentStatus === "refunded") {
    return {
      key: "refunded",
      adminLabel: "Refunded",
      customerLabel: "Refunded",
      tone: "neutral",
      payable: false,
    };
  }

  if (order.status === "cancelled") {
    return {
      key: "unpaid-closed",
      adminLabel: "Unpaid · closed",
      customerLabel: "Not paid",
      tone: "neutral",
      payable: false,
    };
  }

  if (order.paymentStatus === "failed") {
    // The card was declined, which is not the end of it: the order is still
    // open and another card will settle it.
    return {
      key: "failed",
      adminLabel: "Payment failed",
      customerLabel: "Payment failed",
      tone: "critical",
      payable: true,
    };
  }

  return {
    key: "awaiting",
    adminLabel: "Awaiting payment",
    customerLabel: "Awaiting payment",
    tone: "attention",
    payable: true,
  };
}

/** Kept as a named export because three screens ask exactly this question. */
export function isAwaitingPayment(order: OrderStates): boolean {
  return paymentView(order).payable;
}

const FULFILLMENT_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Not started", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  processing: { label: "Packing", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "critical" },
};

/**
 * What the fulfillment column should say.
 *
 * An unpaid order is reported as on hold rather than as any stage of
 * fulfillment, however its status column happens to read. Nothing is picked,
 * packed or posted before the money arrives, and showing a fulfillment stage
 * there is how a parcel goes out against an order nobody paid for. "On hold"
 * rather than "Awaiting payment" so the two columns never read identically —
 * the payment column is where the reason belongs.
 */
export function fulfillmentView(order: OrderStates): FulfillmentView {
  const payment = paymentView(order);
  if (payment.payable) {
    return { label: "On hold", tone: "neutral" };
  }
  return FULFILLMENT_LABELS[order.status] ?? { label: order.status, tone: "neutral" };
}
