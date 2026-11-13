/**
 * Whether a thing can be bought, and what the shop wants said about it.
 *
 * The count decides, and it decides automatically: nothing in stock means the
 * product leaves the catalogue, a handful left says so on the card, and a
 * healthy number says so too. The switch stays as an override for the cases a
 * number cannot express — a product pulled for a reason that has nothing to do
 * with how many are on the shelf.
 *
 * One thing the count cannot say is "I do not know", and that distinction
 * carries real weight here: a product whose stock has never been entered is
 * not a product with none. Those read as null and are shown without any badge
 * at all, which is also what every product in this catalogue looked like
 * before stock existed on it. The alternative — treating a blank as zero —
 * empties the shop the moment the column is added.
 */

/** Where "a few left" ends and "plenty" begins. */
export const LOW_STOCK_THRESHOLD = 5;

/** What the shop sets on a product or a size. Stored. */
export type AvailabilitySetting = "auto" | "low_stock" | "unavailable";

/**
 * What a shopper is told. Derived; never stored.
 *
 * "unknown" is not a hedge — it is the honest state for stock nobody has
 * entered, and it renders as nothing rather than as a claim.
 */
export type AvailabilityState = "unknown" | "in_stock" | "low_stock" | "unavailable";

export const AVAILABILITY_SETTINGS: AvailabilitySetting[] = [
  "auto",
  "low_stock",
  "unavailable",
];

/** Copy for the shop's own screens, where "auto" is a real choice. */
export const SETTING_LABELS: Record<AvailabilitySetting, string> = {
  auto: "Follow stock count",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

/** Copy a shopper sees. "unknown" renders as nothing at all. */
export const STATE_LABELS: Record<AvailabilityState, string> = {
  unknown: "",
  in_stock: "In stock",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

/**
 * The automatic rule, from a count alone.
 *
 * null is untracked, not empty. Zero or less is empty.
 */
export function stockState(stock: number | null | undefined): AvailabilityState {
  if (stock === null || stock === undefined) return "unknown";
  if (stock <= 0) return "unavailable";
  return stock <= LOW_STOCK_THRESHOLD ? "low_stock" : "in_stock";
}

export interface VariationAvailabilityInput {
  active: boolean;
  stock: number;
  availability?: AvailabilitySetting | null;
}

/**
 * What one size is.
 *
 * Order matters. An inactive size is gone whatever the switch says — that is
 * the shop having removed it, not having run out. After that the switch
 * decides, and only "auto" consults the count.
 *
 * "low_stock" set by hand does not check the count, because a shop that marks
 * a size low means it; letting a stale number override that would put the
 * count back in charge of the one case the switch exists to handle.
 */
export function variationAvailability(variation: VariationAvailabilityInput): AvailabilityState {
  if (!variation.active) return "unavailable";

  switch (variation.availability ?? "auto") {
    case "unavailable":
      return "unavailable";
    case "low_stock":
      return "low_stock";
    default:
      return stockState(variation.stock);
  }
}

/** Whether this size can go in a cart. The one question checkout asks. */
export function isPurchasable(variation: VariationAvailabilityInput): boolean {
  return variationAvailability(variation) !== "unavailable";
}

/**
 * What a product's sizes add up to.
 *
 * It leans toward warning: one size running low is worth saying even when
 * another is fully stocked, because the shopper who wants that size would
 * rather hear it on the listing than after clicking. The product page shows
 * the truth per size.
 */
export function productAvailability(
  variations: VariationAvailabilityInput[]
): AvailabilityState {
  const active = variations.filter(variation => variation.active);
  if (active.length === 0) return "unavailable";

  const states = active.map(variationAvailability);
  if (states.every(state => state === "unavailable")) return "unavailable";
  if (states.some(state => state === "low_stock")) return "low_stock";
  if (states.some(state => state === "in_stock")) return "in_stock";
  return "unknown";
}

export interface ProductAvailabilityInput {
  availability?: AvailabilitySetting | null;
  /** Null means nobody has entered one — not that there are none. */
  stock?: number | null;
}

/**
 * What a product is, from its switch, its own count, and its sizes.
 *
 * Only two products in this catalogue have sizes; the rest sell on their base
 * price, and their own count is the only thing that can speak for them. Where
 * sizes do exist they are the finer truth and the product's count is ignored —
 * a number on the product would be a second, competing total.
 *
 * The switch outranks both. "unavailable" closes the product whatever the
 * numbers say, while "low_stock" cannot talk over sizes that are all genuinely
 * gone, because that would advertise something nobody can buy.
 */
export function resolveProductAvailability(
  product: ProductAvailabilityInput,
  variations: VariationAvailabilityInput[]
): AvailabilityState {
  const setting = product.availability ?? "auto";
  if (setting === "unavailable") return "unavailable";

  const base =
    variations.length > 0 ? productAvailability(variations) : stockState(product.stock);

  if (setting === "low_stock") {
    return base === "unavailable" ? "unavailable" : "low_stock";
  }
  return base;
}

/** Whether a product can be bought at all, before any size is chosen. */
export function isProductPurchasable(
  product: ProductAvailabilityInput,
  variations: VariationAvailabilityInput[]
): boolean {
  return resolveProductAvailability(product, variations) !== "unavailable";
}
