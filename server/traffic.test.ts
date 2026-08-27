import { beforeEach, describe, expect, it } from "vitest";
import {
  DIRECT_SOURCE,
  fillTrafficGaps,
  hourBucket,
  isBotUserAgent,
  normalizePath,
  normalizeSource,
  type TrafficPoint,
} from "@shared/traffic";
import {
  MAX_VIEWS_PER_VISITOR_DAY,
  clientIp,
  drainTrafficBufferForTests,
  recordPageView,
  resetTrafficStateForTests,
} from "./traffic";

/**
 * Traffic counting, tested where the mistakes would actually be made.
 *
 * Two of these are about not storing something: a path must not carry a reset
 * token into a table, and a visitor must not stay recognisable past the day
 * they visited. The rest are about the arithmetic that turns page loads into
 * the numbers on the dashboard — chiefly that a visitor is counted once and a
 * view is counted every time, which is the distinction the whole schema rests
 * on.
 */

const SITE_HOST = "www.brighterdayslabs.com";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// ─── Paths ───────────────────────────────────────────────────────────────────

describe("normalizePath", () => {
  it("keeps a plain path as it is", () => {
    expect(normalizePath("/compounds")).toBe("/compounds");
    expect(normalizePath("/")).toBe("/");
  });

  it("drops the query string, which is where a live credential would be", () => {
    // The reason this matters: /reset-password?token=… is a working password
    // reset link, and it must not end up in an analytics row.
    expect(normalizePath("/reset-password?token=abc123")).toBe("/reset-password");
    expect(normalizePath("/compounds?utm_source=google#top")).toBe("/compounds");
  });

  it("treats a trailing slash as the same page", () => {
    expect(normalizePath("/compounds/")).toBe("/compounds");
    expect(normalizePath("/compounds///")).toBe("/compounds");
  });

  it("collapses repeated slashes so one page is not two rows", () => {
    expect(normalizePath("/compounds//bpc-157")).toBe("/compounds/bpc-157");
  });

  it("lowercases, so /Compounds and /compounds are one page", () => {
    expect(normalizePath("/Compounds/BPC-157")).toBe("/compounds/bpc-157");
  });

  it("refuses anything that is not a path", () => {
    expect(normalizePath("https://example.com/x")).toBeNull();
    expect(normalizePath("compounds")).toBeNull();
    expect(normalizePath("")).toBeNull();
  });

  it("refuses a path too long to be real, rather than truncating it", () => {
    // Truncating would file every long junk URL under one made-up page.
    expect(normalizePath(`/${"a".repeat(300)}`)).toBeNull();
  });
});

// ─── Traffic sources ─────────────────────────────────────────────────────────

describe("normalizeSource", () => {
  it("files a missing or unusable referrer as direct", () => {
    expect(normalizeSource(null, null, SITE_HOST)).toBe(DIRECT_SOURCE);
    expect(normalizeSource("", null, SITE_HOST)).toBe(DIRECT_SOURCE);
    expect(normalizeSource("not a url", null, SITE_HOST)).toBe(DIRECT_SOURCE);
    expect(normalizeSource("file:///C:/page.html", null, SITE_HOST)).toBe(DIRECT_SOURCE);
  });

  it("files our own pages as direct rather than as a source", () => {
    expect(normalizeSource("https://www.brighterdayslabs.com/compounds", null, SITE_HOST)).toBe(
      DIRECT_SOURCE
    );
    expect(normalizeSource("https://brighterdayslabs.com/", null, SITE_HOST)).toBe(DIRECT_SOURCE);
    expect(normalizeSource("https://shop.brighterdayslabs.com/", null, SITE_HOST)).toBe(
      DIRECT_SOURCE
    );
  });

  it("names the search engines, whatever domain they arrive on", () => {
    expect(normalizeSource("https://www.google.com/", null, SITE_HOST)).toBe("google");
    expect(normalizeSource("https://www.google.co.uk/search?q=x", null, SITE_HOST)).toBe("google");
    expect(normalizeSource("https://news.google.com/", null, SITE_HOST)).toBe("google");
    expect(normalizeSource("https://duckduckgo.com/", null, SITE_HOST)).toBe("duckduckgo");
  });

  it("collapses the many faces of one network", () => {
    expect(normalizeSource("https://l.facebook.com/", null, SITE_HOST)).toBe("facebook");
    expect(normalizeSource("https://m.facebook.com/", null, SITE_HOST)).toBe("facebook");
    expect(normalizeSource("https://t.co/abc", null, SITE_HOST)).toBe("x");
  });

  it("reads the android-app scheme, which is not a URL at all", () => {
    expect(normalizeSource("android-app://com.google.android.gm", null, SITE_HOST)).toBe("gmail");
    expect(normalizeSource("android-app://com.facebook.katana", null, SITE_HOST)).toBe("facebook");
    // An unmapped package keeps its own name rather than vanishing into "other".
    expect(normalizeSource("android-app://com.example.reader", null, SITE_HOST)).toBe(
      "com.example.reader"
    );
  });

  it("keeps an unrecognised host, which is how a missing mapping gets noticed", () => {
    expect(normalizeSource("https://www.peptidetalk.org/thread/9", null, SITE_HOST)).toBe(
      "peptidetalk.org"
    );
  });

  it("lets utm_source win, since the referrer may not have survived the click", () => {
    expect(normalizeSource("https://l.facebook.com/", "newsletter", SITE_HOST)).toBe("newsletter");
    expect(normalizeSource(null, "  Spring-Campaign ", SITE_HOST)).toBe("spring-campaign");
  });
});

