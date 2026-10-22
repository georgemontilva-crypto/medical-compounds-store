/**
 * ArgentPlatforms (PaymentJS) integration — the server half.
 *
 * PaymentJS is a browser library. It mounts the card fields, tokenises the
 * card and reports the outcome through JavaScript callbacks. That shape has a
 * consequence worth stating plainly, because every decision in this file
 * follows from it:
 *
 *   The amount is submitted by the browser, and so is the news that the
 *   payment succeeded.
 *
 * `client.submit({ amount: "1999" })` runs on the shopper's machine, where the
 * shopper can change it. `onPaymentSuccess` is a callback in the same page.
 * Taken at face value, either one lets somebody pay a dollar for a five
 * hundred dollar order, or skip paying and still have the order confirmed.
 *
 * So nothing the browser reports is believed. The browser's only job is to
 * hand back a payment intent id; this module then asks ArgentPlatforms what
 * that payment actually was, and the order is settled only if the API says it
 * completed, for this order, for the exact amount the order totals.
 *
 * ─── What is still missing ───────────────────────────────────────────────────
 *
 * The PaymentJS document covers the browser library only. It does not include
 * the server API: no base URL, no authentication scheme, no response shape.
 * `fetchPaymentIntent` below is written against the conventional REST shape
 * and is the single place to correct once ArgentPlatforms supplies their
 * server documentation — see the note on that function.
 *
 * Until it is configured and confirmed against their real API, this module
 * refuses to settle anything. That is deliberate. An integration that cannot
 * verify a payment should decline to confirm orders, not assume the best.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Order, OrderItem } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  assertPayloadIsSanitized,
  buildSanitizedProcessorPayload,
  getSanitizedStatementDescriptor,
} from "./paymentDescriptor";

// ─── Configuration ───────────────────────────────────────────────────────────

/** Whether the browser can be handed a usable PaymentJS configuration. */
export function isArgentClientConfigured(): boolean {
  return ENV.argentPublicKey.length > 0;
}

/**
 * Whether the server can verify a payment.
 *
 * Separate from the client check on purpose: a deployment with a public key
 * and no secret key can render the card fields and take a payment it has no
 * way to confirm. `startArgentPayment` refuses in that state rather than
 * letting a shopper be charged for an order that can never be settled.
 */
export function isArgentServerConfigured(): boolean {
  return ENV.argentSecretKey.length > 0 && ENV.argentApiUrl.length > 0;
}

// ─── Order reference ─────────────────────────────────────────────────────────

/**
 * The `reference` PaymentJS is initialised with, and the thing that binds a
 * payment to one specific order.
 *
 * It carries a signature rather than being a bare order number, and that
 * matters more than it looks. Verification asks the API what a payment intent
 * was; without a binding, somebody could pay for their own small order and
 * then present that payment's id against a different order of the same total.
 * The reference comes back from the API inside the intent, so checking it
 * proves the payment was created for this order and no other.
 *
 * Derived rather than stored, so no column and no migration: the same order
 * id always produces the same reference, and only this server can produce it.
 */
export function orderPaymentReference(orderId: number): string {
  const signature = createHmac("sha256", ENV.cookieSecret || "argent-reference")
    .update(`argent:order:${orderId}`)
    .digest("hex")
    .slice(0, 16);
  return `bdl-${orderId}-${signature}`;
}

