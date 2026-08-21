import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIPPING_SETTINGS,
  MIN_BILLABLE_LBS,
  UPS_SERVICES,
  enabledServices,
  isOriginComplete,
  originSchema,
  ouncesToPounds,
  parseShippingSettings,
  resolveUnitWeightOz,
  shippingSettingsSchema,
  sumCartWeightOz,
  upsServiceLabel,
} from "@shared/shipping";

/**
 * Two things here decide real money: what a package is said to weigh, and
 * whether we are willing to quote at all. Both fail quietly if left to
 * defaults — an unweighed product that silently becomes zero ounces produces a
 * rate we would honour and the carrier would not.
 */

// ─── Weight resolution ───────────────────────────────────────────────────────

describe("resolveUnitWeightOz", () => {
  it("uses the product weight when the variation has none", () => {
    expect(resolveUnitWeightOz({ weightOz: "2.5" }, { weightOz: null })).toBe(2.5);
    expect(resolveUnitWeightOz({ weightOz: "2.5" }, null)).toBe(2.5);
    expect(resolveUnitWeightOz({ weightOz: "2.5" })).toBe(2.5);
  });

  it("prefers the variation weight when it has one", () => {
    // The case the override exists for: 30 mL really does outweigh 10 mL.
    expect(resolveUnitWeightOz({ weightOz: "2.5" }, { weightOz: "6.0" })).toBe(6);
  });

  it("accepts numbers as well as the strings MySQL returns", () => {
    expect(resolveUnitWeightOz({ weightOz: 2.5 })).toBe(2.5);
  });

  it("is null when neither has a weight", () => {
    expect(resolveUnitWeightOz({ weightOz: null }, { weightOz: null })).toBeNull();
    expect(resolveUnitWeightOz({})).toBeNull();
  });

  it("treats blank, zero and negative as not recorded", () => {
    // A zero weight is not a light package; it is a missing measurement, and
    // quoting on it would produce a rate the carrier never agreed to.
    expect(resolveUnitWeightOz({ weightOz: "" })).toBeNull();
    expect(resolveUnitWeightOz({ weightOz: "0" })).toBeNull();
    expect(resolveUnitWeightOz({ weightOz: "0.00" })).toBeNull();
    expect(resolveUnitWeightOz({ weightOz: "-1" })).toBeNull();
    expect(resolveUnitWeightOz({ weightOz: "not a number" })).toBeNull();
  });

  it("falls back to the product when the variation weight is unusable", () => {
    expect(resolveUnitWeightOz({ weightOz: "2.5" }, { weightOz: "0" })).toBe(2.5);
  });
});

// ─── Cart weight ─────────────────────────────────────────────────────────────

describe("sumCartWeightOz", () => {
  it("multiplies by quantity and adds the lines up", () => {
    const result = sumCartWeightOz([
      { productName: "BPC-157", quantity: 2, product: { weightOz: "1.5" } },
      { productName: "Semax", quantity: 1, product: { weightOz: "2" } },
    ]);
    expect(result).toEqual({ totalOz: 5, missing: [] });
  });

  it("applies a variation override per line", () => {
    const result = sumCartWeightOz([
      {
        productName: "BAC Water",
        quantity: 3,
        product: { weightOz: "2" },
        variation: { weightOz: "6" },
      },
    ]);
    expect(result.totalOz).toBe(18);
  });

  it("refuses a total when any line cannot be weighed", () => {
    // Not a partial total: shipping half a cart's weight would quote a rate
    // that is wrong in the carrier's favour, every time.
    const result = sumCartWeightOz([
      { productName: "BPC-157", quantity: 1, product: { weightOz: "1.5" } },
      { productName: "GHK-Cu", quantity: 1, product: { weightOz: null } },
    ]);
    expect(result.totalOz).toBeNull();
    expect(result.missing).toEqual(["GHK-Cu"]);
  });

  it("names each unweighed product once, however many lines it has", () => {
    const result = sumCartWeightOz([
      { productName: "GHK-Cu", quantity: 1, product: { weightOz: null } },
      { productName: "GHK-Cu", quantity: 2, product: { weightOz: null } },
      { productName: "GLOW", quantity: 1, product: { weightOz: null } },
    ]);
    expect(result.missing).toEqual(["GHK-Cu", "GLOW"]);
  });

  it("weighs an empty cart as zero, which is not the same as unknown", () => {
    expect(sumCartWeightOz([])).toEqual({ totalOz: 0, missing: [] });
  });
});

