import { describe, expect, it } from "vitest";
import {
  MIN_PAYOUT_AMOUNT,
  buildCodeBase,
  buildCodeCandidate,
  buildFallbackBase,
  checkPayoutEligibility,
  computePayoutBalance,
  computeReferralCommission,
  computeReferralDiscount,
  isSelfReferral,
  normalizeReferralCode,
} from "./affiliate";

/**
 * These are the decisions that move money: whether a code is someone's own,
 * what is actually owed, and whether a payout may be requested. Each case below
 * is a way the program could be abused or a balance mis-stated.
 */

// ─── Code generation ─────────────────────────────────────────────────────────

describe("buildCodeBase", () => {
  it("prefers the name, stripped to alphanumerics", () => {
    expect(buildCodeBase("George Montilva", "gm@example.com")).toBe("GEORGEMONTILVA");
  });

  it("falls back to the email local part when the name is unusable", () => {
    expect(buildCodeBase("", "researcher@example.com")).toBe("RESEARCHER");
    expect(buildCodeBase("  ", "researcher@example.com")).toBe("RESEARCHER");
    expect(buildCodeBase(null, "researcher@example.com")).toBe("RESEARCHER");
  });

  it("skips a name too short to be a code and uses the email instead", () => {
    expect(buildCodeBase("Jo", "jothelab@example.com")).toBe("JOTHELAB");
  });

  it("strips accents-free punctuation and spacing from both sources", () => {
    expect(buildCodeBase("Anna-Maria O'Neill", null)).toBe("ANNAMARIAONEILL");
    expect(buildCodeBase(null, "first.last+tag@example.com")).toBe("FIRSTLASTTAG");
  });

  it("returns null when nothing usable is left", () => {
    expect(buildCodeBase(null, null)).toBeNull();
    expect(buildCodeBase("", "")).toBeNull();
    expect(buildCodeBase("!!", "@@@@")).toBeNull();
  });

  it("leaves room for a collision suffix", () => {
    const base = buildCodeBase("A".repeat(60), null);
    expect(base).not.toBeNull();
    expect(base!.length).toBeLessThanOrEqual(28);
  });
});

describe("buildCodeCandidate", () => {
  it("offers the bare base first, so an uncontested name gets a clean code", () => {
    expect(buildCodeCandidate("GEORGE", 0)).toBe("GEORGE");
  });

  it("numbers subsequent attempts", () => {
    expect(buildCodeCandidate("GEORGE", 1)).toBe("GEORGE2");
    expect(buildCodeCandidate("GEORGE", 2)).toBe("GEORGE3");
  });

  it("keeps numbered candidates within the column width", () => {
    const long = "B".repeat(32);
    expect(buildCodeCandidate(long, 9).length).toBeLessThanOrEqual(32);
  });
});

describe("buildFallbackBase", () => {
  it("derives a stem from the user id", () => {
    expect(buildFallbackBase(42)).toBe("REF42");
  });
});

describe("normalizeReferralCode", () => {
  it("upper-cases and strips whitespace and punctuation", () => {
    expect(normalizeReferralCode("  george-2 ")).toBe("GEORGE2");
  });

  it("returns an empty string for input with nothing usable", () => {
    expect(normalizeReferralCode("   ")).toBe("");
    expect(normalizeReferralCode("!!!")).toBe("");
  });
});

// ─── Self-referral ───────────────────────────────────────────────────────────

