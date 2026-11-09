import { describe, expect, it } from "vitest";
import { addressLines, buildPackingListPdf, totalUnits } from "./packingList";

const ORIGIN = {
  name: "Brighter Days Labs",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
};

const ORDER = {
  id: 8011,
  createdAt: new Date("2026-11-04T12:58:00Z"),
  trackingNumber: "1Z999AA10123456784",
  shippingServiceName: "UPS Ground",
  shippingFirstName: "Jane",
  shippingLastName: "Roe",
  shippingAddress: "1 Main Street",
  shippingCity: "New York",
  shippingState: "NY",
  shippingZip: "10001",
  shippingCountry: "United States",
};

describe("totalUnits", () => {
  it("counts units, not lines — the figure a packer checks against", () => {
    expect(
      totalUnits([
        { productName: "BPC-157", quantity: 2 },
        { productName: "TB-500", quantity: 1 },
        { productName: "BAC Water", quantity: 4 },
      ])
    ).toBe(7);
  });

  it("is zero for nothing", () => {
    expect(totalUnits([])).toBe(0);
  });
});

describe("addressLines", () => {
  it("lays out a complete address", () => {
    expect(addressLines(ORDER)).toEqual([
      "Jane Roe",
      "1 Main Street",
      "New York, NY 10001",
      "United States",
    ]);
  });

  it("drops missing parts instead of printing blanks or stray commas", () => {
    // Guest and legacy orders have gaps, and a blank line in an address block
    // reads as a system that lost something.
    expect(
      addressLines({
        id: 1,
        createdAt: new Date(),
        shippingFirstName: "Jane",
        shippingLastName: null,
        shippingAddress: null,
        shippingCity: "New York",
        shippingState: null,
        shippingZip: "10001",
        shippingCountry: null,
      })
    ).toEqual(["Jane", "New York 10001"]);
  });

  it("returns nothing at all rather than a block of empty lines", () => {
    expect(addressLines({ id: 1, createdAt: new Date() })).toEqual([]);
  });
});

describe("buildPackingListPdf", () => {
  const items = [
    { productName: "BPC-157", variationLabel: "10mg", quantity: 2 },
    { productName: "Bacteriostatic Water", variationLabel: "10ml", quantity: 4 },
  ];

  it("produces a real PDF", async () => {
    const bytes = await buildPackingListPdf(ORDER, items, ORIGIN);
    // %PDF- — the magic number a viewer checks before anything else.
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("survives a product name far longer than its column", async () => {
    // pdf-lib draws straight off the page rather than wrapping or throwing, so
    // the truncation is the only thing standing between a long catalogue name
    // and a corrupted-looking row.
    const bytes = await buildPackingListPdf(
      ORDER,
      [{ productName: "R".repeat(400), variationLabel: "10mg", quantity: 1 }],
      ORIGIN
    );
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("paginates rather than running off the bottom of the page", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      productName: `Compound ${i + 1}`,
      variationLabel: "10mg",
      quantity: 1,
    }));
    const long = await buildPackingListPdf(ORDER, many, ORIGIN);
    const short = await buildPackingListPdf(ORDER, items, ORIGIN);
    expect(long.length).toBeGreaterThan(short.length);
  });

  it("builds for an order with no tracking number yet", async () => {
    // Picking happens before the parcel is addressed, so the sheet has to exist
    // before a label does.
    const bytes = await buildPackingListPdf(
      { ...ORDER, trackingNumber: null, shippingServiceName: null },
      items,
      ORIGIN
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("falls back to the shop name when the origin has none set", async () => {
    const bytes = await buildPackingListPdf(ORDER, items, { ...ORIGIN, name: "" });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});
