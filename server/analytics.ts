import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  orderItems,
  orders,
  pageViewStats,
  products,
  trafficSourceStats,
} from "../drizzle/schema";
import type { PagePopularity, SourcePopularity, TrafficPoint } from "@shared/traffic";

/**
 * Aggregate queries behind the admin analytics dashboard.
 *
 * Everything here adds up in SQL. None of it pulls rows across the wire to sum
 * them in JavaScript, which is merely wasteful at eight orders and ruinous at
 * eighty thousand. The only work left to the caller is filling gaps the
 * database cannot invent — a day with no sales produces no row.
 *
 * Two conventions run through all of it:
 *
 *   - Money counts an order only once payment settled: `paymentStatus = 'paid'`.
 *     Refunded and failed orders are excluded by construction rather than
 *     subtracted afterwards.
 *   - Revenue is dated by `paidAt` where it is known, falling back to
 *     `createdAt` for orders placed before that column existed. `updatedAt` is
 *     not a substitute — it moves on every later status change.
 */

/** When the money landed, tolerating orders old enough to have no `paidAt`. */
const paidDate = sql`coalesce(${orders.paidAt}, ${orders.createdAt})`;

export type SalesGranularity = "day" | "week" | "month";

/** Bucketing expression for `paidDate`, as a `YYYY-MM-DD` string. */
function salesBucket(granularity: SalesGranularity) {
  switch (granularity) {
    case "week":
      // The Monday of the week the payment landed in.
      return sql`date_format(date_sub(${paidDate}, interval weekday(${paidDate}) day), '%Y-%m-%d')`;
    case "month":
      return sql`date_format(${paidDate}, '%Y-%m-01')`;
    default:
      return sql`date_format(${paidDate}, '%Y-%m-%d')`;
  }
}

export interface SalesPoint {
  bucket: string;
  revenue: number;
  orders: number;
}

/** Revenue and paid-order count per bucket. Empty buckets are simply absent. */
export async function getSalesOverTime(
  since: Date,
  granularity: SalesGranularity
): Promise<SalesPoint[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      bucket: sql<string>`${salesBucket(granularity)}`.as("bucket"),
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
      orderCount: sql<number>`count(*)`,
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), sql`${paidDate} >= ${since}`))
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);

  return rows.map((r) => ({
    bucket: String(r.bucket),
    revenue: Number(r.revenue ?? 0),
    orders: Number(r.orderCount ?? 0),
  }));
}

/** Paid revenue, paid order count and average order value for a window. */
export async function getRevenueSummary(since: Date) {
  const db = await getDb();
  if (!db) return { revenue: 0, orders: 0, averageOrderValue: 0 };

  const result = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
      orderCount: sql<number>`count(*)`,
      averageOrderValue: sql<string>`coalesce(avg(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), sql`${paidDate} >= ${since}`));

  return {
    revenue: Number(result[0]?.revenue ?? 0),
    orders: Number(result[0]?.orderCount ?? 0),
    averageOrderValue: Number(result[0]?.averageOrderValue ?? 0),
  };
}

/**
 * How many orders sit in each workflow status.
 *
 * Counts every order regardless of payment on purpose: this is the state of the
 * fulfilment queue, not a revenue figure, so a cancelled order still belongs in
 * it. Dated by `createdAt`, since an unpaid order has no payment date.
 */
export async function getOrdersByStatus(since: Date) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({ status: orders.status, count: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.createdAt} >= ${since}`)
    .groupBy(orders.status);

  return rows.map((r) => ({ status: r.status, count: Number(r.count ?? 0) }));
}

export interface ProductSales {
  productId: number;
  name: string;
  units: number;
  revenue: number;
}

/**
 * Best sellers by units, from the line items of paid orders.
 *
 * Grouped by product id rather than by the name stored on the line: that name
 * is a snapshot taken at purchase, so renaming a product would otherwise split
 * its history into two rows.
 */
