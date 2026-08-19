import { addUserPoints, getOrderById, markReferralEligible } from "./db";

/**
 * What an order earns once it has actually been paid for.
 *
 * Both routes into "paid" go through here — the Stripe webhook and an admin
 * settling an order by hand — so a customer who paid by transfer earns the same
 * points as one who paid by card, and their affiliate earns the same commission.
 */

/** Loyalty points awarded per order: one per whole dollar of the order total. */
export function computePointsForOrder(total: string | number): number {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

export interface SettledRewards {
  pointsAwarded: number;
  referralMadeEligible: boolean;
}

/**
 * Awards points and releases the affiliate commission for a paid order.
 *
 * Safe to call more than once only because its callers gate on a transition:
 * markOrderPaid reports whether it actually moved the order, and
 * markReferralEligible only promotes a still-pending referral. Calling this for
 * an order that was already paid would award its points a second time, so it
 * must stay behind that gate rather than being called defensively.
 */
export async function settleOrderRewards(orderId: number): Promise<SettledRewards> {
  const order = await getOrderById(orderId);
  if (!order) return { pointsAwarded: 0, referralMadeEligible: false };

  let pointsAwarded = 0;
  // Guests have no account to credit; their order still counts for the
  // affiliate who referred it.
  if (order.userId !== null) {
    pointsAwarded = computePointsForOrder(order.total);
    if (pointsAwarded > 0) {
      await addUserPoints(order.userId, pointsAwarded);
    }
  }

  const referralMadeEligible = await markReferralEligible(orderId);

  return { pointsAwarded, referralMadeEligible };
}
