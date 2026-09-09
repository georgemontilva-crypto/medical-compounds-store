import { ENV } from "./_core/env";
import {
  ouncesToPounds,
  upsServiceLabel,
  type ShippingOrigin,
  type ShippingSettings,
  type PackagedShipment,
} from "@shared/shipping";

/**
 * UPS REST client: OAuth, rating, and nothing else it does not need.
 *
 * Called directly over fetch rather than through a package. The two UPS SDKs on
 * npm were last published five and eleven years ago — before UPS retired the
 * XML API and moved to OAuth in 2024 — so they do not merely lag, they speak a
 * protocol that no longer answers.
 *
 * Everything here fails into a typed result rather than an exception. A carrier
 * being slow, unreachable or unhappy with an address is an ordinary Tuesday,
 * and none of those should be able to take the checkout down with it.
 */

const TIMEOUT_MS = 12_000;

/** Sandbox unless production is asked for by name. See ENV.upsProduction. */
function baseUrl(): string {
  return ENV.upsProduction ? "https://onlinetools.ups.com" : "https://wwwcie.ups.com";
}

export function isUpsConfigured(): boolean {
  return Boolean(ENV.upsClientId && ENV.upsClientSecret);
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export type UpsErrorKind =
  | "not_configured"
  | "not_ready"
  | "auth_failed"
  | "invalid_address"
  | "no_rates"
  | "timeout"
  | "unavailable";

export interface UpsError {
  ok: false;
  kind: UpsErrorKind;
  /** Safe to show a shopper: no account numbers, no carrier internals. */
  message: string;
  /** For the server log only. */
  detail?: string;
}

function fail(kind: UpsErrorKind, message: string, detail?: string): UpsError {
  return { ok: false, kind, message, detail };
}

/**
 * What a shopper is told. Deliberately vague about our own misconfiguration —
 * an unset origin address is our problem to fix, and telling a customer about
 * it helps nobody.
 */
const SHOPPER_MESSAGE: Record<UpsErrorKind, string> = {
  not_configured: "Shipping rates are unavailable right now. Please contact us to order.",
  not_ready: "Shipping rates are unavailable right now. Please contact us to order.",
  auth_failed: "Shipping rates are unavailable right now. Please contact us to order.",
  invalid_address: "We couldn't find that address. Please check it and try again.",
  no_rates: "No shipping options are available for this address.",
  timeout: "Shipping rates are taking longer than usual. Please try again in a moment.",
  unavailable: "Shipping rates are temporarily unavailable. Please try again shortly.",
};

/** UPS error codes that mean "the address is wrong", not "we are broken". */
const ADDRESS_ERROR_CODES = new Set([
  "111285", // invalid postal code
  "111286", // invalid state/province
  "110002", // missing or invalid ship-to
  "111210", // invalid destination
  "9370701", // address classification failure
]);

// ─── Token ───────────────────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  /** Epoch ms after which this must not be reused. */
  expiresAt: number;
}

/**
 * Held per process. A UPS token lives four hours, so fetching one per request
 * would add a round trip to every quote for no benefit whatsoever.
 *
 * Renewed a minute early: a token that expires while a request is in flight
 * fails the request, and a minute costs nothing against four hours.
 */
let cached: CachedToken | null = null;
const RENEW_MARGIN_MS = 60_000;

/** Dropped so the next call re-authenticates; used when UPS rejects a token. */
export function clearUpsTokenCache(): void {
  cached = null;
}