export async function getTopProducts(since: Date, limit: number): Promise<ProductSales[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      productId: orderItems.productId,
      name: sql<string>`max(${products.name})`,
      // Aliased explicitly: drizzle only emits `AS` when asked, and the ORDER BY
      // below refers to this column by name.
      units: sql<number>`sum(${orderItems.quantity})`.as("units"),
      revenue: sql<string>`sum(${orderItems.subtotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.paymentStatus, "paid"), sql`${paidDate} >= ${since}`))
    .groupBy(orderItems.productId)
    .orderBy(sql`units desc`)
    .limit(limit);

  return rows.map((r) => ({
    productId: Number(r.productId),
    name: String(r.name ?? ""),
    units: Number(r.units ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));
}

/**
 * Slowest movers, including everything that sold nothing at all.
 *
 * Driven from `products` with an outer join, because `order_items` only ever
 * mentions products that sold at least once — and a product with zero sales is
 * exactly what this list exists to surface. The paid and date filters sit in the
 * join condition, not a WHERE clause: in a WHERE they would drop the
 * null-extended rows and quietly collapse this back into an inner join, hiding
 * the very products being looked for.
 */
export async function getSlowestProducts(since: Date, limit: number): Promise<ProductSales[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      // Aliased for the ORDER BY below — see getTopProducts.
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.as("units"),
      revenue: sql<string>`coalesce(sum(${orderItems.subtotal}), 0)`,
    })
    .from(products)
    .leftJoin(orderItems, eq(orderItems.productId, products.id))
    .leftJoin(
      orders,
      and(
        eq(orders.id, orderItems.orderId),
        eq(orders.paymentStatus, "paid"),
        sql`${paidDate} >= ${since}`
      )
    )
    .groupBy(products.id, products.name)
    .orderBy(sql`units asc`, products.name)
    .limit(limit);

  return rows.map((r) => ({
    productId: Number(r.productId),
    name: String(r.name ?? ""),
    units: Number(r.units ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));
}

/**
 * Buyers who have ordered once versus more than once, over all time.
 *
 * Identity is the shipping email rather than the user id. Guest checkout is a
 * first-class flow here and leaves `orders.userId` null, so counting by user id
 * would silently omit every guest. Emails are lowered so casing cannot split one
 * buyer into two.
 *
 * Deliberately not scoped to the selected range: "returning" is a fact about a
 * buyer's whole history, and a 30-day window would file a loyal customer as new
 * merely because their earlier orders fell outside it.
 */
export async function getCustomerMix() {
  const db = await getDb();
  if (!db) return { oneOrder: 0, returning: 0 };

  const perCustomer = db
    .select({
      email: sql<string>`lower(${orders.shippingEmail})`.as("email"),
      orderCount: sql<number>`count(*)`.as("orderCount"),
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), sql`${orders.shippingEmail} is not null`))
    .groupBy(sql`email`)
    .as("perCustomer");

  const result = await db
    .select({
      oneOrder: sql<number>`coalesce(sum(case when ${perCustomer.orderCount} = 1 then 1 else 0 end), 0)`,
      returning: sql<number>`coalesce(sum(case when ${perCustomer.orderCount} > 1 then 1 else 0 end), 0)`,
    })
    .from(perCustomer);

  return {
    oneOrder: Number(result[0]?.oneOrder ?? 0),
    returning: Number(result[0]?.returning ?? 0),
  };
}

/**
 * Checkouts that reached the payment step and were never paid for.
 *
 * The order row is written before the shopper is handed to Stripe, so an
 * unfinished payment leaves a `pending` row behind. That makes abandonment
 * measurable with no tracking of any kind — and, because the row carries a
 * shipping email, recoverable. `graceHours` keeps payments still in flight out
 * of the count.
 *
 * This is not an abandoned cart. Someone who filled a basket and never opened
 * the checkout leaves no trace in any table and cannot be counted here.
 */
export async function getAbandonedCheckouts(since: Date, graceHours: number) {
  const db = await getDb();
  if (!db) return { count: 0, value: 0, failed: 0 };

  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

  const [abandoned, failed] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
        value: sql<string>`coalesce(sum(${orders.total}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.paymentStatus, "pending"),
          sql`${orders.status} <> 'cancelled'`,
          sql`${orders.createdAt} < ${cutoff}`,
          sql`${orders.createdAt} >= ${since}`
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "failed"), sql`${orders.createdAt} >= ${since}`)),
  ]);

  return {
    count: Number(abandoned[0]?.count ?? 0),
    value: Number(abandoned[0]?.value ?? 0),
    failed: Number(failed[0]?.count ?? 0),
  };
}

/** The most recent unpaid checkouts, as a recovery queue the admin can work. */
export async function getRecentAbandonedCheckouts(graceHours: number, limit: number) {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: orders.id,
      email: orders.shippingEmail,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, "pending"),
        sql`${orders.status} <> 'cancelled'`,
        sql`${orders.createdAt} < ${cutoff}`
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    total: Number(r.total ?? 0),
    createdAt: r.createdAt,
  }));
}

