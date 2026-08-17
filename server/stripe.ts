import Stripe from "stripe";
import type { Order, OrderItem } from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  assertPayloadIsSanitized,
  buildSanitizedProcessorPayload,
  getSanitizedOrderDescriptor,
} from "./paymentDescriptor";

/**
 * Stripe Checkout integration.
 *
 * This is the boundary paymentDescriptor.ts was written for: everything Stripe
 * ever sees about an order is assembled here, from the sanitized payload, and
 * re-checked with assertPayloadIsSanitized before it leaves the process.
 */

// ─── Client ──────────────────────────────────────────────────────────────────

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return ENV.stripeSecretKey.length > 0;
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) client = new Stripe(ENV.stripeSecretKey);
  return client;
}

// ─── Return URLs ─────────────────────────────────────────────────────────────

export function buildCheckoutReturnUrls(orderId: number) {
  const origin = ENV.publicSiteUrl.replace(/\/$/, "");
  return {
    successUrl: `${origin}/checkout?payment=success&orderId=${orderId}`,
    cancelUrl: `${origin}/checkout?payment=cancelled&orderId=${orderId}`,
  };
}

// ─── Session params ──────────────────────────────────────────────────────────

export type CheckoutOrder = Pick<Order, "id" | "total"> & {
  shippingEmail?: string | null;
};

export type CheckoutItem = Pick<OrderItem, "productName" | "variationLabel" | "quantity">;

/**
 * Builds the exact object handed to `stripe.checkout.sessions.create`.
 *
 * Pure and exported so the sanitization guarantee can be unit-tested against
 * real-looking catalog names without touching the network.
 *
 * The whole order is a *single* line item priced at the order total. One line
 * item per product would mean one more product name to sanitize for each item
 * in the cart, and Stripe would render a list of identical generic labels
 * anyway — the reconciliation key we care about is the order id, which the
 * descriptor already carries.
 */
export function buildCheckoutSessionParams(
  order: CheckoutOrder,
  items: CheckoutItem[],
  urls: { successUrl: string; cancelUrl: string }
): Stripe.Checkout.SessionCreateParams {
  const payload = buildSanitizedProcessorPayload(order, items);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payload.currency,
          unit_amount: payload.amountInCents,
          product_data: {
            // Never the catalog name. This is the only product text Stripe sees.
            name: getSanitizedOrderDescriptor(order),
          },
        },
      },
    ],
    payment_intent_data: {
      description: payload.description,
      statement_descriptor_suffix: payload.statementDescriptor,
      metadata: payload.metadata,
    },
    metadata: payload.metadata,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    ...(order.shippingEmail ? { customer_email: order.shippingEmail } : {}),
  };

  // Guard everything we generated. `customer_email` is deliberately excluded:
  // it is the shopper's own address, not catalog data, and a real customer
  // writing from something like "peptidefan@gmail.com" would otherwise fail a
  // restricted-term check and be unable to pay.
  const { customer_email: _shopperEmail, ...generated } = params;
  assertPayloadIsSanitized(generated, items);

  return params;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

/**
 * Verifies a webhook signature. Throws if the secret is missing, so an
 * unconfigured deployment rejects events instead of trusting them.
 */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, ENV.stripeWebhookSecret);
}
