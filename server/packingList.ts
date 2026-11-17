/**
 * The sheet that goes in the box.
 *
 * It does two jobs at once and that shapes every choice here. On the bench it
 * is what somebody picks against, so the quantities are large, there is a tick
 * box beside each line, and the total unit count is stated separately — a
 * packer who miscounts a line still catches it against the total. In the box it
 * is what the buyer checks on arrival, so it names the order, says what should
 * be inside, and carries the handling terms this category requires.
 *
 * No prices. A packing list is not an invoice: the money side already reached
 * the buyer by email, and a price sheet in a parcel is the thing that goes
 * wrong when an order is reshipped, split or sent as a replacement.
 *
 * Printed 4x6, on the same thermal stock as the shipping label. A shop that
 * packs parcels has one printer loaded with one size of media, and a Letter
 * sheet sent to it comes out shrunk to a third of the page or cut off. Four by
 * six is a small canvas and the type is set accordingly — every measurement
 * below is chosen for that page, not scaled down from a larger one.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ShippingOrigin } from "@shared/shipping";

export interface PackingListItem {
  productName: string;
  variationLabel?: string | null;
  quantity: number;
}

export interface PackingListOrder {
  id: number;
  createdAt: Date | string;
  trackingNumber?: string | null;
  shippingServiceName?: string | null;
  shippingFirstName?: string | null;
  shippingLastName?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
}

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.44, 0.47);
const RULE = rgb(0.85, 0.85, 0.85);

/** 4x6 inches at 72 points to the inch — thermal label stock. */
const PAGE = { width: 288, height: 432 };
const MARGIN = 14;
const CONTENT = PAGE.width - MARGIN * 2;

/** How tall one item row is, tick box included. */
const ROW_HEIGHT = 17;

/**
 * The line below which no further row is started.
 *
 * Rows are placed against the real remaining space rather than counted out in
 * advance: the header's height varies with the address, and a fixed row count
 * either wastes a short page or runs a long one off the bottom. On this page
 * there is no slack to spend on either.
 */
const BODY_FLOOR = MARGIN + 46;

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The delivery address as lines, skipping whatever is missing.
 *
 * Guest orders and old rows have gaps in them, and an address block printed
 * with a blank line or a stray comma looks like a system that lost something.
 */
