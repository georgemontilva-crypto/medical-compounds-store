import { randomUUID, createHash } from "node:crypto";
import type { ShippingRate } from "./ups";

/**
 * Short-lived server-side memory of what was quoted.
 *
 * The shopper picks a shipping option in the browser, and the browser must not
 * be the thing that says what it costs — a client that could name its own
 * shipping price could set it to a penny, and this codebase already refuses to
 * let prices travel that way for line items.
 *
 * So the quote stays here and only an opaque id crosses the wire. The client
 * echoes back the id and a service code; the price is looked up, never
 * received. A cart fingerprint is stored alongside so that adding an item after
 * quoting invalidates the quote instead of shipping a heavier parcel at the
 * lighter parcel's price.
 *
 * In process memory, which means: gone on restart, and not shared if this ever
 * runs on more than one instance. Both degrade the same harmless way — the
 * lookup misses and the shopper re-quotes — and neither can produce a wrong
 * charge, which is the property that matters.
 */

export interface StoredQuote {
  rates: ShippingRate[];
  /** Identifies the cart the rates were quoted for. */
  cartHash: string;
  expiresAt: number;
}

/** Long enough to fill in a checkout, short enough that rates stay current. */
export const QUOTE_TTL_MS = 30 * 60 * 1000;

/** Bounded so a crawler quoting in a loop cannot grow this without limit. */
const MAX_QUOTES = 500;

const quotes = new Map<string, StoredQuote>();

export interface QuotableLine {
  productId: number;
  variationId?: number;
  quantity: number;
}

/**
 * A fingerprint of what is being shipped.
 *
 * Sorted, so the same cart assembled in a different order is the same cart, and
 * a shopper who reorders their basket is not made to re-quote for nothing.
 */
export function cartFingerprint(lines: QuotableLine[], destinationZip: string): string {
  const normalized = lines
    .map((l) => `${l.productId}:${l.variationId ?? 0}:${l.quantity}`)
    .sort()
    .join("|");
  return createHash("sha256").update(`${normalized}#${destinationZip}`).digest("hex").slice(0, 32);
}

function evictExpired(now: number): void {
  for (const [id, quote] of Array.from(quotes.entries())) {
    if (quote.expiresAt <= now) quotes.delete(id);
  }
}

export function storeQuote(rates: ShippingRate[], cartHash: string): string {
  const now = Date.now();
  evictExpired(now);

  // Still full of live quotes: drop the oldest rather than refuse to quote.
  if (quotes.size >= MAX_QUOTES) {
    const oldest = Array.from(quotes.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) quotes.delete(oldest[0]);
  }

  const id = randomUUID();
  quotes.set(id, { rates, cartHash, expiresAt: now + QUOTE_TTL_MS });
  return id;
}

export type QuoteLookup =
  | { ok: true; rate: ShippingRate }
  | { ok: false; reason: "expired" | "cart_changed" | "service_not_quoted" };

/**
 * The price that was quoted for one service, if this quote still applies.
 *
 * Every failure means the same thing to the caller — re-quote — but they are
 * named separately because "your cart changed" and "this took too long" deserve
 * different words in front of a shopper.
 */
export function resolveQuotedRate(
  quoteId: string,
  serviceCode: string,
  cartHash: string
): QuoteLookup {
  const quote = quotes.get(quoteId);
  if (!quote || quote.expiresAt <= Date.now()) {
    if (quote) quotes.delete(quoteId);
    return { ok: false, reason: "expired" };
  }
  if (quote.cartHash !== cartHash) {
    return { ok: false, reason: "cart_changed" };
  }

  const rate = quote.rates.find((r) => r.serviceCode === serviceCode);
  if (!rate) return { ok: false, reason: "service_not_quoted" };

  return { ok: true, rate };
}

/** Test seam: forget everything. */
export function clearQuotes(): void {
  quotes.clear();
}

/** Test seam: how many live quotes are held. */
export function quoteCount(): number {
  evictExpired(Date.now());
  return quotes.size;
}
