import { describe, expect, it } from "vitest";
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_KEYS,
  ORDER_STATUSES,
  bucketKeys,
  bucketOf,
  conversionRate,
  fillSalesGaps,
  fillStatusCounts,
  rangeStart,
  type SalesPoint,
} from "@shared/analytics";

/**
 * The database reports only the buckets that contain data. Everything here is
 * about what happens to the ones it cannot report: a week with no sales still
 * has to appear as a zero, or the chart draws a line straight from one sale to
 * the next and reads as steady trade through a dead stretch.
 */

const NOW = new Date("2026-08-20T12:00:00.000Z");

// ─── Bucketing ───────────────────────────────────────────────────────────────

describe("bucketOf", () => {
  it("buckets a day to its own date", () => {
    expect(bucketOf(new Date("2026-08-20T23:59:00.000Z"), "day")).toBe("2026-08-20");
  });

  it("buckets a week to the Monday it belongs to", () => {
    // 2026-08-20 is a Thursday; its Monday is the 17th.
    expect(bucketOf(new Date("2026-08-20T12:00:00.000Z"), "week")).toBe("2026-08-17");
    expect(bucketOf(new Date("2026-08-17T00:00:00.000Z"), "week")).toBe("2026-08-17");
  });

  it("keeps Sunday in the week that began the previous Monday", () => {
    // The trap in getUTCDay(): Sunday is 0, so a naive subtraction moves it
    // forward a week instead of back six days.
    expect(bucketOf(new Date("2026-08-23T12:00:00.000Z"), "week")).toBe("2026-08-17");
  });

  it("buckets a month to its first day", () => {
    expect(bucketOf(new Date("2026-08-20T12:00:00.000Z"), "month")).toBe("2026-08-01");
    expect(bucketOf(new Date("2026-08-01T00:00:00.000Z"), "month")).toBe("2026-08-01");
  });
});

describe("bucketKeys", () => {
  it("produces every day in the span, inclusive", () => {
    const keys = bucketKeys(new Date("2026-08-18"), new Date("2026-08-21"), "day");
    expect(keys).toEqual(["2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"]);
  });

  it("produces consecutive Mondays for a week span", () => {
    const keys = bucketKeys(new Date("2026-08-05"), new Date("2026-08-20"), "week");
    expect(keys).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
  });

  it("produces month starts, crossing a year boundary", () => {
    const keys = bucketKeys(new Date("2025-11-14"), new Date("2026-02-03"), "month");
    expect(keys).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
  });

  it("returns a single bucket when both ends fall in it", () => {
    expect(bucketKeys(new Date("2026-08-20T01:00:00Z"), new Date("2026-08-20T23:00:00Z"), "day"))
      .toEqual(["2026-08-20"]);
  });

  it("returns nothing when the range runs backwards", () => {
    expect(bucketKeys(new Date("2026-08-20"), new Date("2026-08-10"), "day")).toEqual([]);
  });

  it("stays bounded for an absurd span", () => {
    const keys = bucketKeys(new Date("1990-01-01"), new Date("2026-08-20"), "day");
    expect(keys.length).toBeLessThanOrEqual(400);
  });
});

// ─── Gap filling ─────────────────────────────────────────────────────────────

