import { z } from "zod";

/**
 * Shipping configuration and the arithmetic around package weight.
 *
 * Carrier credentials are deliberately absent: they live in environment
 * variables alongside the Stripe keys. What is configured here are business
 * decisions — where parcels leave from, which services are offered, what is
 * added for handling — and those belong to the shop owner, not to
 * infrastructure.
 */

// ─── UPS services ────────────────────────────────────────────────────────────

/**
 * The domestic services offered at checkout, by UPS service code.
 *
 * Codes are UPS's own and are what the Rating and Shipping APIs speak; the
 * labels are what a shopper sees. Kept to the three the shop sells — UPS
 * defines many more (12, 13, 14, 59 among them) and they can be added here
 * without touching anything else.
 */
export const UPS_SERVICES = [
  { code: "03", label: "UPS Ground" },
  { code: "02", label: "UPS 2nd Day Air" },
  { code: "01", label: "UPS Next Day Air" },
] as const;

export type UpsServiceCode = (typeof UPS_SERVICES)[number]["code"];

export const UPS_SERVICE_CODES = UPS_SERVICES.map((s) => s.code) as unknown as [
  UpsServiceCode,
  ...UpsServiceCode[],
];

export function upsServiceLabel(code: string): string {
  return UPS_SERVICES.find((s) => s.code === code)?.label ?? `UPS service ${code}`;
}

// ─── Settings ────────────────────────────────────────────────────────────────

/** The key this object is stored under in `site_settings`. */
export const SHIPPING_SETTINGS_KEY = "shipping_settings";

/**
 * Where parcels ship from.
 *
 * Every field is required once shipping is switched on — UPS rejects a rating
 * request without a complete origin — but the record starts empty, so the
 * schema allows blanks and `isOriginComplete` is what gates quoting. That split
 * lets the admin save a half-filled form and come back to it.
 */
export const originSchema = z.object({
  name: z.string().max(100).default(""),
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(100).default(""),
  zip: z.string().max(20).default(""),
  country: z.string().max(100).default("United States"),
});

export type ShippingOrigin = z.infer<typeof originSchema>;

export const shippingSettingsSchema = z.object({
  origin: originSchema.default(originSchema.parse({})),
  /** Which services to offer, by UPS code. Absent means not offered. */
  services: z.record(z.string(), z.boolean()).default({ "03": true }),
  /**
   * Flat amount added to every carrier rate, for packing materials and labour.
   * Capped rather than unbounded: a stray keystroke here silently overcharges
   * every order until somebody notices.
   */
  handlingFeeUsd: z.number().min(0).max(100).default(0),
});

export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;

/** The shape a shop starts with: ground only, no handling fee, no origin yet. */
export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = shippingSettingsSchema.parse({});

/**
 * Reads stored settings, falling back to defaults rather than throwing.
 *
 * The stored value is JSON written by an earlier version of this schema, so it
 * can be malformed, partial, or absent. A settings page that crashes on bad
 * data is worse than one that shows defaults and lets the admin fix them.
 */
export function parseShippingSettings(raw: string | null | undefined): ShippingSettings {
  if (!raw) return DEFAULT_SHIPPING_SETTINGS;
  try {
    const parsed = shippingSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SHIPPING_SETTINGS;
  } catch {
    return DEFAULT_SHIPPING_SETTINGS;
  }
}

/** Whether the origin has everything a carrier needs to quote from it. */
export function isOriginComplete(origin: ShippingOrigin): boolean {
  return Boolean(
    origin.name.trim() &&
      origin.street.trim() &&
      origin.city.trim() &&
      origin.state.trim() &&
      origin.zip.trim() &&
      origin.country.trim()
  );
}

/** The service codes switched on, in the order they are offered. */
export function enabledServices(settings: ShippingSettings): UpsServiceCode[] {
  return UPS_SERVICES.filter((s) => settings.services[s.code]).map((s) => s.code);
}

// ─── Weight ──────────────────────────────────────────────────────────────────

/** Decimal columns arrive as strings from MySQL; nulls mean "not recorded". */
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The shipping weight of one unit, in ounces.
 *
 * A variation's own weight wins when it has one, because that is the case it
 * exists for — a 30 mL bottle really does outweigh a 10 mL. Otherwise the
 * product's weight stands for every size of it. Null means the weight was never
 * recorded, which is a refusal to quote rather than a zero: shipping a package
 * of unknown weight at a guessed rate loses money on every order.
 */
export function resolveUnitWeightOz(
  product: { weightOz?: string | number | null },
  variation?: { weightOz?: string | number | null } | null
): number | null {
  return toNumber(variation?.weightOz) ?? toNumber(product.weightOz);
}

export interface WeighableLine {
  productName: string;
  quantity: number;
  product: { weightOz?: string | number | null };
  variation?: { weightOz?: string | number | null } | null;
}

export interface CartWeight {
  /** Total ounces for the whole cart, or null when anything is unweighed. */
  totalOz: number | null;
  /** Products missing a weight, named so the admin can go and fix them. */
  missing: string[];
}

/**
 * Adds up a cart's shipping weight, reporting what it could not weigh.
 *
 * Returns the offending product names rather than a bare failure so the error
 * can say which product needs attention instead of "shipping unavailable".
 */
export function sumCartWeightOz(lines: WeighableLine[]): CartWeight {
  const missing: string[] = [];
  let totalOz = 0;

  for (const line of lines) {
    const unit = resolveUnitWeightOz(line.product, line.variation);
    if (unit === null) {
      if (!missing.includes(line.productName)) missing.push(line.productName);
      continue;
    }
    totalOz += unit * line.quantity;
  }

  return { totalOz: missing.length > 0 ? null : totalOz, missing };
}

/** Minimum weight UPS will rate. Anything lighter is billed as this anyway. */
export const MIN_BILLABLE_LBS = 0.1;

/**
 * Ounces to the pounds the UPS Rating API expects.
 *
 * Rounded up to a tenth: rounding down would quote a lighter parcel than the
 * one actually handed over, and the carrier bills what it weighs, not what we
 * said.
 */
export function ouncesToPounds(oz: number): number {
  const lbs = Math.ceil((oz / 16) * 10) / 10;
  return Math.max(MIN_BILLABLE_LBS, lbs);
}
