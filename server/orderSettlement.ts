/**
 * What happens once a payment is confirmed, for any processor.
 *
 * This used to live inside the Stripe webhook handler. It was lifted out when
 * a second processor arrived, because the steps that follow a payment are not
 * Stripe's — they are the shop's: mark the order paid, settle affiliate
 * points, email the customer and the admin, notify the owner. A second copy
 * of that sequence is a second place for the two to drift, and the way that
 * drift shows up is an order that was paid for and never confirmed to anyone.
 *
 * The amount check lives here too, and that is the point of the module. It is
 * the same invariant whichever processor reports the payment: the money that
 * arrived must equal the money the order asks for, computed from the stored
 * total rather than from anything the payer sent. A processor that reports a
 * different figure is not settled, it is escalated.
 */

import { getOrderById, markOrderPaid } from "./db";
import { notifyOwner } from "./_core/notification";
import { sendAdminOrderNotificationEmail, sendOrderConfirmationEmail } from "./orderEmails";
import { settleOrderRewards } from "./rewards";

/** The processors allowed to settle an order, as stored on orders.paymentMethod. */
export type PaymentProcessor = "stripe" | "argent";

const PROCESSOR_LABELS: Record<PaymentProcessor, string> = {
  stripe: "Stripe",
  argent: "ArgentPlatforms",
};

export type SettlementResult =
  | { settled: true }
  /** The order exists and was already paid — a redelivered event, normally. */
  | { settled: false; reason: "already-settled"; detail: string }
  | { settled: false; reason: "unknown-order"; detail: string }
  /** Paid amount disagrees with the order total. Never settle; escalate. */
  | { settled: false; reason: "amount-mismatch"; detail: string };

/** The order total in minor units, which is what processors report. */
export function orderTotalInCents(total: string | number): number {
  return Math.round(Number(total) * 100);
}

/**
 * Settles an order against a confirmed payment.
 *
 * Every step after markOrderPaid sits behind `updated: true`, which is what
 * makes the whole function safe to call twice: a redelivered webhook, a
 * customer refreshing the confirmation page, two browser tabs finishing at
 * once. The second call finds the order already paid and does nothing — no
 * second email, no second award of points.
 */
export async function settlePaidOrder(input: {
  orderId: number;
  /** The processor's own id for the payment, stored for refunds and support. */
  paymentReference: string;
  /** What the processor says was actually charged, in minor units. */
  paidCents: number;
  processor: PaymentProcessor;
}): Promise<SettlementResult> {
  const { orderId, paymentReference, paidCents, processor } = input;
  const label = PROCESSOR_LABELS[processor];

  const order = await getOrderById(orderId);
  if (!order) {
    const detail = `${label} reported payment ${paymentReference} for unknown order ${orderId}`;
    console.warn(detail);
    return { settled: false, reason: "unknown-order", detail };
  }

  const expectedCents = orderTotalInCents(order.total);
  if (paidCents !== expectedCents) {
    // The amount was altered between the order being priced and the payment
    // being taken. Refuse, loudly, and leave the order for a human: retrying
    // cannot make this check pass, and settling it would ship goods against a
    // payment that does not cover them.
    const detail =
      `${label} payment ${paymentReference} settled ${paidCents} minor units but ` +
      `order ${orderId} totals ${expectedCents} — refusing to mark it paid`;
    console.error(detail);
    try {
      await notifyOwner({
        title: `Payment amount mismatch — Order #${orderId}`,
        content:
          `${label} reported a payment that does not match the order total.\n\n` +
          `Order: #${orderId}\nExpected: ${expectedCents} minor units\n` +
          `Reported: ${paidCents} minor units\nReference: ${paymentReference}\n\n` +
          `The order has NOT been marked paid. Check it before fulfilling.`,
      });
    } catch (e) {
      console.warn("Failed to send amount-mismatch notification", e);
    }
    return { settled: false, reason: "amount-mismatch", detail };
  }

  const result = await markOrderPaid(orderId, paymentReference, processor);
  if (!result.updated) {
    const detail = `${label}: order ${orderId} not updated (${result.reason})`;
    console.log(detail);
    return { settled: false, reason: "already-settled", detail };
  }

  console.log(`${label}: order ${orderId} marked paid (${paymentReference})`);

  const rewards = await settleOrderRewards(orderId);
  if (rewards.pointsAwarded > 0 || rewards.referralMadeEligible) {
    console.log(
      `${label}: order ${orderId} rewards — ${rewards.pointsAwarded} points, ` +
        `referral eligible: ${rewards.referralMadeEligible}`
    );
  }

  // Settled together rather than awaited in sequence: neither should delay the
  // other, and a failure in one must not stop the other from going out.
  const [confirmation, adminNotice] = await Promise.allSettled([
    sendOrderConfirmationEmail(orderId),
    sendAdminOrderNotificationEmail(orderId),
  ]);
  if (confirmation.status === "rejected") {
    console.warn(`${label}: confirmation email threw for order ${orderId}`, confirmation.reason);
  }
  if (adminNotice.status === "rejected") {
    console.warn(`${label}: admin email threw for order ${orderId}`, adminNotice.reason);
  }

  try {
    await notifyOwner({
      title: `Payment received — Order #${orderId}`,
      content:
        `${label} payment confirmed for order #${orderId}.\n\n` +
        `Amount: $${Number(order.total).toFixed(2)}\nReference: ${paymentReference}`,
    });
  } catch (e) {
    console.warn("Failed to send payment notification", e);
  }

  return { settled: true };
}
