import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  hourBucket,
  isBotUserAgent,
  normalizePath,
  normalizeSource,
} from "@shared/traffic";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { pageViewStats, trafficSourceStats } from "../drizzle/schema";

/**
 * Counting page views without keeping anything about the people who make them.
 *
 * Three properties hold, and each one is load-bearing somewhere below:
 *
 *   1. **No identifier is ever stored.** Telling one visitor from another needs
 *      only that two hits look alike within a day. A SHA-256 of address, user
 *      agent and a salt does that, and the salt is 32 random bytes made in
 *      memory at first use and thrown away at midnight UTC. Once it rotates,
 *      yesterday's hashes cannot be reproduced from an address by anyone —
 *      including whoever holds this process's memory, because the salt that
 *      made them no longer exists anywhere. No cookie is set and no consent
 *      banner is owed.
 *
 *   2. **Nothing reaches the database per view.** Hits land in the two maps
 *      below and are written out once a minute as `+= n` on an hourly row. A
 *      thousand views an hour on one page is one row and sixty statements a
 *      day, not a thousand inserts. The cost is that a crash loses up to a
 *      minute of counts — a deliberate trade, and the reason a graceful
 *      shutdown flushes on the way out, since a deploy is the restart that
 *      actually happens.
 *
 *   3. **Visitor identity never outlives the process.** `viewsByVisitor` is not
 *      backed by a table, so a restart lets a visitor already counted today be
 *      counted once more when they next load a page. That inflates the visitor
 *      figure slightly on days the site was deployed. Persisting it would mean
 *      a row per visitor per day, which is the identifier property 1 exists to
 *      avoid — this side of the trade was chosen on purpose.
 */

/** How often the buffer is written out. */
const FLUSH_INTERVAL_MS = 60_000;

/**
 * Views one visitor may contribute in a day before the rest are ignored.
 *
 * The structural half of bot filtering: something that runs our JavaScript,
 * sends a plausible user agent and loads pages all day is capped here rather
 * than being allowed to decide what the "most viewed page" is. A person
 * browsing a catalogue does not come close to this.
 */
export const MAX_VIEWS_PER_VISITOR_DAY = 200;

/**
 * How many visitors are tracked at once, so the map cannot grow without bound.
 *
 * Past the cap, views still count but new visitors stop being recognised as
 * new. That undercounts visitors in a scenario — a distributed crawl — where
 * the number was going to be wrong anyway, and it keeps memory flat.
 */
const MAX_TRACKED_VISITORS = 50_000;

interface PageBucket {
  bucketStart: Date;
  path: string;
  views: number;
  entries: number;
}

interface SourceBucket {
  bucketStart: Date;
  source: string;
  visits: number;
}

let pageBuckets = new Map<string, PageBucket>();
let sourceBuckets = new Map<string, SourceBucket>();
let viewsByVisitor = new Map<string, number>();
let saltDay = "";
let dailySalt = "";
let flushTimer: NodeJS.Timeout | null = null;

// ─── Visitor identity ────────────────────────────────────────────────────────

/** The salt that makes today's hashes meaningless tomorrow. */
function currentSalt(now: Date): string {
  const day = now.toISOString().slice(0, 10);
  if (day !== saltDay) {
    saltDay = day;
    dailySalt = randomBytes(32).toString("hex");
    // The old hashes are unusable against the new salt, and keeping them would
    // stop the new day's visitors from being recognised as new.
    viewsByVisitor.clear();
  }
  return dailySalt;
}

/**
 * A day-scoped fingerprint that identifies nobody.
 *
 * Returned to the caller and used only as a map key — it is never stored, sent
 * anywhere, or logged.
 */
function visitorHash(ip: string, userAgent: string, now: Date): string {
  return createHash("sha256").update(`${ip}\n${userAgent}\n${currentSalt(now)}`).digest("hex");
}

/**
 * The visitor's address as it looked in front of Railway's proxy.
 *
 * `req.ip` is the proxy: Express is not configured to trust `X-Forwarded-For`,
 * so every visitor would otherwise hash to the same value and the whole site
 * would look like one very busy person. The left-most entry of the header is
 * the client as the first proxy saw it.
 *
 * That entry is trivially spoofable, which here costs nothing: forging it only
 * splits the forger's own counts, it grants no access, and the value is thrown
 * away as soon as it has been hashed. It would matter for a rate limiter; it
 * does not matter for a counter.
 */
export function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",")[0].trim();
  }
  return req.ip ?? "";
}

/** This site's own hostname, so its own pages are not read as a traffic source. */
function siteHost(): string {
  try {
    return new URL(ENV.publicSiteUrl).hostname;
  } catch {
    return "";
  }
}

// ─── Recording ───────────────────────────────────────────────────────────────

export interface PageViewHit {
  ip: string;
  userAgent: string;
  path: string;
  referrer?: string | null;
  utmSource?: string | null;
}

