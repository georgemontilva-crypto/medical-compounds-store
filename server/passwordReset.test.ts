import { beforeEach, describe, expect, it } from "vitest";
import {
  RESET_TOKEN_TTL_MS,
  buildResetUrl,
  clearResetAttempts,
  consumeResetAttempt,
  generateResetToken,
  hashResetToken,
  hashesMatch,
  isResetTokenUsable,
  resetAttemptKey,
} from "./passwordReset";

/**
 * A reset token is a temporary credential. Each case below is a way one could
 * outlive its purpose, be redeemed twice, or be read off a table.
 */

describe("token generation", () => {
  it("never returns the same token twice", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateResetToken()));
    expect(seen.size).toBe(200);
  });

  it("is url-safe, so it survives a query string intact", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateResetToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(token)).toBe(token);
    }
  });

  it("carries enough entropy to be unguessable", () => {
    // 32 bytes base64url, unpadded.
    expect(generateResetToken().length).toBe(43);
  });
});

describe("token hashing", () => {
  it("produces a 64-char hex digest, which is what the column holds", () => {
    expect(hashResetToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable, so a token can be found by its hash", () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).toBe(hashResetToken(token));
  });

  it("does not contain the token it was derived from", () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).not.toContain(token);
  });

  it("gives different tokens different hashes", () => {
    expect(hashResetToken("a")).not.toBe(hashResetToken("b"));
  });
});

describe("hashesMatch", () => {
  it("accepts a genuine pair", () => {
    const h = hashResetToken("token");
    expect(hashesMatch(h, h)).toBe(true);
  });

  it("rejects a different digest", () => {
    expect(hashesMatch(hashResetToken("a"), hashResetToken("b"))).toBe(false);
  });

  it("rejects empty and malformed input rather than throwing", () => {
    expect(hashesMatch("", "")).toBe(false);
    expect(hashesMatch("zz", hashResetToken("a"))).toBe(false);
  });
});

describe("isResetTokenUsable", () => {
  const now = 1_700_000_000_000;

  it("accepts a fresh, unused token", () => {
    expect(isResetTokenUsable({ expiresAt: new Date(now + 1000), usedAt: null }, now)).toBe(true);
  });

  it("refuses one that has been used, even while unexpired", () => {
    expect(
      isResetTokenUsable({ expiresAt: new Date(now + RESET_TOKEN_TTL_MS), usedAt: new Date(now) }, now)
    ).toBe(false);
  });

  it("refuses one that has expired, even though it was never used", () => {
    expect(isResetTokenUsable({ expiresAt: new Date(now - 1), usedAt: null }, now)).toBe(false);
  });

  it("treats the expiry instant as past, not present", () => {
    expect(isResetTokenUsable({ expiresAt: new Date(now), usedAt: null }, now)).toBe(false);
  });

  it("expires an hour out, which is the window the email promises", () => {
    const issued = { expiresAt: new Date(now + RESET_TOKEN_TTL_MS), usedAt: null };
    expect(isResetTokenUsable(issued, now + 59 * 60 * 1000)).toBe(true);
    expect(isResetTokenUsable(issued, now + 61 * 60 * 1000)).toBe(false);
  });
});

describe("rate limiting", () => {
  const now = 1_700_000_000_000;
  beforeEach(() => clearResetAttempts());

  it("allows a normal number of attempts", () => {
    const key = resetAttemptKey("a@example.com", "1.1.1.1");
    for (let i = 0; i < 5; i++) expect(consumeResetAttempt(key, now)).toBe(true);
  });

  it("refuses once the window is spent", () => {
    const key = resetAttemptKey("a@example.com", "1.1.1.1");
    for (let i = 0; i < 5; i++) consumeResetAttempt(key, now);
    expect(consumeResetAttempt(key, now)).toBe(false);
  });

  it("gives the attempts back after the window passes", () => {
    const key = resetAttemptKey("a@example.com", "1.1.1.1");
    for (let i = 0; i < 6; i++) consumeResetAttempt(key, now);
    expect(consumeResetAttempt(key, now + 16 * 60 * 1000)).toBe(true);
  });

  it("does not let one caller lock a stranger out of their own account", () => {
    // Same address, different client: exhausting one must not spend the other.
    const attacker = resetAttemptKey("victim@example.com", "6.6.6.6");
    for (let i = 0; i < 6; i++) consumeResetAttempt(attacker, now);
    expect(consumeResetAttempt(attacker, now)).toBe(false);

    const victim = resetAttemptKey("victim@example.com", "10.0.0.1");
    expect(consumeResetAttempt(victim, now)).toBe(true);
  });

  it("treats an address as the same one regardless of case or padding", () => {
    expect(resetAttemptKey("  A@Example.COM ", "1.1.1.1")).toBe(
      resetAttemptKey("a@example.com", "1.1.1.1")
    );
  });

  it("still counts callers whose address is unknown", () => {
    const key = resetAttemptKey("a@example.com", undefined);
    for (let i = 0; i < 5; i++) expect(consumeResetAttempt(key, now)).toBe(true);
    expect(consumeResetAttempt(key, now)).toBe(false);
  });
});

describe("buildResetUrl", () => {
  it("points at the reset page with the token attached", () => {
    expect(buildResetUrl("https://example.com", "abc")).toBe(
      "https://example.com/reset-password?token=abc"
    );
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(buildResetUrl("https://example.com/", "abc")).toBe(
      "https://example.com/reset-password?token=abc"
    );
  });

  it("escapes a token so it survives the query string", () => {
    expect(buildResetUrl("https://example.com", "a+b/c=")).toBe(
      "https://example.com/reset-password?token=a%2Bb%2Fc%3D"
    );
  });

  it("round-trips a real token unchanged", () => {
    const token = generateResetToken();
    const url = new URL(buildResetUrl("https://example.com", token));
    expect(url.searchParams.get("token")).toBe(token);
  });
});
