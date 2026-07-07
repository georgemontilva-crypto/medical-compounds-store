import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Product variation "value" columns are MySQL decimals, which come back as
// strings like "10.00" — Number(...).toString() drops insignificant
// trailing zeros ("10.00" -> "10") while still showing real decimals
// ("2.50" -> "2.5") correctly.
export function formatVariationValue(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toString();
}

// ─── Bulk (volume) discount tiers — same global thresholds for every
// product; only the percentages come from admin config (bulkDiscount.get).
export interface BulkDiscountTiers {
  tier2Percent: number;
  tier4Percent: number;
  tier8Percent: number;
}

export const BULK_DISCOUNT_QUANTITIES = [1, 2, 4, 8] as const;

export function getBulkDiscountPercent(quantity: number, tiers: BulkDiscountTiers): number {
  if (quantity >= 8) return tiers.tier8Percent;
  if (quantity >= 4) return tiers.tier4Percent;
  if (quantity >= 2) return tiers.tier2Percent;
  return 0;
}
