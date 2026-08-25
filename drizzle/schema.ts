import {
  boolean,
  date,
  decimal,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  index,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  // Nullable: accounts predate this column and signup never asks for it. Same
  // width as orders.shippingPhone so the two can hold the same value.
  phone: varchar("phone", { length: 30 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Loyalty points: floor(order total) awarded once an order is paid.
  points: int("points").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  heroImageUrl: varchar("heroImageUrl", { length: 500 }),
  heroImageKey: varchar("heroImageKey", { length: 500 }),
  badgeCode: varchar("badgeCode", { length: 10 }),
  tagline: varchar("tagline", { length: 300 }),
  ctaText: varchar("ctaText", { length: 50 }).default("Explore Category"),
  questionText: varchar("questionText", { length: 200 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  description: text("description"),
  shortDescription: varchar("shortDescription", { length: 500 }),
  categoryId: int("categoryId").references(() => categories.id),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }).notNull(),
  featured: boolean("featured").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  mechanism: text("mechanism"),
  casNumber: varchar("casNumber", { length: 50 }),
  excludeFromBulkDiscount: boolean("excludeFromBulkDiscount").default(false).notNull(),
  // ─── Shipping weight ───────────────────────────────────────────────────────
  // An override, not a requirement. Almost every product here is a standard
  // vial, and the shop-wide default in shipping settings covers those; this is
  // for the ones that genuinely differ — bacteriostatic water, kits, multi-vial
  // packs, accessories.
  //
  // Ounces rather than pounds: a peptide vial weighs a fraction of a pound, and
  // storing 0.05 lb loses the precision that decides a rate band. Converted to
  // the pounds UPS wants at the edge of the API call.
  //
  // No dimensions here. UPS rates the box an order ships in, not the product,
  // and which box that is depends on how many units the order holds — so the
  // dimensions live with the boxes in shipping settings.
  weightOz: decimal("weightOz", { precision: 8, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Product Images ───────────────────────────────────────────────────────────
export const productImages = mysqlTable("product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  variationId: int("variationId").references(() => productVariations.id),
  url: varchar("url", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  altText: varchar("altText", { length: 200 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;

// ─── Product Variations ───────────────────────────────────────────────────────
export const productVariations = mysqlTable("product_variations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  unit: mysqlEnum("unit", ["mg", "ml"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: int("stock").default(0).notNull(),
  sku: varchar("sku", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  // Overrides the product's weight when this size actually weighs something
  // different. Worth having for volumes — 30 mL of water outweighs 10 mL by a
  // useful margin — and pointless for masses, where 40 mg of peptide is a
  // rounding error next to the vial. Null means "same as the product".
  weightOz: decimal("weightOz", { precision: 8, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductVariation = typeof productVariations.$inferSelect;
export type InsertProductVariation = typeof productVariations.$inferInsert;

// ─── Coupons ──────────────────────────────────────────────────────────────────
export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: mysqlEnum("type", ["percentage", "fixed"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("minOrderAmount", { precision: 10, scale: 2 }),
  maxUses: int("maxUses"),
  usedCount: int("usedCount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  isNewCustomerOffer: boolean("isNewCustomerOffer").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ])
    .default("pending")
    .notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discountAmount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  couponId: int("couponId").references(() => coupons.id),
  couponCode: varchar("couponCode", { length: 50 }),
  // Researcher info
  researcherType: mysqlEnum("researcherType", [
    "private_researcher",
    "lab_company_researcher",
    "government_entity_researcher",
  ]).notNull(),
  dateOfBirth: date("dateOfBirth", { mode: "string" }).notNull(),
  // Shipping info
  shippingFirstName: varchar("shippingFirstName", { length: 100 }),
  shippingLastName: varchar("shippingLastName", { length: 100 }),
  shippingEmail: varchar("shippingEmail", { length: 320 }),
  shippingPhone: varchar("shippingPhone", { length: 30 }),
  shippingAddress: text("shippingAddress"),
  shippingCity: varchar("shippingCity", { length: 100 }),
  shippingState: varchar("shippingState", { length: 100 }),
  shippingZip: varchar("shippingZip", { length: 20 }),
  shippingCountry: varchar("shippingCountry", { length: 100 }),
  // Payment
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"])
    .default("pending")
    .notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 200 }),
  // When the money actually arrived, as opposed to when the order was placed.
  // Nullable because it is only known once payment settles, and because orders
  // that predate this column never recorded it — revenue reporting falls back
  // to createdAt for those. Not derivable from updatedAt, which moves on every
  // subsequent status change.
  paidAt: timestamp("paidAt"),
  // ─── Shipping ──────────────────────────────────────────────────────────────
  // The service the shopper chose and what it cost, frozen at purchase. The
  // name is stored alongside the code because it is what they were shown and
  // agreed to — re-deriving it later would rewrite history if the shop ever
  // changes which services it offers.
  shippingService: varchar("shippingService", { length: 10 }),
  shippingServiceName: varchar("shippingServiceName", { length: 60 }),
  shippingCost: decimal("shippingCost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 50 }),
  // Set when a human says the parcel left, not when a label is printed.
  shippedAt: timestamp("shippedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Shipping Labels ──────────────────────────────────────────────────────────
/**
 * Carrier labels, kept out of `orders` on purpose.
 *
 * A label is tens of kilobytes of base64 and `getOrderById` selects every
 * column, so holding it on the order would drag it across the wire on every
 * read — the admin list, the checkout, the webhook. Here it is fetched only
 * when somebody asks to print it.
 *
 * In the database rather than object storage because a label carries the
 * buyer's full name and home address. The bucket serves public, permanently
 * cached URLs; a hard-to-guess URL is obscurity, not access control, and a
 * voided label would stay readable at that address forever.
 */
export const shippingLabels = mysqlTable(
  "shipping_labels",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId")
      .notNull()
      .references(() => orders.id),
    trackingNumber: varchar("trackingNumber", { length: 50 }).notNull(),
    serviceCode: varchar("serviceCode", { length: 10 }).notNull(),
    /** GIF, PDF or ZPL, as asked of the carrier. */
    format: varchar("format", { length: 10 }).notNull(),
    // LONGTEXT, not TEXT: a label is around 50 KB of binary, which base64
    // inflates past the 64 KB a TEXT column holds — it would truncate silently
    // and produce an unprintable label.
    /** Base64 exactly as UPS returned it. */
    data: longtext("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("shipping_labels_order_idx").on(table.orderId)]
);

export type ShippingLabel = typeof shippingLabels.$inferSelect;
export type InsertShippingLabel = typeof shippingLabels.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── Welcome Coupon Redemptions (new-customer signup offer tracking) ──────────
export const welcomeCouponRedemptions = mysqlTable("welcome_coupon_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  couponId: int("couponId").notNull().references(() => coupons.id),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
  orderId: int("orderId").references(() => orders.id),
  usedAt: timestamp("usedAt"),
});

export type WelcomeCouponRedemption = typeof welcomeCouponRedemptions.$inferSelect;
export type InsertWelcomeCouponRedemption = typeof welcomeCouponRedemptions.$inferInsert;

// ─── Order Items ──────────────────────────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId")
    .notNull()
    .references(() => orders.id),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  variationId: int("variationId").references(() => productVariations.id),
  productName: varchar("productName", { length: 200 }).notNull(),
  variationLabel: varchar("variationLabel", { length: 50 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ─── Cart (server-side persistence) ──────────────────────────────────────────
export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  variationId: int("variationId").references(() => productVariations.id),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// ─── Lab Reports ──────────────────────────────────────────────────────────────
export const labReports = mysqlTable("lab_reports", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 200 }).notNull(),
  fileSize: int("fileSize"),
  batchNumber: varchar("batchNumber", { length: 100 }),
  testDate: timestamp("testDate"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabReport = typeof labReports.$inferSelect;
export type InsertLabReport = typeof labReports.$inferInsert;

// ─── Site Images (admin-managed static content images) ───────────────────────
export const siteImages = mysqlTable("site_images", {
  id: int("id").autoincrement().primaryKey(),
  slotKey: varchar("slotKey", { length: 100 }).notNull().unique(),
  url: varchar("url", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteImage = typeof siteImages.$inferSelect;
export type InsertSiteImage = typeof siteImages.$inferInsert;

// ─── Hero Slides Config (per-slide active/animation toggles, keyed by the same
// slotKey used in site_images — kept separate because a site_images row only
// exists once an image has been uploaded for that slot) ──────────────────────
export const heroSlidesConfig = mysqlTable("hero_slides_config", {
  id: int("id").autoincrement().primaryKey(),
  slotKey: varchar("slotKey", { length: 100 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  animationEnabled: boolean("animationEnabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HeroSlideConfig = typeof heroSlidesConfig.$inferSelect;
export type InsertHeroSlideConfig = typeof heroSlidesConfig.$inferInsert;

// ─── Site Settings (generic admin-editable text values) ──────────────────────
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ─── Doc Integrity Section (singleton, admin-editable Home content block) ─────
export const docIntegritySection = mysqlTable("doc_integrity_section", {
  id: int("id").autoincrement().primaryKey(),
  eyebrowText: varchar("eyebrowText", { length: 100 }).default("DOCUMENTATION BY DESIGN"),
  headingLine1: varchar("headingLine1", { length: 150 }).default("Research-grade integrity,"),
  headingLine2: varchar("headingLine2", { length: 150 }).default("documented at every layer."),
  bodyText: text("bodyText").default("Brighter Days Labs documents every batch with lab-verified data researchers can trust — from synthesis to shipment."),
  cardBadge: varchar("cardBadge", { length: 50 }).default("COA-LINKED"),
  cardSubtext: varchar("cardSubtext", { length: 100 }).default("Lot-traceable"),
  cardTitle: varchar("cardTitle", { length: 150 }).default("Batch-specific documentation"),
  cardDetail: varchar("cardDetail", { length: 300 }).default("QR access on every vial · ≥99% HPLC verified · US-made, GMP-aligned"),
  heroImageUrl: varchar("heroImageUrl", { length: 500 }),
  heroImageKey: varchar("heroImageKey", { length: 500 }),
  callout1Position: mysqlEnum("callout1Position", ["top", "middle", "bottom"]).default("top"),
  callout1Title: varchar("callout1Title", { length: 100 }).default("Pharmaceutical-Grade Sealing"),
  callout1Description: varchar("callout1Description", { length: 300 }).default("Crimped aluminum cap ensures tamper-evidence and sterility during storage."),
  callout2Position: mysqlEnum("callout2Position", ["top", "middle", "bottom"]).default("middle"),
  callout2Title: varchar("callout2Title", { length: 100 }).default("Verified Purity Label"),
  callout2Description: varchar("callout2Description", { length: 300 }).default("Every vial displays dosage, ≥99% purity, and research-grade certification."),
  callout3Position: mysqlEnum("callout3Position", ["top", "middle", "bottom"]).default("bottom"),
  callout3Title: varchar("callout3Title", { length: 100 }).default("Research Use Compliance"),
  callout3Description: varchar("callout3Description", { length: 300 }).default("Clearly marked for laboratory and scientific research applications only."),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocIntegritySection = typeof docIntegritySection.$inferSelect;
export type InsertDocIntegritySection = typeof docIntegritySection.$inferInsert;

// ─── Wholesale Applications ───────────────────────────────────────────────────
export const wholesaleApplications = mysqlTable("wholesale_applications", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "contacted"])
    .default("pending")
    .notNull(),
  fullName: varchar("fullName", { length: 150 }).notNull(),
  workEmail: varchar("workEmail", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  // Reused as "Company Name" in the form/UI — kept as roleTitle at the
  // column/API level to avoid an extra RENAME COLUMN migration.
  roleTitle: varchar("roleTitle", { length: 150 }).notNull(),
  // No longer collected on the form (was "Organization / Institution").
  // Left in place, nullable, rather than dropped — avoids a DROP COLUMN
  // migration for a field that may still hold historical data later.
  organization: varchar("organization", { length: 200 }),
  // No longer collected on the form (was the research-domains multi-select).
  // Comma-separated slugs, already nullable — left in place for the same
  // reason as organization above.
  researchDomains: varchar("researchDomains", { length: 300 }),
  expectedMonthlyVolume: mysqlEnum("expectedMonthlyVolume", [
    "25k_50k",
    "50k_100k",
    "100k_500k",
    "over_1m",
  ]).notNull(),
  taxExempt: boolean("taxExempt").default(false).notNull(),
  shippingStreet: varchar("shippingStreet", { length: 255 }).notNull(),
  shippingCity: varchar("shippingCity", { length: 150 }).notNull(),
  shippingState: varchar("shippingState", { length: 100 }).notNull(),
  shippingZip: varchar("shippingZip", { length: 20 }).notNull(),
  notes: text("notes"),
  wantsUpdates: boolean("wantsUpdates").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WholesaleApplication = typeof wholesaleApplications.$inferSelect;
export type InsertWholesaleApplication = typeof wholesaleApplications.$inferInsert;

// ─── Affiliates ───────────────────────────────────────────────────────────────

/**
 * One share code per user, created on demand the first time they open the
 * affiliate section. There is no application or approval step.
 */
export const affiliateCodes = mysqlTable("affiliate_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AffiliateCode = typeof affiliateCodes.$inferSelect;
export type InsertAffiliateCode = typeof affiliateCodes.$inferInsert;

/**
 * One row per order placed with a referral code.
 *
 * "rejected" records a self-referral attempt: the buyer used their own code,
 * so no discount was given and no commission is owed, but the attempt is kept
 * for abuse monitoring. Rejected rows always carry commissionAmount 0.00 so a
 * balance query that forgets its status filter still cannot pay them out.
 */
export const affiliateReferrals = mysqlTable(
  "affiliate_referrals",
  {
    id: int("id").autoincrement().primaryKey(),
    affiliateCodeId: int("affiliateCodeId")
      .notNull()
      .references(() => affiliateCodes.id),
    orderId: int("orderId")
      .notNull()
      .references(() => orders.id),
    // Null when the buyer checked out as a guest.
    referredUserId: int("referredUserId").references(() => users.id),
    commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    status: mysqlEnum("status", ["pending", "eligible", "paid", "rejected"])
      .default("pending")
      .notNull(),
    // Set when a payout request settles this commission, so the accounting is
    // an explicit link rather than a guess based on timestamps.
    payoutRequestId: int("payoutRequestId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("affiliate_referrals_code_status_idx").on(table.affiliateCodeId, table.status)]
);

export type AffiliateReferral = typeof affiliateReferrals.$inferSelect;
export type InsertAffiliateReferral = typeof affiliateReferrals.$inferInsert;

export const affiliatePayoutRequests = mysqlTable(
  "affiliate_payout_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    amountRequested: decimal("amountRequested", { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "paid", "rejected"]).default("pending").notNull(),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    paidAt: timestamp("paidAt"),
    adminNotes: text("adminNotes"),
  },
  (table) => [index("affiliate_payout_requests_user_status_idx").on(table.userId, table.status)]
);

export type AffiliatePayoutRequest = typeof affiliatePayoutRequests.$inferSelect;
export type InsertAffiliatePayoutRequest = typeof affiliatePayoutRequests.$inferInsert;

// ─── Password reset ───────────────────────────────────────────────────────────
/**
 * One row per reset request.
 *
 * `tokenHash` is a SHA-256 hex digest, never the token itself: this table is
 * the one place an attacker with read access could otherwise collect live
 * credentials. The plaintext exists only in the email that was sent.
 *
 * Rows are kept after use rather than deleted — `usedAt` is what makes a token
 * single-use, and a deleted row is indistinguishable from one that never
 * existed when something needs explaining later.
 */
export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("password_reset_tokens_user_idx").on(table.userId)]
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
