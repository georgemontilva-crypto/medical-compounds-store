import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pricing rules moved to @shared/pricing so the server can re-derive order
// totals with the exact same functions the cart prices with. Re-exported here
// because the rest of the client imports them from "@/lib/utils".
export {
  BULK_DISCOUNT_QUANTITIES,
  applyBulkDiscount,
  formatVariationValue,
  getBulkDiscountPercent,
  type BulkDiscountTiers,
} from "@shared/pricing";
