import express, { type Express } from "express";
import type Stripe from "stripe";
import type { Order } from "../drizzle/schema";
import {
  cancelExpiredOrder,
  getOrderById,
  getOrderByPaymentReference,
  markOrderPaid,
  markOrderPaymentFailed,
  markOrderRefunded,
} from "./db";
import { constructWebhookEvent } from "./stripe";
import { settleOrderRewards } from "./rewards";
import {
  sendAdminAlertEmail,
  sendAdminOrderNotificationEmail,
  sendOrderConfirmationEmail,
} from "./orderEmails";
import { notifyOwner } from "./_core/notification";

export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";

/**
 * Events this endpoint acts on. Subscribe exactly these in the Stripe
 * Dashboard — anything else is verified, acknowledged and ignored.
 */
export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "charge.refunded",
] as const;

/**
 * Stripe webhook receiver.
 *
 * Must be registered *before* express.json(). Signature verification hashes the
 * exact bytes Stripe signed, and a parsed-then-reserialized body is not
 * byte-identical — with the JSON parser in front, every event would fail
 * verification.
 */
export function registerStripeWebhook(app: Express) {
  app.post(
    STRIPE_WEBHOOK_PATH,
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        res.status(400).send("Missing stripe-signature header");
        return;
      }

      let event: Stripe.Event;
      try {
        event = constructWebhookEvent(req.body as Buffer, signature);
      } catch (err) {
        // Unsigned or misconfigured. Never fall through to "trust it anyway" —
        // this endpoint can mark orders paid.
        console.warn("Stripe webhook signature verification failed:", err);
        res.status(400).send("Invalid signature");
        return;
      }

      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutSessionCompleted(event.data.object);
            break;
          case "checkout.session.expired":
            await handleCheckoutSessionExpired(event.data.object);
            break;
          case "payment_intent.payment_failed":
            await handlePaymentIntentFailed(event.data.object);
            break;
          case "charge.refunded":
            await handleChargeRefunded(event.data.object);
            break;
          default:
            break;
        }
      } catch (err) {
        // 5xx tells Stripe to retry. Every handler below is idempotent, so a
        // retry after a partial failure is safe.
        console.error(`Stripe webhook handler failed for ${event.type}:`, err);
        res.status(500).send("Handler error");
        return;
      }

      res.json({ received: true });
    }
  );
}

// ─── Pure decision helpers ───────────────────────────────────────────────────

export type OrderPaymentState = Pick<Order, "status" | "paymentStatus" | "paymentReference">;

/** Reads the order id we attached to a session or payment intent. */
export function readOrderIdFromMetadata(metadata: Stripe.Metadata | null): number | null {
  const orderId = Number(metadata?.orderId);
  return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
}

/**
 * Whether an expired checkout session should cancel its order.
 *
 * Three things must hold, and each rules out a real way this goes wrong:
 *  - the order is still unpaid, so a settled order is never cancelled;
 *  - its fulfillment status is untouched, so an admin who already moved it on
 *    does not get overruled by a 24-hour-old session timing out;
 *  - the expiring session is the one the order is actually waiting on. A
 *    superseded session expiring must not cancel an order that has since been
 *    paid through a newer one — markOrderPaid replaces paymentReference with
 *    the payment intent, so a paid order can never match a session id here.
 */
export function canExpiredSessionCancelOrder(
  order: OrderPaymentState,
  sessionId: string
): boolean {
  return (
    order.paymentStatus === "pending" &&
    order.status === "pending" &&
    order.paymentReference === sessionId
  );
}

/**
 * Whether a refunded charge covers the whole amount.
 *
 * orders.paymentStatus has no partial state, so a partial refund is reported
 * rather than recorded — claiming "refunded" for a $10 refund on a $250 order
 * would be worse than leaving it to a human.
 */
