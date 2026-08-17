import express, { type Express } from "express";
import type Stripe from "stripe";
import { getOrderById, markOrderPaid } from "./db";
import { constructWebhookEvent } from "./stripe";
import { notifyOwner } from "./_core/notification";

export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";

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
        if (event.type === "checkout.session.completed") {
          await handleCheckoutSessionCompleted(event.data.object);
        }
      } catch (err) {
        // 5xx tells Stripe to retry. markOrderPaid is idempotent, so a retry
        // after a partial failure is safe.
        console.error(`Stripe webhook handler failed for ${event.type}:`, err);
        res.status(500).send("Handler error");
        return;
      }

      res.json({ received: true });
    }
  );
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Some payment methods complete the session but settle later.
  if (session.payment_status !== "paid") return;

  const orderId = Number(session.metadata?.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
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

  try {
    await notifyOwner({
      title: `Payment received — Order #${orderId}`,
      content: `Stripe payment confirmed for order #${orderId}.\n\nAmount: $${Number(order.total).toFixed(2)}\nReference: ${paymentReference}`,
    });
  } catch (e) {
    console.warn("Failed to send payment notification", e);
  }
}
