import { z } from "zod";

/**
 * Shipping configuration and the arithmetic that turns a cart into a parcel.
 *
 * Carrier credentials are deliberately absent: they live in environment
 * variables alongside the Stripe keys. What is configured here are business
 * decisions — where parcels leave from, which services are offered, what the
 * shop packs things in, and what is added for handling.
 *
 * The shape of the model follows the shop. This is a vial store: the products
 * are small, light and nearly identical, so a weight recorded per product is
 * the exception rather than the rule, and what actually decides the carrier
 * charge is which box the order goes in — see `dimensionalWeightLbs`.
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

// ─── Boxes ───────────────────────────────────────────────────────────────────

/**
 * A box the shop actually keeps on the shelf.
 *
 * Capacity is a count of units, not a weight. Vials are light enough that a
 * weight limit would almost never be the binding constraint — a box that holds
 * six vials is full at roughly fifteen ounces, nowhere near any sane weight cap
 * — while the seventh vial does not fit whatever it weighs. A count is also the
 * only one of the two a shopkeeper can answer by looking at a box.
 */
export const shippingBoxSchema = z.object({
  name: z.string().min(1).max(60),
  lengthIn: z.number().positive().max(200),
  widthIn: z.number().positive().max(200),
  heightIn: z.number().positive().max(200),
  /** Maximum units this box holds, inclusive: 6 means the sixth still fits. */
  maxUnits: z.number().int().positive().max(1000),
  /** Overrides the shop-wide packaging weight. Null falls back to it. */
  packagingWeightOz: z.number().min(0).max(500).nullable().default(null),
});

export type ShippingBox = z.infer<typeof shippingBoxSchema>;

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
   * Flat amount added to every carrier rate, for labour.
   * Capped rather than unbounded: a stray keystroke here silently overcharges
   * every order until somebody notices.
   */
  handlingFeeUsd: z.number().min(0).max(100).default(0),
  /**
   * What a bought label comes back as.
   *
   * "GIF" is an image that prints from any browser onto ordinary paper.
   * "ZPL" is the instruction language a thermal printer speaks directly, at
   * exactly 4x6 — sharper, correctly sized, and useless without such a
   * printer. Defaults to the one that works on whatever the shop already has.
   */
  labelFormat: z.enum(["GIF", "ZPL"]).default("GIF"),
  /**
   * What one standard vial weighs, in its own packaging.
   *
   * The default for every product, so a catalogue of near-identical vials needs
   * no per-product data entry at all. A product or variation only records its
   * own weight when it genuinely differs.
   */
  defaultVialWeightOz: z.number().positive().max(500).default(2.5),
  /**
   * What the outer packaging adds — box, label, padding — counted once per
   * order, not per unit. A box may override it with its own figure.
   */
  packagingWeightOz: z.number().min(0).max(500).default(3),
  /** Boxes the shop packs into, in any order; selection sorts by size. */
  boxes: z.array(shippingBoxSchema).default([]),
});

export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;

/** The shape a shop starts with: ground only, no boxes defined yet. */
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

/** Everything that must hold before a rate can be requested. */
export function shippingReadiness(settings: ShippingSettings) {
  return {
    originComplete: isOriginComplete(settings.origin),
    anyService: enabledServices(settings).length > 0,
    anyBox: settings.boxes.length > 0,
    vialWeightSet: settings.defaultVialWeightOz > 0,
  };
}

export function isReadyToQuote(settings: ShippingSettings): boolean {
  return Object.values(shippingReadiness(settings)).every(Boolean);
}

// ─── Dimensional weight ──────────────────────────────────────────────────────

/** UPS daily-rate divisor for inches and pounds. Retail rates use 166. */
export const UPS_DIM_DIVISOR = 139;

/**
 * The weight UPS treats a box as having because of its size alone.
 *
 * For a shop shipping vials this is usually the figure that decides the charge:
 * a few ounces of peptide never outweighs the box it travels in. Sending one
 * vial in a 12 × 10 × 6 carton is billed as roughly six pounds, several times
 * what the same vial costs in a 6 × 4 × 3.
 *
 * UPS rounds each dimension up to a whole inch before dividing.
 */
export function dimensionalWeightLbs(box: {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}): number {
  const l = Math.ceil(box.lengthIn);
  const w = Math.ceil(box.widthIn);
  const h = Math.ceil(box.heightIn);
  return (l * w * h) / UPS_DIM_DIVISOR;
}

/**
 * What UPS actually bills: the greater of real and dimensional weight, rounded
 * up to the next whole pound. Shown in the admin so an oversized box is a
 * visible cost rather than a silent one.
 */