describe("fillSalesGaps", () => {
  const from = new Date("2026-08-18T00:00:00.000Z");
  const to = new Date("2026-08-21T00:00:00.000Z");

  it("inserts zeroed buckets for days with no sales", () => {
    const points: SalesPoint[] = [{ bucket: "2026-08-20", revenue: 114.98, orders: 2 }];
    const filled = fillSalesGaps(points, from, to, "day");

    expect(filled.map((p) => p.bucket)).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
    expect(filled.find((p) => p.bucket === "2026-08-19")).toEqual({
      bucket: "2026-08-19",
      revenue: 0,
      orders: 0,
    });
  });

  it("leaves the reported figures untouched", () => {
    const points: SalesPoint[] = [{ bucket: "2026-08-20", revenue: 114.98, orders: 2 }];
    const filled = fillSalesGaps(points, from, to, "day");
    expect(filled.find((p) => p.bucket === "2026-08-20")).toEqual(points[0]);
  });

  it("returns an all-zero series when nothing sold", () => {
    const filled = fillSalesGaps([], from, to, "day");
    expect(filled).toHaveLength(4);
    expect(filled.every((p) => p.revenue === 0 && p.orders === 0)).toBe(true);
  });

  it("keeps a reported bucket that falls outside the walked calendar", () => {
    // The SQL formats dates in the database's timezone, so a sale at the edge of
    // the window can land a day either side. Dropping it would lose real money
    // from the chart; an extra point at the edge is the safer failure.
    const points: SalesPoint[] = [{ bucket: "2026-08-17", revenue: 50, orders: 1 }];
    const filled = fillSalesGaps(points, from, to, "day");
    expect(filled.map((p) => p.bucket)).toContain("2026-08-17");
    expect(filled[0]?.bucket).toBe("2026-08-17");
  });

  it("returns buckets in ascending order", () => {
    const points: SalesPoint[] = [
      { bucket: "2026-08-21", revenue: 10, orders: 1 },
      { bucket: "2026-08-18", revenue: 20, orders: 1 },
    ];
    const filled = fillSalesGaps(points, from, to, "day");
    const sorted = filled.map((p) => p.bucket).slice().sort();
    expect(filled.map((p) => p.bucket)).toEqual(sorted);
  });
});

// ─── Status filling ──────────────────────────────────────────────────────────

describe("fillStatusCounts", () => {
  it("returns all six statuses even when only one has orders", () => {
    const filled = fillStatusCounts([{ status: "paid_typo_ignored", count: 3 }]);
    expect(filled.map((s) => s.status)).toEqual([...ORDER_STATUSES]);
    expect(filled.every((s) => s.count === 0)).toBe(true);
  });

  it("carries through the counts it was given", () => {
    const filled = fillStatusCounts([
      { status: "delivered", count: 5 },
      { status: "pending", count: 2 },
    ]);
    expect(filled.find((s) => s.status === "delivered")?.count).toBe(5);
    expect(filled.find((s) => s.status === "pending")?.count).toBe(2);
    expect(filled.find((s) => s.status === "cancelled")?.count).toBe(0);
  });

  it("keeps the statuses in their workflow order", () => {
    const filled = fillStatusCounts([]);
    expect(filled.map((s) => s.status)).toEqual([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]);
  });
});

// ─── Ranges ──────────────────────────────────────────────────────────────────

describe("rangeStart", () => {
  it("starts a 7-day window six days before today, at midnight UTC", () => {
    const start = rangeStart("7d", NOW);
    expect(start.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });

  it("goes further back for a wider window", () => {
    expect(rangeStart("30d", NOW).toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(rangeStart("12m", NOW) < rangeStart("90d", NOW)).toBe(true);
  });

  it("covers every advertised range key", () => {
    for (const key of ANALYTICS_RANGE_KEYS) {
      expect(rangeStart(key, NOW) <= NOW).toBe(true);
      expect(ANALYTICS_RANGES[key].label).toBeTruthy();
    }
  });
});

// ─── Conversion ──────────────────────────────────────────────────────────────

describe("conversionRate", () => {
  it("is the paid share of attempted checkouts", () => {
    expect(conversionRate(3, 1)).toBe(0.75);
    expect(conversionRate(1, 1)).toBe(0.5);
  });

  it("is null when nothing was attempted, rather than zero", () => {
    // A store with no checkouts has no conversion rate; reporting 0% would
    // invent a problem out of an absence of data.
    expect(conversionRate(0, 0)).toBeNull();
  });

  it("is 1 when every checkout was paid", () => {
    expect(conversionRate(4, 0)).toBe(1);
  });

  it("is 0 when none were", () => {
    expect(conversionRate(0, 4)).toBe(0);
  });
});