async function getToken(): Promise<{ ok: true; token: string } | UpsError> {
  if (!isUpsConfigured()) {
    return fail("not_configured", SHOPPER_MESSAGE.not_configured, "UPS credentials are unset");
  }
  if (cached && Date.now() < cached.expiresAt) {
    return { ok: true, token: cached.token };
  }

  try {
    const res = await fetch(`${baseUrl()}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${ENV.upsClientId}:${ENV.upsClientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: string | number;
    } | null;

    if (!res.ok || !body?.access_token) {
      // Never log the response verbatim: a failed auth echoes the client id.
      return fail("auth_failed", SHOPPER_MESSAGE.auth_failed, `token HTTP ${res.status}`);
    }

    const lifetimeMs = Number(body.expires_in ?? 0) * 1000;
    cached = {
      token: body.access_token,
      expiresAt: Date.now() + Math.max(0, lifetimeMs - RENEW_MARGIN_MS),
    };
    return { ok: true, token: cached.token };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return fail(
      timedOut ? "timeout" : "unavailable",
      timedOut ? SHOPPER_MESSAGE.timeout : SHOPPER_MESSAGE.unavailable,
      (e as Error).message
    );
  }
}

// ─── Requests ────────────────────────────────────────────────────────────────

function upsAddress(name: string, line: string, city: string, state: string, zip: string) {
  return {
    Name: name.slice(0, 35),
    Address: {
      AddressLine: [line.slice(0, 35)],
      City: city.slice(0, 30),
      StateProvinceCode: state.slice(0, 5),
      PostalCode: zip.slice(0, 10),
      CountryCode: "US",
    },
  };
}

function originAddress(origin: ShippingOrigin) {
  return upsAddress(origin.name, origin.street, origin.city, origin.state, origin.zip);
}

export interface RateDestination {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ShippingRate {
  serviceCode: string;
  serviceName: string;
  /** Carrier charge plus the configured handling fee. */
  amount: number;
  /** Carrier charge alone, kept so the admin can see what was added. */
  carrierAmount: number;
  currency: string;
  /** Business days in transit, when UPS commits to one. */
  transitDays: number | null;
}

export type RateResult = { ok: true; rates: ShippingRate[] } | UpsError;

/**
 * Live rates for one package to one address.
 *
 * Uses `Shoptimeintransit`, which returns every service and its transit time in
 * a single call. Plain `Shop` costs the same round trip but omits transit for
 * Ground — and "arrives in 3 business days" is worth more to a shopper than a
 * service with no date against it.
 */
export async function getShippingRates(
  settings: ShippingSettings,
  shipment: PackagedShipment,
  destination: RateDestination
): Promise<RateResult> {
  if (!shipment.box) {
    return fail("not_ready", SHOPPER_MESSAGE.not_ready, "no shipping box configured");
  }

  const auth = await getToken();
  if (!("ok" in auth) || auth.ok !== true) return auth as UpsError;

  const box = shipment.box;
  const body = {
    RateRequest: {
      Request: {
        RequestOption: "Shoptimeintransit",
        TransactionReference: { CustomerContext: "checkout" },
      },
      Shipment: {
        Shipper: {
          ...originAddress(settings.origin),
          ...(ENV.upsAccountNumber ? { ShipperNumber: ENV.upsAccountNumber } : {}),
        },
        ShipFrom: originAddress(settings.origin),
        // Required whenever transit times are asked for: UPS rejects
        // Shoptimeintransit outright without it. 03 is a non-document
        // shipment, which is what a box of vials is.
        DeliveryTimeInformation: { PackageBillType: "03" },
        ShipTo: upsAddress(
          destination.name || "Customer",
          destination.street,
          destination.city,
          destination.state,
          destination.zip
        ),
        Package: [
          {
            // 02 is "customer supplied package" — our own box, not UPS packaging.
            PackagingType: { Code: "02" },
            Dimensions: {
              UnitOfMeasurement: { Code: "IN" },
              Length: String(box.lengthIn),
              Width: String(box.widthIn),
              Height: String(box.heightIn),
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" },
              Weight: String(ouncesToPounds(shipment.totalOz)),
            },
          },
        ],
      },
    },
  };

  try {
    const res = await fetch(`${baseUrl()}/api/rating/v2409/Shoptimeintransit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        transId: `rate-${Date.now()}`,
        transactionSrc: "brighterdayslabs",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await res.text();
    // A wrong path on this host answers 200 with a marketing page rather than a
    // 404, so the status alone cannot be trusted to mean "this is the API".
    if (text.trimStart().startsWith("<")) {
      return fail("unavailable", SHOPPER_MESSAGE.unavailable, "non-JSON response from UPS");
    }

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return fail("unavailable", SHOPPER_MESSAGE.unavailable, "unparseable response");
    }

    if (!res.ok) {
      const errors: Array<{ code?: string; message?: string }> =
        json?.response?.errors ?? json?.errors ?? [];
      const codes = errors.map((e) => String(e.code ?? ""));
      const detail = codes.join(",") + " " + errors.map((e) => e.message).join("; ");

      if (res.status === 401) {
        // The cached token is the likeliest culprit; drop it so a retry is clean.
        clearUpsTokenCache();
        return fail("auth_failed", SHOPPER_MESSAGE.auth_failed, `HTTP 401 ${detail}`);
      }
      if (codes.some((c) => ADDRESS_ERROR_CODES.has(c))) {
        return fail("invalid_address", SHOPPER_MESSAGE.invalid_address, detail);
      }
      return fail("unavailable", SHOPPER_MESSAGE.unavailable, `HTTP ${res.status} ${detail}`);
    }

    const rates = parseRates(json, settings);
    if (rates.length === 0) {
      return fail("no_rates", SHOPPER_MESSAGE.no_rates, "no offered service came back");
    }
    return { ok: true, rates };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return fail(
      timedOut ? "timeout" : "unavailable",
      timedOut ? SHOPPER_MESSAGE.timeout : SHOPPER_MESSAGE.unavailable,
      (e as Error).message
    );
  }
}

