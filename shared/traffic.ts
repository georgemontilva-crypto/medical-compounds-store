import { bucketKeys, type SalesGranularity } from "./analytics";

/**
 * First-party traffic measurement: the shapes, and the parts that are pure.
 *
 * The store counts its own traffic instead of embedding a third-party script.
 * Both sides of that trade show up in the numbers this file helps produce, so
 * they are worth stating here rather than in a commit message:
 *
 *   - Nothing about a visitor leaves this server, and nothing that identifies
 *     one is ever stored. `server/traffic.ts` reduces a hit to a hash that
 *     stops meaning anything at midnight, and only counts are written down.
 *   - Bot filtering is ours to maintain. `isBotUserAgent` catches the crawlers
 *     that announce themselves, and a hit is only ever recorded from
 *     JavaScript, which excludes most of the ones that do not. That is well
 *     short of what a dedicated analytics vendor filters, and the gap is a
 *     standing maintenance cost — the list below needs revisiting, not just
 *     writing once.
 *   - Referrer naming is ours to maintain too: `SOURCE_NAMES` needs a line
 *     added whenever a new network starts sending traffic, or that traffic
 *     shows up under a bare hostname nobody recognises.
 */

/** Longest path stored. Anything longer is junk and is dropped, not truncated. */
export const MAX_PATH_LENGTH = 255;

/** Longest source name stored. */
export const MAX_SOURCE_LENGTH = 128;

/** Where a visit is filed when no usable referrer came with it. */
export const DIRECT_SOURCE = "direct";

export interface TrafficPoint {
  /** Bucket start as `YYYY-MM-DD`, matching the sales series. */
  bucket: string;
  views: number;
  visitors: number;
}

export interface PagePopularity {
  path: string;
  views: number;
  /** Visitors whose first page of the day was this one. */
  entries: number;
}

export interface SourcePopularity {
  source: string;
  visits: number;
}

// ─── Paths ───────────────────────────────────────────────────────────────────

/**
 * The stored form of a path, or null when it should not be stored at all.
 *
 * The query string is cut off before anything is written down. That is not
 * tidiness: `/reset-password?token=…` carries a live credential, and a text
 * column in an analytics table is the last place it should come to rest.
 */
export function normalizePath(raw: string): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;

  let path = trimmed.split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, "/");
  // A trailing slash is the same page; "/" itself keeps its own.
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";

  if (path.length > MAX_PATH_LENGTH) return null;
  return path;
}

// ─── Traffic sources ─────────────────────────────────────────────────────────

/** Android hands over `android-app://<package>` where a browser sends a URL. */
const APP_NAMES: Array<[RegExp, string]> = [
  [/^com\.google\.android\.gm$/, "gmail"],
  [/^com\.google\.android\./, "google"],
  [/^com\.facebook\./, "facebook"],
  [/^com\.instagram\./, "instagram"],
  [/^com\.twitter\./, "x"],
  [/^com\.linkedin\./, "linkedin"],
  [/^com\.reddit\./, "reddit"],
  [/^com\.zhiliaoapp\.musically$/, "tiktok"],
];

/**
 * Hostnames worth showing under a name a human recognises.
 *
 * Anything unmatched is kept as its bare hostname rather than lumped into an
 * "other" bucket — an unrecognised host that keeps appearing is exactly the
 * signal that this list needs a new line.
 */
const SOURCE_NAMES: Array<[RegExp, string]> = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/^search\.brave\.com$/, "brave"],
  [/(^|\.)search\.yahoo\.com$/, "yahoo"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/^(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)outlook\.(com|live\.com)$/, "outlook"],
  [/^mail\.yahoo\.com$/, "yahoo mail"],
  [/(^|\.)chatgpt\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
];

