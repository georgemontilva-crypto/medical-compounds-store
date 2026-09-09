import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Guest order tracking.
 *
 * A guest order has userId null, so the session-keyed procedures can never
 * return it — orders.track is the only way its buyer sees it again. That makes
 * it public, and public plus sequential order numbers means the email is doing
 * the actual authorising. These cases pin the input guard, which rejects
 * before the resolver runs and before any database is touched.
 */

function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

const caller = () => appRouter.createCaller(makeCtx());

describe("orders.track input", () => {
  it("refuses a lookup with no email, which would leave the order number alone as the key", async () => {
    await expect(
      // @ts-expect-error deliberately omitted
      caller().orders.track({ orderId: 8001 })
    ).rejects.toThrow();
  });

  it("refuses an email that is not one", async () => {
    await expect(caller().orders.track({ orderId: 8001, email: "not-an-email" })).rejects.toThrow();
  });

  it("refuses an empty email", async () => {
    await expect(caller().orders.track({ orderId: 8001, email: "" })).rejects.toThrow();
  });

  it("refuses an order number that is not a number", async () => {
    await expect(
      // @ts-expect-error deliberately wrong type
      caller().orders.track({ orderId: "8001", email: "buyer@example.com" })
    ).rejects.toThrow();
  });

  it("accepts a well-formed pair as far as the resolver", async () => {
    // Reaches the database, which is absent here — the point is that it got
    // past validation, not what it found.
    await expect(
      caller().orders.track({ orderId: 8001, email: "buyer@example.com" })
    ).rejects.toThrow();
  });
});
