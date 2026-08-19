/**
 * Affiliate program constants shared by the client and the server.
 *
 * The percentages and thresholds live here so the figures the FAQ promises a
 * shopper are literally the ones the server applies and pays out.
 */

/** Discount the buyer gets for using someone's referral code. */
export const REFERRAL_DISCOUNT_PERCENT = 10;

/** Commission the affiliate earns, as a percentage of the order subtotal. */
export const REFERRAL_COMMISSION_PERCENT = 10;

/** Minimum eligible balance before a payout can be requested. */
export const MIN_PAYOUT_AMOUNT = 25;

/** How long a captured ?ref= code stays attributed to a visitor. */
export const REFERRAL_ATTRIBUTION_DAYS = 30;
