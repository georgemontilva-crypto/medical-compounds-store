import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIPPING_SETTINGS,
  MIN_BILLABLE_LBS,
  UPS_DIM_DIVISOR,
  UPS_SERVICES,
  billableWeightLbs,
  computePackage,
  countUnits,
  dimensionalWeightLbs,
  enabledServices,
  isOriginComplete,
  isReadyToQuote,
  originSchema,
  ouncesToPounds,
  parseShippingSettings,
  pickBox,
  resolveUnitWeightOz,
  shippingBoxSchema,
  shippingReadiness,
  shippingSettingsSchema,
  sumCartWeightOz,
  upsServiceLabel,
  type ShippingBox,
  type WeighableLine,
} from "@shared/shipping";

/**
 * What a parcel is said to weigh, and which box it is said to travel in, are
 * both real money. The second one more than the first: UPS bills the greater of
 * actual and dimensional weight, and a box of vials is light enough that the
 * carton almost always wins — so the wrong box silently multiplies the rate.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SMALL: ShippingBox = {
  name: "Standard box",
  lengthIn: 6,
  widthIn: 4,
  heightIn: 3,
  maxUnits: 4,
  packagingWeightOz: null,
};

const LARGE: ShippingBox = {
  name: "Large box",
  lengthIn: 10,
  widthIn: 8,
  heightIn: 4,
  maxUnits: 12,
  packagingWeightOz: 5,
};

/** The shop as configured: 2.5 oz vials, 3 oz of packaging, two boxes. */
const SETTINGS = shippingSettingsSchema.parse({
  defaultVialWeightOz: 2.5,
  packagingWeightOz: 3,
  boxes: [SMALL, LARGE],
});

const standardVial = (quantity: number, name = "BPC-157"): WeighableLine => ({
  productName: name,
  quantity,
  product: { weightOz: null },
});

const bacWater = (quantity = 1): WeighableLine => ({
  productName: "BAC Water 10mL",
  quantity,
  product: { weightOz: "8" },
});

// ─── The four worked examples ────────────────────────────────────────────────
// These are the cases the shop owner specified by hand. They are written out
// rather than computed so that a change in the arithmetic fails here loudly.

describe("computePackage — the specified examples", () => {
  it("1 standard vial weighs 2.5 + 3 = 5.5 oz", () => {
    expect(computePackage([standardVial(1)], SETTINGS).totalOz).toBe(5.5);
  });

  it("2 standard vials weigh 5 + 3 = 8 oz", () => {
    expect(computePackage([standardVial(2)], SETTINGS).totalOz).toBe(8);
  });

  it("BAC Water at its own 8 oz weighs 8 + 3 = 11 oz", () => {
    expect(computePackage([bacWater(1)], SETTINGS).totalOz).toBe(11);
  });

  it("3 standard vials plus BAC Water weigh 7.5 + 8 + 3 = 18.5 oz", () => {
    const pkg = computePackage([standardVial(3), bacWater(1)], SETTINGS);
    expect(pkg.contentsOz).toBe(15.5);
    expect(pkg.packagingOz).toBe(3);
    expect(pkg.totalOz).toBe(18.5);
    // Four units still fit the small box, so the packaging figure is its own.
    expect(pkg.units).toBe(4);
    expect(pkg.box?.name).toBe("Standard box");
  });
});

