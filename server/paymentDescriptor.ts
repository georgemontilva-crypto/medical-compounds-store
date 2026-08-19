import type { Order, OrderItem } from "../drizzle/schema";

/**
 * Payment-processor text sanitization.
 *
 * Nothing in this file talks to a processor — there is no payment integration
 * yet (orders are placed with paymentStatus "pending" and settled manually).
 * This is the seam that a future Stripe/PayPal/high-risk-gateway integration
 * must go through, so that the only order text leaving our servers is generic.
 *
 * The real product detail (peptide names, variation labels) stays in
 * order_items and is never derived from here.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bank-statement line. Stripe allows 5–22 chars and forbids < > \ " ' * */
export const STATEMENT_DESCRIPTOR = "BRIGHTER DAYS LABS";

/** Generic noun used in place of any product name. */
const GENERIC_ITEM_LABEL = "Lab Supply Item";

/**
 * Terms that must never appear in processor-bound text, independent of what
 * the catalog is called today. Matched case-insensitively as substrings.
 */
export const RESTRICTED_TERMS = [
  "peptide",
  "research compound",
  "research chemical",
  "research use only",
  "ruo",
  "sarm",
  "nootropic",
  "not for human consumption",
] as const;

// ─── Descriptors ─────────────────────────────────────────────────────────────

/**
 * The charge description a processor would show. Carries the order id so the
 * charge can be reconciled against our database, and nothing else.
 */
export function getSanitizedOrderDescriptor(order: Pick<Order, "id">): string {
  return `${GENERIC_ITEM_LABEL} — Order #${order.id}`;
}

/**
 * Statement descriptor (what the customer sees on their bank statement).
 * Company name only — never product, never category.
 */
export function getSanitizedStatementDescriptor(): string {
  return STATEMENT_DESCRIPTOR;
}

// ─── Payload ─────────────────────────────────────────────────────────────────

export interface SanitizedProcessorPayload {
  /** Total in minor units (cents), as processors expect. */
  amountInCents: number;
  currency: "usd";
  description: string;
  statementDescriptor: string;
  /**
   * Deliberately minimal. Only non-identifying reconciliation keys — adding
   * product detail here is the exact failure this module exists to prevent.
   */
  metadata: {
    orderId: string;
    itemCount: string;
  };
}

/**
 * Builds the complete set of fields destined for a payment processor.
 *
 * `items` is accepted only to derive the item *count* and to let the caller
 * run assertPayloadIsSanitized against the same order; no item text is copied
 * into the payload.
 */
export function buildSanitizedProcessorPayload(
  order: Pick<Order, "id" | "total">,
  items: Pick<OrderItem, "quantity">[]
): SanitizedProcessorPayload {
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    amountInCents: Math.round(Number(order.total) * 100),
    currency: "usd",
    description: getSanitizedOrderDescriptor(order),
    statementDescriptor: getSanitizedStatementDescriptor(),
    metadata: {
      orderId: String(order.id),
      itemCount: String(itemCount),
    },
  };
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/**
 * Every string a payload would send, flattened for inspection.
 */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, acc));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectStrings(v, acc));
  }
  return acc;
}

/**
 * Returns the restricted terms present in the given text, if any.
 */
export function findRestrictedTerms(text: string): string[] {
  const haystack = text.toLowerCase();
  return RESTRICTED_TERMS.filter((term) => {
    // "ruo" is short enough to hit inside unrelated words (e.g. "grouo"),
    // so require it to stand alone.
    if (term === "ruo") return /\bruo\b/.test(haystack);
    return haystack.includes(term);
  });
}

/**
 * Throws if any product detail from `items`, any restricted term, or any value
 * in `alsoForbidden` appears anywhere in `payload`. Call this at the
 * integration boundary — right before handing the payload to the processor SDK
 * — so a future edit that reintroduces product names fails loudly instead of
 * reaching the merchant account.
 *
 * `alsoForbidden` carries the order-specific strings that are none of the
 * processor's business but are not product text either — an affiliate referral
 * code, for instance. Without it the guard would have no opinion on them, and
 * they would stay out of the payload only by construction.
 */
export function assertPayloadIsSanitized(
  payload: unknown,
  items: Pick<OrderItem, "productName" | "variationLabel">[],
  alsoForbidden: Array<string | null | undefined> = []
): void {
  const strings = collectStrings(payload);
  const forbidden = alsoForbidden
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());

  for (const text of strings) {
    const restricted = findRestrictedTerms(text);
    if (restricted.length > 0) {
      throw new Error(
        `Processor payload contains restricted term(s) [${restricted.join(", ")}] in: "${text}"`
      );
    }

    const haystack = text.toLowerCase();

    for (const value of forbidden) {
      if (haystack.includes(value)) {
        throw new Error(`Processor payload leaks forbidden value "${value}" in: "${text}"`);
      }
    }

    for (const item of items) {
      if (haystack.includes(item.productName.toLowerCase())) {
        throw new Error(
          `Processor payload leaks product name "${item.productName}" in: "${text}"`
        );
      }
      if (item.variationLabel && haystack.includes(item.variationLabel.toLowerCase())) {
        throw new Error(
          `Processor payload leaks variation label "${item.variationLabel}" in: "${text}"`
        );
      }
    }
  }
}
