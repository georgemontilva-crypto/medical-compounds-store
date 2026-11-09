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

const PAGE = { width: 612, height: 792 }; // US Letter, 72dpi
const MARGIN = 54;
const CONTENT = PAGE.width - MARGIN * 2;

/** Rows that fit under the header on the first page, and on a later one. */
const ROWS_FIRST_PAGE = 22;
const ROWS_LATER_PAGE = 34;

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

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const text = (
    value: string,
    x: number,
    size: number,
    font = regular,
    color = INK
  ) => page.drawText(value, { x, y, size, font, color });

  const rule = () => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT, y },
      thickness: 0.75,
      color: RULE,
    });
  };

  // ── Masthead ───────────────────────────────────────────────────────────────
  const shopName = origin.name?.trim() || "Brighter Days Labs";
  text(shopName, MARGIN, 16, bold);
  text("PACKING LIST", MARGIN + CONTENT - bold.widthOfTextAtSize("PACKING LIST", 11), 11, bold, MUTED);
  y -= 10;
  rule();
  y -= 24;

  // ── Order and destination, side by side ────────────────────────────────────
  const rightColumn = MARGIN + CONTENT / 2;
  const blockTop = y;

  text("ORDER", MARGIN, 8, bold, MUTED);
  y -= 15;
  text(`#${order.id}`, MARGIN, 14, bold);
  y -= 15;
  text(formatDate(order.createdAt), MARGIN, 9.5, regular, MUTED);

  if (order.trackingNumber) {
    y -= 15;
    text(`Tracking  ${order.trackingNumber}`, MARGIN, 9, regular, MUTED);
  }
  if (order.shippingServiceName) {
    y -= 13;
    text(order.shippingServiceName, MARGIN, 9, regular, MUTED);
  }

  const leftBottom = y;
  y = blockTop;

  text("SHIP TO", rightColumn, 8, bold, MUTED);
  y -= 15;
  for (const line of addressLines(order)) {
    text(truncate(line, CONTENT / 2 - 10, 10, regular), rightColumn, 10);
    y -= 14;
  }

  y = Math.min(leftBottom, y) - 26;

  // ── Items ──────────────────────────────────────────────────────────────────
  const COL_TICK = MARGIN;
  const COL_ITEM = MARGIN + 26;
  const COL_QTY = MARGIN + CONTENT - 34;
  const ITEM_WIDTH = COL_QTY - COL_ITEM - 16;

  const drawTableHead = () => {
    text("ITEM", COL_ITEM, 8, bold, MUTED);
    text("QTY", COL_QTY, 8, bold, MUTED);
    y -= 8;
    rule();
    y -= 18;
  };

  drawTableHead();

  let rowsLeft = ROWS_FIRST_PAGE;
  for (const item of items) {
    if (rowsLeft === 0) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
      text(`Packing list — Order #${order.id} (continued)`, MARGIN, 9, regular, MUTED);
      y -= 20;
      drawTableHead();
      rowsLeft = ROWS_LATER_PAGE;
    }

    // An empty square per line. The packer ticks it; the buyer ticks it again
    // on arrival. Cheaper than any reconciliation that happens afterwards.
    page.drawRectangle({
      x: COL_TICK,
      y: y - 2,
      width: 11,
      height: 11,
      borderColor: rgb(0.65, 0.65, 0.65),
      borderWidth: 0.9,
    });

    const name = item.variationLabel
      ? `${item.productName} — ${item.variationLabel}`
      : item.productName;
    text(truncate(name, ITEM_WIDTH, 10.5, regular), COL_ITEM, 10.5);
    text(`${item.quantity}`, COL_QTY, 10.5, bold);

    y -= 13;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN + CONTENT, y: y + 4 },
      thickness: 0.4,
      color: rgb(0.93, 0.93, 0.93),
    });
    y -= 12;
    rowsLeft--;
  }

  // ── Total ──────────────────────────────────────────────────────────────────
  y -= 4;
  rule();
  y -= 18;
  const units = totalUnits(items);
  text("Total units in this parcel", MARGIN + 26, 10, bold);
  text(`${units}`, COL_QTY, 10, bold);

  // ── Terms ──────────────────────────────────────────────────────────────────
  // Low on the page and small, but present: this catalogue does not ship
  // without the handling terms, and the parcel is where a buyer meets them.
  const footerY = MARGIN + 34;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 22 },
    end: { x: MARGIN + CONTENT, y: footerY + 22 },
    thickness: 0.75,
    color: RULE,
  });
  page.drawText(
    "All materials are supplied for laboratory research use only. Not for human or veterinary",
    { x: MARGIN, y: footerY + 8, size: 8, font: regular, color: MUTED }
  );
  page.drawText(
    "use. Check the contents against this list on arrival and report any discrepancy within 7 days.",
    { x: MARGIN, y: footerY - 2, size: 8, font: regular, color: MUTED }
  );

  return pdf.save();
}
