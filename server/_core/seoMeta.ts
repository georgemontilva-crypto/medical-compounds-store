import { getProductBySlug, getProductImages, getPublishedBlogPostBySlug } from "../db";
import { blogDescription, truncateAtWord } from "@shared/blog";

const SITE_URL = "https://www.brighterdayslabs.com";
const BRAND = "Brighter Days Labs";

// Every <title> ends with the brand. The site is young enough that the
// repetition in the SERP and the tab bar is worth the ~21 characters; the
// home page is the one exception, since it already leads with the brand.
const TITLE_SUFFIX = ` — ${BRAND}`;

// Same logo index.html points at, used when a product has no uploaded image.
const FALLBACK_OG_IMAGE =
  "https://pub-f9dc97453f1244a0a96fa1fb85c35d2e.r2.dev/site-images/site_logo/ne8tTXarNj_logo-02_f57c9665.png";

export type Robots = "index, follow" | "noindex, follow";

export type RouteMeta = {
  /**
   * The one query this page is meant to answer. This is the useful half of
   * what Rank Math/Yoast call a "focus keyword" — Google has no such concept,
   * but "title and description should agree on what the page is about" is
   * real. seoMeta.test.ts asserts every token here appears in both `title`
   * and `description`, which is the part a test can actually enforce.
   */
  keyword: string;
  /** Without the brand suffix — `titleFor()` appends it. */
  title: string;
  description: string;
  /**
   * Must match the <h1> the page renders once React mounts. The string is
   * deliberately duplicated here rather than imported from a shared module:
   * the server writes it into #root as a placeholder, and a shared constant
   * invites a page to render it a second time.
   * server/seoMeta.test.ts reads the .tsx files and fails if these drift.
   */
  h1: string;
  /** First paragraph of the page, same rule as `h1`. */
  intro: string;
};

/**
 * Public, indexable routes. `sitemap.ts` derives its URL list from these keys,
 * so a route added here shows up in sitemap.xml automatically.
 *
 * Each entry names the file its h1/intro is copied from. Change one, change
 * the other — the test will tell you if you forget.
 */
