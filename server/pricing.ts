import { TRPCError } from "@trpc/server";
import {
  DEFAULT_BULK_DISCOUNT_TIERS,
  applyBulkDiscount,
  buildVariationLabel,
  getBulkDiscountPercent,
  type BulkDiscountTiers,
} from "@shared/pricing";
import {
  getAffiliateCodeByCode,
  getCouponByCode,
  getProductById,
  getSiteSetting,
  getUserById,
  getVariationById,
  getWelcomeRedemption,
} from "./db";
import {
  computeReferralCommission,
  computeReferralDiscount,
  isSelfReferral,
  normalizeReferralCode,
} from "./affiliate";

/**
 * Authoritative order pricing.
 *
 * The checkout request tells us *what* the shopper wants (product, variation,
 * quantity) and nothing about what it costs. Every price, discount and total is
 * re-derived here from the database, because as soon as a payment processor
 * charges `orders.total` automatically, a client-supplied price is a client-
 * supplied invoice.
 */

// ─── Bulk discount tiers ─────────────────────────────────────────────────────

export async function getBulkDiscountTiers(): Promise<BulkDiscountTiers> {
  const [t2, t5] = await Promise.all([
    getSiteSetting("bulk_discount_tier_2"),
    getSiteSetting("bulk_discount_tier_5"),
  ]);
  return {
    tier2Percent: t2 ? Number(t2.value) : DEFAULT_BULK_DISCOUNT_TIERS.tier2Percent,
    tier5Percent: t5 ? Number(t5.value) : DEFAULT_BULK_DISCOUNT_TIERS.tier5Percent,
  };
}

// ─── Line pricing ────────────────────────────────────────────────────────────

export interface RequestedLine {
  productId: number;
  variationId?: number;
  quantity: number;
}

export interface PricedLine {
  productId: number;
  variationId?: number;
  productName: string;
  variationLabel?: string;
  quantity: number;
  /** Per-unit price after the volume discount, rounded to cents. */
  unitPrice: number;
  subtotal: number;
}

/** Money is rounded per line so the stored decimals and the total agree. */
function toCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Resolves each requested line against the catalog: real name, real price, real
 * volume discount. Rejects inactive products, variations belonging to another
 * product, and out-of-stock quantities.
 */
export async function priceOrderLines(lines: RequestedLine[]): Promise<PricedLine[]> {
  if (lines.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty" });
  }

  const tiers = await getBulkDiscountTiers();
  const priced: PricedLine[] = [];

  for (const line of lines) {
    const product = await getProductById(line.productId);
    if (!product || !product.active) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One of the items in your cart is no longer available.",
      });
    }

    let basePrice = Number(product.basePrice);
    let variationLabel: string | undefined;

    if (line.variationId !== undefined) {
      const variation = await getVariationById(line.variationId);
      if (!variation || !variation.active || variation.productId !== product.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The selected option for ${product.name} is no longer available.`,
        });
      }
      if (variation.stock < line.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Only ${variation.stock} left of ${product.name}.`,
        });
      }
      basePrice = Number(variation.price);
      variationLabel = buildVariationLabel(variation);
    }

    // Same rule the product page advertises. Recomputing it from the final line
    // quantity also fixes a client-side drift: the cart merges quantities but
    // keeps the unit price captured when the item was first added.
    const percent = product.excludeFromBulkDiscount
      ? 0
      : getBulkDiscountPercent(line.quantity, tiers);
    const unitPrice = toCents(applyBulkDiscount(basePrice, percent));

    priced.push({
      productId: product.id,
      variationId: line.variationId,
      productName: product.name,
      variationLabel,
      quantity: line.quantity,
      unitPrice,
      subtotal: toCents(unitPrice * line.quantity),
    });
  }

  return priced;
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export interface ResolvedCoupon {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  discount: number;
}

/**
 * Validates a coupon and computes its discount against a server-computed order
 * amount. Shared by `coupons.validate` (the checkout preview) and `orders.create`
 * (the binding calculation) so a code can never behave differently between the
 * price the shopper is quoted and the price they are charged.
 */
