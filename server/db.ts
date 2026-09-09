import { and, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  CartItem,
  Category,
  InsertBlogCategory,
  InsertBlogPost,
  InsertCartItem,
  InsertCategory,
  InsertCoupon,
  InsertDocIntegritySection,
  InsertLabReport,
  InsertOrder,
  InsertOrderItem,
  InsertShippingLabel,
  InsertProduct,
  InsertProductImage,
  InsertProductVariation,
  InsertHeroSlideConfig,
  InsertSiteImage,
  InsertUser,
  InsertWholesaleApplication,
  InsertWelcomeCouponRedemption,
  Order,
  AffiliateCode,
  InsertAffiliateCode,
  InsertAffiliatePayoutRequest,
  InsertAffiliateReferral,
  affiliateCodes,
  affiliatePayoutRequests,
  affiliateReferrals,
  blogCategories,
  blogPostCategories,
  blogPosts,
  cartItems,
  categories,
  coupons,
  docIntegritySection,
  heroSlidesConfig,
  labReports,
  orderItems,
  passwordResetTokens,
  shippingLabels,
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
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
      // Columns are listed rather than selecting the whole row: `users` carries
      // passwordHash and openId, and spreading it sent both to the admin's
      // browser, where they sat in the query cache. Nothing here needs them.
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        loginMethod: users.loginMethod,
        role: users.role,
        points: users.points,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastSignedIn: users.lastSignedIn,
      },
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

/**
 * The profile fields an admin may edit, and only those.
 *
 * Deliberately not a partial of the whole row: passwordHash, role, openId and
 * points each have their own path in or out of this table, and a generic
 * "update user" would let any future caller reach them through here. A
 * forgotten password is a reset flow, not something an admin retypes.
 */
export async function updateUserProfile(
  id: number,
  data: { name: string; email: string; phone: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ name: data.name, email: data.email, phone: data.phone })
    .where(eq(users.id, id));
}

/**
 * Whether some *other* account already holds this email.
 *
 * Scoped to "other" because an edit that leaves the email untouched must not
 * collide with the row being edited.
 */
export async function findUserByEmailExcluding(
  email: string,
  excludeUserId: number
): Promise<{ id: number } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, excludeUserId)))
    .limit(1);
  return result[0];
}

// ─── Password reset ──────────────────────────────────────────────────────────

/**
 * Retires every live token for a user, then stores the new one.
 *
 * Superseding rather than accumulating: two valid links in two inboxes is one
 * more chance for the wrong person to hold a working one, and a shopper who
 * clicks the form twice expects the newest email to be the one that works.
 * Marked used rather than deleted, so the trail of what was issued survives.
 */
export async function createPasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
}

/** Looked up by hash, because the plaintext is never stored to compare against. */
export async function getPasswordResetTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  return result[0];
}

/**
 * Spends a token, and says whether it was this call that spent it.
 *
 * The `usedAt IS NULL` in the WHERE is what makes the token single-use under
 * concurrency: two requests arriving together both pass the earlier validity
 * check, and only the one whose UPDATE actually matches a row is allowed to
 * proceed. Deciding this in the database rather than in the process is the
 * difference between "single use" and "usually single use".
 */
export async function consumePasswordResetToken(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [result] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)));
  return (result as { affectedRows?: number }).affectedRows === 1;
}

/** Sets a new password hash. Nothing else on the row moves. */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
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

/**
 * An order looked up the way somebody who never made an account has to: the
 * number from their receipt plus the address it was sent to.
 *
 * Both must match. The id alone is guessable — they are sequential — so the
 * email is what actually authorises the read, and it is compared
 * case-insensitively because people capitalise inconsistently when typing an
 * address back in.
 */
