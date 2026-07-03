import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
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
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

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