export function addressLines(order: PackingListOrder): string[] {
  const name = [order.shippingFirstName, order.shippingLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const cityLine = [
    [order.shippingCity, order.shippingState].filter(Boolean).join(", "),
    order.shippingZip,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return [name, order.shippingAddress ?? "", cityLine, order.shippingCountry ?? ""]
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/** Units in the parcel, which is the number a packer counts against. */
export function totalUnits(items: PackingListItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Cuts a string to what fits in `width`, ending in an ellipsis if it had to.
 *
 * Product names in this catalogue run long ("Retatrutide 10mg — research
 * grade"), and pdf-lib will happily draw straight through the column and off
 * the page rather than wrap or complain.
 */
function truncate(
  text: string,
  width: number,
  size: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number }
): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

export async function buildPackingListPdf(
  order: PackingListOrder,
  items: PackingListItem[],
  origin: ShippingOrigin
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Packing list — Order #${order.id}`);
  pdf.setProducer("Brighter Days Labs");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const RIGHT = MARGIN + CONTENT;

  // Columns. The tick box and the quantity are fixed; the name takes what is
  // left, which on this page is not much and is why it gets truncated.
  const COL_TICK = MARGIN;
  const COL_ITEM = MARGIN + 14;
  const QTY_WIDTH = 22;
  const ITEM_WIDTH = CONTENT - 14 - QTY_WIDTH - 6;

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN - 9;

  const text = (
    value: string,
    x: number,
    size: number,
    font = regular,
    color = INK
  ) => page.drawText(value, { x, y, size, font, color });

  /** Draws `value` so it ends at `right`, for the quantity column. */
  const textRight = (
    value: string,
    right: number,
    size: number,
    font = regular,
    color = INK
  ) => page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, size, font, color });

  const rule = (thickness = 0.6, color = RULE) => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness,
      color,
    });
  };

  const drawTableHead = () => {
    text("ITEM", COL_ITEM, 5.5, bold, MUTED);
    textRight("QTY", RIGHT, 5.5, bold, MUTED);
    y -= 5;
    rule();
    y -= 12;
  };

  // ── Masthead ───────────────────────────────────────────────────────────────
  const shopName = origin.name?.trim() || "Brighter Days Labs";
  text(truncate(shopName, CONTENT - 56, 9, bold), MARGIN, 9, bold);
  textRight("PACKING LIST", RIGHT, 6, bold, MUTED);
  y -= 6;
  rule(0.8);

  // ── Order ──────────────────────────────────────────────────────────────────
  y -= 15;
  text(`#${order.id}`, MARGIN, 13, bold);
  textRight(formatDate(order.createdAt), RIGHT, 7, regular, MUTED);

  if (order.shippingServiceName) {
    y -= 11;
    text(truncate(order.shippingServiceName, CONTENT, 6.5, regular), MARGIN, 6.5, regular, MUTED);
  }
  if (order.trackingNumber) {
    y -= 9;
    text(truncate(order.trackingNumber, CONTENT, 6.5, regular), MARGIN, 6.5, regular, MUTED);
  }

  // ── Destination ────────────────────────────────────────────────────────────
  // Under the order rather than beside it: half of 260 points is not a column,
  // it is a place where addresses get cut in half.
  const destination = addressLines(order);
  if (destination.length > 0) {
    y -= 14;
    text("SHIP TO", MARGIN, 5.5, bold, MUTED);
    y -= 10;
    for (const line of destination) {
      text(truncate(line, CONTENT, 8, regular), MARGIN, 8);
      y -= 9.5;
    }
    y += 9.5;
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  y -= 14;
  drawTableHead();

  for (const item of items) {
    if (y - ROW_HEIGHT < BODY_FLOOR) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN - 7;
      text(`#${order.id} — continued`, MARGIN, 7, regular, MUTED);
      y -= 12;
      drawTableHead();
    }

    // An empty square per line. The packer ticks it; the buyer ticks it again
    // on arrival. Cheaper than any reconciliation that happens afterwards.
    page.drawRectangle({
      x: COL_TICK,
      y: y - 1.5,
      width: 8,
      height: 8,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.7,
    });

    const name = item.variationLabel
      ? `${item.productName} — ${item.variationLabel}`
      : item.productName;
    text(truncate(name, ITEM_WIDTH, 8, regular), COL_ITEM, 8);
    textRight(`${item.quantity}`, RIGHT, 8, bold);

    y -= 7;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: RIGHT, y: y + 2 },
      thickness: 0.35,
      color: rgb(0.9, 0.9, 0.9),
    });
    y -= ROW_HEIGHT - 7;
  }

  // ── Total ──────────────────────────────────────────────────────────────────
  y -= 3;
  rule(0.8);
  y -= 12;
  text("Total units", COL_ITEM, 8, bold);
  textRight(`${totalUnits(items)}`, RIGHT, 8, bold);

  // ── Terms ──────────────────────────────────────────────────────────────────
  // Low on the page and small, but present: this catalogue does not ship
  // without the handling terms, and the parcel is where a buyer meets them.
  const footerY = MARGIN + 6;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 20 },
    end: { x: RIGHT, y: footerY + 20 },
    thickness: 0.6,
    color: RULE,
  });
  const terms = [
    "Supplied for laboratory research use only.",
    "Not for human or veterinary use. Check the contents",
    "on arrival and report any discrepancy within 7 days.",
  ];
  terms.forEach((line, i) => {
    page.drawText(line, {
      x: MARGIN,
      y: footerY + 12 - i * 6.5,
      size: 5.2,
      font: regular,
      color: MUTED,
    });
  });

  return pdf.save();
}
