import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { isSandboxTrackingNumber } from "./ups";
import type { TrpcContext } from "./_core/context";

/**
 * Discarding a label.
 *
 * A sandbox label is a sample barcode, and createLabel refuses an order that
 * already carries one — so an order labelled during testing would be stuck
 * with it forever unless something can throw it away. A bought label is the
 * opposite: deleting the row would hide the charge rather than reverse it.
 *
 * Which is which is read from the tracking number rather than the mode in
 * force, and that distinction is the whole point: the orders that need
 * discarding are precisely the ones labelled in sandbox *before* somebody
 * switched to production. Judging by the current mode would strand them.
 */

function adminCtx(): TrpcContext {
  return {
    user: { id: 1, email: "admin@brighterdays.com", role: "admin", name: "Admin" } as
      TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function shopperCtx(): TrpcContext {
  return { ...adminCtx(), user: null };
}

describe("isSandboxTrackingNumber", () => {
  it("recognises the placeholder UPS returns from the sandbox", () => {
    expect(isSandboxTrackingNumber("1ZXXXXXXXXXXXXXXXX")).toBe(true);
  });

  it("leaves a real tracking number alone", () => {
    expect(isSandboxTrackingNumber("1Z999AA10123456784")).toBe(false);
  });

  it("is not fooled by whitespace around the placeholder", () => {
    expect(isSandboxTrackingNumber("  1ZXXXXXXXXXXXXXXXX  ")).toBe(true);
  });

  it("does not treat a stray X in a real number as a test label", () => {
    // A single X is not the placeholder; deleting a paid label over one
    // character would be the expensive mistake here.
    expect(isSandboxTrackingNumber("1Z9X9AA10123456784")).toBe(false);
  });
});

describe("shipping.discardTestLabel", () => {
  it("is not something a shopper can reach", async () => {
    await expect(
      appRouter.createCaller(shopperCtx()).shipping.discardTestLabel({ orderId: 8001 })
    ).rejects.toThrow();
  });

  it("wants a numeric order", async () => {
    await expect(
      // @ts-expect-error deliberately wrong type
      appRouter.createCaller(adminCtx()).shipping.discardTestLabel({ orderId: "8001" })
    ).rejects.toThrow();
  });
});
