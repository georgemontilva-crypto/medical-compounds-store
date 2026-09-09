import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { isUpsSandbox } from "./ups";
import type { TrpcContext } from "./_core/context";

/**
 * Discarding a label.
 *
 * A sandbox label is a sample barcode, and createLabel refuses an order that
 * already carries one — so an order labelled during testing would be stuck
 * with it forever unless something can throw it away. A production label is
 * the opposite: it was bought, and deleting the row would hide the charge
 * rather than reverse it.
 *
 * UPS_ENVIRONMENT is read once when _core/env is imported, so these assert
 * against whichever mode the process is actually in rather than flipping the
 * variable at runtime. That is also worth knowing about deploys: changing
 * that variable needs a restart, not just a save.
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

  it("refuses in production and proceeds in sandbox, according to the mode in force", async () => {
    const call = appRouter.createCaller(adminCtx()).shipping.discardTestLabel({ orderId: 8001 });

    if (isUpsSandbox()) {
      // Past the environment guard; stops later, at an order lookup that needs
      // a database this test does not have.
      await expect(call).rejects.not.toThrow(/void it with ups/i);
    } else {
      await expect(call).rejects.toThrow(/void it with ups/i);
    }
  });
});

describe("isUpsSandbox", () => {
  it("treats anything other than the exact word production as sandbox", () => {
    // Pinned because the consequence is asymmetric: guessing "sandbox" wrongly
    // prints an unusable label, guessing "production" wrongly buys a real one.
    const live = process.env.UPS_ENVIRONMENT === "production";
    expect(isUpsSandbox()).toBe(!live);
  });
});