describe("computePackage — packaging and box interplay", () => {
  it("counts packaging once per order, not per unit", () => {
    const one = computePackage([standardVial(1)], SETTINGS);
    const two = computePackage([standardVial(2)], SETTINGS);
    expect(two.totalOz - one.totalOz).toBe(2.5);
  });

  it("uses the chosen box's own packaging weight when it has one", () => {
    // Five units overflow the small box, so the large one and its 5 oz apply.
    const pkg = computePackage([standardVial(5)], SETTINGS);
    expect(pkg.box?.name).toBe("Large box");
    expect(pkg.packagingOz).toBe(5);
    expect(pkg.totalOz).toBe(2.5 * 5 + 5);
  });

  it("falls back to the shop packaging weight when no box defines one", () => {
    expect(computePackage([standardVial(1)], SETTINGS).packagingOz).toBe(3);
  });

  it("falls back to the shop packaging weight when no boxes exist at all", () => {
    const noBoxes = shippingSettingsSchema.parse({ defaultVialWeightOz: 2.5, packagingWeightOz: 3 });
    const pkg = computePackage([standardVial(1)], noBoxes);
    expect(pkg.box).toBeNull();
    expect(pkg.totalOz).toBe(5.5);
  });

  it("weighs an empty cart as packaging alone", () => {
    expect(computePackage([], SETTINGS).contentsOz).toBe(0);
  });
});

// ─── Weight precedence ───────────────────────────────────────────────────────

describe("resolveUnitWeightOz — variation, then product, then default", () => {
  it("falls back to the shop default when nothing is recorded", () => {
    expect(resolveUnitWeightOz({ weightOz: null }, null, 2.5)).toBe(2.5);
    expect(resolveUnitWeightOz({}, undefined, 2.5)).toBe(2.5);
  });

  it("prefers the product's own weight over the default", () => {
    expect(resolveUnitWeightOz({ weightOz: "8" }, null, 2.5)).toBe(8);
  });

  it("prefers the variation's weight over the product's", () => {
    // The whole point of the override: were the product to win, a per-size
    // weight could never take effect, which is the 10 mL versus 30 mL case.
    expect(resolveUnitWeightOz({ weightOz: "8" }, { weightOz: "16" }, 2.5)).toBe(16);
  });

  it("treats blank, zero and rubbish as not recorded at either level", () => {
    expect(resolveUnitWeightOz({ weightOz: "" }, { weightOz: "" }, 2.5)).toBe(2.5);
    expect(resolveUnitWeightOz({ weightOz: "0" }, { weightOz: "0" }, 2.5)).toBe(2.5);
    expect(resolveUnitWeightOz({ weightOz: "-3" }, null, 2.5)).toBe(2.5);
    expect(resolveUnitWeightOz({ weightOz: "abc" }, null, 2.5)).toBe(2.5);
  });

  it("falls through the variation to the product when the override is unusable", () => {
    expect(resolveUnitWeightOz({ weightOz: "8" }, { weightOz: "0" }, 2.5)).toBe(8);
  });

  it("accepts numbers as well as the strings MySQL returns", () => {
    expect(resolveUnitWeightOz({ weightOz: 8 }, null, 2.5)).toBe(8);
  });
});

describe("sumCartWeightOz and countUnits", () => {
  it("multiplies by quantity across lines", () => {
    expect(sumCartWeightOz([standardVial(2), bacWater(1)], 2.5)).toBe(13);
  });

  it("counts units, which is what picks the box", () => {
    expect(countUnits([standardVial(3), bacWater(2)])).toBe(5);
    expect(countUnits([])).toBe(0);
  });
});

// ─── Box selection ───────────────────────────────────────────────────────────

describe("pickBox", () => {
  const boxes = [LARGE, SMALL]; // deliberately unsorted

  it("picks the smallest box that holds the order", () => {
    expect(pickBox(1, boxes).box?.name).toBe("Standard box");
    expect(pickBox(4, boxes).box?.name).toBe("Standard box");
  });

  it("treats maxUnits as inclusive — the fourth unit still fits", () => {
    expect(pickBox(4, boxes).box?.name).toBe("Standard box");
    expect(pickBox(5, boxes).box?.name).toBe("Large box");
  });

  it("returns nothing when no boxes are configured", () => {
    expect(pickBox(1, [])).toEqual({ box: null, oversize: false });
  });

  it("uses the largest box and flags an order that exceeds every box", () => {
    // Quoted anyway rather than refused: blocking a sale over a case that needs
    // a human either way is the worse failure. The flag is what gets it packed
    // and re-rated by hand.
    const selection = pickBox(50, boxes);
    expect(selection.box?.name).toBe("Large box");
    expect(selection.oversize).toBe(true);
  });

  it("does not flag an order that fits", () => {
    expect(pickBox(12, boxes).oversize).toBe(false);
  });

  it("propagates the oversize flag through computePackage", () => {
    expect(computePackage([standardVial(50)], SETTINGS).oversize).toBe(true);
  });
});