export const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  // client/src/components/HeroSlider.tsx — BRAND_NAME + SLIDES[0].headline/sub
  "/": {
    keyword: "research peptides",
    title: `${BRAND} — Research Grade Peptides & Compounds`,
    description:
      "Brighter Days Labs supplies ≥99% HPLC-verified research peptides and compounds with batch-specific Certificates of Analysis. Research Use Only.",
    h1: "Brighter Days Labs Precision Peptides for Advanced Research",
    intro:
      "High-purity lyophilized compounds manufactured to the strictest laboratory standards.",
  },

  // client/src/pages/Compounds.tsx
  "/compounds": {
    keyword: "research compounds",
    title: "Research Compounds Catalog",
    description:
      "Browse all research compounds Brighter Days Labs offers, organized by biological mechanism. ≥99% HPLC purity with a batch-specific COA on every order.",
    h1: "Research Compounds",
    intro: "Research-grade peptides and compounds organized by biological mechanism.",
  },

  // client/src/pages/Blog.tsx
  "/blog": {
    keyword: "research blog",
    title: "Research Blog",
    description:
      "The Brighter Days Labs research blog: peptide handling, reconstitution, storage, and how to read a Certificate of Analysis.",
    h1: "Research Blog",
    intro:
      "Notes from the bench on peptide handling, documentation, and what a Certificate of Analysis actually tells you.",
  },

  // client/src/pages/FAQ.tsx
  "/faq": {
    keyword: "frequently asked questions",
    title: "Frequently Asked Questions",
    description:
      "Frequently asked questions about ordering research peptides: shipping times, COA access, purity standards, storage, and what Research Use Only means.",
    h1: "Frequently Asked Questions",
    intro:
      "Answers to the questions we hear most often about ordering, shipping, purity, and research use.",
  },

  // client/src/pages/Contact.tsx
  "/contact": {
    keyword: "contact",
    title: "Contact Us",
    description:
      "Contact Brighter Days Labs about bulk pricing, custom synthesis, or a specific Certificate of Analysis. We reply within one business day.",
    h1: "Contact Us",
    intro:
      "Need a compound we don't list? Want bulk pricing or custom synthesis? Have a question about a specific COA? We respond within one business day.",
  },

  // client/src/pages/WholesaleApplication.tsx
  "/wholesale": {
    keyword: "wholesale research",
    title: "Wholesale & Institutional Research",
    description:
      "Wholesale peptide supply for universities, contract labs, and research organizations that need consistent volume, documentation, and pricing at scale.",
    h1: "Built for institutional research at volume",
    intro:
      "Brighter Days Labs partners with universities, contract labs, and research organizations that need consistent supply, documentation, and pricing at scale. Tell us about your program and our team will follow up.",
  },

  // client/src/pages/LabTests.tsx
  "/lab-tests": {
    keyword: "lab tests",
    title: "Lab Tests & Certificates of Analysis",
    description:
      "Third-party lab tests and Certificates of Analysis for every Brighter Days Labs batch, published as soon as they're available. No sign-up required.",
    h1: "Lab Tests",
    intro:
      "Certificates of Analysis for every tested batch, published as soon as they're available.",
  },

  // client/src/pages/ScienceApproach.tsx
  "/science/approach": {
    keyword: "mechanism",
    title: "Catalog Organized by Mechanism",
    description:
      "Brighter Days Labs groups its catalog by biological mechanism of action, not alphabetically — every category collects compounds researchers study together.",
    h1: "Organized by mechanism. Accessible by design.",
    intro:
      "Brighter Days Labs organizes its catalog by biological mechanism of action, not alphabetically and not by popularity. Every category groups compounds researchers actually study together, and every batch ships with its own documentation.",
  },

  // client/src/pages/ScienceManufacturing.tsx
  "/science/manufacturing": {
    keyword: "manufacturing",
    title: "Manufacturing & Batch Accountability",
    description:
      "US-based peptide manufacturing with batch-level accountability: documented process controls, purification, and quality checks traceable to every vial.",
    h1: "US-based synthesis with batch-level accountability.",
    intro:
      "Every compound Brighter Days Labs sells is synthesized and tested under documented process controls. Sourcing, purification, and quality checks are tracked at the batch level, so a given vial can always be traced back to how and when it was made.",
  },

  // client/src/pages/ScienceResearchStandards.tsx
  "/science/research-standards": {
    keyword: "research standards",
    title: "Research Standards",
    description:
      "The research standards Brighter Days Labs holds itself to: documentation depth, labeling precision, and mechanism-based categorization on every compound.",
    h1: "What serious researchers should expect from a supply partner.",
    intro:
      "Compound sourcing isn't a commodity decision. Documentation depth, labeling precision, and how rigorously a catalog is categorized all affect whether the data you get back is usable. Brighter Days Labs holds itself to a documented standard on all three.",
  },

  // client/src/pages/ScienceResponsibleSupply.tsx
  "/science/responsible-supply": {
    keyword: "responsible supply",
    title: "Responsible Supply",
    description:
      "Responsible supply at Brighter Days Labs: operational control over how each compound is manufactured, packaged, and handled before it reaches the bench.",
    h1: "Discipline at every step of the chain.",
    intro:
      "Responsible sourcing isn't a marketing line — it's operational control over how a compound is manufactured, packaged, and handled before it reaches a researcher's bench. Brighter Days Labs treats each of those steps as a discipline with its own standard.",
  },

  // client/src/pages/LegalResearchUseOnly.tsx (title/intro props)
  "/legal/research-use-only": {
    keyword: "research use only",
    title: "Research Use Only Policy",
    description:
      "The Research Use Only policy governing every product Brighter Days Labs sells: who may purchase, permitted use, and the restrictions that apply.",
    h1: "Research Use Only Policy & Website Disclaimer",
    intro:
      "This policy governs the purchase and use of all products sold by Brighter Days Labs and applies to every visitor, account holder, and purchaser on this website. Please read it carefully before browsing our catalog or placing an order.",
  },

  // client/src/pages/LegalWebsiteDisclaimer.tsx (title/intro props)
  "/legal/website-disclaimer": {
    keyword: "website disclaimer",
    title: "Website Disclaimer",
    description:
      "The website disclaimer for Brighter Days Labs: limitations on the information published here and how it relates to our Research Use Only policy.",
    h1: "Website Disclaimer",
    intro:
      "This disclaimer summarizes key limitations that apply to your use of this website. For the complete policy governing product purchase and use, see our Research Use Only Policy & Website Disclaimer.",
  },

  // client/src/pages/LegalTermsOfService.tsx (title/intro props)
  "/legal/terms-of-service": {
    keyword: "terms of service",
    title: "Terms of Service",
    description:
      "The Terms of Service governing your use of the Brighter Days Labs website and the purchase of any product through it.",
    h1: "Terms of Service",
    intro:
      "These Terms of Service govern your access to and use of the Brighter Days Labs website and the purchase of any product through it.",
  },

  // client/src/pages/LegalShippingPolicy.tsx (title/intro props)
  "/legal/shipping-policy": {
    keyword: "shipping policy",
    title: "Shipping Policy",
    description:
      "The Brighter Days Labs shipping policy: carriers, delivery estimates, costs, and what to do if an order is delayed or damaged in transit.",
    h1: "Shipping Policy",
    intro:
      "This policy describes how Brighter Days Labs ships orders, including carriers, delivery estimates, costs, and what to do if something goes wrong in transit.",
  },
};