/**
 * Adds one page view to the buffer. Never throws and never awaits.
 *
 * A visitor's traffic source is recorded once, on their first page of the day.
 * Every page after that carries this site as its referrer, so counting them
 * would bury the real entry points under our own hostname.
 */
export function recordPageView(hit: PageViewHit, now: Date = new Date()): void {
  if (isBotUserAgent(hit.userAgent)) return;

  const path = normalizePath(hit.path);
  if (!path) return;

  const hash = visitorHash(hit.ip, hit.userAgent, now);
  const previous = viewsByVisitor.get(hash);
  const tracked = previous !== undefined || viewsByVisitor.size < MAX_TRACKED_VISITORS;

  if (tracked) {
    const seen = (previous ?? 0) + 1;
    if (seen > MAX_VIEWS_PER_VISITOR_DAY) return;
    viewsByVisitor.set(hash, seen);
  }

  const isFirstToday = tracked && previous === undefined;
  const bucketStart = hourBucket(now);
  const bucketKey = bucketStart.toISOString();

  const pageKey = `${bucketKey}|${path}`;
  const page = pageBuckets.get(pageKey);
  if (page) {
    page.views += 1;
    if (isFirstToday) page.entries += 1;
  } else {
    pageBuckets.set(pageKey, { bucketStart, path, views: 1, entries: isFirstToday ? 1 : 0 });
  }

  if (!isFirstToday) return;

  const source = normalizeSource(hit.referrer, hit.utmSource, siteHost());
  const sourceKey = `${bucketKey}|${source}`;
  const existing = sourceBuckets.get(sourceKey);
  if (existing) existing.visits += 1;
  else sourceBuckets.set(sourceKey, { bucketStart, source, visits: 1 });
}

/** Empties the buffer and hands back what was in it. */
function drainBuffer(): { pages: PageBucket[]; sources: SourceBucket[] } {
  const pages = Array.from(pageBuckets.values());
  const sources = Array.from(sourceBuckets.values());
  pageBuckets = new Map();
  sourceBuckets = new Map();
  return { pages, sources };
}

// ─── Flushing ────────────────────────────────────────────────────────────────

/**
 * Writes the buffered counts out and empties the buffer.
 *
 * One statement per distinct bucket, each adding its own literal rather than
 * using MySQL's deprecated `VALUES()` in the update clause. The buffer is only
 * drained once the database has answered, so a window with no connection waits
 * for the next flush instead of evaporating.
 *
 * A failed write does lose that window's counts. Holding them back for a retry
 * would let the buffer grow without limit while the database stayed down, and
 * a minute of page views is not worth that risk.
 */
export async function flushTrafficBuffer(): Promise<void> {
  if (pageBuckets.size === 0 && sourceBuckets.size === 0) return;

  const db = await getDb();
  if (!db) return;

  const { pages, sources } = drainBuffer();

  try {
    await Promise.all([
      ...pages.map((page) =>
        db
          .insert(pageViewStats)
          .values({
            bucketStart: page.bucketStart,
            path: page.path,
            views: page.views,
            entries: page.entries,
          })
          .onDuplicateKeyUpdate({
            set: {
              views: sql`${pageViewStats.views} + ${page.views}`,
              entries: sql`${pageViewStats.entries} + ${page.entries}`,
            },
          })
      ),
      ...sources.map((source) =>
        db
          .insert(trafficSourceStats)
          .values({
            bucketStart: source.bucketStart,
            source: source.source,
            visits: source.visits,
          })
          .onDuplicateKeyUpdate({
            set: { visits: sql`${trafficSourceStats.visits} + ${source.visits}` },
          })
      ),
    ]);
  } catch (error) {
    console.warn("[Traffic] Flush failed; this window's counts are lost:", error);
  }
}

/**
 * Starts the flush loop, and arranges for a last flush on a clean shutdown.
 *
 * The shutdown hook is what keeps the accepted "up to a minute lost" from
 * happening on every release: a deploy is a SIGTERM, not a crash, so the
 * partial window can still be written. An actual crash loses it, as agreed.
 */
export function startTrafficFlush(): void {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    void flushTrafficBuffer();
  }, FLUSH_INTERVAL_MS);
  // A page-view counter is not a reason to keep the process alive.
  flushTimer.unref?.();

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void flushTrafficBuffer().finally(() => process.exit(0));
    });
  }
}

/** Test seam: forget the buffer, the salt and everyone counted today. */
export function resetTrafficStateForTests(): void {
  pageBuckets = new Map();
  sourceBuckets = new Map();
  viewsByVisitor = new Map();
  saltDay = "";
  dailySalt = "";
}

/** Test seam: what a flush would write, without a database. */
export function drainTrafficBufferForTests(): { pages: PageBucket[]; sources: SourceBucket[] } {
  return drainBuffer();
}
