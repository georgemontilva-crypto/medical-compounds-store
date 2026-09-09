import { describe, expect, it } from "vitest";
import { buildLabelBody, parseRates } from "./ups";
import { originSchema, shippingSettingsSchema } from "@shared/shipping";

/**
 * Reading a rate response is where a carrier's answer becomes a price a shopper
 * sees, so the shapes that surprised us against the real sandbox are pinned
 * here: a service returned twice at two prices, a single result arriving
 * unwrapped, and transit time living in either of two containers.
 */

const settings = shippingSettingsSchema.parse({
  services: { "03": true, "02": true, "01": true },
  handlingFeeUsd: 0,
});

const withFee = shippingSettingsSchema.parse({
  services: { "03": true },
  handlingFeeUsd: 2.5,
});

const groundOnly = shippingSettingsSchema.parse({ services: { "03": true } });

function rated(
  code: string,
  amount: string,
  opts: { transit?: number; guaranteed?: number; currency?: string } = {}
) {
  return {
    Service: { Code: code },
    TotalCharges: { MonetaryValue: amount, CurrencyCode: opts.currency ?? "USD" },
    ...(opts.transit !== undefined
      ? {
          TimeInTransit: {
            ServiceSummary: { EstimatedArrival: { BusinessDaysInTransit: String(opts.transit) } },
          },
        }
      : {}),
    ...(opts.guaranteed !== undefined
      ? { GuaranteedDelivery: { BusinessDaysInTransit: String(opts.guaranteed) } }
      : {}),
  };
}

const response = (entries: unknown) => ({ RateResponse: { RatedShipment: entries } });

// ─── Filtering ───────────────────────────────────────────────────────────────

describe("parseRates — which services are offered", () => {
  it("keeps only the services the shop switched on", () => {
    // UPS answers with everything it can carry; the shop sells three at most.
    const json = response([
      rated("03", "11.01"),
      rated("12", "16.59"),
      rated("02", "17.43"),
      rated("59", "22.84"),
      rated("14", "61.58"),
    ]);
    expect(parseRates(json, groundOnly).map((r) => r.serviceCode)).toEqual(["03"]);
    expect(parseRates(json, settings).map((r) => r.serviceCode)).toEqual(["03", "02"]);
  });

  it("returns nothing when no offered service came back", () => {
    expect(parseRates(response([rated("12", "16.59")]), groundOnly)).toEqual([]);
  });
});

// ─── Duplicates ──────────────────────────────────────────────────────────────

