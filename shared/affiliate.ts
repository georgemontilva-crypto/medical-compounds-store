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

/**
 * Whether the affiliate program is visible to shoppers.
 *
 * Off while Stripe is not live: without the payment webhook a commission can
 * never move from "pending" to "eligible", so the program would promise a
 * payout that cannot arrive. The backend stays fully wired and the admin views
 * stay reachable — this only hides the customer-facing surfaces.
 *
 * ?ref= capture keeps running while this is off, so attribution from links
 * already shared is not lost when it is switched back on.
 */
export const AFFILIATE_UI_ENABLED = false;