// ─── Dimensional weight ──────────────────────────────────────────────────────

describe("dimensionalWeightLbs", () => {
  it("divides cubic inches by the UPS daily-rate divisor", () => {
    expect(dimensionalWeightLbs(SMALL)).toBeCloseTo((6 * 4 * 3) / UPS_DIM_DIVISOR, 6);
    expect(UPS_DIM_DIVISOR).toBe(139);
  });

  it("rounds each dimension up to a whole inch first, as UPS does", () => {
    const box = { lengthIn: 6.1, widthIn: 4.2, heightIn: 3.3 };
    expect(dimensionalWeightLbs(box)).toBeCloseTo((7 * 5 * 4) / UPS_DIM_DIVISOR, 6);
  });

  it("grows fast with box size — the reason box choice matters", () => {
    expect(dimensionalWeightLbs(LARGE)).toBeGreaterThan(dimensionalWeightLbs(SMALL) * 4);
  });
});

describe("billableWeightLbs", () => {
  it("bills the dimensional weight when the contents are light", () => {
    // One 5.5 oz parcel is 0.34 lb of contents in a box whose size alone rates
    // 0.52 lb; UPS rounds the greater up to the next whole pound.
    expect(billableWeightLbs(5.5, SMALL)).toBe(1);
  });

  it("bills the real weight when the contents are heavy", () => {
    expect(billableWeightLbs(160, SMALL)).toBe(10);
  });

  it("charges a big box for its size however little is inside", () => {
    // The number the settings page shows to discourage oversized cartons.
    expect(billableWeightLbs(5.5, LARGE)).toBe(3);
    expect(billableWeightLbs(5.5, LARGE)).toBeGreaterThan(billableWeightLbs(5.5, SMALL));
  });

  it("falls back to the real weight with no box", () => {
    expect(billableWeightLbs(40, null)).toBe(3);
  });
});

