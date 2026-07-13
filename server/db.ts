import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  CartItem,
  Category,
  InsertCartItem,
  InsertCategory,
  InsertCoupon,
  InsertDocIntegritySection,
  InsertLabReport,
  InsertOrder,
  InsertOrderItem,
  InsertProduct,
  InsertProductImage,
  InsertProductVariation,
  InsertHeroSlideConfig,
  InsertSiteImage,
  InsertUser,
  InsertWholesaleApplication,
  InsertWelcomeCouponRedemption,
  Order,
  cartItems,
  categories,
  coupons,
  docIntegritySection,
  heroSlidesConfig,
  labReports,
  orderItems,
  orders,
  productImages,
  productVariations,
  products,
  siteImages,
  siteSettings,
  users,
  welcomeCouponRedemptions,
  wholesaleApplications,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getAllUsers(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      user: users,
      welcomeCouponCode: coupons.code,
      welcomeCouponRedeemedAt: welcomeCouponRedemptions.redeemedAt,
      welcomeCouponUsedAt: welcomeCouponRedemptions.usedAt,
    })
    .from(users)
    .leftJoin(welcomeCouponRedemptions, eq(welcomeCouponRedemptions.userId, users.id))
    .leftJoin(coupons, eq(coupons.id, welcomeCouponRedemptions.couponId))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r.user,
    welcomeCouponCode: r.welcomeCouponCode,
    welcomeCouponRedeemedAt: r.welcomeCouponRedeemedAt,
    welcomeCouponUsedAt: r.welcomeCouponUsedAt,
  }));
}

export async function countUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return Number(result[0]?.count ?? 0);
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(categories).values(data);
  return result[0];
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(categories).where(eq(categories.id, id));
}

