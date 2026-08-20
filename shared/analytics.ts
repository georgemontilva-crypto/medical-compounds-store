/**
 * Shapes and pure helpers for the admin analytics dashboard.
 *
 * The database can only report buckets that contain data: a day with no sales
 * produces no row, and a status nobody's order is in produces no row either.
 * A chart needs the gaps anyway — a flat stretch is information, and a line that
 * skips from Monday to Friday misreads as a steep climb. Filling them is
 * arithmetic over the calendar, not a query, so it lives here where it can be
 * tested without a database.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type SalesGranularity = "day" | "week" | "month";

export interface SalesPoint {
  /** Bucket start as `YYYY-MM-DD`. */
  bucket: string;
  revenue: number;
  orders: number;
}

/** Selectable windows, as whole days back from now. */
export const ANALYTICS_RANGES = {
  "7d": { days: 7, label: "Last 7 days", granularity: "day" as SalesGranularity },
  "30d": { days: 30, label: "Last 30 days", granularity: "day" as SalesGranularity },
  "90d": { days: 90, label: "Last 90 days", granularity: "week" as SalesGranularity },
  "12m": { days: 365, label: "Last 12 months", granularity: "month" as SalesGranularity },
} as const;

export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

/** The same keys as a tuple, for building a zod enum from one source of truth. */
export const ANALYTICS_RANGE_KEYS = ["7d", "30d", "90d", "12m"] as const satisfies readonly AnalyticsRange[];

export const DEFAULT_RANGE: AnalyticsRange = "30d";

/**
 * How long a checkout may sit unpaid before it counts as abandoned.
 *
 * Long enough that a shopper still typing their card number on Stripe's page is
 * not counted as lost.
 */
export const ABANDONED_GRACE_HOURS = 2;

/** Midnight UTC at the start of the window. */
export function rangeStart(range: AnalyticsRange, now: Date = new Date()): Date {
  const days = ANALYTICS_RANGES[range].days;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1)
  );
  return start;
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The bucket a moment belongs to, matching what the SQL grouping produces. */
export function bucketOf(date: Date, granularity: SalesGranularity): string {
  if (granularity === "month") {
    return toKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  }
  if (granularity === "week") {
    // MySQL's WEEKDAY() is 0 for Monday; getUTCDay() is 0 for Sunday.
    const offset = (date.getUTCDay() + 6) % 7;
    return toKey(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset))
    );
  }
  return toKey(date);
}

/** Guards against an absurd range producing an unbounded series. */
const MAX_BUCKETS = 400;

/** Every bucket key between two moments, inclusive, in ascending order. */
export function bucketKeys(from: Date, to: Date, granularity: SalesGranularity): string[] {
  if (to < from) return [];

  const keys: string[] = [];
  const cursor = new Date(
    granularity === "month"
      ? Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
      : Date.UTC(
          from.getUTCFullYear(),
          from.getUTCMonth(),
          from.getUTCDate() - (granularity === "week" ? (from.getUTCDay() + 6) % 7 : 0)
        )
  );
  const last = bucketOf(to, granularity);

  while (keys.length < MAX_BUCKETS) {
    const key = toKey(cursor);
    keys.push(key);
    if (key >= last) break;

    if (granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (granularity === "week" ? 7 : 1));
  }

  return keys;
}

/**
 * A complete series over the window, with absent buckets zeroed.
 *
 * Buckets the database reported but the calendar walk did not produce are kept
 * rather than dropped — the SQL formats dates in the database's timezone, and
 * losing a real sale to an off-by-one at the edge of the range would be a worse
 * bug than an extra point.
 */
export function fillSalesGaps(
  points: SalesPoint[],
  from: Date,
  to: Date,
  granularity: SalesGranularity
): SalesPoint[] {
  const byBucket = new Map(points.map((p) => [p.bucket, p]));
  const series = new Map<string, SalesPoint>();

  for (const bucket of bucketKeys(from, to, granularity)) {
    series.set(bucket, byBucket.get(bucket) ?? { bucket, revenue: 0, orders: 0 });
  }
  for (const point of points) {
    if (!series.has(point.bucket)) series.set(point.bucket, point);
  }

  return Array.from(series.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Counts for all six statuses, including the ones nothing is sitting in. */
export function fillStatusCounts(
  rows: Array<{ status: string; count: number }>
): Array<{ status: OrderStatus; count: number }> {
  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  return ORDER_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
}

/**
 * Share of checkouts that ended in payment.
 *
 * Returns null rather than zero when nothing has been attempted: no checkouts is
 * not the same as a 0% conversion rate, and showing the latter would invent a
 * problem that does not exist.
 */
export function conversionRate(paid: number, abandoned: number): number | null {
  const attempted = paid + abandoned;
  if (attempted === 0) return null;
  return paid / attempted;
}