/** Constant-time comparison, so a reference cannot be guessed byte by byte. */
export function referenceMatchesOrder(reference: string, orderId: number): boolean {
  const expected = Buffer.from(orderPaymentReference(orderId));
  const actual = Buffer.from(reference ?? "");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ─── What the browser is given ───────────────────────────────────────────────

export type ArgentClientConfig = {
  publicKey: string;
  environment: "development" | "production";
  reference: string;
  /** Minor units, as a string — the shape PaymentJS expects. */
  amount: string;
  currencyCode: string;
  /** Statement descriptor. Company name only; never a product. */
  descriptor: string;
};

/**
 * The options handed to `ArgentPlatforms.init()` in the browser.
 *
 * The amount is included because PaymentJS requires it, not because it is
 * trusted: the figure that decides whether an order is settled is read back
 * from the API in `verifyArgentPayment`, never from here and never from what
 * the browser later submits.
 *
 * Note what is absent. PaymentJS accepts a `products_purchased` metadata array
 * and renders it in the order summary, which would put real catalog names in
 * front of the processor and on the payment screen — the exact disclosure
 * paymentDescriptor.ts exists to prevent. The processor sees an order number
 * and a company name.
 */
export function buildArgentClientConfig(
  order: Pick<Order, "id" | "total">,
  items: Pick<OrderItem, "quantity" | "productName" | "variationLabel">[]
): ArgentClientConfig {
  const payload = buildSanitizedProcessorPayload(order, items);

  const config: ArgentClientConfig = {
    publicKey: ENV.argentPublicKey,
    environment: ENV.argentProduction ? "production" : "development",
    reference: orderPaymentReference(order.id),
    amount: String(payload.amountInCents),
    currencyCode: payload.currency.toUpperCase(),
    descriptor: getSanitizedStatementDescriptor(),
  };

  // The same guard Stripe's payload goes through: nothing leaves here carrying
  // a catalog term, including via a future edit to this function.
  const { publicKey: _publicKey, ...describable } = config;
  assertPayloadIsSanitized(describable, items);

  return config;
}

// ─── Verification ────────────────────────────────────────────────────────────

/** What the server needs to know about a payment, whatever shape the API uses. */
export type ArgentPaymentIntent = {
  id: string;
  /** True only when the money is actually captured. */
  completed: boolean;
  /** Minor units, as reported by the API. */
  amountInMinorUnits: number;
  currencyCode: string;
  /** The reference the intent was created with, used to bind it to an order. */
  reference: string;
};

export class ArgentNotConfiguredError extends Error {
  constructor() {
    super("ArgentPlatforms server API is not configured");
    this.name = "ArgentNotConfiguredError";
  }
}

/**
 * Asks ArgentPlatforms what a payment intent actually is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS THE ONE FUNCTION TO CORRECT when ArgentPlatforms supply their server
 * API documentation. The request below uses the conventional REST shape — a
 * GET to /payment_intents/{id} with a bearer token — because their PaymentJS
 * document does not specify it. The endpoint path, the auth header and the
 * response field names may all differ.
 *
 * What must NOT change is the behaviour around it: unknown shape, unparseable
 * response, non-2xx status and missing configuration all throw. Nothing here
 * may return a value that reads as "completed" unless the API clearly said so.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function fetchPaymentIntent(paymentIntentId: string): Promise<ArgentPaymentIntent> {
  if (!isArgentServerConfigured()) throw new ArgentNotConfiguredError();

  const base = ENV.argentApiUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ENV.argentSecretKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `ArgentPlatforms lookup for ${paymentIntentId} failed with HTTP ${response.status}`
    );
  }

  const body: unknown = await response.json();
  return parsePaymentIntent(paymentIntentId, body);
}

/**
 * Reads the API's response into the fields verification needs.
 *
 * Strict by design: a response this cannot read is an error, not an
 * incomplete payment and certainly not a successful one. The status is only
 * treated as captured for values that unambiguously say so.
 */
export function parsePaymentIntent(expectedId: string, body: unknown): ArgentPaymentIntent {
  if (!body || typeof body !== "object") {
    throw new Error(`ArgentPlatforms returned a non-object for ${expectedId}`);
  }

  // Some APIs wrap the resource; unwrap one level before reading fields.
  const root = body as Record<string, unknown>;
  const node = (
    root.payment_intent && typeof root.payment_intent === "object"
      ? root.payment_intent
      : root.data && typeof root.data === "object"
        ? root.data
        : root
  ) as Record<string, unknown>;

  const id = typeof node.id === "string" ? node.id : null;
  const status = typeof node.status === "string" ? node.status.toLowerCase() : null;
  const reference = typeof node.reference === "string" ? node.reference : null;
  const amountRaw = node.amount ?? node.amount_total;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string" && /^\d+$/.test(amountRaw)
        ? Number(amountRaw)
        : null;
  const currency =
    typeof node.currency_code === "string"
      ? node.currency_code
      : typeof node.currency === "string"
        ? node.currency
        : null;

  if (id === null || status === null || reference === null || amount === null) {
    throw new Error(
      `ArgentPlatforms response for ${expectedId} is missing id, status, reference or amount`
    );
  }

  return {
    id,
    // Only these mean the money is captured. Anything else — pending,
    // requires_action, authorised-but-not-captured, a status nobody has seen
    // yet — is not a payment this shop will ship against.
    completed: status === "completed" || status === "succeeded" || status === "captured",
    amountInMinorUnits: amount,
    currencyCode: (currency ?? "USD").toUpperCase(),
    reference,
  };
}

export type ArgentVerification =
  | { ok: true; intent: ArgentPaymentIntent }
  | {
      ok: false;
      reason: "not-completed" | "wrong-order" | "wrong-amount" | "wrong-currency";
      detail: string;
    };

/**
 * Decides whether a payment intent may settle a given order.
 *
 * Pure, so every rejection path is unit-testable without a network: an
 * incomplete payment, a payment belonging to another order, a payment for the
 * wrong amount. Each of those is somebody trying something or something being
 * badly wrong, and neither is a thing to let through.
 */
export function verifyArgentPayment(
  intent: ArgentPaymentIntent,
  order: Pick<Order, "id" | "total">
): ArgentVerification {
  if (!intent.completed) {
    return {
      ok: false,
      reason: "not-completed",
      detail: `Payment ${intent.id} is not a completed capture`,
    };
  }

  if (!referenceMatchesOrder(intent.reference, order.id)) {
    return {
      ok: false,
      reason: "wrong-order",
      detail: `Payment ${intent.id} was not created for order ${order.id}`,
    };
  }

  const expectedCents = Math.round(Number(order.total) * 100);
  if (intent.amountInMinorUnits !== expectedCents) {
    return {
      ok: false,
      reason: "wrong-amount",
      detail:
        `Payment ${intent.id} captured ${intent.amountInMinorUnits} minor units ` +
        `but order ${order.id} totals ${expectedCents}`,
    };
  }

  if (intent.currencyCode !== "USD") {
    return {
      ok: false,
      reason: "wrong-currency",
      detail: `Payment ${intent.id} is in ${intent.currencyCode}, not USD`,
    };
  }

  return { ok: true, intent };
}
