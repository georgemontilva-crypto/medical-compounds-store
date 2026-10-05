/**
 * Where a buyer came from, remembered until they buy.
 *
 * Traffic reporting already says how many people arrived from each source. It
 * cannot say which of them bought, because an order carried nothing about the
 * visit that produced it — so "revenue by channel", the question anyone paying
 * for advertising asks first, had no answer.
 *
 * This remembers the source on arrival and sends it with the order.
 *
 * First touch, not last: unlike the referral code next door, where the most
 * recent affiliate is the one owed commission, the interesting question here is
 * what *introduced* someone to the shop. A buyer who finds the site through an
 * advertisement, returns twice by typing the address, and then buys was won by
 * the advertisement — recording that sale as "direct" would quietly argue for
 * cutting the thing that worked.
 */

const STORAGE_KEY = "trafficAttribution";

/** Matches the affiliate window, so both attributions expire together. */
const ATTRIBUTION_DAYS = 30;

export interface StoredAttribution {
  /** utm_source, or a referring host, or "direct". */
  source: string;
  /** utm_medium when the link carried one. */
  medium?: string;
  /** utm_campaign when the link carried one. */
  campaign?: string;
  /** When this visit happened, for judging how stale an attribution is. */
  firstSeen: number;
  expiresAt: number;
}

function clean(value: string | null, max = 128): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().slice(0, max);
  return trimmed || null;
}

/** The host a visitor came from, or null for direct arrivals and our own pages. */
function referringHost(): string | null {
  if (!document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    // Navigation within the site is not an arrival.
    if (host === window.location.hostname.replace(/^www\./, "")) return null;
    return host;
  } catch {
    return null;
  }
}

export function getStoredAttribution(): StoredAttribution | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredAttribution>;
    if (typeof stored.source !== "string" || typeof stored.expiresAt !== "number") {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() > stored.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored as StoredAttribution;
  } catch {
    // Private-mode storage, or a value another tab corrupted. An unreadable
    // attribution is not worth breaking a page render over.
    return null;
  }
}

/**
 * Records how this visit arrived, if nothing is recorded yet.
 *
 * Returns early when an attribution already exists — that is what makes it
 * first touch. The one exception is a tagged link: a visitor arriving from a
 * campaign is a stronger signal than whatever vague source was stored before
 * it, and advertising spend is the thing most needing an honest answer.
 */
export function captureAttributionFromUrl(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const utmSource = clean(params.get("utm_source"));
  const existing = getStoredAttribution();

  if (existing && !utmSource) return;

  const source = utmSource ?? referringHost() ?? "direct";

  const payload: StoredAttribution = {
    source,
    medium: clean(params.get("utm_medium"), 64) ?? undefined,
    campaign: clean(params.get("utm_campaign"), 80) ?? undefined,
    firstSeen: existing?.firstSeen ?? Date.now(),
    expiresAt: Date.now() + ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked — attribution is best-effort and never blocks a sale.
  }
}

/** Cleared once the order carrying it has been placed. */
export function clearStoredAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the entry expires on its own.
  }
}