describe("parseRates — the same service twice", () => {
  it("keeps the cheaper of two entries for one service", () => {
    // Seen against the live sandbox: code 01 came back at both 31.58 and 47.58.
    // Two rows reading "UPS Next Day Air" is not a choice anyone can make.
    const json = response([rated("01", "47.58", { transit: 1 }), rated("01", "31.58", { transit: 1 })]);
    const rates = parseRates(json, settings);
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(31.58);
  });

  it("keeps the cheaper regardless of the order they arrive in", () => {
    const cheapFirst = response([rated("01", "31.58"), rated("01", "47.58")]);
    expect(parseRates(cheapFirst, settings)[0].amount).toBe(31.58);
  });

  it("never returns a duplicated service code", () => {
    const json = response([rated("03", "11.01"), rated("03", "12.00"), rated("02", "17.43")]);
    const codes = parseRates(json, settings).map((r) => r.serviceCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ─── Money ───────────────────────────────────────────────────────────────────

describe("parseRates — prices", () => {
  it("adds the handling fee once per option and keeps the carrier figure", () => {
    const rates = parseRates(response([rated("03", "11.01")]), withFee);
    expect(rates[0].carrierAmount).toBe(11.01);
    expect(rates[0].amount).toBe(13.51);
  });

  it("rounds to whole cents rather than carrying float dust", () => {
    const settingsOddFee = shippingSettingsSchema.parse({
      services: { "03": true },
      handlingFeeUsd: 0.1,
    });
    expect(parseRates(response([rated("03", "11.02")]), settingsOddFee)[0].amount).toBe(11.12);
  });

  it("sorts cheapest first, whatever order UPS used", () => {
    const json = response([rated("01", "31.58"), rated("03", "11.01"), rated("02", "17.43")]);
    expect(parseRates(json, settings).map((r) => r.amount)).toEqual([11.01, 17.43, 31.58]);
  });

  it("skips an entry with an unreadable amount rather than pricing it at zero", () => {
    // A free shipping option nobody agreed to is worse than one option fewer.
    const json = response([rated("03", "not a number"), rated("02", "17.43")]);
    expect(parseRates(json, settings).map((r) => r.serviceCode)).toEqual(["02"]);
  });

  it("carries the currency through", () => {
    expect(parseRates(response([rated("03", "11.01")]), groundOnly)[0].currency).toBe("USD");
  });
});

// ─── Transit ─────────────────────────────────────────────────────────────────

describe("parseRates — transit times", () => {
  it("reads transit from the time-in-transit container", () => {
    expect(parseRates(response([rated("03", "11.01", { transit: 2 })]), groundOnly)[0].transitDays).toBe(2);
  });

  it("falls back to the guaranteed-delivery container", () => {
    expect(
      parseRates(response([rated("01", "31.58", { guaranteed: 1 })]), settings)[0].transitDays
    ).toBe(1);
  });

  it("prefers time-in-transit when both are present", () => {
    const json = response([rated("03", "11.01", { transit: 3, guaranteed: 5 })]);
    expect(parseRates(json, groundOnly)[0].transitDays).toBe(3);
  });

  it("is null when UPS commits to nothing, rather than guessing a number", () => {
    expect(parseRates(response([rated("03", "11.01")]), groundOnly)[0].transitDays).toBeNull();
  });

  it("treats a zero or negative transit as no commitment", () => {
    expect(parseRates(response([rated("03", "11.01", { transit: 0 })]), groundOnly)[0].transitDays).toBeNull();
  });
});

// ─── Shapes ──────────────────────────────────────────────────────────────────

describe("parseRates — response shapes", () => {
  it("accepts a single result that arrives unwrapped", () => {
    // UPS sends an object rather than a one-element array when only one service
    // matches, which reads as "no rates" if the caller assumes an array.
    const rates = parseRates(response(rated("03", "11.01", { transit: 2 })), groundOnly);
    expect(rates).toHaveLength(1);
    expect(rates[0].serviceCode).toBe("03");
  });

  it("names the service for display", () => {
    expect(parseRates(response([rated("03", "11.01")]), groundOnly)[0].serviceName).toBe("UPS Ground");
  });

  it("returns nothing for an empty, missing or malformed body", () => {
    expect(parseRates(response([]), settings)).toEqual([]);
    expect(parseRates({}, settings)).toEqual([]);
    expect(parseRates(null, settings)).toEqual([]);
    expect(parseRates({ RateResponse: {} }, settings)).toEqual([]);
  });

  it("skips an entry with no service code", () => {
    const json = response([{ TotalCharges: { MonetaryValue: "11.01" } }, rated("03", "11.01")]);
    expect(parseRates(json, groundOnly)).toHaveLength(1);
  });
});

/**
 * The label body. UPS names the same concepts differently between Rating and
 * Shipping, and the two are edited side by side in this file — so the field
 * that actually broke a real label is pinned by name here.
 */
describe("buildLabelBody", () => {
  const origin = originSchema.parse({
    name: "Brighter Days Labs",
    street: "4200 Steve Reynolds Blvd",
    city: "Norcross",
    state: "GA",
    zip: "30093",
    country: "US",
  });

  const request = {
    serviceCode: "03",
    weightOz: 8.02,
    box: { lengthIn: 6, widthIn: 4, heightIn: 3 },
    recipient: {
      name: "Jane Roe",
      street: "1 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      phone: "(212) 555-0100",
    },
  };

  const pkg = (body: any) => body.ShipmentRequest.Shipment.Package[0];

  it("names the packaging field the way Shipping expects, not the way Rating does", () => {
    const body = buildLabelBody(origin, request, "A86B60") as any;
    // Sending Rating's `PackagingType` here is what produced
    // "120600 Missing or invalid packaging type code" against the live API.
    expect(pkg(body).Packaging).toEqual({ Code: "02" });
    expect(pkg(body).PackagingType).toBeUndefined();
  });

  it("bills the account it was given rather than reading the environment", () => {
    const body = buildLabelBody(origin, request, "A86B60") as any;
    expect(body.ShipmentRequest.Shipment.Shipper.ShipperNumber).toBe("A86B60");
    expect(
      body.ShipmentRequest.Shipment.PaymentInformation.ShipmentCharge.BillShipper.AccountNumber
    ).toBe("A86B60");
  });

  it("sends dimensions and weight as strings, which UPS requires", () => {
    const body = buildLabelBody(origin, request, "A86B60") as any;
    expect(pkg(body).Dimensions).toMatchObject({
      UnitOfMeasurement: { Code: "IN" },
      Length: "6",
      Width: "4",
      Height: "3",
    });
    // 8.02 oz rounds up: UPS bills what it weighs, not what we declared.
    expect(pkg(body).PackageWeight.Weight).toBe("0.6");
  });

  it("strips punctuation from the recipient phone", () => {
    const body = buildLabelBody(origin, request, "A86B60") as any;
    expect(body.ShipmentRequest.Shipment.ShipTo.Phone).toEqual({ Number: "2125550100" });
  });

  it("omits the phone entirely when there is none, rather than sending an empty one", () => {
    const withoutPhone = { ...request, recipient: { ...request.recipient, phone: null } };
    const body = buildLabelBody(origin, withoutPhone, "A86B60") as any;
    expect(body.ShipmentRequest.Shipment.ShipTo.Phone).toBeUndefined();
  });
});
