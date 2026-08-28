import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { injectRouteMeta } from "./seoMeta";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const withMeta = await injectRouteMeta(page, url);
      res.status(200).set({ "Content-Type": "text/html" }).end(withMeta);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Vite's build output uses content-hashed filenames under assets/
  // (e.g. index-KCZBoZZ2.js) — a given URL's content never changes, so it's
  // safe to cache for a year. Everything else (index.html, favicon.ico,
  // robots.txt) keeps the default of no long-lived caching, since index.html
  // in particular must always be re-fetched to pick up the latest asset
  // hashes after a new deploy.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), { maxAge: "1y", immutable: true })
  );
  // `index: false` matters: express.static otherwise answers "/" with
  // index.html itself and the catch-all below never runs, which left the home
  // page — and only the home page — served with no canonical, no robots, no
  // JSON-LD and an empty #root while every other route got its metadata.
  app.use(express.static(distPath, { index: false }));

  // The built index.html can't change without a restart, so read it once
  // rather than on every request — this path now runs for every HTML response,
  // not just the product pages it used to.
  let cachedTemplate: string | null = null;

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");

    // Every route gets its own title, description, canonical, robots, social
    // tags and #root placeholder — see seoMeta.ts. This used to apply only to
    // /compounds/:slug, which left every other URL claiming the home page's.
    try {
      if (cachedTemplate === null) {
        cachedTemplate = await fs.promises.readFile(indexPath, "utf-8");
      }
      const page = await injectRouteMeta(cachedTemplate, req.originalUrl);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      // Serving the un-rewritten document beats serving a 500: the SPA still
      // boots and renders, it just carries index.html's generic tags.
      console.error("Failed to inject route meta, serving index.html as-is:", e);
      res.sendFile(indexPath);
    }
  });
}