/**
 * Session- and account-scoped routes. They get a real <title> and an explicit
 * `noindex, follow` instead of silently inheriting the home page's tags, but
 * no #root placeholder — there is nothing here worth putting in an index.
 */
const NOINDEX_ROUTE_TITLES: Record<string, string> = {
  "/login": "Sign In",
  "/register": "Create Account",
  "/forgot-password": "Reset Password",
  "/reset-password": "Choose a New Password",
  "/checkout": "Checkout",
  "/my-account": "My Account",
  "/my-orders": "My Orders",
  "/404": "Page Not Found",
};

/** Everything under these prefixes is noindex, however deep. */
const NOINDEX_PREFIXES = ["/admin", "/my-orders/"];

const PRODUCT_PATH = /^\/compounds\/([^/]+)$/;
const LAB_REPORT_PATH = /^\/lab-reports\/([^/]+)$/;
const BLOG_POST_PATH = /^\/blog\/([^/]+)$/;

export type ResolvedMeta = {
  title: string;
  description: string;
  canonical: string;
  robots: Robots;
  ogType: "website" | "product" | "article";
  image: string;
  imageAlt: string;
  /** Omitted for noindex routes — nothing is injected into #root for those. */
  h1?: string;
  intro?: string;
  jsonLd: object[];
};

type MetaBase = Pick<ResolvedMeta, "canonical" | "ogType" | "image" | "imageAlt" | "jsonLd">;

function titleFor(title: string) {
  // The home page's title already opens with the brand; appending the suffix
  // would read "Brighter Days Labs — … — Brighter Days Labs".
  return title.includes(BRAND) ? title : `${title}${TITLE_SUFFIX}`;
}

/**
 * Query strings never produce a distinct canonical. `/compounds?category=x`
 * renders the same catalog with a client-side filter applied, so all four
 * category URLs collapse onto /compounds rather than competing with it.
 */
export function normalizePath(originalUrl: string) {
  const path = originalUrl.split(/[?#]/)[0] || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isNoindexPath(path: string) {
  if (path in NOINDEX_ROUTE_TITLES) return true;
  return NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

function organizationJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: BRAND,
      url: `${SITE_URL}/`,
      logo: FALLBACK_OG_IMAGE,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: BRAND,
      url: `${SITE_URL}/`,
    },
  ];
}

/**
 * The metadata every route is served with. Never throws: an unknown path or a
 * database hiccup falls back to a generic descriptor rather than 500ing a page
 * that would otherwise have rendered fine client-side.
 */
export async function resolveRouteMeta(originalUrl: string): Promise<ResolvedMeta> {
  const path = normalizePath(originalUrl);
  const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;

  const base: MetaBase = {
    canonical,
    ogType: "website",
    image: FALLBACK_OG_IMAGE,
    imageAlt: BRAND,
    jsonLd: [],
  };

  const productMatch = PRODUCT_PATH.exec(path);
  if (productMatch) return resolveProduct(decodeURIComponent(productMatch[1]), base);

  const labReportMatch = LAB_REPORT_PATH.exec(path);
  if (labReportMatch) return resolveLabReport(decodeURIComponent(labReportMatch[1]), base);

  const blogMatch = BLOG_POST_PATH.exec(path);
  if (blogMatch) return resolveBlogPost(decodeURIComponent(blogMatch[1]), base);

  if (isNoindexPath(path)) {
    const title = NOINDEX_ROUTE_TITLES[path] ?? BRAND;
    return {
      ...base,
      title: titleFor(title),
      description: STATIC_ROUTE_META["/"].description,
      robots: "noindex, follow",
    };
  }

  const staticMeta = STATIC_ROUTE_META[path];
  if (staticMeta) {
    return {
      ...base,
      title: titleFor(staticMeta.title),
      description: staticMeta.description,
      robots: "index, follow",
      h1: staticMeta.h1,
      intro: staticMeta.intro,
      jsonLd: path === "/" ? organizationJsonLd() : [],
    };
  }

  // Unknown path: the client renders its not-found state, so don't invite an
  // index of a URL that doesn't exist.
  return {
    ...base,
    title: titleFor("Page Not Found"),
    description: STATIC_ROUTE_META["/"].description,
    robots: "noindex, follow",
  };
}