export async function getOrderForGuest(id: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return undefined;

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  const order = rows[0];
  if (!order) return undefined;
  if ((order.shippingEmail ?? "").trim().toLowerCase() !== normalised) return undefined;
  return order;
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

/** Records the processor session an order is waiting on, before any money moves. */
export async function setOrderPaymentSession(id: number, sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(orders)
    .set({ paymentMethod: "stripe", paymentReference: sessionId })
    .where(eq(orders.id, id));
}

export type MarkOrderPaidResult =
  | { updated: true }
  | { updated: false; reason: "not_found" | "already_paid" };

/**
 * Settles an order from a verified processor event.
 *
 * Separate from updateOrderStatus because that one requires a fulfillment
 * status, and a payment webhook has no business deciding whether an order has
 * shipped. Idempotent: Stripe retries deliveries, and a replay must not
 * overwrite a status an admin has already moved forward.
 */
export async function markOrderPaid(
  id: number,
  paymentReference: string
): Promise<MarkOrderPaidResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getOrderById(id);
  if (!existing) return { updated: false, reason: "not_found" };
  if (existing.paymentStatus === "paid") return { updated: false, reason: "already_paid" };

  await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      paymentMethod: "stripe",
      paymentReference,
      // Stamped here rather than in the webhook handler so every path that
      // marks an order paid records when, and the early return above keeps a
      // replayed webhook from moving the timestamp on an already-paid order.
      paidAt: new Date(),
      ...(existing.status === "pending" ? { status: "confirmed" as const } : {}),
    })
    .where(eq(orders.id, id));

  return { updated: true };
}


/** Looks an order up by the processor reference stored on it. */
export async function getOrderByPaymentReference(reference: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentReference, reference))
    .limit(1);
  return result[0];
}

export type OrderWriteResult =
  | { updated: true }
  | { updated: false; reason: string };

/**
 * Records a declined card.
 *
 * Only ever a *pending* order becomes "failed". A decline inside Stripe
 * Checkout does not end the session — the shopper can retry with another card
 * and succeed seconds later — so this is an intermediate state that a later
 * markOrderPaid overwrites. The guard is for the reverse case: webhook
 * deliveries are not ordered, and a payment_failed arriving after the payment
 * succeeded must not walk a settled order backwards.
 */
export async function markOrderPaymentFailed(id: number): Promise<OrderWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getOrderById(id);
  if (!existing) return { updated: false, reason: "not_found" };
  if (existing.paymentStatus !== "pending") {
    return { updated: false, reason: `payment_status_is_${existing.paymentStatus}` };
  }

  await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, id));
  return { updated: true };
}

/**
 * Settles a refund issued from the Stripe Dashboard.
 *
 * Only paymentStatus moves: a refund after delivery does not un-deliver the
 * order, so the fulfillment status is left to the admin. Refunded orders drop
 * out of sumOrderRevenue() automatically, which filters on "paid".
 */
export async function markOrderRefunded(id: number): Promise<OrderWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getOrderById(id);
  if (!existing) return { updated: false, reason: "not_found" };
  if (existing.paymentStatus === "refunded") {
    return { updated: false, reason: "already_refunded" };
  }

  await db.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, id));
  return { updated: true };
}

/**
 * Cancels an order whose checkout session expired unpaid.
 *
 * paymentStatus is deliberately left "pending": nothing was declined, the
 * shopper simply never paid, and "failed" would claim a decline that never
 * happened. See canExpiredSessionCancelOrder for the guards this enforces.
 */
export async function cancelExpiredOrder(id: number): Promise<OrderWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getOrderById(id);
  if (!existing) return { updated: false, reason: "not_found" };

  await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id));
  return { updated: true };
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

// Product slugs whose /lab-reports/:slug page actually has something on it.
// Requires both an active report and an active product, so the sitemap never
// advertises an empty (or unlisted-product) report page. lastmod is the newest
// report for that product.
export async function getProductSlugsWithLabReports() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      slug: products.slug,
      lastmod: sql<string | Date>`max(${labReports.updatedAt})`,
    })
    .from(labReports)
    .innerJoin(products, eq(labReports.productId, products.id))
    .where(and(eq(labReports.active, true), eq(products.active, true)))
    .groupBy(products.slug);
}

