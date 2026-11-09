import { describe, expect, it } from "vitest";
import { createPool } from "mysql2";
import { POOL_OPTIONS } from "./db";

/**
 * These lock in the pool settings that stop a save from spinning forever.
 *
 * The bug they guard against is not hypothetical: handing drizzle a connection
 * string builds a pool on mysql2's defaults, where idle connections are kept
 * indefinitely and `queueLimit: 0` means an unbounded queue. A hosted database
 * drops its side of an idle connection, mysql2 keeps handing that socket out,
 * and every request after it queues behind the dead one with no timeout. The
 * admin sees requests get slower and then stop returning at all.
 *
 * Reverting to `drizzle(process.env.DATABASE_URL)` reintroduces exactly that,
 * so what matters here is that the values are set and are sane — not the
 * particular numbers.
 */
describe("POOL_OPTIONS", () => {
  it("bounds the queue, so a saturated pool fails instead of hanging", () => {
    // mysql2 reads 0 as "unlimited", which is the setting that turns a
    // temporary problem into a request that never comes back.
    expect(POOL_OPTIONS.queueLimit).toBeGreaterThan(0);
  });

  it("keeps connections demonstrably alive rather than assumed alive", () => {
    expect(POOL_OPTIONS.enableKeepAlive).toBe(true);
    expect(POOL_OPTIONS.keepAliveInitialDelay).toBeGreaterThan(0);
  });

  it("recycles idle connections before anything upstream drops them", () => {
    // Proxies and managed MySQL commonly close idle connections at 60s, so
    // ours have to go first or we hand out sockets the other end has closed.
    expect(POOL_OPTIONS.idleTimeout).toBeLessThan(60_000);
    expect(POOL_OPTIONS.maxIdle).toBeLessThanOrEqual(POOL_OPTIONS.connectionLimit);
  });

  it("gives up on a connection attempt rather than waiting indefinitely", () => {
    expect(POOL_OPTIONS.connectTimeout).toBeGreaterThan(0);
    expect(POOL_OPTIONS.connectTimeout).toBeLessThanOrEqual(30_000);
  });

  it("is accepted by mysql2 rather than silently ignored", () => {
    // Options mysql2 does not recognise are dropped without complaint, so the
    // only proof that these took effect is reading them back off the pool.
    // createPool does not connect until a query runs, so this touches nothing.
    const pool = createPool({ uri: "mysql://u:p@127.0.0.1:3306/db", ...POOL_OPTIONS });
    try {
      const config = pool.config as unknown as {
        queueLimit: number;
        connectionLimit: number;
        idleTimeout: number;
        maxIdle: number;
        connectionConfig: { enableKeepAlive: boolean; connectTimeout: number };
      };

      expect(config.queueLimit).toBe(POOL_OPTIONS.queueLimit);
      expect(config.connectionLimit).toBe(POOL_OPTIONS.connectionLimit);
      expect(config.idleTimeout).toBe(POOL_OPTIONS.idleTimeout);
      expect(config.maxIdle).toBe(POOL_OPTIONS.maxIdle);
      expect(config.connectionConfig.enableKeepAlive).toBe(true);
      expect(config.connectionConfig.connectTimeout).toBe(POOL_OPTIONS.connectTimeout);
    } finally {
      pool.end(() => {});
    }
  });
});