export function isFullyRefunded(
  charge: Pick<Stripe.Charge, "amount" | "amount_refunded">
): boolean {
  return charge.amount > 0 && charge.amount_refunded >= charge.amount;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Some payment methods complete the session but settle later.
  if (session.payment_status !== "paid") return;

  const orderId = readOrderIdFromMetadata(session.metadata);
  if (orderId === null) {
    console.warn(`Stripe session ${session.id} has no usable orderId metadata`);
    return;
  }

  const order = await getOrderById(orderId);
  if (!order) {
    console.warn(`Stripe session ${session.id} references unknown order ${orderId}`);
    return;
  }

  // The session was created from orders.total, so a mismatch means the amount
  // was altered somewhere between creation and payment. Refuse to settle it and
  // leave the order for a human, rather than retrying a check that cannot pass.
  const expectedCents = Math.round(Number(order.total) * 100);
  if (session.amount_total !== expectedCents) {
    console.error(
      `Stripe session ${session.id} paid ${session.amount_total} but order ${orderId} totals ${expectedCents} — not marking paid`
    );
    return;
  }

  const paymentReference =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? session.id);

  const result = await markOrderPaid(orderId, paymentReference);
  if (!result.updated) {
    // Stripe redelivers events; an already-paid order is the expected outcome.
    console.log(`Stripe webhook: order ${orderId} not updated (${result.reason})`);
    return;
  }

  console.log(`Stripe webhook: order ${orderId} marked paid (${paymentReference})`);

  // Behind markOrderPaid returning updated:true, so a redelivered event cannot
  // award the same points twice.
  const rewards = await settleOrderRewards(orderId);
  if (rewards.pointsAwarded > 0 || rewards.referralMadeEligible) {
    console.log(
      `Stripe webhook: order ${orderId} rewards — ${rewards.pointsAwarded} points, referral eligible: ${rewards.referralMadeEligible}`
    );
  }

  // Both sit behind markOrderPaid returning updated:true, so a redelivered
  // event cannot send a second copy of either. Settled together rather than
  // awaited in sequence: neither should delay the other, and a failure in one
  // must not stop the other from going out.
  const [confirmation, adminNotice] = await Promise.allSettled([
    sendOrderConfirmationEmail(orderId),
    sendAdminOrderNotificationEmail(orderId),
  ]);
  if (confirmation.status === "rejected") {
    console.warn(`Stripe webhook: confirmation email threw for order ${orderId}`, confirmation.reason);
  }
  if (adminNotice.status === "rejected") {
    console.warn(`Stripe webhook: admin email threw for order ${orderId}`, adminNotice.reason);
  }

  try {
    await notifyOwner({
      title: `Payment received — Order #${orderId}`,
      content: `Stripe payment confirmed for order #${orderId}.\n\nAmount: $${Number(order.total).toFixed(2)}\nReference: ${paymentReference}`,
    });
  } catch (e) {
    console.warn("Failed to send payment notification", e);
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const orderId = readOrderIdFromMetadata(session.metadata);
  if (orderId === null) {
    console.warn(`Expired Stripe session ${session.id} has no usable orderId metadata`);
    return;
  }

  const order = await getOrderById(orderId);
  if (!order) {
    console.warn(`Expired Stripe session ${session.id} references unknown order ${orderId}`);
    return;
  }

  if (!canExpiredSessionCancelOrder(order, session.id)) {
    console.log(
      `Stripe webhook: session ${session.id} expired but order ${orderId} left alone (status=${order.status}, paymentStatus=${order.paymentStatus})`
    );
    return;
  }

  const result = await cancelExpiredOrder(orderId);
  console.log(
    result.updated
      ? `Stripe webhook: order ${orderId} cancelled — checkout session expired unpaid`
      : `Stripe webhook: order ${orderId} not cancelled (${result.reason})`
  );

  // An abandoned checkout is a sale that nearly happened, and the buyer's
  // email is on the order — worth knowing about rather than only appearing as
  // a gap in the numbers.
  if (!result.updated) return;

  await sendAdminAlertEmail({
    subject: `Checkout abandoned — Order #${orderId}`,
    heading: `Order #${orderId} was cancelled`,
    intro: "The checkout session expired without payment, so the order was closed.",
    lines: [
      ["Order", `#${orderId}`],
      ["Amount", `$${Number(order.total).toFixed(2)}`],
      ["Buyer", order.shippingEmail ?? "—"],
    ],
  }).catch((e) => console.warn("Failed to send abandoned-checkout alert", e));
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const orderId = readOrderIdFromMetadata(intent.metadata);
  if (orderId === null) {
    console.warn(`Failed payment intent ${intent.id} has no usable orderId metadata`);
    return;
  }

  // A decline does not end the Checkout session — the shopper can retry with
  // another card. markOrderPaymentFailed only writes over a pending order, so a
  // later success still settles it.
  const result = await markOrderPaymentFailed(orderId);
  const reason = intent.last_payment_error?.message ?? "unknown reason";
  console.log(
    result.updated
      ? `Stripe webhook: order ${orderId} payment failed (${reason})`
      : `Stripe webhook: order ${orderId} not marked failed (${result.reason})`
  );

  // Only on the transition. A shopper retrying a declined card produces one of
  // these per attempt, and three emails about one order is noise that gets the
  // alerts filtered.
  if (!result.updated) return;

  await sendAdminAlertEmail({
    subject: `Payment failed — Order #${orderId}`,
    heading: `Payment failed on order #${orderId}`,
    intro: "The card was declined. The order is still open and can be paid.",
    lines: [
      ["Order", `#${orderId}`],
      ["Reason", reason],
      ["Amount", `$${(intent.amount / 100).toFixed(2)}`],
    ],
  }).catch((e) => console.warn("Failed to send payment-failed alert", e));
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!isFullyRefunded(charge)) {
    console.warn(
      `Stripe charge ${charge.id} partially refunded (${charge.amount_refunded} of ${charge.amount}) — orders.paymentStatus has no partial state, leaving it for a human`
    );
    return;
  }

  const order = await findOrderForCharge(charge);
  if (!order) {
    console.warn(`Refunded Stripe charge ${charge.id} could not be matched to an order`);
    return;
  }

  const result = await markOrderRefunded(order.id);
  if (!result.updated) {
    console.log(`Stripe webhook: order ${order.id} not marked refunded (${result.reason})`);
    return;
  }

  console.log(`Stripe webhook: order ${order.id} marked refunded (charge ${charge.id})`);

  await sendAdminAlertEmail({
    subject: `Refund issued — Order #${order.id}`,
    heading: `Refund issued on order #${order.id}`,
    intro: "Stripe confirmed a full refund. Nothing needs shipping for this order.",
    lines: [
      ["Order", `#${order.id}`],
      ["Refunded", `$${(charge.amount_refunded / 100).toFixed(2)}`],
      ["Charge", charge.id],
    ],
  }).catch((e) => console.warn("Failed to send refund alert", e));

  try {
    await notifyOwner({
      title: `Refund issued — Order #${order.id}`,
      content: `Stripe refund confirmed for order #${order.id}.\n\nAmount refunded: $${(charge.amount_refunded / 100).toFixed(2)}\nCharge: ${charge.id}`,
    });
  } catch (e) {
    console.warn("Failed to send refund notification", e);
  }
}

/**
 * A refund arrives as a charge, not an order. The payment intent is what
 * markOrderPaid stored on the order, so that is the primary key back; the
 * metadata copy is a fallback for charges created outside our checkout flow.
 */
async function findOrderForCharge(charge: Stripe.Charge) {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (intentId) {
    const byReference = await getOrderByPaymentReference(intentId);
    if (byReference) return byReference;
  }

  const orderId = readOrderIdFromMetadata(charge.metadata);
  return orderId === null ? undefined : await getOrderById(orderId);
}