export async function resolveCoupon(
  code: string,
  orderAmount: number,
  userId?: number
): Promise<ResolvedCoupon> {
  const coupon = await getCouponByCode(code);
  if (!coupon || !coupon.active) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Coupon not found or inactive" });
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Coupon has expired" });
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Coupon usage limit reached" });
  }
  if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Minimum order amount is $${coupon.minOrderAmount}`,
    });
  }
  if (coupon.isNewCustomerOffer) {
    const redemption = userId ? await getWelcomeRedemption(userId, coupon.id) : undefined;
    if (!redemption) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "This code is reserved for new customers who registered through the welcome offer.",
      });
    }
    if (redemption.usedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This welcome code has already been used.",
      });
    }
  }

  const raw =
    coupon.type === "percentage"
      ? (orderAmount * Number(coupon.value)) / 100
      : Number(coupon.value);

  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: Number(coupon.value),
    discount: toCents(Math.min(raw, orderAmount)),
  };
}

// ─── Referrals ───────────────────────────────────────────────────────────────

export type ReferralRejectionReason = "unknown_code" | "self_referral";

export interface ResolvedReferral {
  affiliateCodeId: number;
  ownerUserId: number;
  code: string;
  /** Discount granted to the buyer. Zero when the referral was rejected. */
  discount: number;
  /** Commission owed to the affiliate. Zero when the referral was rejected. */
  commission: number;
  /** Set when the code was refused; the attempt is still recorded. */
  rejectedReason?: ReferralRejectionReason;
}

/**
 * Resolves a referral code against the catalog of affiliates.
 *
 * A self-referral resolves to a *rejected* referral rather than an error: the
 * order still goes through, simply without a discount, and the attempt is
 * recorded so it shows up in the admin's abuse view. An unknown code resolves
 * to null — there is nobody to record it against.
 */
export async function resolveReferral(
  code: string,
  subtotal: number,
  buyerEmails: Array<string | null | undefined>,
  buyerUserId?: number | null
): Promise<ResolvedReferral | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const affiliateCode = await getAffiliateCodeByCode(normalized);
  if (!affiliateCode) return null;

  const owner = await getUserById(affiliateCode.userId);

  if (
    isSelfReferral({
      buyerUserId,
      buyerEmails,
      ownerUserId: affiliateCode.userId,
      ownerEmail: owner?.email,
    })
  ) {
    return {
      affiliateCodeId: affiliateCode.id,
      ownerUserId: affiliateCode.userId,
      code: affiliateCode.code,
      // No benefit flows in either direction. Zero rather than the amount that
      // would have been owed, so a balance query that forgets its status filter
      // still cannot pay out a rejected row.
      discount: 0,
      commission: 0,
      rejectedReason: "self_referral",
    };
  }

  return {
    affiliateCodeId: affiliateCode.id,
    ownerUserId: affiliateCode.userId,
    code: affiliateCode.code,
    discount: computeReferralDiscount(subtotal),
    commission: computeReferralCommission(subtotal),
  };
}

// ─── Whole-order pricing ─────────────────────────────────────────────────────

export interface PricedOrder {
  items: PricedLine[];
  subtotal: number;
  discount: number;
  /** Carrier charge plus handling, as quoted server side. */
  shipping: number;
  total: number;
  coupon?: ResolvedCoupon;
  referral?: ResolvedReferral;
  /** Which discount actually applied, once the two were compared. */
  appliedDiscount: "none" | "coupon" | "referral";
}

export interface PriceOrderOptions {
  couponCode?: string;
  referralCode?: string;
  userId?: number;
  /** Every address that identifies the buyer, for self-referral detection. */
  buyerEmails?: Array<string | null | undefined>;
  /**
   * Shipping to add, resolved from a server-held quote — never a figure the
   * browser sent. Zero while the shopper has not chosen a service yet.
   */
  shipping?: number;
}

/**
 * Prices a whole order from the database.
 *
 * Coupon and referral discounts do not stack — the larger of the two applies.
 * A referred order already costs the store its commission on top of the
 * buyer's discount, and letting an aggressive coupon compound on that can put
 * the order underwater.
 *
 * The affiliate's commission is unaffected by which discount wins: they
 * brought the sale either way.
 */
export async function priceOrder(
  lines: RequestedLine[],
  options: PriceOrderOptions = {}
): Promise<PricedOrder> {
  const items = await priceOrderLines(lines);
  const subtotal = toCents(items.reduce((sum, i) => sum + i.subtotal, 0));

  const coupon = options.couponCode
    ? await resolveCoupon(options.couponCode, subtotal, options.userId)
    : undefined;

  const referral = options.referralCode
    ? ((await resolveReferral(
        options.referralCode,
        subtotal,
        options.buyerEmails ?? [],
        options.userId
      )) ?? undefined)
    : undefined;

  const couponDiscount = coupon?.discount ?? 0;
  const referralDiscount = referral?.discount ?? 0;

  let discount = 0;
  let appliedDiscount: PricedOrder["appliedDiscount"] = "none";
  if (couponDiscount > 0 || referralDiscount > 0) {
    if (referralDiscount > couponDiscount) {
      discount = referralDiscount;
      appliedDiscount = "referral";
    } else {
      discount = couponDiscount;
      appliedDiscount = "coupon";
    }
  }

  // Shipping is added after the discount, not before it: a percentage coupon
  // is a discount on the goods, and letting it eat into the carrier's charge
  // would have the shop subsidising UPS out of its own margin.
  const shipping = toCents(Math.max(0, options.shipping ?? 0));
  const goods = toCents(Math.max(0, subtotal - discount));

  return {
    items,
    subtotal,
    discount,
    shipping,
    total: toCents(goods + shipping),
    coupon,
    referral,
    appliedDiscount,
  };
}
