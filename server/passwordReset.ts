import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { escapeHtml } from "./email";

/**
 * Password reset tokens.
 *
 * The rule this file exists to keep: what is stored is never what is sent. The
 * token travels once, in one email, and the database holds only a SHA-256 of
 * it. Read access to `password_reset_tokens` therefore yields nothing that can
 * be redeemed — which is the whole difference between a leaked table and a
 * leaked set of live credentials.
 *
 * SHA-256 rather than bcrypt, deliberately. A reset token is 32 bytes of
 * CSPRNG output, not a human-chosen password: there is no dictionary to attack
 * and no work factor worth paying on every lookup. Bcrypt would also make the
 * lookup impossible — its salt is per-hash, so finding a row by token would
 * mean comparing against every row in the table.
 */

/** Long enough to finish reading an email, short enough to matter if it leaks. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * 32 bytes of CSPRNG output, base64url so it survives a query string without
 * escaping. ~256 bits: not guessable, and not worth rate-limiting against.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The only form of the token that is ever written down. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two hex digests.
 *
 * The lookup itself is by indexed equality, so this is belt-and-braces rather
 * than the primary defence — but a plain `===` on a secret-derived value is the
 * kind of thing that is free to avoid and awkward to explain later.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export interface StoredResetToken {
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Whether a token row may still be redeemed.
 *
 * Both conditions are checked here rather than in the SQL so that the reason
 * is available to the caller and, more importantly, so that "used" and
 * "expired" cannot drift apart between the query and the update.
 */
export function isResetTokenUsable(row: StoredResetToken, now: number = Date.now()): boolean {
  if (row.usedAt !== null) return false;
  return row.expiresAt.getTime() > now;
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

/**
 * A fixed window per caller, held in process memory.
 *
 * Same trade as shippingQuotes.ts: gone on restart, not shared across
 * instances. Both degrade the same harmless way — the window resets and the
 * caller gets their attempts back — and neither can wrongly *deny* a real
 * person their reset, which is the failure that would actually hurt.
 *
 * Keyed by email *and* client address, so one person hammering the form cannot
 * lock a stranger out of their own account by guessing their address.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Bounded so a script cycling addresses cannot grow this without limit. */
const MAX_TRACKED = 1000;

interface AttemptWindow {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptWindow>();

export function resetAttemptKey(email: string, ip: string | undefined): string {
  return `${email.trim().toLowerCase()}|${ip ?? "unknown"}`;
}

/**
 * Records an attempt and says whether it is allowed.
 *
 * Returns false once the window is spent. The caller must still answer the
 * request identically either way — a refusal that looked different from a send
 * would turn this into the account-enumeration oracle the endpoint is written
 * to avoid.
 */
export function consumeResetAttempt(key: string, now: number = Date.now()): boolean {
  for (const [k, window] of Array.from(attempts.entries())) {
    if (window.resetAt <= now) attempts.delete(k);
  }

  if (attempts.size >= MAX_TRACKED) {
    const oldest = Array.from(attempts.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt)[0];
    if (oldest) attempts.delete(oldest[0]);
  }

  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  existing.count += 1;
  return existing.count <= MAX_ATTEMPTS;
}

/** Test seam: forget every window. */
export function clearResetAttempts(): void {
  attempts.clear();
}

// ─── Email ───────────────────────────────────────────────────────────────────

export function buildResetUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildResetEmailHtml(resetUrl: string): string {
  // Escaped even though the URL is ours: the token is base64url and the origin
  // comes from configuration, but nothing here is worth hand-waving about.
  const safeUrl = escapeHtml(resetUrl);
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #262626;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Reset your password</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #525252;">
        We received a request to reset the password on your Brighter Days Labs account.
        This link works once and expires in one hour.
      </p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" style="background: #262626; color: #fff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-size: 14px; display: inline-block;">
          Choose a new password
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #737373;">
        If you didn't ask for this, you can ignore this email — your password stays as it is.
      </p>
      <p style="font-size: 12px; color: #a3a3a3; word-break: break-all;">${safeUrl}</p>
    </div>
  `;
}
