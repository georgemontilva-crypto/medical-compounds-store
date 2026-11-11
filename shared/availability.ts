/**
 * Whether a thing can be bought, and what the shop wants said about it.
 *
 * There are two sources of truth here and they are not equal. The `stock`
 * number has been in the schema from the start, but nothing ever decrements it
 * — no order, no payment, no webhook touches it — so it only changes when
 * somebody types into the admin. A figure maintained entirely by hand, shown to
 * shoppers as "12 in stock", is a figure that is confidently wrong as often as
 * it is right.
 *
 * So the shop gets a switch, and the switch wins. `auto` keeps the old
 * behaviour for everything that already exists — the number still decides —
 * and the two explicit settings override it. Nothing had to be migrated and
 * nobody has to go set a value on 17 products before this is useful.
 */

/** What the shop sets on a size. Stored. */
export type AvailabilitySetting = "auto" | "low_stock" | "unavailable";

/** What a shopper is told. Derived; never stored. */
export type AvailabilityState = "in_stock" | "low_stock" | "unavailable";

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

/** Copy a shopper sees. "in_stock" renders as nothing at all. */
export const STATE_LABELS: Record<AvailabilityState, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

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
 * decides, and only `auto` consults the count.
 *
 * Note that "low_stock" does not check the count. A shop that marks a size low
 * means it: letting a stale 40 in the stock column quietly override that would
 * put the hand-maintained number back in charge of the thing it was too
 * unreliable to decide.
 */
export function variationAvailability(variation: VariationAvailabilityInput): AvailabilityState {
  if (!variation.active) return "unavailable";

  switch (variation.availability ?? "auto") {
    case "unavailable":
      return "unavailable";
    case "low_stock":
      return "low_stock";
    default:
      return variation.stock > 0 ? "in_stock" : "unavailable";
  }
}

/** Whether this size can go in a cart. The one question checkout asks. */
export function isPurchasable(variation: VariationAvailabilityInput): boolean {
  return variationAvailability(variation) !== "unavailable";
}

/**
 * What the catalogue card says for a product, from its sizes.
 *
 * A card is a summary, so it leans toward warning rather than reassuring: one
 * size running low is worth saying even when another is fully stocked, because
 * the shopper who wants that size would rather hear it on the listing than
 * after clicking. The product page shows the truth per size.
 *
 * A product with no active sizes is unavailable rather than in stock — the
 * fallback has to be the one that cannot sell something that does not exist.
 */
export function productAvailability(
  variations: VariationAvailabilityInput[]
): AvailabilityState {
  const active = variations.filter(variation => variation.active);
  if (active.length === 0) return "unavailable";

  const states = active.map(variationAvailability);
  if (states.every(state => state === "unavailable")) return "unavailable";
  if (states.some(state => state === "low_stock")) return "low_stock";
  return "in_stock";
}