// ─── Affiliates ───────────────────────────────────────────────────────────────

export async function getAffiliateCodeByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(affiliateCodes)
    .where(eq(affiliateCodes.userId, userId))
    .limit(1);
  return result[0];
}

export async function getAffiliateCodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(affiliateCodes)
    .where(eq(affiliateCodes.id, id))
    .limit(1);
  return result[0];
}

export async function getAffiliateCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(affiliateCodes)
    .where(eq(affiliateCodes.code, code))
    .limit(1);
  return result[0];
}

export async function createAffiliateCode(data: InsertAffiliateCode): Promise<AffiliateCode> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(affiliateCodes).values(data);
  const created = await getAffiliateCodeByUserId(data.userId);
  if (!created) throw new Error("Failed to read back the created affiliate code");
  return created;
}

export async function createAffiliateReferral(data: InsertAffiliateReferral) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(affiliateReferrals).values(data);
}

export async function getReferralsByAffiliateCodeId(affiliateCodeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.affiliateCodeId, affiliateCodeId))
    .orderBy(desc(affiliateReferrals.createdAt));
}

export async function getReferralByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(affiliateReferrals)
    .where(eq(affiliateReferrals.orderId, orderId))
    .limit(1);
  return result[0];
}

/**
 * Promotes a referral to "eligible" once its order is paid for.
 *
 * Only a "pending" row moves: a rejected self-referral must never become
 * payable, and an already-eligible or paid one must not be re-counted when
 * Stripe redelivers the event.
 */
export async function markReferralEligible(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getReferralByOrderId(orderId);
  if (!existing || existing.status !== "pending") return false;

  await db
    .update(affiliateReferrals)
    .set({ status: "eligible" })
    .where(eq(affiliateReferrals.id, existing.id));
  return true;
}

/** Every referral belonging to a user, via their own code. */
export async function getReferralsByUserId(userId: number) {
  const code = await getAffiliateCodeByUserId(userId);
  if (!code) return [];
  return getReferralsByAffiliateCodeId(code.id);
}

// ─── Payout requests ──────────────────────────────────────────────────────────

export async function getPendingPayoutRequest(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(affiliatePayoutRequests)
    .where(
      and(
        eq(affiliatePayoutRequests.userId, userId),
        eq(affiliatePayoutRequests.status, "pending")
      )
    )
    .limit(1);
  return result[0];
}

export async function getPayoutRequestsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(affiliatePayoutRequests)
    .where(eq(affiliatePayoutRequests.userId, userId))
    .orderBy(desc(affiliatePayoutRequests.requestedAt));
}

/**
 * Opens a payout request and stamps the commissions it covers.
 *
 * The eligible referrals are linked to the request as it is created, so
 * settling it later pays exactly the rows the balance was computed from.
 * Commissions that become eligible afterwards belong to the next request.
 */
export async function createPayoutRequest(
  userId: number,
  affiliateCodeId: number,
  amountRequested: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const result = await db
    .insert(affiliatePayoutRequests)
    .values({ userId, amountRequested: amountRequested.toFixed(2), status: "pending" });
  const requestId = (result[0] as unknown as { insertId: number }).insertId;
  if (!requestId) throw new Error("Failed to get payout request insertId");

  await db
    .update(affiliateReferrals)
    .set({ payoutRequestId: requestId })
    .where(
      and(
        eq(affiliateReferrals.affiliateCodeId, affiliateCodeId),
        eq(affiliateReferrals.status, "eligible"),
        isNull(affiliateReferrals.payoutRequestId)
      )
    );

  return requestId;
}

export async function getAllPayoutRequests(status?: "pending" | "paid" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      request: affiliatePayoutRequests,
      userName: users.name,
      userEmail: users.email,
    })
    .from(affiliatePayoutRequests)
    .leftJoin(users, eq(users.id, affiliatePayoutRequests.userId))
    .where(status ? eq(affiliatePayoutRequests.status, status) : undefined)
    .orderBy(desc(affiliatePayoutRequests.requestedAt));

  return rows.map((r) => ({ ...r.request, userName: r.userName, userEmail: r.userEmail }));
}

