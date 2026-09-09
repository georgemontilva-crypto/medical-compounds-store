// Order lifecycle email. Three moments matter to a buyer: the payment went
// through, and the parcel is moving. A fourth matters to the shop: something
// is waiting to be packed.
//
// Unlike the Stripe payload, these emails name the real products. The buyer
// is entitled to know what they bought; the sanitiser in paymentDescriptor.ts
// exists for the processor, not for the customer, and must not be applied here.
import { escapeHtml, sendEmail } from "./email";
import { getOrderById, getOrderItems } from "./db";

type OrderRow = Awaited<ReturnType<typeof getOrderById>>;
type OrderItemRow = Awaited<ReturnType<typeof getOrderItems>>[number];

const BRAND = "Brighter Days Labs";

function money(value: unknown): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

/**
 * Order numbers shown to a buyer are the row id — the sequence was moved to
 * start at 8001 in the database precisely so the id could be shown as-is,
 * with no arithmetic anywhere.
 */
function orderNumber(id: number): string {
  return `#${id}`;
}

function itemRows(items: OrderItemRow[]): string {
  return items
    .map((item) => {
      const label = item.variationLabel
        ? `${escapeHtml(item.productName)} <span style="color:#666">(${escapeHtml(item.variationLabel)})</span>`
        : escapeHtml(item.productName);
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;color:#666">${item.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${money(item.subtotal)}</td>
        </tr>`;
    })
    .join("");
}

function totalsRows(order: NonNullable<OrderRow>): string {
  const rows: string[] = [
    `<tr><td colspan="2" style="padding:6px 0;color:#666">Subtotal</td><td style="padding:6px 0;text-align:right">${money(order.subtotal)}</td></tr>`,
  ];

  if (Number(order.discountAmount) > 0) {
    const code = order.couponCode ? ` (${escapeHtml(order.couponCode)})` : "";
    rows.push(
      `<tr><td colspan="2" style="padding:6px 0;color:#666">Discount${code}</td><td style="padding:6px 0;text-align:right">-${money(order.discountAmount)}</td></tr>`
    );
  }

  if (Number(order.shippingCost) > 0 || order.shippingServiceName) {
    const service = order.shippingServiceName ? ` · ${escapeHtml(order.shippingServiceName)}` : "";
    rows.push(
      `<tr><td colspan="2" style="padding:6px 0;color:#666">Shipping${service}</td><td style="padding:6px 0;text-align:right">${money(order.shippingCost)}</td></tr>`
    );
  }

  rows.push(
    `<tr><td colspan="2" style="padding:12px 0 0;font-weight:bold;border-top:2px solid #d3c4ab">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:bold;border-top:2px solid #d3c4ab">${money(order.total)}</td></tr>`
  );

  return rows.join("");
}

function shippingBlock(order: NonNullable<OrderRow>): string {
  const lines = [
    [order.shippingFirstName, order.shippingLastName].filter(Boolean).join(" "),
    order.shippingAddress,
    [order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(", "),
    order.shippingCountry,
  ].filter((line): line is string => Boolean(line && line.trim()));

  if (lines.length === 0) return "";

  return `
    <h3 style="font-size:14px;margin:28px 0 8px;color:#1a1a1a">Shipping to</h3>
    <p style="margin:0;color:#666;line-height:1.6">${lines.map((l) => escapeHtml(l)).join("<br>")}</p>`;
}

function shell(heading: string, intro: string, inner: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
    <h1 style="font-size:20px;margin:0 0 4px">${heading}</h1>
    <p style="margin:0 0 24px;color:#666">${intro}</p>
    ${inner}
    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;line-height:1.5">
      FOR RESEARCH USE ONLY. NOT FOR HUMAN OR VETERINARY USE.<br>
      ${BRAND}
    </p>
  </div>`;
}

/**
 * Sent once payment is confirmed, not when the order row is created — an
 * abandoned checkout leaves a pending order behind, and confirming a purchase
 * nobody paid for is worse than sending nothing.
 */
export async function sendOrderConfirmationEmail(orderId: number): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order) {
    console.warn(`[orderEmails] confirmation skipped — order ${orderId} not found`);
    return false;
  }

  const to = order.shippingEmail;
  if (!to) {
    console.warn(`[orderEmails] confirmation skipped — order ${orderId} has no shippingEmail`);
    return false;
  }

  const items = await getOrderItems(orderId);

  const html = shell(
    `Order ${orderNumber(order.id)} confirmed`,
    "Thank you — we have your payment and your order is being prepared.",
    `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr>
          <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #d3c4ab;font-size:12px;color:#666">Item</th>
          <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #d3c4ab;font-size:12px;color:#666">Qty</th>
          <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #d3c4ab;font-size:12px;color:#666">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows(items)}${totalsRows(order)}</tbody>
    </table>
    ${shippingBlock(order)}
    <p style="margin:24px 0 0;color:#666;font-size:13px">
      We'll email you a tracking number as soon as your parcel ships.
    </p>`
  );

  const sent = await sendEmail({
    to,
    subject: `Order ${orderNumber(order.id)} confirmed — ${BRAND}`,
    html,
  });
  if (!sent) console.warn(`[orderEmails] confirmation for order ${orderId} was not delivered`);
  return sent;
}

/**
 * Goes to whoever packs the parcels. Separate from notifyOwner so that a
 * missing ADMIN_NOTIFICATION_EMAIL is visible in the log rather than silent.
 */
export async function sendAdminOrderNotificationEmail(orderId: number): Promise<boolean> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn(
      `[orderEmails] admin notification skipped for order ${orderId} — ADMIN_NOTIFICATION_EMAIL is unset`
    );
    return false;
  }

  const order = await getOrderById(orderId);
  if (!order) return false;
  const items = await getOrderItems(orderId);

  const buyer = [order.shippingFirstName, order.shippingLastName].filter(Boolean).join(" ");
  const service = order.shippingServiceName ?? "not selected";

  const html = shell(
    `New paid order ${orderNumber(order.id)}`,
    "This order is paid and waiting to be packed.",
    `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>${itemRows(items)}${totalsRows(order)}</tbody>
    </table>
    <h3 style="font-size:14px;margin:28px 0 8px">Buyer</h3>
    <p style="margin:0;color:#666;line-height:1.6">
      ${escapeHtml(buyer || "—")}<br>
      ${escapeHtml(order.shippingEmail ?? "—")}<br>
      ${escapeHtml(order.shippingPhone ?? "—")}
    </p>
    ${shippingBlock(order)}
    <h3 style="font-size:14px;margin:28px 0 8px">Shipping method</h3>
    <p style="margin:0;color:#666">${escapeHtml(service)}</p>`
  );

  const sent = await sendEmail({
    to,
    subject: `New order ${orderNumber(order.id)} — ${money(order.total)}`,
    html,
  });
  if (!sent) console.warn(`[orderEmails] admin notification for order ${orderId} was not delivered`);
  return sent;
}

/**
 * Sent when a label is created, which is the moment the parcel becomes
 * trackable. The tracking link is UPS's public one — no account needed.
 */
export async function sendTrackingEmail(
  orderId: number,
  trackingNumber: string
): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order) return false;

  const to = order.shippingEmail;
  if (!to) {
    console.warn(`[orderEmails] tracking skipped — order ${orderId} has no shippingEmail`);
    return false;
  }

  const safeTracking = escapeHtml(trackingNumber);
  const url = `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  const service = order.shippingServiceName ? escapeHtml(order.shippingServiceName) : "UPS";

  const html = shell(
    `Order ${orderNumber(order.id)} has shipped`,
    `Your parcel is on its way via ${service}.`,
    `
    <p style="margin:0 0 8px;color:#666;font-size:13px">Tracking number</p>
    <p style="margin:0 0 20px;font-size:18px;font-weight:bold;letter-spacing:0.5px">${safeTracking}</p>
    <a href="${url}" style="display:inline-block;background:#d3c4ab;color:#1a1a1a;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:14px">Track this shipment</a>
    ${shippingBlock(order)}`
  );

  const sent = await sendEmail({
    to,
    subject: `Order ${orderNumber(order.id)} has shipped — ${BRAND}`,
    html,
  });
  if (!sent) console.warn(`[orderEmails] tracking for order ${orderId} was not delivered`);
  return sent;
}
