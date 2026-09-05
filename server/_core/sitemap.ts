import type { Express } from "express";
import {
  getProductSlugsWithLabReports,
  getProducts,
  getPublishedBlogPostSlugs,
} from "../db";
import { STATIC_ROUTE_META } from "./seoMeta";

const SITE_URL = "https://www.brighterdayslabs.com";

// Public, indexable static routes. Derived from seoMeta.ts rather than listed
// again here: that table already decides which paths are indexable and what
// they claim, and two hand-maintained lists drift. A route added there appears
// in the sitemap automatically.
const STATIC_PATHS = Object.keys(STATIC_ROUTE_META);

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: Date | string | null) {
  const lastmodTag = lastmod
    ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
    : "";
  return `  <url><loc>${xmlEscape(loc)}</loc>${lastmodTag}</url>`;
}

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const [products, labReported, blogPosts] = await Promise.all([
        getProducts({ active: true, limit: 10000 }),
        getProductSlugsWithLabReports(),
        // Published only — the helper filters on status in SQL, so a draft
        // cannot reach the sitemap even briefly.
        getPublishedBlogPostSlugs(),
      ]);

      // /compounds?category=<slug> is deliberately absent. Those four URLs
      // render the same catalog with a client-side filter, and seoMeta.ts
      // canonicalises them to /compounds — listing them here would tell Google
      // to index pages that then disclaim themselves.
      const entries = [
        ...STATIC_PATHS.map((p) => urlEntry(`${SITE_URL}${p}`)),
        ...products.map((p) => urlEntry(`${SITE_URL}/compounds/${p.slug}`, p.updatedAt)),
        ...labReported.map((r) => urlEntry(`${SITE_URL}/lab-reports/${r.slug}`, r.lastmod)),
        ...blogPosts.map((p) => urlEntry(`${SITE_URL}/blog/${p.slug}`, p.lastmod)),
      ];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

      res.set("Content-Type", "application/xml").status(200).send(xml);
    } catch (err) {
      console.error("Failed to generate sitemap:", err);
      res.status(500).set("Content-Type", "application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${STATIC_PATHS.map((p) => urlEntry(`${SITE_URL}${p}`)).join("\n")}\n</urlset>\n`
      );
    }
  });
}