describe("isSelfReferral", () => {
  const owner = "affiliate@example.com";
  const OWNER_ID = 7;

  /** A guest checkout: no account id on the buyer's side. */
  const asGuest = (buyerEmails: Array<string | null | undefined>, ownerEmail = owner) =>
    isSelfReferral({ buyerEmails, ownerUserId: OWNER_ID, ownerEmail });

  it("catches the buyer using their own code", () => {
    expect(asGuest([owner])).toBe(true);
  });

  it("catches it through the signed-in account when shipping uses another address", () => {
    // Signed in as the affiliate, typing a different email into the form.
    expect(asGuest(["someone.else@example.com", owner])).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(asGuest(["  AFFILIATE@Example.COM "])).toBe(true);
  });

  it("allows a genuine referral", () => {
    expect(asGuest(["colleague@example.com", null])).toBe(false);
  });

  it("does not match when the affiliate has no email on record", () => {
    // Otherwise two accounts with a null email would look like the same person.
    expect(asGuest([null, undefined], null)).toBe(false);
    expect(asGuest([""], "")).toBe(false);
  });

  it("catches the owner by account id even when every email differs", () => {
    // The bypass this arm exists for: an affiliate whose account email was
    // changed still cannot refer themselves while signed in.
    expect(
      isSelfReferral({
        buyerUserId: OWNER_ID,
        buyerEmails: ["brand.new@example.com"],
        ownerUserId: OWNER_ID,
        ownerEmail: "changed@example.com",
      })
    ).toBe(true);
  });

  it("catches the owner by account id even with no email on either side", () => {
    // The email arm returns early on a missing owner email; the id arm must not.
    expect(
      isSelfReferral({
        buyerUserId: OWNER_ID,
        buyerEmails: [null],
        ownerUserId: OWNER_ID,
        ownerEmail: null,
      })
    ).toBe(true);
  });

  it("does not treat a different signed-in account as the owner", () => {
    expect(
      isSelfReferral({
        buyerUserId: OWNER_ID + 1,
        buyerEmails: ["colleague@example.com"],
        ownerUserId: OWNER_ID,
        ownerEmail: owner,
      })
    ).toBe(false);
  });

  it("still catches a signed-in buyer whose account email matches the owner's", () => {
    // Different account rows, same address — the id arm misses, the email arm does not.
    expect(
      isSelfReferral({
        buyerUserId: OWNER_ID + 1,
        buyerEmails: [owner],
        ownerUserId: OWNER_ID,
        ownerEmail: owner,
      })
    ).toBe(true);
  });
});

// ─── Money ───────────────────────────────────────────────────────────────────

describe("referral amounts", () => {
  it("computes the buyer discount and the affiliate commission from the subtotal", () => {
    expect(computeReferralDiscount(249.5)).toBe(24.95);
    expect(computeReferralCommission(249.5)).toBe(24.95);
  });

  it("rounds to cents rather than carrying float noise", () => {
    expect(computeReferralDiscount(0.07)).toBe(0.01);
    expect(computeReferralCommission(33.33)).toBe(3.33);
  });
});

describe("computePayoutBalance", () => {
  const referrals = [
    { status: "eligible", commissionAmount: "10.00" },
    { status: "eligible", commissionAmount: "15.50" },
    { status: "pending", commissionAmount: "99.00" },
    { status: "paid", commissionAmount: "40.00" },
    { status: "rejected", commissionAmount: "0.00" },
  ];

  it("counts only eligible commissions", () => {
    expect(computePayoutBalance(referrals)).toBe(25.5);
  });

  it("never counts a rejected self-referral, even if it carries an amount", () => {
    // Defense in depth: rejected rows are written with 0.00, but the balance
    // must not depend on that being true.
    const tampered = [{ status: "rejected", commissionAmount: "500.00" }];
    expect(computePayoutBalance(tampered)).toBe(0);
  });

  it("is zero for an affiliate with no referrals", () => {
    expect(computePayoutBalance([])).toBe(0);
  });
});

// ─── Payout eligibility ──────────────────────────────────────────────────────

describe("checkPayoutEligibility", () => {
  it("allows a request at or above the minimum", () => {
    expect(checkPayoutEligibility(MIN_PAYOUT_AMOUNT, false)).toEqual({ allowed: true });
    expect(checkPayoutEligibility(100, false)).toEqual({ allowed: true });
  });

  it("blocks a balance below the minimum", () => {
    expect(checkPayoutEligibility(MIN_PAYOUT_AMOUNT - 0.01, false)).toEqual({
      allowed: false,
      reason: "below_minimum",
    });
  });

  it("blocks a second request while one is still pending", () => {
    // Without this, the same eligible balance could be requested repeatedly
    // before an admin settles the first one.
    expect(checkPayoutEligibility(500, true)).toEqual({
      allowed: false,
      reason: "request_pending",
    });
  });

  it("reports the pending request ahead of the minimum when both apply", () => {
    expect(checkPayoutEligibility(0, true)).toEqual({
      allowed: false,
      reason: "request_pending",
    });
  });
});