/**
 * Settles a payout request. Only the commissions stamped with this request id
 * are marked paid, so anything that became eligible after the request was
 * opened stays available for the next one.
 */
export async function settlePayoutRequest(
  id: number,
  status: "paid" | "rejected",
  adminNotes?: string
): Promise<{ updated: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const result = await db
    .select()
    .from(affiliatePayoutRequests)
    .where(eq(affiliatePayoutRequests.id, id))
    .limit(1);
  const request = result[0];
  if (!request) return { updated: false, reason: "not_found" };
  if (request.status !== "pending") return { updated: false, reason: "already_settled" };

  await db
    .update(affiliatePayoutRequests)
    .set({
      status,
      adminNotes: adminNotes ?? null,
      ...(status === "paid" ? { paidAt: new Date() } : {}),
    })
    .where(eq(affiliatePayoutRequests.id, id));

  if (status === "paid") {
    await db
      .update(affiliateReferrals)
      .set({ status: "paid" })
      .where(eq(affiliateReferrals.payoutRequestId, id));
  } else {
    // A rejected request releases its commissions back to the balance.
    await db
      .update(affiliateReferrals)
      .set({ payoutRequestId: null })
      .where(eq(affiliateReferrals.payoutRequestId, id));
  }

  return { updated: true };
}

// ─── Admin overview ───────────────────────────────────────────────────────────

/** Every affiliate with their commission totals, for the admin table. */
export async function getAffiliatesOverview() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      code: affiliateCodes,
      userName: users.name,
      userEmail: users.email,
      status: affiliateReferrals.status,
      commissionAmount: affiliateReferrals.commissionAmount,
    })
    .from(affiliateCodes)
    .leftJoin(users, eq(users.id, affiliateCodes.userId))
    .leftJoin(affiliateReferrals, eq(affiliateReferrals.affiliateCodeId, affiliateCodes.id));

  const byCode = new Map<
    number,
    {
      codeId: number;
      code: string;
      userId: number;
      userName: string | null;
      userEmail: string | null;
      referralCount: number;
      eligibleTotal: number;
      paidTotal: number;
      rejectedCount: number;
    }
  >();

  for (const row of rows) {
    const entry = byCode.get(row.code.id) ?? {
      codeId: row.code.id,
      code: row.code.code,
      userId: row.code.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      referralCount: 0,
      eligibleTotal: 0,
      paidTotal: 0,
      rejectedCount: 0,
    };

    const amount = Number(row.commissionAmount ?? 0);
    if (row.status === "rejected") entry.rejectedCount += 1;
    else if (row.status) entry.referralCount += 1;
    if (row.status === "eligible") entry.eligibleTotal += amount;
    if (row.status === "paid") entry.paidTotal += amount;

    byCode.set(row.code.id, entry);
  }

  return Array.from(byCode.values()).map((e) => ({
    ...e,
    eligibleTotal: Math.round(e.eligibleTotal * 100) / 100,
    paidTotal: Math.round(e.paidTotal * 100) / 100,
  }));
}

/** Self-referral attempts, for abuse monitoring. */
export async function getRejectedReferrals() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      referral: affiliateReferrals,
      code: affiliateCodes.code,
      ownerEmail: users.email,
      orderEmail: orders.shippingEmail,
      orderTotal: orders.total,
    })
    .from(affiliateReferrals)
    .innerJoin(affiliateCodes, eq(affiliateCodes.id, affiliateReferrals.affiliateCodeId))
    .leftJoin(users, eq(users.id, affiliateCodes.userId))
    .leftJoin(orders, eq(orders.id, affiliateReferrals.orderId))
    .where(eq(affiliateReferrals.status, "rejected"))
    .orderBy(desc(affiliateReferrals.createdAt));

  return rows.map((r) => ({
    ...r.referral,
    code: r.code,
    ownerEmail: r.ownerEmail,
    orderEmail: r.orderEmail,
    orderTotal: r.orderTotal,
  }));
}