/**
 * Picks the offered services out of a rate response, cheapest first.
 *
 * UPS returns every service it can carry — seven for a domestic parcel — and
 * the shop offers three at most. Filtering here rather than asking for each
 * service separately keeps it to one round trip.
 */
export function parseRates(json: any, settings: ShippingSettings): ShippingRate[] {
  const raw = json?.RateResponse?.RatedShipment;
  if (!raw) return [];
  const list: any[] = Array.isArray(raw) ? raw : [raw];

  // Keyed by service, because UPS can return the same service more than once —
  // a published and a negotiated rate for the same delivery, say. Two rows
  // reading "UPS Next Day Air" at different prices is not a choice a shopper
  // can make, so the cheaper one is the offer and the other is noise.
  const bestByService = new Map<string, ShippingRate>();

  for (const entry of list) {
    const serviceCode = String(entry?.Service?.Code ?? "");
    if (!settings.services[serviceCode]) continue;

    const carrierAmount = Number(entry?.TotalCharges?.MonetaryValue);
    if (!Number.isFinite(carrierAmount)) continue;

    const days = Number(
      entry?.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit ??
        entry?.GuaranteedDelivery?.BusinessDaysInTransit
    );

    const rate: ShippingRate = {
      serviceCode,
      serviceName: upsServiceLabel(serviceCode),
      carrierAmount,
      // Handling is ours, not the carrier's, and is added once per option so
      // every price the shopper compares includes it.
      amount: Math.round((carrierAmount + settings.handlingFeeUsd) * 100) / 100,
      currency: String(entry?.TotalCharges?.CurrencyCode ?? "USD"),
      transitDays: Number.isFinite(days) && days > 0 ? days : null,
    };

    const existing = bestByService.get(serviceCode);
    if (!existing || rate.amount < existing.amount) {
      bestByService.set(serviceCode, rate);
    }
  }

  return Array.from(bestByService.values()).sort((a, b) => a.amount - b.amount);
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** The formats we ask UPS for. GIF prints anywhere; ZPL needs a thermal printer. */
export type LabelFormat = "GIF" | "ZPL";

export interface LabelRequest {
  serviceCode: string;
  weightOz: number;
  box: { lengthIn: number; widthIn: number; heightIn: number };
  recipient: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    phone?: string | null;
  };
}

export interface PurchasedLabel {
  trackingNumber: string;
  /** Base64, as UPS returned it. */
  data: string;
  format: "GIF" | "PDF" | "ZPL";
}

export type LabelResult = { ok: true; label: PurchasedLabel } | UpsError;

/**
 * Buys a shipping label.
 *
 * Unlike rating, this one costs money and produces a real parcel — in the
 * sandbox it returns a watermarked label and a fake tracking number, and in
 * production it does not. Which of those happens is decided solely by
 * UPS_ENVIRONMENT, and the caller is expected to tell the operator which world
 * they are in.
 *
 * Requires the shipper account number: rating works without one, this does not.
 */
export async function createShippingLabel(
  origin: ShippingOrigin,
  request: LabelRequest,
  format: LabelFormat = "GIF"
): Promise<LabelResult> {
  if (!ENV.upsAccountNumber) {
    return fail("not_configured", SHOPPER_MESSAGE.not_configured, "UPS_ACCOUNT_NUMBER is unset");
  }

  const auth = await getToken();
  if (!("ok" in auth) || auth.ok !== true) return auth as UpsError;

  const body = buildLabelBody(origin, request, ENV.upsAccountNumber, format);

  try {
    const res = await fetch(`${baseUrl()}/api/shipments/v2409/ship`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        transId: `label-${Date.now()}`,
        transactionSrc: "brighterdayslabs",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    });

    return await readLabelResponse(res, format);
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return fail("timeout", SHOPPER_MESSAGE.timeout, "label request timed out");
    }
    return fail("unavailable", SHOPPER_MESSAGE.unavailable, String(err));
  }
}

/**
 * The Shipping request body, separated from the call so its shape can be
 * asserted without reaching UPS.
 *
 * Worth knowing before editing: Shipping and Rating disagree on field names
 * for the same concepts. The packaging code is `Packaging` here and
 * `PackagingType` there; sending Rating's name reads to UPS as an absent
 * field and comes back as 120600.
 */
