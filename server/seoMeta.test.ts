import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildRootPlaceholder,
  injectSeoMeta,
  normalizePath,
  resolveRouteMeta,
  STATIC_ROUTE_META,
} from "./_core/seoMeta";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function readSource(relative: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relative), "utf-8");
}

const INDEX_HTML = readSource("client/index.html");

/**
 * Collapses a .tsx file (or a metadata string) to comparable prose: JSX
 * markup out, `{" "}` spacers out, the literal two-character escape `\n`
 * inside a source string treated as a space, whitespace collapsed. Enough to
 * tell "this exact sentence is rendered by this file" from "it isn't",
 * without parsing JSX.
 *
 * A tag's quoted attribute values are kept rather than dropped with the tag:
 * the four legal pages pass their heading and opening paragraph to
 * LegalPageLayout as `title=` and `intro=` props, so that text only exists
 * inside a tag. Keeping className strings too is harmless noise for a
 * substring check.
 */
function prose(value: string) {
  return value
    .replace(/<[^>]*>/g, (tag) => {
      const attributeText = (tag.match(/"[^"]*"/g) ?? [])
        .map((quoted) => quoted.slice(1, -1))
        .join(" ");
      return ` ${attributeText} `;
    })
    .replace(/\{" "\}/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The h1/intro in STATIC_ROUTE_META are copies of strings that live in these
 * components. Nothing at build time forces the copies to agree — this table
 * plus the test below is what does. A route whose page is edited without
 * updating seoMeta.ts fails here rather than silently serving a crawler one
 * headline and a visitor another.
 *
 * `fragments` is only needed where the page assembles the text from more than
 * one literal (the home page's h1 is a constant plus a slide headline).
 */
const PAGE_SOURCES: Record<
  string,
  { file: string; h1Fragments?: string[]; introFragments?: string[] }
> = {
  "/": {
    file: "client/src/components/HeroSlider.tsx",
    h1Fragments: ["Brighter Days Labs", "Precision Peptides for Advanced Research"],
  },
  "/compounds": { file: "client/src/pages/Compounds.tsx" },
  "/faq": { file: "client/src/pages/FAQ.tsx" },
  "/contact": { file: "client/src/pages/Contact.tsx" },
  "/wholesale": { file: "client/src/pages/WholesaleApplication.tsx" },
  "/lab-tests": { file: "client/src/pages/LabTests.tsx" },
  "/science/approach": { file: "client/src/pages/ScienceApproach.tsx" },
  "/science/manufacturing": { file: "client/src/pages/ScienceManufacturing.tsx" },
  "/science/research-standards": { file: "client/src/pages/ScienceResearchStandards.tsx" },
  "/science/responsible-supply": { file: "client/src/pages/ScienceResponsibleSupply.tsx" },
  "/legal/research-use-only": { file: "client/src/pages/LegalResearchUseOnly.tsx" },
  "/legal/website-disclaimer": { file: "client/src/pages/LegalWebsiteDisclaimer.tsx" },
  "/legal/terms-of-service": { file: "client/src/pages/LegalTermsOfService.tsx" },
  "/legal/shipping-policy": { file: "client/src/pages/LegalShippingPolicy.tsx" },
};

describe("STATIC_ROUTE_META stays in sync with the pages it describes", () => {
  it("covers every route that has a page source, and no others", () => {
    expect(Object.keys(PAGE_SOURCES).sort()).toEqual(Object.keys(STATIC_ROUTE_META).sort());
  });

  for (const [route, meta] of Object.entries(STATIC_ROUTE_META)) {
    const source = PAGE_SOURCES[route];

    it(`${route} — h1 matches the component's <h1>`, () => {
      const rendered = prose(readSource(source.file));
      for (const fragment of source.h1Fragments ?? [meta.h1]) {
        expect(rendered, `${source.file} no longer renders this h1`).toContain(prose(fragment));
      }
    });

    it(`${route} — intro matches the component's opening paragraph`, () => {
      const rendered = prose(readSource(source.file));
      for (const fragment of source.introFragments ?? [meta.intro]) {
        expect(rendered, `${source.file} no longer renders this paragraph`).toContain(
          prose(fragment)
        );
      }
    });
  }
});

describe("focus keyword coherence", () => {
  // The practical half of what Rank Math calls a focus keyword: title and
  // description have to agree on what the page is about. Google has no such
  // metric, but two fields contradicting each other is a real defect.
  for (const [route, meta] of Object.entries(STATIC_ROUTE_META)) {
    it(`${route} — "${meta.keyword}" appears in both title and description`, () => {
      const tokens = meta.keyword.toLowerCase().split(/\s+/);
      const title = meta.title.toLowerCase();
      const description = meta.description.toLowerCase();
      for (const token of tokens) {
        expect(title, `title is missing "${token}"`).toContain(token);
        expect(description, `description is missing "${token}"`).toContain(token);
      }
    });
  }
});

describe("metadata is distinct and well-formed per route", () => {
  it("gives every route its own title", () => {
    const titles = Object.values(STATIC_ROUTE_META).map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("gives every route its own description", () => {
    const descriptions = Object.values(STATIC_ROUTE_META).map((m) => m.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  for (const [route, meta] of Object.entries(STATIC_ROUTE_META)) {
    it(`${route} — title and description are within display limits`, async () => {
      const resolved = await resolveRouteMeta(route);
      // Google truncates a title around 60 characters; the brand suffix is
      // already included in `resolved.title`.
      expect(resolved.title.length).toBeLessThanOrEqual(65);
      expect(meta.description.length).toBeGreaterThanOrEqual(110);
      expect(meta.description.length).toBeLessThanOrEqual(160);
    });
  }
});

describe("normalizePath", () => {
  it("drops the query string so filtered catalog URLs share one canonical", () => {
    expect(normalizePath("/compounds?category=cellular-research")).toBe("/compounds");
  });

  it("drops the hash", () => {
    expect(normalizePath("/faq#shipping")).toBe("/faq");
  });

  it("strips a trailing slash but keeps the root", () => {
    expect(normalizePath("/compounds/")).toBe("/compounds");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("resolveRouteMeta", () => {
  it("canonicalises every category URL onto /compounds", async () => {
    const filtered = await resolveRouteMeta("/compounds?category=metabolic-research");
    const catalog = await resolveRouteMeta("/compounds");
    expect(filtered.canonical).toBe("https://www.brighterdayslabs.com/compounds");
    expect(filtered.canonical).toBe(catalog.canonical);
  });

  it("serves Organization and WebSite JSON-LD on the home page only", async () => {
    const home = await resolveRouteMeta("/");
    expect(home.jsonLd.map((block) => (block as { "@type": string })["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);

    for (const route of Object.keys(STATIC_ROUTE_META)) {
      if (route === "/") continue;
      const meta = await resolveRouteMeta(route);
      expect(meta.jsonLd, `${route} should carry no JSON-LD`).toEqual([]);
    }
  });

  it("marks session and account routes noindex with a title of their own", async () => {
    for (const route of ["/login", "/register", "/checkout", "/my-account", "/my-orders"]) {
      const meta = await resolveRouteMeta(route);
      expect(meta.robots, route).toBe("noindex, follow");
      expect(meta.title, route).not.toBe(STATIC_ROUTE_META["/"].title);
      expect(meta.h1, route).toBeUndefined();
    }
  });

  it("marks nested admin and order routes noindex", async () => {
    expect((await resolveRouteMeta("/admin/products")).robots).toBe("noindex, follow");
    expect((await resolveRouteMeta("/my-orders/8042")).robots).toBe("noindex, follow");
  });

  it("marks an unknown path noindex rather than letting it claim the home page", async () => {
    const meta = await resolveRouteMeta("/not-a-real-page");
    expect(meta.robots).toBe("noindex, follow");
    expect(meta.title).toBe("Page Not Found — Brighter Days Labs");
  });

  it("appends the brand suffix once, and not at all to the home page", async () => {
    expect((await resolveRouteMeta("/faq")).title).toBe(
      "Frequently Asked Questions — Brighter Days Labs"
    );
    expect((await resolveRouteMeta("/")).title).toBe(
      "Brighter Days Labs — Research Grade Peptides & Compounds"
    );
  });

  it("gives every indexable route a self-referential canonical", async () => {
    for (const route of Object.keys(STATIC_ROUTE_META)) {
      const meta = await resolveRouteMeta(route);
      expect(meta.canonical, route).toBe(`https://www.brighterdayslabs.com${route}`);
      expect(meta.robots, route).toBe("index, follow");
    }
  });
});

describe("injectSeoMeta rewrites the served document", () => {
  it("leaves exactly one title, description, canonical and robots tag", async () => {
    const meta = await resolveRouteMeta("/faq");
    const html = injectSeoMeta(INDEX_HTML, meta);

    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/<meta name="robots"/g)).toHaveLength(1);
    expect(html).toContain("<title>Frequently Asked Questions — Brighter Days Labs</title>");
    expect(html).not.toContain("<title>Brighter Days Labs — Research Grade");
  });

  it("writes exactly one h1 into #root, and none on noindex routes", async () => {
    const faq = injectSeoMeta(INDEX_HTML, await resolveRouteMeta("/faq"));
    expect(faq.match(/<h1>/g)).toHaveLength(1);
    expect(faq).toContain("<h1>Frequently Asked Questions</h1>");
    expect(faq).toContain("data-seo-placeholder");

    const login = injectSeoMeta(INDEX_HTML, await resolveRouteMeta("/login"));
    expect(login).not.toContain("<h1>");
    expect(login).toContain('<div id="root"></div>');
  });

  it("hides the placeholder from a browser that paints before React mounts", async () => {
    const placeholder = buildRootPlaceholder(await resolveRouteMeta("/faq"));
    expect(placeholder).toContain("clip:rect(0 0 0 0)");
    expect(placeholder).toContain("clip-path:inset(50%)");
  });

  it("replaces index.html's generic social tags rather than adding to them", async () => {
    const html = injectSeoMeta(INDEX_HTML, await resolveRouteMeta("/contact"));
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(html).toContain('content="Contact Us — Brighter Days Labs"');
    expect(html).not.toContain('content="Made in the USA"');
  });

  it("carries no JSON-LD on a route that should not claim to be the site", async () => {
    const html = injectSeoMeta(INDEX_HTML, await resolveRouteMeta("/legal/terms-of-service"));
    expect(html).not.toContain("application/ld+json");
  });

  it("escapes a title that would otherwise break out of its tag", () => {
    const html = injectSeoMeta(INDEX_HTML, {
      title: 'BPC-157 <script>alert("x")</script>',
      description: 'A "quoted" & <angled> description',
      canonical: "https://www.brighterdayslabs.com/compounds/bpc-157-10mg",
      robots: "index, follow",
      ogType: "product",
      image: "https://example.test/img.png",
      imageAlt: "BPC-157",
      h1: "BPC-157 <b>10mg</b>",
      intro: "Intro & more",
      jsonLd: [{ "@type": "Product", name: "</script><script>alert(1)</script>" }],
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain("&quot;quoted&quot;");
  });
});

describe("index.html no longer declares anything per-route", () => {
  // These moved to seoMeta.ts. Left in index.html they would go out on all 17
  // routes at once, which is the defect this middleware exists to fix.
  it("has no canonical, robots, social or JSON-LD tags of its own", () => {
    expect(INDEX_HTML).not.toMatch(/<link[^>]+rel="canonical"/);
    expect(INDEX_HTML).not.toMatch(/<meta[^>]+name="robots"/);
    expect(INDEX_HTML).not.toMatch(/<meta[^>]+property="og:/);
    expect(INDEX_HTML).not.toMatch(/<meta[^>]+name="twitter:/);
    expect(INDEX_HTML).not.toContain("application/ld+json");
  });

  it("still ships a fallback title and description for the injection-failed path", () => {
    expect(INDEX_HTML).toMatch(/<title>[^<]+<\/title>/);
    expect(INDEX_HTML).toMatch(/<meta name="description"/);
  });
});