// ─── Bots ────────────────────────────────────────────────────────────────────

describe("isBotUserAgent", () => {
  it("lets a real browser through", () => {
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(
      isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile")
    ).toBe(false);
  });

  it("catches the crawlers that announce themselves", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("curl/8.4.0")).toBe(true);
    expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
    expect(isBotUserAgent("HeadlessChrome/120.0")).toBe(true);
  });

  it("treats a missing user agent as automated", () => {
    // A browser that just ran our script always sends one.
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
  });
});

// ─── Buckets ─────────────────────────────────────────────────────────────────

describe("hourBucket", () => {
  it("floors to the hour in UTC", () => {
    expect(hourBucket(new Date("2026-08-20T14:37:52.123Z")).toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
  });

  it("keeps the last second of an hour inside that hour", () => {
    expect(hourBucket(new Date("2026-08-20T14:59:59.999Z")).toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
  });
});

describe("fillTrafficGaps", () => {
  it("zeroes the days nobody visited", () => {
    const points: TrafficPoint[] = [{ bucket: "2026-08-20", views: 12, visitors: 5 }];
    const filled = fillTrafficGaps(
      points,
      new Date("2026-08-18T00:00:00.000Z"),
      new Date("2026-08-20T12:00:00.000Z"),
      "day"
    );

    expect(filled).toEqual([
      { bucket: "2026-08-18", views: 0, visitors: 0 },
      { bucket: "2026-08-19", views: 0, visitors: 0 },
      { bucket: "2026-08-20", views: 12, visitors: 5 },
    ]);
  });

  it("keeps a bucket the calendar walk did not produce", () => {
    // Losing a real day to an off-by-one at the edge would be worse than an
    // extra point on the chart.
    const points: TrafficPoint[] = [{ bucket: "2026-08-17", views: 3, visitors: 2 }];
    const filled = fillTrafficGaps(
      points,
      new Date("2026-08-18T00:00:00.000Z"),
      new Date("2026-08-18T12:00:00.000Z"),
      "day"
    );

    expect(filled.map((p) => p.bucket)).toEqual(["2026-08-17", "2026-08-18"]);
  });
});

// ─── The request address ─────────────────────────────────────────────────────

describe("clientIp", () => {
  it("takes the left-most forwarded address, which is the visitor", () => {
    expect(
      clientIp({ headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }, ip: "10.0.0.1" })
    ).toBe("203.0.113.9");
  });

  it("falls back to the socket address when nothing was forwarded", () => {
    expect(clientIp({ headers: {}, ip: "203.0.113.9" })).toBe("203.0.113.9");
    expect(clientIp({ headers: { "x-forwarded-for": "  " }, ip: "203.0.113.9" })).toBe(
      "203.0.113.9"
    );
  });

  it("survives a request with no address at all", () => {
    expect(clientIp({ headers: {} })).toBe("");
  });
});

// ─── Counting ────────────────────────────────────────────────────────────────

const AT_NOON = new Date("2026-08-20T12:15:00.000Z");

function hit(overrides: Partial<Parameters<typeof recordPageView>[0]> = {}) {
  return {
    ip: "203.0.113.9",
    userAgent: CHROME,
    path: "/compounds",
    ...overrides,
  };
}

describe("recordPageView", () => {
  beforeEach(() => {
    resetTrafficStateForTests();
  });

  it("counts every view but the visitor only once", () => {
    recordPageView(hit(), AT_NOON);
    recordPageView(hit(), AT_NOON);
    recordPageView(hit({ path: "/faq" }), AT_NOON);

    const { pages } = drainTrafficBufferForTests();
    const byPath = new Map(pages.map((p) => [p.path, p]));

    expect(byPath.get("/compounds")).toMatchObject({ views: 2, entries: 1 });
    // The second page of the same visit is a view, not another arrival.
    expect(byPath.get("/faq")).toMatchObject({ views: 1, entries: 0 });
  });

  it("adds up to that day's unique visitors across every page", () => {
    recordPageView(hit({ ip: "203.0.113.9" }), AT_NOON);
    recordPageView(hit({ ip: "203.0.113.9", path: "/faq" }), AT_NOON);
    recordPageView(hit({ ip: "198.51.100.4", path: "/faq" }), AT_NOON);

    const { pages } = drainTrafficBufferForTests();
    expect(pages.reduce((n, p) => n + p.entries, 0)).toBe(2);
    expect(pages.reduce((n, p) => n + p.views, 0)).toBe(3);
  });

  it("separates hours into their own buckets", () => {
    recordPageView(hit(), new Date("2026-08-20T12:59:00.000Z"));
    recordPageView(hit(), new Date("2026-08-20T13:01:00.000Z"));

    const { pages } = drainTrafficBufferForTests();
    expect(pages.map((p) => p.bucketStart.toISOString()).sort()).toEqual([
      "2026-08-20T12:00:00.000Z",
      "2026-08-20T13:00:00.000Z",
    ]);
  });

  it("attributes the source once, on the page the visit started from", () => {
    recordPageView(hit({ referrer: "https://www.google.com/" }), AT_NOON);
    // Every later page carries this site as its referrer. Counting those would
    // bury google under our own hostname.
    recordPageView(
      hit({ path: "/faq", referrer: "https://www.brighterdayslabs.com/compounds" }),
      AT_NOON
    );

    const { sources } = drainTrafficBufferForTests();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ source: "google", visits: 1 });
  });

  it("ignores a crawler that names itself", () => {
    recordPageView(hit({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }), AT_NOON);
    recordPageView(hit({ userAgent: "" }), AT_NOON);

    expect(drainTrafficBufferForTests().pages).toHaveLength(0);
  });

  it("ignores a path it refuses to store", () => {
    recordPageView(hit({ path: "https://example.com/" }), AT_NOON);
    expect(drainTrafficBufferForTests().pages).toHaveLength(0);
  });

  it("stops counting one visitor past the daily ceiling", () => {
    for (let i = 0; i < MAX_VIEWS_PER_VISITOR_DAY + 50; i++) {
      recordPageView(hit(), AT_NOON);
    }

    const { pages } = drainTrafficBufferForTests();
    expect(pages[0].views).toBe(MAX_VIEWS_PER_VISITOR_DAY);
  });

  it("counts yesterday's visitor again tomorrow, because the salt rotated", () => {
    recordPageView(hit(), AT_NOON);
    drainTrafficBufferForTests();

    recordPageView(hit(), new Date("2026-08-21T09:00:00.000Z"));

    const { pages } = drainTrafficBufferForTests();
    // Not a bug: the hash that recognised them yesterday cannot be recomputed,
    // by us or by anyone, once the salt is gone. Daily uniques is the metric
    // that survives that, and it is the one the dashboard reports.
    expect(pages[0]).toMatchObject({ views: 1, entries: 1 });
  });

  it("hands back an empty buffer once drained", () => {
    recordPageView(hit(), AT_NOON);
    drainTrafficBufferForTests();

    expect(drainTrafficBufferForTests()).toEqual({ pages: [], sources: [] });
  });
});