async function resolveProduct(slug: string, base: MetaBase): Promise<ResolvedMeta> {
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (err) {
    // A DB hiccup shouldn't cost the user the page — serve it with the
    // catalog's metadata rather than erroring out.
    console.error(`Failed to load product for route meta (${slug}):`, err);
    return catalogFallback(base, "index, follow");
  }

  // Unknown slug renders the client-side not-found state; don't advertise a
  // product that isn't there.
  if (!product || !product.active) return catalogFallback(base, "noindex, follow");

  let image = base.image;
  try {
    const images = await getProductImages(product.id);
    // Mirrors ProductDetail's displayImages: product-level images first,
    // falling back to whatever exists (variation-specific ones).
    const productLevel = images.filter((img) => img.variationId == null);
    image = (productLevel[0] ?? images[0])?.url ?? base.image;
  } catch (err) {
    console.error(`Failed to load images for route meta (${slug}):`, err);
  }

  const description = (
    product.shortDescription
      ? product.shortDescription
      : `${product.name} — research-grade compound with a batch-specific Certificate of Analysis. ≥99% HPLC verified. Research Use Only.`
  ).slice(0, 160);

  return {
    ...base,
    title: titleFor(product.name),
    description,
    robots: "index, follow",
    ogType: "product",
    image,
    imageAlt: product.name,
    // client/src/pages/ProductDetail.tsx:294 renders {product.name} as the h1,
    // and :438 renders shortDescription.
    h1: product.name,
    intro: description,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description,
        ...(image !== FALLBACK_OG_IMAGE ? { image: [image] } : {}),
        sku: String(product.id),
        brand: { "@type": "Brand", name: BRAND },
        offers: {
          "@type": "Offer",
          url: base.canonical,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };
}

async function resolveLabReport(slug: string, base: MetaBase): Promise<ResolvedMeta> {
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (err) {
    console.error(`Failed to load product for lab report meta (${slug}):`, err);
    return catalogFallback(base, "index, follow");
  }

  if (!product || !product.active) return catalogFallback(base, "noindex, follow");

  return {
    ...base,
    title: titleFor(`${product.name} Lab Reports`),
    description:
      `Third-party Certificates of Analysis for ${product.name} from Brighter Days Labs: purity, identity, and batch documentation, published without a sign-up.`.slice(
        0,
        160
      ),
    robots: "index, follow",
    // client/src/pages/LabReports.tsx:102
    h1: `${product.name} — Lab Reports`,
    intro: `Third-party Certificates of Analysis for ${product.name}, published as soon as each batch is tested.`,
  };
}


async function resolveBlogPost(slug: string, base: MetaBase): Promise<ResolvedMeta> {
  let post;
  try {
    post = await getPublishedBlogPostBySlug(slug);
  } catch (err) {
    // Same reasoning as resolveProduct: a database hiccup costs the page its
    // specific metadata, not its existence.
    console.error(`Failed to load blog post for route meta (${slug}):`, err);
    return blogFallback(base, "index, follow");
  }

  // Covers an unknown slug and a draft alike — getPublishedBlogPostBySlug
  // filters on status, so an unpublished article is indistinguishable from a
  // missing one here, and neither should advertise itself.
  if (!post) return blogFallback(base, "noindex, follow");

  const description = blogDescription(post.excerpt, post.title);
  const image = post.coverImageUrl ?? base.image;
  const published = post.publishedAt ?? post.updatedAt;

  return {
    ...base,
    title: titleFor(post.title),
    description,
    robots: "index, follow",
    ogType: "article",
    image,
    imageAlt: post.title,
    // client/src/pages/BlogPost.tsx renders {post.title} as the h1 and the
    // excerpt as the standfirst directly below it.
    h1: post.title,
    intro: description,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        // Google ignores a headline past ~110 characters; the title column
        // allows 200.
        headline: truncateAtWord(post.title, 110),
        description,
        ...(image !== FALLBACK_OG_IMAGE ? { image: [image] } : {}),
        datePublished: new Date(published).toISOString(),
        dateModified: new Date(post.updatedAt).toISOString(),
        author: { "@type": "Organization", name: BRAND },
        publisher: {
          "@type": "Organization",
          name: BRAND,
          logo: { "@type": "ImageObject", url: FALLBACK_OG_IMAGE },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": base.canonical },
      },
    ],
  };
}

/** The blog index's metadata, for a post URL that resolves to nothing. */
function blogFallback(base: MetaBase, robots: Robots): ResolvedMeta {
  return {
    ...base,
    title: titleFor(STATIC_ROUTE_META["/blog"].title),
    description: STATIC_ROUTE_META["/blog"].description,
    robots,
  };
}