export function buildLabelBody(
  origin: ShippingOrigin,
  request: LabelRequest,
  accountNumber: string,
  format: LabelFormat = "GIF"
) {
  return {
    ShipmentRequest: {
      Request: { RequestOption: "nonvalidate" },
      Shipment: {
        Description: "Laboratory supplies",
        Shipper: {
          ...originAddress(origin),
          ShipperNumber: accountNumber,
        },
        ShipFrom: originAddress(origin),
        ShipTo: {
          ...upsAddress(
            request.recipient.name,
            request.recipient.street,
            request.recipient.city,
            request.recipient.state,
            request.recipient.zip
          ),
          ...(request.recipient.phone
            ? { Phone: { Number: request.recipient.phone.replace(/\D/g, "").slice(0, 15) } }
            : {}),
        },
        PaymentInformation: {
          ShipmentCharge: {
            // 01 — transportation charges, billed to our own account.
            Type: "01",
            BillShipper: { AccountNumber: accountNumber },
          },
        },
        Service: { Code: request.serviceCode },
        Package: [
          {
            // Shipping calls this field "Packaging"; Rating calls the same
            // thing "PackagingType". Sending Rating's name here reads as a
            // missing field and fails with 120600.
            Packaging: { Code: "02" },
            Dimensions: {
              UnitOfMeasurement: { Code: "IN" },
              Length: String(request.box.lengthIn),
              Width: String(request.box.widthIn),
              Height: String(request.box.heightIn),
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" },
              Weight: String(ouncesToPounds(request.weightOz)),
            },
          },
        ],
      },
      LabelSpecification:
        format === "ZPL"
          ? {
              // The language a thermal printer reads directly. LabelStockSize
              // only applies to the thermal formats, and UPS scales to 4x6 at
              // most whatever is asked for.
              LabelImageFormat: { Code: "ZPL" },
              LabelStockSize: { Width: "4", Height: "6" },
            }
          : {
              // An image, for a shop printing onto ordinary paper. UPS wants a
              // user agent alongside it.
              LabelImageFormat: { Code: "GIF" },
              HTTPUserAgent: "Mozilla/5.0",
            },
    },
  };
}

/** Turns a Shipping API response into a label or a typed failure. */
async function readLabelResponse(res: Response, format: LabelFormat): Promise<LabelResult> {
  try {
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      return fail("unavailable", SHOPPER_MESSAGE.unavailable, "non-JSON response from UPS");
    }

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return fail("unavailable", SHOPPER_MESSAGE.unavailable, "unparseable response");
    }

    if (!res.ok) {
      const errors: Array<{ code?: string; message?: string }> =
        json?.response?.errors ?? json?.errors ?? [];
      const detail = errors.map((e) => `${e.code} ${e.message}`).join("; ");
      if (res.status === 401) {
        clearUpsTokenCache();
        return fail("auth_failed", "UPS rejected our credentials.", detail);
      }
      if (errors.some((e) => ADDRESS_ERROR_CODES.has(String(e.code)))) {
        return fail("invalid_address", "UPS rejected the delivery address.", detail);
      }
      // The operator is an admin, not a shopper: they can act on the real text.
      return fail("unavailable", detail || `UPS returned HTTP ${res.status}.`, detail);
    }

    const results = json?.ShipmentResponse?.ShipmentResults;
    const pkg = Array.isArray(results?.PackageResults)
      ? results.PackageResults[0]
      : results?.PackageResults;

    const trackingNumber = String(
      pkg?.TrackingNumber ?? results?.ShipmentIdentificationNumber ?? ""
    );
    const data = String(pkg?.ShippingLabel?.GraphicImage ?? "");

    if (!trackingNumber || !data) {
      // Both or neither: half a label is not something to store and print.
      return fail("unavailable", "UPS did not return a printable label.", "missing label fields");
    }

    return { ok: true, label: { trackingNumber, data, format } };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return fail(
      timedOut ? "timeout" : "unavailable",
      timedOut ? "UPS took too long to answer." : SHOPPER_MESSAGE.unavailable,
      (e as Error).message
    );
  }
}

/** Whether labels bought right now are test labels. */
export function isUpsSandbox(): boolean {
  return !ENV.upsProduction;
}

/**
 * Whether a tracking number came from the sandbox rather than a real purchase.
 *
 * UPS returns a literal placeholder — 1ZXXXXXXXXXXXXXXXX — for test labels,
 * where a bought one has digits. Reading the number rather than the current
 * environment matters: an order labelled in sandbox is still holding a useless
 * barcode after somebody switches to production, and that is precisely when it
 * needs to be replaceable.
 */
export function isSandboxTrackingNumber(trackingNumber: string): boolean {
  return /X{4,}/i.test(trackingNumber.trim());
}