// ─── Points ───────────────────────────────────────────────────────────────────

/** Adds loyalty points to a user. Called once per order, when it is paid. */
export async function addUserPoints(userId: number, points: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (points <= 0) return;
  await db
    .update(users)
    .set({ points: sql`${users.points} + ${points}` })
    .where(eq(users.id, userId));
}

/** Order count and lifetime spend, counting only orders that were paid for. */
export async function getUserOrderStats(userId: number) {
  const db = await getDb();
  if (!db) return { orderCount: 0, totalSpent: 0 };
  const result = await db
    .select({
      orderCount: sql<number>`count(*)`,
      totalSpent: sql<string>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.paymentStatus, "paid")));

  return {
    orderCount: Number(result[0]?.orderCount ?? 0),
    totalSpent: Number(result[0]?.totalSpent ?? 0),
  };
}

// ─── Shipping labels ──────────────────────────────────────────────────────────

/**
 * Stores a bought label and stamps the tracking number onto the order.
 *
 * The order keeps only the tracking number — a short string the admin list and
 * the customer both want — while the image itself stays in its own table, where
 * a select-everything read of an order will never drag it along.
 */
export async function saveShippingLabel(data: InsertShippingLabel) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.insert(shippingLabels).values(data);
  await db
    .update(orders)
    .set({ trackingNumber: data.trackingNumber })
    .where(eq(orders.id, data.orderId));
}

/** Label metadata for an order, without the image. */
export async function getShippingLabelSummary(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: shippingLabels.id,
      trackingNumber: shippingLabels.trackingNumber,
      serviceCode: shippingLabels.serviceCode,
      format: shippingLabels.format,
      createdAt: shippingLabels.createdAt,
    })
    .from(shippingLabels)
    .where(eq(shippingLabels.orderId, orderId))
    .orderBy(desc(shippingLabels.id))
    .limit(1);

  return result[0];
}

/** The image itself, fetched only when somebody asks to print it. */
export async function getShippingLabelImage(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({ data: shippingLabels.data, format: shippingLabels.format })
    .from(shippingLabels)
    .where(eq(shippingLabels.orderId, orderId))
    .orderBy(desc(shippingLabels.id))
    .limit(1);

  return result[0];
}

/**
 * Records that a parcel actually left, which a printed label does not prove.
 *
 * Separate from label creation on purpose: labels get bought, voided, and left
 * on desks for two days. Telling a customer their order shipped should mean it
 * did.
 */