function catalogFallback(base: MetaBase, robots: Robots): ResolvedMeta {
  return {
    ...base,
    title: titleFor(STATIC_ROUTE_META["/compounds"].title),
    description: STATIC_ROUTE_META["/compounds"].description,
    robots,
  };
}

// ── HTML injection ───────────────────────────────────────────────────────────

// index.html keeps a generic <title> and description purely as a safety net
// for the case where injection throws and the raw file is served. Both are
// stripped here before the per-route pair is written, so a page never carries
// two of either — which is what used to happen on product pages, where
// <Helmet>'s copy was appended below the static one and Google read the first.
const STATIC_TITLE = /[ \t]*<title>[\s\S]*?<\/title>\r?\n?/i;
const STATIC_DESCRIPTION = /[ \t]*<meta\s+name="description"[^>]*>\r?\n?/i;

// Matches the generic og:/twitter: meta tags in index.html so they can be
// dropped before the per-route ones are inserted. Anchored on the
// property/name attribute coming first, which is how index.html writes them.
const GENERIC_SOCIAL_META =
  /[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\r?\n?/g;

const EMPTY_ROOT = /<div id="root">\s*<\/div>/;

// Visually hidden, but present in the served HTML. A crawler that doesn't run
// JS reads the real h1 and opening paragraph; a browser never paints them,
// because they are clipped to a 1px box and React removes them outright on
// mount. Inline rather than a class because index.html ships no stylesheet of
// its own — the CSS arrives with the bundle, by which point this is gone.
const PLACEHOLDER_STYLE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;" +
  "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Deliberately without react-helmet-async's data-rh attribute: these tags are
// the server's, and nothing client-side claims them any more.
function metaTag(kind: "property" | "name", key: string, content: string) {
  return `    <meta ${kind}="${key}" content="${escapeAttr(content)}" />`;
}

export function buildHeadTags(meta: ResolvedMeta) {
  const tags = [
    `    <title>${escapeText(meta.title)}</title>`,
    metaTag("name", "description", meta.description),
    `    <link rel="canonical" href="${escapeAttr(meta.canonical)}" />`,
    metaTag("name", "robots", meta.robots),
    metaTag("property", "og:type", meta.ogType),
    metaTag("property", "og:site_name", BRAND),
    metaTag("property", "og:title", meta.title),
    metaTag("property", "og:description", meta.description),
    metaTag("property", "og:url", meta.canonical),
    metaTag("property", "og:image", meta.image),
    metaTag("property", "og:image:alt", meta.imageAlt),
    metaTag("name", "twitter:card", "summary_large_image"),
    metaTag("name", "twitter:title", meta.title),
    metaTag("name", "twitter:description", meta.description),
    metaTag("name", "twitter:image", meta.image),
  ];

  for (const block of meta.jsonLd) {
    // `<` is escaped so a product name containing "</script>" can't break out
    // of the block.
    const json = JSON.stringify(block).replace(/</g, "\\u003c");
    tags.push(`    <script type="application/ld+json">${json}</script>`);
  }

  return tags.join("\n");
}

export function buildRootPlaceholder(meta: ResolvedMeta) {
  if (!meta.h1) return '<div id="root"></div>';
  const intro = meta.intro ? `<p>${escapeText(meta.intro)}</p>` : "";
  return (
    `<div id="root"><div data-seo-placeholder style="${PLACEHOLDER_STYLE}">` +
    `<h1>${escapeText(meta.h1)}</h1>${intro}</div></div>`
  );
}

/**
 * Rewrites index.html with the metadata for one route.
 *
 * Applies to every route, not just product pages: the SPA serves one HTML
 * document for all of them, so without this every URL claims the home page's
 * title, description and social tags, and none of them carry a canonical.
 *
 * The #root placeholder is the only part written into the body. React's
 * createRoot() clears the container on its first render, so the placeholder is
 * gone before the page is interactive and exactly one h1 survives — verified
 * against this project's React 19 rather than assumed.
 */
export function injectSeoMeta(html: string, meta: ResolvedMeta) {
  const head = html
    .replace(STATIC_TITLE, "")
    .replace(STATIC_DESCRIPTION, "")
    .replace(GENERIC_SOCIAL_META, "")
    .replace("</head>", `${buildHeadTags(meta)}\n  </head>`);

  return head.replace(EMPTY_ROOT, buildRootPlaceholder(meta));
}

/** Convenience wrapper: resolve the route, then inject. Never throws. */
export async function injectRouteMeta(html: string, originalUrl: string) {
  const meta = await resolveRouteMeta(originalUrl);
  return injectSeoMeta(html, meta);
}
