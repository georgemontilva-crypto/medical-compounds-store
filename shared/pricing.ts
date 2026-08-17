/**
 * Catalog pricing rules shared by the client and the server.
 *
 * The client uses these to show prices and build the cart; the server uses the
 * same functions to re-derive what an order actually costs before money moves.
 * They live here so the two sides can never drift apart — a discount the client
 * displays is by construction the discount the server charges.
 */

// ─── Bulk (volume) discount tiers ────────────────────────────────────────────

export interface BulkDiscountTiers {
  tier2Percent: number;
  tier5Percent: number;
}

/** Quantity thresholds offered on the product page. Same for every product. */
export const BULK_DISCOUNT_QUANTITIES = [1, 2, 5] as const;

/** Fallbacks when the admin has never saved the tiers to site_settings. */
export const DEFAULT_BULK_DISCOUNT_TIERS: BulkDiscountTiers = {
  tier2Percent: 10,
  tier5Percent: 20,
};

export function getBulkDiscountPercent(quantity: number, tiers: BulkDiscountTiers): number {
  if (quantity >= 5) return tiers.tier5Percent;
  if (quantity >= 2) return tiers.tier2Percent;
  return 0;
}

export function applyBulkDiscount(unitPrice: number, percent: number): number {
  return unitPrice * (1 - percent / 100);
}

// ─── Display helpers ─────────────────────────────────────────────────────────

// Product variation "value" columns are MySQL decimals, which come back as
// strings like "10.00" — Number(...).toString() drops insignificant
// trailing zeros ("10.00" -> "10") while still showing real decimals
// ("2.50" -> "2.5") correctly.
export function formatVariationValue(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toString();
}

/** The label stored on an order line, e.g. "10mg". */
export function buildVariationLabel(
  variation: { value: string | number; unit: string } | undefined | null
): string | undefined {
  if (!variation) return undefined;
  return `${formatVariationValue(variation.value)}${variation.unit}`;
}