// ─── Unit conversion ─────────────────────────────────────────────────────────

describe("ouncesToPounds", () => {
  it("converts sixteen ounces to a pound", () => {
    expect(ouncesToPounds(16)).toBe(1);
  });

  it("rounds up to a tenth rather than down", () => {
    // Rounding down would declare a lighter parcel than the one handed over,
    // and the carrier bills what it weighs.
    expect(ouncesToPounds(17)).toBe(1.1);
    expect(ouncesToPounds(16.1)).toBe(1.1);
  });

  it("never goes below the minimum billable weight", () => {
    expect(ouncesToPounds(0.1)).toBe(MIN_BILLABLE_LBS);
    expect(ouncesToPounds(1)).toBe(MIN_BILLABLE_LBS);
  });

  it("handles a realistic vial", () => {
    expect(ouncesToPounds(2.5)).toBeCloseTo(0.2, 5);
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe("parseShippingSettings", () => {
  it("returns defaults for an absent value", () => {
    expect(parseShippingSettings(null)).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect(parseShippingSettings(undefined)).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect(parseShippingSettings("")).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });

  it("returns defaults rather than throwing on malformed JSON", () => {
    // The stored row is hand-editable and predates any given version of this
    // schema. A settings page that crashes on it cannot be used to fix it.
    expect(parseShippingSettings("{not json")).toEqual(DEFAULT_SHIPPING_SETTINGS);
    expect(parseShippingSettings("[]")).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });

  it("reads back what was written", () => {
    const settings = shippingSettingsSchema.parse({
      origin: {
        name: "Brighter Days Labs",
        street: "400 Science Park Dr",
        city: "Boston",
        state: "MA",
        zip: "02115",
        country: "United States",
      },
      services: { "03": true, "02": true, "01": false },
      handlingFeeUsd: 2.5,
    });
    expect(parseShippingSettings(JSON.stringify(settings))).toEqual(settings);
  });

  it("fills in missing sections with defaults", () => {
    const parsed = parseShippingSettings(JSON.stringify({ handlingFeeUsd: 3 }));
    expect(parsed.handlingFeeUsd).toBe(3);
    expect(parsed.origin.country).toBe("United States");
  });

  it("rejects a handling fee outside the allowed band", () => {
    expect(shippingSettingsSchema.safeParse({ handlingFeeUsd: -1 }).success).toBe(false);
    expect(shippingSettingsSchema.safeParse({ handlingFeeUsd: 1000 }).success).toBe(false);
  });

  it("starts with ground on and no handling fee", () => {
    expect(DEFAULT_SHIPPING_SETTINGS.services["03"]).toBe(true);
    expect(DEFAULT_SHIPPING_SETTINGS.handlingFeeUsd).toBe(0);
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

  it("rejects a default, empty origin", () => {
    expect(isOriginComplete(originSchema.parse({}))).toBe(false);
  });

  it("rejects when any single field is missing", () => {
    for (const key of Object.keys(full) as Array<keyof typeof full>) {
      expect(isOriginComplete({ ...full, [key]: "" })).toBe(false);
    }
  });

  it("rejects whitespace masquerading as a value", () => {
    expect(isOriginComplete({ ...full, zip: "   " })).toBe(false);
  });
});

describe("enabledServices", () => {
  it("returns only the switched-on codes, in offer order", () => {
    const settings = shippingSettingsSchema.parse({
      services: { "01": true, "03": true },
    });
    // Declaration order, not object-key order: Ground is offered first.
    expect(enabledServices(settings)).toEqual(["03", "01"]);
  });

  it("is empty when nothing is offered", () => {
    expect(enabledServices(shippingSettingsSchema.parse({ services: {} }))).toEqual([]);
  });

  it("ignores codes that are not services we offer", () => {
    const settings = shippingSettingsSchema.parse({ services: { "99": true } });
    expect(enabledServices(settings)).toEqual([]);
  });
});

describe("upsServiceLabel", () => {
  it("names the three offered services", () => {
    expect(upsServiceLabel("03")).toBe("UPS Ground");
    expect(upsServiceLabel("02")).toBe("UPS 2nd Day Air");
    expect(upsServiceLabel("01")).toBe("UPS Next Day Air");
  });

  it("falls back to the raw code for anything else", () => {
    expect(upsServiceLabel("12")).toBe("UPS service 12");
  });

  it("covers every service in the table", () => {
    for (const service of UPS_SERVICES) {
      expect(upsServiceLabel(service.code)).toBe(service.label);
    }
  });
});
