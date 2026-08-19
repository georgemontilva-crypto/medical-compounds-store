import { REFERRAL_ATTRIBUTION_DAYS } from "@shared/affiliate";

/**
 * Referral attribution.
 *
 * A visitor arriving on any page with ?ref=CODE has that code remembered for
 * REFERRAL_ATTRIBUTION_DAYS, so an affiliate still gets credit when the sale
 * happens days after the click. Last click wins: a newer code replaces an
 * older one.
 */

const STORAGE_KEY = "referralAttribution";

interface StoredReferral {
  code: string;
  expiresAt: number;
}

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Reads the remembered code, clearing it once it has expired. */
export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof stored.code !== "string" || typeof stored.expiresAt !== "number") {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() > stored.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.code;
  } catch {
    // Private-mode storage errors, or a value some other tab corrupted. An
    // unreadable attribution is not worth breaking a page render over.
    return null;
  }
}

export function storeReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalize(code);
  if (!normalized) return;

  const payload: StoredReferral = {
    code: normalized,
    expiresAt: Date.now() + REFERRAL_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked — attribution is best-effort.
  }
}

export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the entry expires on its own.
  }
}

/**
 * Captures ?ref= from the current URL and strips it from the address bar.
 *
 * Reads the live URL rather than a router location so it works on any landing
 * page — a shared product link is the likeliest entry point, not the homepage.
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return null;

  storeReferralCode(ref);

  params.delete("ref");
  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", cleanUrl);

  return normalize(ref);
}

/** Share link an affiliate hands out. */
export function buildReferralShareUrl(code: string): string {
  return `https://www.brighterdayslabs.com/?ref=${encodeURIComponent(code)}`;
}