// ─── Site traffic ─────────────────────────────────────────────────────────────
/**
 * Reads over the two aggregate tables `server/traffic.ts` writes.
 *
 * Everything below groups hourly rows into the same day, week and month buckets
 * the sales series uses, so the two charts line up and a spike in traffic can
 * be read against a spike in orders.
 *
 * One convention differs from the money queries above. The window bound is
 * bound as a UTC string rather than as a Date: `bucketStart` is a DATETIME with
 * no time zone of its own, and handing the driver a Date would have it
 * formatted in whatever zone the process happens to run in — which is the one
 * thing that would quietly shift the window by hours between a laptop and
 * Railway.
 */
function utcBound(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Bucketing expression over an hourly traffic row, as a `YYYY-MM-DD` string. */
function trafficBucket(granularity: SalesGranularity) {
  const at = pageViewStats.bucketStart;
  switch (granularity) {
    case "week":
      return sql`date_format(date_sub(${at}, interval weekday(${at}) day), '%Y-%m-%d')`;
    case "month":
      return sql`date_format(${at}, '%Y-%m-01')`;
    default:
      return sql`date_format(${at}, '%Y-%m-%d')`;
  }
}

/** Views and visitors per bucket. Quiet buckets are simply absent. */
export async function getTrafficOverTime(
  since: Date,
  granularity: SalesGranularity
): Promise<TrafficPoint[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      bucket: sql<string>`${trafficBucket(granularity)}`.as("bucket"),
      views: sql<number>`coalesce(sum(${pageViewStats.views}), 0)`,
      visitors: sql<number>`coalesce(sum(${pageViewStats.entries}), 0)`,
    })
    .from(pageViewStats)
    .where(sql`${pageViewStats.bucketStart} >= ${utcBound(since)}`)
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);

  return rows.map((r) => ({
    bucket: String(r.bucket),
    views: Number(r.views ?? 0),
    visitors: Number(r.visitors ?? 0),
  }));
}

/**
 * Headline traffic figures for a window.
 *
 * `visitors` sums the entry counts, which makes it the sum of each day's unique
 * visitors: someone who comes back on Tuesday counts on Monday and again on
 * Tuesday. That is what a daily-unique figure means everywhere else, and it is
 * the only honest one available without keeping an identifier around longer
 * than a day.
 */
export async function getTrafficSummary(since: Date) {
  const db = await getDb();
  if (!db) return { views: 0, visitors: 0 };

  const result = await db
    .select({
      views: sql<number>`coalesce(sum(${pageViewStats.views}), 0)`,
      visitors: sql<number>`coalesce(sum(${pageViewStats.entries}), 0)`,
    })
    .from(pageViewStats)
    .where(sql`${pageViewStats.bucketStart} >= ${utcBound(since)}`);

  return {
    views: Number(result[0]?.views ?? 0),
    visitors: Number(result[0]?.visitors ?? 0),
  };
}

/**
 * The most viewed pages in the window.
 *
 * `entries` is how many visits started on that page rather than how many people
 * saw it, so a page can be viewed constantly and land almost nobody — which is
 * the difference between a page people pass through and a page people arrive
 * on.
 */
export async function getTopPages(since: Date, limit: number): Promise<PagePopularity[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      path: pageViewStats.path,
      // Aliased explicitly: drizzle only emits `AS` when asked, and the ORDER BY
      // below refers to this column by name.
      views: sql<number>`sum(${pageViewStats.views})`.as("views"),
      entries: sql<number>`sum(${pageViewStats.entries})`,
    })
    .from(pageViewStats)
    .where(sql`${pageViewStats.bucketStart} >= ${utcBound(since)}`)
    .groupBy(pageViewStats.path)
    .orderBy(sql`views desc`)
    .limit(limit);

  return rows.map((r) => ({
    path: String(r.path ?? ""),
    views: Number(r.views ?? 0),
    entries: Number(r.entries ?? 0),
  }));
}

/** Where the window's visits came from, busiest first. */
export async function getTopSources(since: Date, limit: number): Promise<SourcePopularity[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      source: trafficSourceStats.source,
      visits: sql<number>`sum(${trafficSourceStats.visits})`.as("visits"),
    })
    .from(trafficSourceStats)
    .where(sql`${trafficSourceStats.bucketStart} >= ${utcBound(since)}`)
    .groupBy(trafficSourceStats.source)
    .orderBy(sql`visits desc`)
    .limit(limit);

  return rows.map((r) => ({
    source: String(r.source ?? ""),
    visits: Number(r.visits ?? 0),
  }));
}
