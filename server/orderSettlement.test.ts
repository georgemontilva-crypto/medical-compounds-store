import { describe, expect, it } from "vitest";
import { orderTotalInCents, purchaseEffectsFor } from "./orderSettlement";

describe("orderTotalInCents", () => {
  it("converts a decimal total to minor units", () => {
    expect(orderTotalInCents("117.93")).toBe(11793);
    expect(orderTotalInCents(249.5)).toBe(24950);
  });

  it("rounds rather than truncating, so floating point cannot lose a cent", () => {
    // 1.15 * 100 is 114.99999999999999 in IEEE 754. Truncating would charge
    // $1.14 against a $1.15 order and the amount check would reject a payment
    // that was in fact correct.
    expect(orderTotalInCents("1.15")).toBe(115);
    expect(orderTotalInCents("8.21")).toBe(821);
  });
});

describe("purchaseEffectsFor", () => {
  // These effects used to run when the order row was created. Moving them to
  // settlement is the whole point: an unpaid checkout must consume nothing.

  it("empties the cart and spends the coupon for a signed-in buyer", () => {
    expect(purchaseEffectsFor({ id: 8011, userId: 42, couponId: 7 })).toEqual({
      clearCartForUserId: 42,
      burnCouponId: 7,
      markWelcomeUsed: { userId: 42, couponId: 7 },
    });
  });

  it("spends a guest's coupon without trying to clear a cart they do not have", () => {
    expect(purchaseEffectsFor({ id: 8012, userId: null, couponId: 7 })).toEqual({
      clearCartForUserId: null,
      burnCouponId: 7,
      markWelcomeUsed: null,
    });
  });

  it("spends no coupon when none applied", () => {
    expect(purchaseEffectsFor({ id: 8013, userId: 42, couponId: null })).toEqual({
      clearCartForUserId: 42,
      burnCouponId: null,
      markWelcomeUsed: null,
    });
  });

  it("closes a welcome redemption only when both the buyer and the coupon are known", () => {
    // markWelcomeRedemptionUsed is keyed on the pair; without both there is no
    // row it could possibly match, and calling it would be a silent no-op that
    // reads like it did something.
    expect(purchaseEffectsFor({ id: 8014, userId: null, couponId: null }).markWelcomeUsed).toBeNull();
    expect(purchaseEffectsFor({ id: 8015, userId: null, couponId: 7 }).markWelcomeUsed).toBeNull();
    expect(purchaseEffectsFor({ id: 8016, userId: 42, couponId: null }).markWelcomeUsed).toBeNull();
  });
});
