import type { Express } from "express";
import { getAllCategories, getProducts } from "../db";

const SITE_URL = "https://www.brighterdayslabs.com";

// Public, indexable static routes — mirrors PublicRoutes in client/src/App.tsx,
// minus session/account-scoped pages (login, register, checkout, my-orders)
// that have no SEO value and shouldn't be crawled.
const STATIC_PATHS = [
  "/",
  "/compounds",
  "/science/approach",
  "/science/manufacturing",
  "/science/research-standards",
  "/science/responsible-supply",
  "/lab-tests",
  "/faq",
  "/contact",
  "/wholesale",
  "/legal/research-use-only",
  "/legal/website-disclaimer",
  "/legal/terms-of-service",
  "/legal/shipping-policy",
];

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
      const [products, categories] = await Promise.all([
        getProducts({ active: true, limit: 10000 }),
        getAllCategories(),
      ]);

      const entries = [
        ...STATIC_PATHS.map((p) => urlEntry(`${SITE_URL}${p}`)),
        ...categories.map((c) => urlEntry(`${SITE_URL}/compounds?category=${c.slug}`, c.updatedAt)),
        ...products.map((p) => urlEntry(`${SITE_URL}/compounds/${p.slug}`, p.updatedAt)),
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
