/**
 * Turning the carrier's label into something a 4x6 thermal printer accepts.
 *
 * UPS does not return a 4x6 PDF. `LabelStockSize` is honoured only for the
 * thermal languages (ZPL, EPL2, SPL); ask for PDF and the label comes back
 * drawn on US Letter, sideways, in the bottom-left corner with the rest of the
 * sheet blank. Measured on a real label: the printed area is exactly 432 x 288
 * points — six inches by four — sitting at the bottom-left of a 612 x 792 page,
 * rotated a quarter turn.
 *
 * Handed to a 4x6 printer, that sheet is scaled to fit the stock, so a label
 * meant to be four inches wide arrives under two. A barcode shrunk that far is
 * one a scanner can refuse, which is the failure the shop actually sees.
 *
 * So we crop. The page content is lifted out at its true size and placed on a
 * 288 x 432 page, turned upright: no scaling anywhere, which matters because
 * barcode widths are a physical specification and not a style.
 *
 * Why here and not at purchase time: the carrier's original stays in the
 * database untouched, every label already bought prints correctly from now on,
 * and if UPS ever changes the template the fix is one function rather than a
 * migration over stored binaries.
 */

import { PDFDocument, degrees } from "pdf-lib";

/** 4x6 inches at 72 points to the inch, portrait. The printer's stock. */
export const FOUR_BY_SIX = { width: 288, height: 432 } as const;

/** US Letter, which is what UPS draws the label on. */
const LETTER = { width: 612, height: 792 } as const;

/**
 * Where UPS puts the label on that sheet, in PDF points from the bottom-left.
 *
 * Measured from a production label rather than taken from the documentation,
 * which does not describe the PDF layout at all. The ink runs from x 14.9 to
 * 442.6 and y 13.0 to 301.0; this box is that ink grown to exactly 432 x 288
 * about its own centre, so nothing is clipped and nothing is scaled.
 */
const UPS_LABEL_BOX = {
  left: 12.75,
  bottom: 13,
  right: 444.75,
  top: 301,
} as const;

const SIZE_TOLERANCE = 2;

const near = (value: number, target: number) => Math.abs(value - target) <= SIZE_TOLERANCE;

/** Whether a page is already the size a 4x6 printer wants. */
export function isFourBySix(width: number, height: number): boolean {
  return near(width, FOUR_BY_SIX.width) && near(height, FOUR_BY_SIX.height);
}

/** Whether a page is the US Letter sheet we know how to crop. */
export function isLetter(width: number, height: number): boolean {
  return near(width, LETTER.width) && near(height, LETTER.height);
}

/**
 * Crops a carrier label PDF down to a true 4x6 page.
 *
 * Deliberately conservative: anything that is not the Letter sheet we measured
 * is returned untouched. A label we do not recognise is one we would be
 * guessing about, and a wrongly cropped label is worse than a correctly sized
 * sheet — the shop can still scale that one by hand, but it cannot recover a
 * barcode we cut in half.
 */
export async function cropLabelToFourBySix(pdfBytes: Uint8Array): Promise<Uint8Array> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch {
    // Not a PDF we can parse. Hand back exactly what we were given.
    return pdfBytes;
  }

  const pages = source.getPages();
  if (pages.length !== 1) return pdfBytes;

  const { width, height } = pages[0].getSize();
  if (isFourBySix(width, height)) return pdfBytes;
  if (!isLetter(width, height)) return pdfBytes;

  const out = await PDFDocument.create();
  out.setTitle(source.getTitle() ?? "Shipping label");
  out.setProducer("Brighter Days Labs");

  const embedded = await out.embedPage(pages[0], UPS_LABEL_BOX);
  const page = out.addPage([FOUR_BY_SIX.width, FOUR_BY_SIX.height]);

  // The cropped region is 432 wide by 288 tall and lies on its side. Turning it
  // three quarters anti-clockwise stands it up; the origin then sits at the
  // page's top-left, hence the y offset. Width and height are passed at their
  // measured values so the draw is 1:1 — no scaling, by design.
  page.drawPage(embedded, {
    x: 0,
    y: FOUR_BY_SIX.height,
    rotate: degrees(270),
    width: UPS_LABEL_BOX.right - UPS_LABEL_BOX.left,
    height: UPS_LABEL_BOX.top - UPS_LABEL_BOX.bottom,
  });

  return out.save();
}
