import {
  MIN_PAYOUT_AMOUNT,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_DISCOUNT_PERCENT,
} from "@shared/affiliate";

/**
 * Affiliate program rules.
 *
 * The decisions that decide who gets paid live here as pure functions, so the
 * ones that cost money — is this a self-referral, what is actually owed, may a
 * payout be requested — can be tested exhaustively without a database.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  MIN_PAYOUT_AMOUNT,
  REFERRAL_ATTRIBUTION_DAYS,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_DISCOUNT_PERCENT,
} from "@shared/affiliate";

const MAX_CODE_LENGTH = 32;
const MIN_BASE_LENGTH = 3;

function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ─── Code generation ─────────────────────────────────────────────────────────

/**
 * Turns a name or email into the alphanumeric stem of a share code.
 * Returns null when there is nothing usable left to build from.
 */
export function buildCodeBase(name: string | null, email: string | null): string | null {
  const fromName = (name ?? "").trim();
  const fromEmail = (email ?? "").split("@")[0] ?? "";

  for (const candidate of [fromName, fromEmail]) {
    const cleaned = candidate
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, MAX_CODE_LENGTH - 4); // leave room for a collision suffix
    if (cleaned.length >= MIN_BASE_LENGTH) return cleaned;
  }

  return null;
}

/**
 * Candidate codes in the order they should be tried: the bare stem first, then
 * numbered variants. The caller walks this until one is free.
 *
 * `attempt` 0 is the bare base, so a user with an uncontested name gets a clean
 * code and only collisions ever see a number.
 */
export function buildCodeCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = String(attempt + 1);
  return `${base.slice(0, MAX_CODE_LENGTH - suffix.length)}${suffix}`;
}

/** Fallback stem when a user has neither a usable name nor email. */
export function buildFallbackBase(userId: number): string {
  return `REF${userId}`;
}

/** Normalizes user input before it is matched against a stored code. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Self-referral ───────────────────────────────────────────────────────────

export interface SelfReferralCheck {
  /** The signed-in buyer's account, or null/undefined for a guest checkout. */
  buyerUserId?: number | null;
  /** Every address that identifies the buyer: the shipping form and the account. */
  buyerEmails: Array<string | null | undefined>;
  /** The account that owns the code being used. */
  ownerUserId: number;
  /** The owner's email as it stands now, not as it stood when the code was issued. */
  ownerEmail: string | null | undefined;
}

/**
 * Whether a buyer is using their own code.
 *
 * Two independent arms, because either one alone is escapable.
 *
 * The account id is checked first. It is the only identifier here that the
 * buyer cannot change: emails are retyped freely in the shipping form and can
 * be edited from the admin panel, and an affiliate whose account email is
 * changed after the fact would otherwise stop matching their own past address
 * and could then refer themselves. An id match is decisive on its own.
 *
 * The email arm still runs, because it catches the case the id arm cannot: an
 * affiliate who signs out and buys as a guest has no account id to compare, and
 * only the address they type gives them away. It is deliberately compared
 * against the owner's *current* email, read at checkout time, so the rule
 * always reflects the present state of the account rather than a stale copy.
 *
 * Both the shipping email and the signed-in account email are tested. Checking
 * only one leaves the obvious hole: signed in as the affiliate while typing a
 * different address into the shipping form.
 */
export function isSelfReferral(check: SelfReferralCheck): boolean {
  if (check.buyerUserId != null && check.buyerUserId === check.ownerUserId) {
    return true;
  }

  const owner = normalizeEmail(check.ownerEmail);
  if (!owner) return false;
  return check.buyerEmails.some((email) => normalizeEmail(email) === owner);
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function computeReferralDiscount(subtotal: number): number {
  return round2((subtotal * REFERRAL_DISCOUNT_PERCENT) / 100);
}

export function computeReferralCommission(subtotal: number): number {
  return round2((subtotal * REFERRAL_COMMISSION_PERCENT) / 100);
}

/**
 * Only "eligible" commissions count toward a payout: "pending" ones belong to
 * orders that have not been paid for, "paid" ones are already settled, and
 * "rejected" ones are self-referral attempts that were never owed.
 */
export function computePayoutBalance(
  referrals: Array<{ status: string; commissionAmount: string | number }>
): number {
  const total = referrals
    .filter((r) => r.status === "eligible")
    .reduce((sum, r) => sum + Number(r.commissionAmount), 0);
  return round2(total);
}

export type PayoutEligibility =
  | { allowed: true }
  | { allowed: false; reason: "below_minimum" | "request_pending" };

/**
 * A single pending request at a time. Without that guard the same eligible
 * balance could be requested repeatedly before an admin settles the first one.
 */
export function checkPayoutEligibility(
  balance: number,
  hasPendingRequest: boolean
): PayoutEligibility {
  if (hasPendingRequest) return { allowed: false, reason: "request_pending" };
  if (balance < MIN_PAYOUT_AMOUNT) return { allowed: false, reason: "below_minimum" };
  return { allowed: true };
}