export function billableWeightLbs(
  actualOz: number,
  box: { lengthIn: number; widthIn: number; heightIn: number } | null
): number {
  const actualLbs = actualOz / 16;
  const dimLbs = box ? dimensionalWeightLbs(box) : 0;
  return Math.ceil(Math.max(actualLbs, dimLbs, 0.01));
}

// ─── Box selection ───────────────────────────────────────────────────────────

/** Cubic inches, for ordering boxes smallest-first. */
function boxVolume(box: ShippingBox): number {
  return box.lengthIn * box.widthIn * box.heightIn;
}

export interface BoxSelection {
  box: ShippingBox | null;
  /**
   * The order is larger than the biggest box holds. Quoted in that box anyway —
   * refusing would break a sale over a case that needs a human either way — but
   * flagged so it is packed and re-rated by hand rather than under-shipped.
   */
  oversize: boolean;
}

/**
 * The smallest box that holds this many units.
 *
 * Smallest by volume, not by declared capacity: capacity is typed in by hand and
 * two boxes can disagree with their own dimensions. Volume is the thing the
 * carrier charges for, so it is the thing to minimise.
 */
export function pickBox(units: number, boxes: ShippingBox[]): BoxSelection {
  if (boxes.length === 0) return { box: null, oversize: false };

  const bySize = [...boxes].sort((a, b) => boxVolume(a) - boxVolume(b));
  const fits = bySize.find((b) => units <= b.maxUnits);
  if (fits) return { box: fits, oversize: false };

  return { box: bySize[bySize.length - 1] ?? null, oversize: true };
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
 * Most specific wins: a variation's own weight, then the product's, then the
 * shop default. The variation has to come first or the override is dead — a
 * product that records a weight would otherwise mask every size of itself,
 * which is exactly the case a 10 mL versus 30 mL bottle exists to distinguish.
 *
 * There is no "unweighed" outcome any more. A blank weight means "a standard
 * vial", which is what nearly every product in this catalogue is.
 */
export function resolveUnitWeightOz(
  product: { weightOz?: string | number | null },
  variation: { weightOz?: string | number | null } | null | undefined,
  defaultVialWeightOz: number
): number {
  return toNumber(variation?.weightOz) ?? toNumber(product.weightOz) ?? defaultVialWeightOz;
}

export interface WeighableLine {
  productName: string;
  quantity: number;
  product: { weightOz?: string | number | null };
  variation?: { weightOz?: string | number | null } | null;
}

/** Weight of the contents alone, before any packaging. */
export function sumCartWeightOz(lines: WeighableLine[], defaultVialWeightOz: number): number {
  return lines.reduce(
    (total, line) =>
      total + resolveUnitWeightOz(line.product, line.variation, defaultVialWeightOz) * line.quantity,
    0
  );
}

/** Total units in the cart, which is what decides the box. */
export function countUnits(lines: WeighableLine[]): number {
  return lines.reduce((n, line) => n + line.quantity, 0);
}

export interface PackagedShipment {
  units: number;
  /** Weight of the products themselves. */
  contentsOz: number;
  /** What the box and padding add, counted once for the order. */
  packagingOz: number;
  /** What goes on the label: contents plus packaging. */
  totalOz: number;
  box: ShippingBox | null;
  oversize: boolean;
}

/**
 * Turns a cart into the parcel that will be handed to the carrier.
 *
 * Packaging is added once per order rather than per unit — one box holds the
 * whole order — and the chosen box's own figure wins over the shop-wide one,
 * because a bigger carton really does weigh more.
 */
export function computePackage(
  lines: WeighableLine[],
  settings: ShippingSettings
): PackagedShipment {
  const units = countUnits(lines);
  const contentsOz = sumCartWeightOz(lines, settings.defaultVialWeightOz);
  const { box, oversize } = pickBox(units, settings.boxes);
  const packagingOz = box?.packagingWeightOz ?? settings.packagingWeightOz;

  return {
    units,
    contentsOz,
    packagingOz,
    totalOz: contentsOz + packagingOz,
    box,
    oversize,
  };
}

/** Minimum weight UPS will rate. Anything lighter is billed as this anyway. */
export const MIN_BILLABLE_LBS = 0.1;

/**
 * Ounces to the pounds the UPS Rating API expects.
 *
 * Rounded up to a tenth: rounding down would declare a lighter parcel than the
 * one actually handed over, and the carrier bills what it weighs, not what we
 * said.
 */
export function ouncesToPounds(oz: number): number {
  const lbs = Math.ceil((oz / 16) * 10) / 10;
  return Math.max(MIN_BILLABLE_LBS, lbs);
}