/** The android package or bare hostname behind a referrer, if it has one. */
function referrerOrigin(referrer: string): { app?: string; host?: string } | null {
  const trimmed = referrer.trim();
  if (!trimmed) return null;

  const androidApp = /^android-app:\/\/([^/?#]+)/i.exec(trimmed);
  if (androidApp) return { app: androidApp[1].toLowerCase() };

  try {
    const url = new URL(trimmed);
    // Anything that is not a web page — `file:`, an extension scheme — tells
    // us nothing about where the traffic came from.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host ? { host } : null;
  } catch {
    return null;
  }
}

/** Whether a hostname is this site, including any subdomain of it. */
function isOwnHost(host: string, siteHost: string): boolean {
  const site = siteHost.toLowerCase().replace(/^www\./, "");
  return site.length > 0 && (host === site || host.endsWith(`.${site}`));
}

/**
 * Where a visit came from, as one short lowercase label.
 *
 * A `utm_source` wins over the referrer: it is what the campaign that produced
 * the click said about itself, and it survives the redirects that strip a
 * referrer along the way.
 *
 * Our own hostname resolves to "direct" rather than to itself. The site is not
 * a source of its own traffic, and a visitor whose first recorded page happens
 * to carry an internal referrer — the counter restarted, or they were last
 * counted yesterday — is honestly unattributed, not self-referred.
 */
export function normalizeSource(
  referrer: string | null | undefined,
  utmSource: string | null | undefined,
  siteHost: string
): string {
  const utm = (utmSource ?? "").trim().toLowerCase();
  if (utm) return utm.slice(0, MAX_SOURCE_LENGTH);

  const origin = referrer ? referrerOrigin(referrer) : null;
  if (!origin) return DIRECT_SOURCE;

  if (origin.app) {
    for (const [pattern, name] of APP_NAMES) {
      if (pattern.test(origin.app)) return name;
    }
    return origin.app.slice(0, MAX_SOURCE_LENGTH);
  }

  const host = origin.host ?? "";
  if (isOwnHost(host, siteHost)) return DIRECT_SOURCE;

  for (const [pattern, name] of SOURCE_NAMES) {
    if (pattern.test(host)) return name;
  }
  return host.slice(0, MAX_SOURCE_LENGTH);
}

// ─── Bots ────────────────────────────────────────────────────────────────────

/**
 * Automated clients that identify themselves in the user agent.
 *
 * This is the weakest of the three filters and the only one that needs
 * feeding. The other two are structural: a hit is only recorded from
 * JavaScript the visitor's browser actually ran, and `server/traffic.ts` caps
 * how many views one visitor can contribute in a day. A crawler that runs
 * JavaScript and lies about its user agent still gets through all three, and
 * no amount of editing this list will change that.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrape|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|preview|monitor|uptime|pingdom|curl|wget|python-requests|httpclient|okhttp|axios|node-fetch|go-http|java\/|libwww|feedfetcher|validator/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  // A browser that just ran our script always sends one; nothing else does.
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}

// ─── Buckets ─────────────────────────────────────────────────────────────────

/**
 * The hour a moment belongs to, in UTC.
 *
 * An hour is the finest bucket the dashboard could plausibly want and the
 * coarsest that still rolls up cleanly into days, weeks and months, so it is
 * the only resolution stored.
 */
export function hourBucket(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours())
  );
}

/**
 * A complete series over the window, with quiet buckets zeroed.
 *
 * Same reasoning as `fillSalesGaps`: a day with no traffic produces no row,
 * and a line that jumps from Monday to Friday reads as a climb rather than as
 * the flat stretch it actually was.
 */
export function fillTrafficGaps(
  points: TrafficPoint[],
  from: Date,
  to: Date,
  granularity: SalesGranularity
): TrafficPoint[] {
  const byBucket = new Map(points.map((p) => [p.bucket, p]));
  const series = new Map<string, TrafficPoint>();

  for (const bucket of bucketKeys(from, to, granularity)) {
    series.set(bucket, byBucket.get(bucket) ?? { bucket, views: 0, visitors: 0 });
  }
  for (const point of points) {
    if (!series.has(point.bucket)) series.set(point.bucket, point);
  }

  return Array.from(series.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}
