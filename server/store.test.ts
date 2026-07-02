import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(overrides?: Partial<TrpcContext>): TrpcContext {
  const cookies: Record<string, unknown> = {};
  const clearedCookies: string[] = [];

  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: unknown) => {
        cookies[name] = value;
      },
      clearCookie: (name: string) => {
        clearedCookies.push(name);
      },
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

function makeAdminCtx(): TrpcContext {
  const adminUser: AuthenticatedUser = {
    id: 1,
    openId: "admin_test",
    email: "admin@biolab.com",
    name: "Admin User",
    loginMethod: "email",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return makeCtx({ user: adminUser });
}

function makeUserCtx(): TrpcContext {
  const regularUser: AuthenticatedUser = {
    id: 2,
    openId: "user_test",
    email: "user@biolab.com",
    name: "Regular User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return makeCtx({ user: regularUser });
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    const ctx = makeCtx({
      user: {
        id: 1,
        openId: "test_user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "email",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as unknown as TrpcContext["res"],
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("auth.me", () => {
  it("returns null when unauthenticated", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the user when authenticated", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("user@biolab.com");
    expect(result?.role).toBe("user");
  });
});

// ─── Admin Access Control Tests ───────────────────────────────────────────────

describe("admin access control", () => {
  it("blocks non-admin from creating categories", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(
      caller.categories.create({ name: "Test", slug: "test" })
    ).rejects.toThrow();
  });

  it("blocks non-admin from listing admin products", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.products.listAdmin()).rejects.toThrow();
  });

  it("blocks non-admin from accessing admin stats", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("blocks unauthenticated from admin stats", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.admin.stats()).rejects.toThrow();
  });
});

// ─── Cart Access Control ──────────────────────────────────────────────────────

describe("cart access control", () => {
  it("blocks unauthenticated user from getting cart", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.cart.get()).rejects.toThrow();
  });

  it("blocks unauthenticated user from adding to cart", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.cart.add({ productId: 1, quantity: 1 })
    ).rejects.toThrow();
  });
});

// ─── Coupon Validation ────────────────────────────────────────────────────────

describe("coupons.validate", () => {
  it("throws NOT_FOUND for non-existent coupon", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(
      caller.coupons.validate({ code: "NONEXISTENT999", orderAmount: 100 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── Public Product Procedures ────────────────────────────────────────────────

describe("products.list (public)", () => {
  it("returns an array (empty if no products)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts category filter without throwing", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.list({ categoryId: 9999 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("accepts search filter without throwing", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.products.list({ search: "nonexistent_compound_xyz" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("categories.list (public)", () => {
  it("returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.categories.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Orders Access Control ────────────────────────────────────────────────────

describe("orders access control", () => {
  it("blocks unauthenticated from creating orders", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.orders.create({
        items: [],
        shipping: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          address: "123 Main St",
          city: "New York",
          country: "US",
        },
      })
    ).rejects.toThrow();
  });

  it("blocks unauthenticated from viewing own orders", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.orders.myOrders()).rejects.toThrow();
  });

  it("blocks non-admin from listing all orders", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.orders.adminList()).rejects.toThrow();
  });
});