describe("ouncesToPounds", () => {
  it("converts sixteen ounces to a pound", () => {
    expect(ouncesToPounds(16)).toBe(1);
  });

  it("rounds up to a tenth rather than down", () => {
    expect(ouncesToPounds(17)).toBe(1.1);
  });

  it("never goes below the minimum billable weight", () => {
    expect(ouncesToPounds(0.1)).toBe(MIN_BILLABLE_LBS);
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe("shippingBoxSchema", () => {
  it("accepts a well-formed box and defaults the packaging override to null", () => {
    const parsed = shippingBoxSchema.parse({
      name: "Standard box",
      lengthIn: 6,
      widthIn: 4,
      heightIn: 3,
      maxUnits: 4,
    });
    expect(parsed.packagingWeightOz).toBeNull();
  });

  it("rejects a box with no name, zero dimensions or no capacity", () => {
    const base = { name: "Box", lengthIn: 6, widthIn: 4, heightIn: 3, maxUnits: 4 };
    expect(shippingBoxSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(shippingBoxSchema.safeParse({ ...base, lengthIn: 0 }).success).toBe(false);
    expect(shippingBoxSchema.safeParse({ ...base, maxUnits: 0 }).success).toBe(false);
    expect(shippingBoxSchema.safeParse({ ...base, maxUnits: 1.5 }).success).toBe(false);
  });
});

describe("parseShippingSettings", () => {
  it("returns defaults for absent or malformed values", () => {
    expect(parseShippingSettings(null)).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect(parseShippingSettings("{not json")).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });

  it("reads back what was written, boxes included", () => {
    expect(parseShippingSettings(JSON.stringify(SETTINGS))).toEqual(SETTINGS);
  });

  it("starts with no boxes, ground only, and a standard vial weight", () => {
    expect(DEFAULT_SHIPPING_SETTINGS.boxes).toEqual([]);
    expect(DEFAULT_SHIPPING_SETTINGS.services["03"]).toBe(true);
    expect(DEFAULT_SHIPPING_SETTINGS.defaultVialWeightOz).toBeGreaterThan(0);
  });

  it("rejects a zero or negative default vial weight", () => {
    expect(shippingSettingsSchema.safeParse({ defaultVialWeightOz: 0 }).success).toBe(false);
    expect(shippingSettingsSchema.safeParse({ defaultVialWeightOz: -2 }).success).toBe(false);
  });

  it("rejects a handling fee outside the allowed band", () => {
    expect(shippingSettingsSchema.safeParse({ handlingFeeUsd: -1 }).success).toBe(false);
    expect(shippingSettingsSchema.safeParse({ handlingFeeUsd: 1000 }).success).toBe(false);
  });
});

// ─── Readiness ───────────────────────────────────────────────────────────────

describe("shippingReadiness", () => {
  const fullOrigin = {
    name: "Brighter Days Labs",
    street: "400 Science Park Dr",
    city: "Boston",
    state: "MA",
    zip: "02115",
    country: "United States",
  };

  it("is not ready out of the box — no origin and no boxes", () => {
    const r = shippingReadiness(DEFAULT_SHIPPING_SETTINGS);
    expect(r.originComplete).toBe(false);
    expect(r.anyBox).toBe(false);
    expect(r.anyService).toBe(true);
    expect(isReadyToQuote(DEFAULT_SHIPPING_SETTINGS)).toBe(false);
  });

  it("is ready once origin, a service, a box and a vial weight are all set", () => {
    const settings = shippingSettingsSchema.parse({
      origin: fullOrigin,
      services: { "03": true },
      boxes: [SMALL],
      defaultVialWeightOz: 2.5,
    });
    expect(isReadyToQuote(settings)).toBe(true);
  });

  it("is blocked by a missing box even when everything else is set", () => {
    const settings = shippingSettingsSchema.parse({
      origin: fullOrigin,
      services: { "03": true },
      boxes: [],
    });
    expect(shippingReadiness(settings).anyBox).toBe(false);
    expect(isReadyToQuote(settings)).toBe(false);
  });

  it("is blocked by no service selected", () => {
    const settings = shippingSettingsSchema.parse({
      origin: fullOrigin,
      services: {},
      boxes: [SMALL],
    });
    expect(isReadyToQuote(settings)).toBe(false);
  });
});

describe("isOriginComplete", () => {
  const full = {
    name: "Brighter Days Labs",
    street: "400 Science Park Dr",
    city: "Boston",
    state: "MA",
    zip: "02115",
    country: "United States",
  };

  it("accepts a fully filled origin", () => {
    expect(isOriginComplete(full)).toBe(true);
  });

  it("rejects when any single field is blank or whitespace", () => {
    for (const key of Object.keys(full) as Array<keyof typeof full>) {
      expect(isOriginComplete({ ...full, [key]: "" })).toBe(false);
      expect(isOriginComplete({ ...full, [key]: "   " })).toBe(false);
    }
  });

  it("rejects the empty default", () => {
    expect(isOriginComplete(originSchema.parse({}))).toBe(false);
  });
});

// ─── Services ────────────────────────────────────────────────────────────────

describe("enabledServices and labels", () => {
  it("returns only switched-on codes, in offer order", () => {
    const settings = shippingSettingsSchema.parse({ services: { "01": true, "03": true } });
    expect(enabledServices(settings)).toEqual(["03", "01"]);
  });

  it("ignores codes that are not services we offer", () => {
    expect(enabledServices(shippingSettingsSchema.parse({ services: { "99": true } }))).toEqual([]);
  });

  it("names every service in the table and falls back for the rest", () => {
    for (const service of UPS_SERVICES) {
      expect(upsServiceLabel(service.code)).toBe(service.label);
    }
    expect(upsServiceLabel("12")).toBe("UPS service 12");
  });
});