// ─── Products ─────────────────────────────────────────────────────────────────
export async function getProducts(opts?: {
  categoryId?: number;
  search?: string;
  featured?: boolean;
  active?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "price_asc" | "price_desc" | "name_asc" | "name_desc" | "featured";
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.active !== undefined) conditions.push(eq(products.active, opts.active));
  if (opts?.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts?.featured !== undefined) conditions.push(eq(products.featured, opts.featured));
  if (opts?.search) {
    conditions.push(
      or(
        like(products.name, `%${opts.search}%`),
        like(products.casNumber, `%${opts.search}%`),
        like(products.mechanism, `%${opts.search}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let orderBy;
  switch (opts?.sortBy) {
    case "price_asc":
      orderBy = products.basePrice;
      break;
    case "price_desc":
      orderBy = desc(products.basePrice);
      break;
    case "name_asc":
      orderBy = products.name;
      break;
    case "name_desc":
      orderBy = desc(products.name);
      break;
    default:
      orderBy = desc(products.featured);
  }
  return db
    .select()
    .from(products)
    .where(where)
    .orderBy(orderBy)
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return result[0];
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(products).values(data);
  return result[0];
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existingOrderItem = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, id))
    .limit(1);
  if (existingOrderItem.length > 0) {
    throw new Error(
      "Cannot delete a product that has existing orders. Deactivate it instead."
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.productId, id));
    await tx.delete(productImages).where(eq(productImages.productId, id));
    await tx.delete(productVariations).where(eq(productVariations.productId, id));
    await tx.delete(labReports).where(eq(labReports.productId, id));
    await tx.delete(products).where(eq(products.id, id));
  });
}

export async function countProducts() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(products);
  return Number(result[0]?.count ?? 0);
}

// ─── Product Images ───────────────────────────────────────────────────────────
export async function getProductImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.sortOrder);
}

export async function addProductImage(data: InsertProductImage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(productImages).values(data);
  return result[0];
}

export async function deleteProductImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(productImages).where(eq(productImages.id, id));
}

// ─── Product Variations ───────────────────────────────────────────────────────
export async function getProductVariations(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productVariations)
    .where(eq(productVariations.productId, productId))
    .orderBy(productVariations.value);
}

export async function getVariationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(productVariations)
    .where(eq(productVariations.id, id))
    .limit(1);
  return result[0];
}

export async function createVariation(data: InsertProductVariation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(productVariations).values(data);
  return result[0];
}

export async function updateVariation(id: number, data: Partial<InsertProductVariation>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(productVariations).set(data).where(eq(productVariations.id, id));
}

export async function deleteVariation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(productVariations).where(eq(productVariations.id, id));
}

// ─── Coupons ──────────────────────────────────────────────────────────────────
export async function getAllCoupons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1);
  return result[0];
}

export async function getCouponById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return result[0];
}

export async function createCoupon(data: InsertCoupon) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(coupons).values(data);
  return result[0];
}

export async function updateCoupon(id: number, data: Partial<InsertCoupon>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}

export async function deleteCoupon(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(coupons).where(eq(coupons.id, id));
}

export async function incrementCouponUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, id));
}

export async function getActiveNewCustomerOfferCoupon() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.isNewCustomerOffer, true), eq(coupons.active, true)))
    .limit(1);
  const coupon = result[0];
  if (!coupon) return undefined;
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return undefined;
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return undefined;
  return coupon;
}

export async function setNewCustomerOfferCoupon(id: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (enabled) {
    await db.update(coupons).set({ isNewCustomerOffer: false }).where(eq(coupons.isNewCustomerOffer, true));
    await db.update(coupons).set({ isNewCustomerOffer: true }).where(eq(coupons.id, id));
  } else {
    await db.update(coupons).set({ isNewCustomerOffer: false }).where(eq(coupons.id, id));
  }
}

// ─── Welcome Coupon Redemptions ────────────────────────────────────────────────
export async function getWelcomeRedemption(userId: number, couponId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(welcomeCouponRedemptions)
    .where(and(eq(welcomeCouponRedemptions.userId, userId), eq(welcomeCouponRedemptions.couponId, couponId)))
    .limit(1);
  return result[0];
}

export async function createWelcomeRedemption(data: InsertWelcomeCouponRedemption) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(welcomeCouponRedemptions).values(data);
}

export async function markWelcomeRedemptionUsed(userId: number, couponId: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(welcomeCouponRedemptions)
    .set({ orderId, usedAt: new Date() })
    .where(
      and(
        eq(welcomeCouponRedemptions.userId, userId),
        eq(welcomeCouponRedemptions.couponId, couponId),
        sql`${welcomeCouponRedemptions.usedAt} IS NULL`
      )
    );
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export async function createOrder(data: InsertOrder): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(orders).values(data);
  // MySQL2 returns OkPacket with insertId
  const insertId = (result[0] as unknown as { insertId: number }).insertId;
  if (!insertId) throw new Error("Failed to get order insertId");
  return insertId;
}

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(orderItems).values(data);
  return result[0];
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getAllOrders(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
}

export async function updateOrderStatus(
  id: number,
  status: Order["status"],
  paymentStatus?: Order["paymentStatus"]
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const updateData: Partial<Order> = { status };
  if (paymentStatus) updateData.paymentStatus = paymentStatus;
  await db.update(orders).set(updateData).where(eq(orders.id, id));
}

export async function countOrders() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(orders);
  return Number(result[0]?.count ?? 0);
}

export async function sumOrderRevenue() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ total: sql<string>`sum(total)` })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));
  return Number(result[0]?.total ?? 0);
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export async function getCartItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cartItems).where(eq(cartItems.userId, userId));
}

export async function upsertCartItem(data: InsertCartItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.userId, data.userId),
        eq(cartItems.productId, data.productId),
        data.variationId
          ? eq(cartItems.variationId, data.variationId)
          : sql`${cartItems.variationId} IS NULL`
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: (existing[0].quantity ?? 1) + (data.quantity ?? 1) })
      .where(eq(cartItems.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(cartItems).values(data);
    return result[0];
  }
}

export async function updateCartItemQuantity(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  } else {
    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, id));
  }
}

export async function removeCartItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cartItems).where(eq(cartItems.id, id));
}

export async function clearCart(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// ─── Lab Reports ──────────────────────────────────────────────────────────────
export async function getLabReportsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(labReports)
    .where(eq(labReports.productId, productId))
    .orderBy(labReports.createdAt);
}

export async function getAllLabReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(labReports).orderBy(labReports.createdAt);
}

export async function createLabReport(data: InsertLabReport) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(labReports).values(data);
  return result[0].insertId as number;
}

export async function deleteLabReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(labReports).where(eq(labReports.id, id));
}

export async function updateLabReport(id: number, data: Partial<InsertLabReport>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(labReports).set(data).where(eq(labReports.id, id));
}

// ─── Site Images ────────────────────────────────────────────────────────────────
export async function getAllSiteImages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteImages);
}

export async function getSiteImageBySlot(slotKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(siteImages).where(eq(siteImages.slotKey, slotKey)).limit(1);
  return result[0];
}

export async function upsertSiteImage(data: InsertSiteImage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(siteImages)
    .values(data)
    .onDuplicateKeyUpdate({ set: { url: data.url, fileKey: data.fileKey, label: data.label, updatedAt: new Date() } });
  return getSiteImageBySlot(data.slotKey);
}

// ─── Hero Slides Config ─────────────────────────────────────────────────────────
export async function getAllHeroSlidesConfig() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heroSlidesConfig);
}

export async function upsertHeroSlideConfig(
  slotKey: string,
  data: Partial<Pick<InsertHeroSlideConfig, "active" | "animationEnabled">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(heroSlidesConfig)
    .values({ slotKey, active: data.active ?? true, animationEnabled: data.animationEnabled ?? true })
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const result = await db.select().from(heroSlidesConfig).where(eq(heroSlidesConfig.slotKey, slotKey)).limit(1);
  return result[0];
}

// ─── Site Settings ──────────────────────────────────────────────────────────────
export async function getSiteSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return result[0];
}

export async function setSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
  return getSiteSetting(key);
}

// ─── Doc Integrity Section (singleton row, id=1) ───────────────────────────────
export async function getDocIntegritySection() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(docIntegritySection).where(eq(docIntegritySection.id, 1)).limit(1);
  return result[0];
}

export async function updateDocIntegritySection(data: Partial<InsertDocIntegritySection>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(docIntegritySection)
    .values({ id: 1, ...data })
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  return getDocIntegritySection();
}

// ─── Wholesale Applications ─────────────────────────────────────────────────────
export async function createWholesaleApplication(data: InsertWholesaleApplication) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(wholesaleApplications).values(data);
  const insertId = result[0].insertId;
  const [row] = await db.select().from(wholesaleApplications).where(eq(wholesaleApplications.id, insertId)).limit(1);
  return row;
}

export async function getWholesaleApplications(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(wholesaleApplications).orderBy(desc(wholesaleApplications.createdAt));
  if (status) {
    return query.where(eq(wholesaleApplications.status, status as any));
  }
  return query;
}

export async function updateWholesaleApplicationStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(wholesaleApplications)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(wholesaleApplications.id, id));
  const [row] = await db.select().from(wholesaleApplications).where(eq(wholesaleApplications.id, id)).limit(1);
  return row;
}

// ─── Public recent lab reports (for the Research Standards page) ───────────────
export async function getRecentPublicLabReports(limit: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: labReports.id,
      title: labReports.title,
      batchNumber: labReports.batchNumber,
      testDate: labReports.testDate,
      createdAt: labReports.createdAt,
      fileUrl: labReports.fileUrl,
      fileName: labReports.fileName,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(labReports)
    .innerJoin(products, eq(labReports.productId, products.id))
    .where(eq(labReports.active, true))
    .orderBy(desc(labReports.createdAt))
    .limit(limit);
}