export async function markOrderShipped(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.update(orders).set({ status: "shipped", shippedAt: new Date() }).where(eq(orders.id, id));
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

/**
 * The columns a listing needs. `content` is deliberately absent: an article
 * body is tens of kilobytes of JSON, and the index page shows a card. Only
 * getPublishedBlogPostBySlug and the admin editor ever read it.
 */
const BLOG_LIST_COLUMNS = {
  id: blogPosts.id,
  title: blogPosts.title,
  slug: blogPosts.slug,
  excerpt: blogPosts.excerpt,
  coverImageUrl: blogPosts.coverImageUrl,
  status: blogPosts.status,
  publishedAt: blogPosts.publishedAt,
  createdAt: blogPosts.createdAt,
  updatedAt: blogPosts.updatedAt,
};

/**
 * Every category attached to each of the given posts, as one query rather than
 * one per post. Returned as a Map so callers can stitch without a nested loop.
 */
async function getCategoriesForPosts(postIds: number[]) {
  const byPost = new Map<number, { id: number; name: string; slug: string }[]>();
  if (postIds.length === 0) return byPost;

  const db = await getDb();
  if (!db) return byPost;

  const rows = await db
    .select({
      postId: blogPostCategories.postId,
      id: blogCategories.id,
      name: blogCategories.name,
      slug: blogCategories.slug,
    })
    .from(blogPostCategories)
    .innerJoin(blogCategories, eq(blogPostCategories.categoryId, blogCategories.id))
    .where(inArray(blogPostCategories.postId, postIds))
    .orderBy(blogCategories.name);

  for (const { postId, ...category } of rows) {
    const existing = byPost.get(postId);
    if (existing) existing.push(category);
    else byPost.set(postId, [category]);
  }
  return byPost;
}

/**
 * The public article list.
 *
 * `status = 'published'` is applied here, in SQL, and there is no parameter to
 * turn it off — the public router calls this one and the admin calls
 * getBlogPostsForAdmin. A draft is not reachable through this path even with a
 * crafted request, which is the property worth having.
 *
 * Ordered by publishedAt with createdAt as a tiebreaker, so two posts released
 * in the same second still come out in a stable order.
 */
export async function getPublishedBlogPosts(options?: {
  categorySlug?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const posts = options?.categorySlug
    ? await db
        .select(BLOG_LIST_COLUMNS)
        .from(blogPosts)
        .innerJoin(blogPostCategories, eq(blogPostCategories.postId, blogPosts.id))
        .innerJoin(blogCategories, eq(blogCategories.id, blogPostCategories.categoryId))
        .where(and(eq(blogPosts.status, "published"), eq(blogCategories.slug, options.categorySlug)))
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select(BLOG_LIST_COLUMNS)
        .from(blogPosts)
        .where(eq(blogPosts.status, "published"))
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset);

  const categories = await getCategoriesForPosts(posts.map((p) => p.id));
  return posts.map((post) => ({ ...post, categories: categories.get(post.id) ?? [] }));
}

/**
 * One published article, with its body, categories and author name.
 *
 * Returns undefined for a draft as well as for a slug that doesn't exist —
 * the caller can't tell the two apart, and shouldn't be able to.
 */
export async function getPublishedBlogPostBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      content: blogPosts.content,
      coverImageUrl: blogPosts.coverImageUrl,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      authorName: users.name,
    })
    .from(blogPosts)
    .leftJoin(users, eq(blogPosts.authorId, users.id))
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
    .limit(1);

  const post = result[0];
  if (!post) return undefined;

  const categories = await getCategoriesForPosts([post.id]);
  return { ...post, categories: categories.get(post.id) ?? [] };
}

/** Published slugs for sitemap.xml, newest first. */
export async function getPublishedBlogPostSlugs() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({ slug: blogPosts.slug, lastmod: blogPosts.updatedAt })
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));
}

/** Everything, drafts included. Admin only. */
export async function getBlogPostsForAdmin() {
  const db = await getDb();
  if (!db) return [];

  const posts = await db
    .select({ ...BLOG_LIST_COLUMNS, authorName: users.name })
    .from(blogPosts)
    .leftJoin(users, eq(blogPosts.authorId, users.id))
    .orderBy(desc(blogPosts.createdAt));

  const categories = await getCategoriesForPosts(posts.map((p) => p.id));
  return posts.map((post) => ({ ...post, categories: categories.get(post.id) ?? [] }));
}

/** One post by id regardless of status, with its body — the editor's read. */
export async function getBlogPostForAdmin(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  const post = result[0];
  if (!post) return undefined;

  const categories = await getCategoriesForPosts([post.id]);
  return { ...post, categories: categories.get(post.id) ?? [] };
}

export async function createBlogPost(data: InsertBlogPost) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(blogPosts).values(data);
  return result[0].insertId as number;
}

export async function updateBlogPost(id: number, data: Partial<InsertBlogPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(blogPosts).set(data).where(eq(blogPosts.id, id));
}

/**
 * Replaces a post's category assignments wholesale.
 *
 * Delete-then-insert rather than diffing: the join rows carry nothing but the
 * pair itself, so there is no state to preserve and a diff would be more code
 * for an identical result.
 */
