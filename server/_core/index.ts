import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerSitemapRoute } from "./sitemap";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { headBucket, storagePut } from "../storage";
import { sendEmailWithDetail } from "../email";
import { registerStripeWebhook } from "../stripeWebhook";
import { startTrafficFlush } from "../traffic";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Before express.json(): the Stripe webhook verifies a signature over the raw
  // request bytes, which the JSON parser would consume.
  registerStripeWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSitemapRoute(app);

  // TEMPORARY diagnostic route — remove once the production R2 "Access Denied"
  // issue is confirmed fixed. Gated by a throwaway query-param token, not by
  // NODE_ENV, since it needs to be reachable on the deployed Railway instance.
  app.get("/api/debug/r2-test", async (req, res) => {
    if (req.query.secret !== "r2diag-8f3a2b91e7") {
      res.status(404).send("Not found");
      return;
    }
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const runtimeConfig = {
      r2AccessKeyIdPrefix: accessKeyId.slice(0, 6),
      r2AccessKeyIdLength: accessKeyId.length,
      r2Endpoint: process.env.R2_ENDPOINT ?? null,
      r2Bucket: process.env.R2_BUCKET ?? null,
      r2PublicUrl: process.env.R2_PUBLIC_URL ?? null,
    };

    let headBucketResult: unknown;
    try {
      await headBucket();
      headBucketResult = { ok: true };
    } catch (err: any) {
      headBucketResult = {
        ok: false,
        name: err?.name,
        message: err?.message,
        Code: err?.Code,
        metadata: err?.$metadata,
      };
    }

    try {
      const { key, url } = await storagePut(
        `debug/${Date.now()}_r2-test.txt`,
        Buffer.from("r2 debug test"),
        "text/plain",
      );
      res.json({ ok: true, key, url, runtimeConfig, headBucketResult });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        name: err?.name,
        message: err?.message,
        Code: err?.Code,
        metadata: err?.$metadata,
        stack: err?.stack,
        runtimeConfig,
        headBucketResult,
      });
    }
  });

  // TEMPORARY diagnostic route — remove once email delivery is confirmed
  // working in production. Same gating as the R2 one: a throwaway token rather
  // than NODE_ENV, because the thing being diagnosed only happens on Railway.
  app.get("/api/debug/email-test", async (req, res) => {
    if (req.query.secret !== "maildiag-4c7e19b3f2") {
      res.status(404).send("Not found");
      return;
    }

    const apiKey = process.env.RESEND_API_KEY ?? "";
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";
    const runtimeConfig = {
      // Prefix and length only: enough to tell a missing key from a wrong one
      // without printing a credential into a browser tab.
      resendApiKeyPrefix: apiKey ? apiKey.slice(0, 6) : null,
      resendApiKeyLength: apiKey.length,
      resendFromEmail: process.env.RESEND_FROM_EMAIL ?? null,
      adminNotificationEmail: adminEmail || null,
    };

    // Where to send it: ?to= wins, otherwise the address alerts are meant to
    // reach — which is itself the thing under suspicion.
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : adminEmail;
    if (!to) {
      res.status(400).json({
        ok: false,
        reason: "No recipient. Set ADMIN_NOTIFICATION_EMAIL or pass ?to=",
        runtimeConfig,
      });
      return;
    }

    const result = await sendEmailWithDetail({
      to,
      subject: "Brighter Days Labs — email delivery test",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:24px">
          <h1 style="font-size:18px;margin:0 0 8px">Email delivery works</h1>
          <p style="color:#666;margin:0">
            If you are reading this, Resend accepted and delivered a message from
            the production server. Sent ${new Date().toISOString()}.
          </p>
        </div>`,
    });

    res.status(result.ok ? 200 : 500).json({ ...result, to, runtimeConfig });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Page views are counted in memory and written out once a minute; this
  // starts that loop and registers the flush that runs on a clean shutdown.
  startTrafficFlush();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
