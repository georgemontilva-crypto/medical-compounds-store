import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storagePut } from "../storage";

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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

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
    };
    try {
      const { key, url } = await storagePut(
        `debug/${Date.now()}_r2-test.txt`,
        Buffer.from("r2 debug test"),
        "text/plain",
      );
      res.json({ ok: true, key, url, runtimeConfig });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        name: err?.name,
        message: err?.message,
        Code: err?.Code,
        metadata: err?.$metadata,
        stack: err?.stack,
        runtimeConfig,
      });
    }
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
