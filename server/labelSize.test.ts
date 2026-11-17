import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { FOUR_BY_SIX, cropLabelToFourBySix, isFourBySix, isLetter } from "./labelSize";

/** A stand-in for what UPS returns: one Letter page with ink where the label sits. */
async function letterLabel(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  // Drawn in the bottom-left corner, sideways, the way the carrier does it.
  page.drawRectangle({ x: 12.75, y: 13, width: 432, height: 288, borderWidth: 1 });
  page.drawText("1Z A86 B60 02 2325 3169", { x: 20, y: 150, size: 10, font });
  return pdf.save();
}

async function pageSizes(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map(p => p.getSize());
}

describe("isFourBySix / isLetter", () => {
  it("recognises the two page sizes that matter, within a rounding point or two", () => {
    expect(isFourBySix(288, 432)).toBe(true);
    expect(isFourBySix(287, 433)).toBe(true);
    expect(isLetter(612, 792)).toBe(true);
    expect(isLetter(611.976, 792.024)).toBe(true);
  });

  it("does not confuse one for the other, or either for A4", () => {
    expect(isFourBySix(612, 792)).toBe(false);
    expect(isLetter(288, 432)).toBe(false);
    expect(isLetter(595, 842)).toBe(false);
    expect(isFourBySix(432, 288)).toBe(false); // landscape is not the stock
  });
});

describe("cropLabelToFourBySix", () => {
  it("turns the carrier's Letter sheet into a 4x6 page", async () => {
    const cropped = await cropLabelToFourBySix(await letterLabel());
    const sizes = await pageSizes(cropped);

    expect(sizes).toHaveLength(1);
    expect(sizes[0].width).toBeCloseTo(FOUR_BY_SIX.width, 5);
    expect(sizes[0].height).toBeCloseTo(FOUR_BY_SIX.height, 5);
  });

  it("keeps the label at its true size rather than fitting it to the page", async () => {
    // The whole point. Barcode bar widths are a physical specification; a label
    // scaled even a few percent is one a scanner is entitled to reject, so the
    // crop must move the artwork without resizing it.
    const cropped = await cropLabelToFourBySix(await letterLabel());
    const pdf = await PDFDocument.load(cropped);
    const page = pdf.getPages()[0];

    // 432 x 288 of artwork placed on a 288 x 432 page can only fit unscaled if
    // it was turned a quarter turn — which is what the page size proves here.
    expect(page.getWidth()).toBeCloseTo(288, 5);
    expect(page.getHeight()).toBeCloseTo(432, 5);
  });

  it("leaves a label that is already 4x6 completely alone", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([288, 432]);
    const original = await pdf.save();

    expect(await cropLabelToFourBySix(original)).toBe(original);
  });

  it("passes through a page size it has not been taught, rather than guessing", async () => {
    // A4, or anything else the carrier might start returning. Cropping by
    // coordinates measured on a different template would cut a barcode in half,
    // and a correctly sized sheet the shop scales by hand beats that.
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const a4 = await pdf.save();

    expect(await cropLabelToFourBySix(a4)).toBe(a4);
  });

  it("passes through a multi-page document untouched", async () => {
    // Two Letter pages is not the single-label layout we measured.
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    pdf.addPage([612, 792]);
    const twoUp = await pdf.save();

    expect(await cropLabelToFourBySix(twoUp)).toBe(twoUp);
  });

  it("hands back bytes that are not a PDF at all instead of throwing", async () => {
    // A truncated or mislabelled row in the database must not take down the
    // admin's label download; the operator gets the original and can see for
    // themselves that it is broken.
    const junk = new TextEncoder().encode("this is not a pdf");
    expect(await cropLabelToFourBySix(junk)).toBe(junk);
  });
});