export async function setBlogPostCategories(postId: number, categoryIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, postId));

  // Array.from rather than a spread: the project targets ES5 downlevel, where
  // spreading a Set is a compile error.
  const unique = Array.from(new Set(categoryIds));
  if (unique.length === 0) return;
  await db
    .insert(blogPostCategories)
    .values(unique.map((categoryId) => ({ postId, categoryId })));
}

/**
 * Deletes a post and the rows that only exist to point at it.
 *
 * The category links go because they describe this post and nothing else.
 * Contrast with orders, where the child rows are the record of what somebody
 * bought and deletion is refused instead.
 */
export async function deleteBlogPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, id));
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

// ─── Blog categories ──────────────────────────────────────────────────────────

/**
 * Categories with the number of articles carrying each one.
 *
 * The count is what the admin's delete dialog reports before removing a
 * category, and what lets the public filter hide a tag nobody has used yet.
 * A left join so a category with no posts still comes back, with zero.
 */
export async function getBlogCategories() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: blogCategories.id,
      name: blogCategories.name,
      slug: blogCategories.slug,
      description: blogCategories.description,
      postCount: sql<number>`count(${blogPostCategories.postId})`,
    })
    .from(blogCategories)
    .leftJoin(blogPostCategories, eq(blogPostCategories.categoryId, blogCategories.id))
    .groupBy(
      blogCategories.id,
      blogCategories.name,
      blogCategories.slug,
      blogCategories.description
    )
    .orderBy(blogCategories.name);
}

/**
 * Categories that have at least one published article behind them.
 *
 * The public filter bar reads this rather than the full list: a tag that leads
 * to an empty page is a dead end for a reader and a thin page for a crawler.
 */
export async function getBlogCategoriesWithPublishedPosts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: blogCategories.id,
      name: blogCategories.name,
      slug: blogCategories.slug,
      postCount: sql<number>`count(${blogPostCategories.postId})`,
    })
    .from(blogCategories)
    .innerJoin(blogPostCategories, eq(blogPostCategories.categoryId, blogCategories.id))
    .innerJoin(blogPosts, eq(blogPosts.id, blogPostCategories.postId))
    .where(eq(blogPosts.status, "published"))
    .groupBy(blogCategories.id, blogCategories.name, blogCategories.slug)
    .orderBy(blogCategories.name);
}

export async function createBlogCategory(data: InsertBlogCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(blogCategories).values(data);
  return result[0].insertId as number;
}

export async function updateBlogCategory(id: number, data: Partial<InsertBlogCategory>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(blogCategories).set(data).where(eq(blogCategories.id, id));
}

/**
 * Deletes a category and unassigns it from every article.
 *
 * A category is a label, not something an article depends on, so reorganizing
 * the taxonomy must never touch the writing: the join rows go, the posts stay
 * exactly as they were, minus one tag. The admin sees the affected count in
 * the confirmation dialog before this runs.
 */
export async function deleteBlogCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.delete(blogPostCategories).where(eq(blogPostCategories.categoryId, id));
  await db.delete(blogCategories).where(eq(blogCategories.id, id));
}

/**
 * Whether a slug is already taken, optionally ignoring one post — the post
 * being edited, which of course still holds its own slug.
 *
 * The unique index is the real guarantee; this exists so the admin gets
 * "That slug is already in use" instead of a raw MySQL duplicate-key error.
 */
export async function blogSlugExists(slug: string, exceptId?: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(exceptId ? and(eq(blogPosts.slug, slug), ne(blogPosts.id, exceptId)) : eq(blogPosts.slug, slug))
    .limit(1);

  return result.length > 0;
}

/** Same check for taxonomy slugs, which share the /blog?category= namespace. */
export async function blogCategorySlugExists(slug: string, exceptId?: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(
      exceptId
        ? and(eq(blogCategories.slug, slug), ne(blogCategories.id, exceptId))
        : eq(blogCategories.slug, slug)
    )
    .limit(1);

  return result.length > 0;
}
