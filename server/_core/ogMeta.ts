import { getProductBySlug, getProductImages } from "../db";

const SITE_URL = "https://www.brighterdayslabs.com";

// Same logo index.html points at, used when a product has no uploaded image.
const FALLBACK_OG_IMAGE =
  "https://pub-f9dc97453f1244a0a96fa1fb85c35d2e.r2.dev/site-images/site_logo/ne8tTXarNj_logo-02_f57c9665.png";

// Matches the generic og:/twitter: meta tags in index.html so they can be
// dropped before the product-specific ones are inserted. Anchored on the
// property/name attribute coming first, which is how index.html writes them.
const GENERIC_SOCIAL_META =
  /[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\r?\n?/g;

const PRODUCT_PATH = /^\/compounds\/([^/]+)\/?$/;

/**
 * True only for a product detail URL (/compounds/<slug>), which is the one
 * place the social tags get rewritten. /compounds itself, the home page and
 * every other route return false and are served untouched.
 */
export function isProductPath(originalUrl: string) {
  return PRODUCT_PATH.test(originalUrl.split(/[?#]/)[0]);
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Deliberately without react-helmet-async's data-rh attribute: that would hand
// ownership of these tags to the <Helmet> in ProductDetail, which no longer
// renders og:/twitter: tags and would therefore strip them on mount.
function metaTag(kind: "property" | "name", key: string, content: string) {
  return `    <meta ${kind}="${key}" content="${escapeAttr(content)}" />`;
}

/**
 * Rewrites the social preview tags in index.html for product pages.
 *
 * Facebook's and WhatsApp's crawlers don't execute JavaScript, so anything
 * <Helmet> renders client-side never reaches them — without this, every shared
 * compound link previews as the site logo and the home page's copy. This is
 * why ProductDetail deliberately leaves its social tags to the server.
 *
 * Any other route (home included) is returned byte-for-byte unchanged, so the
 * static tags already in index.html keep serving it exactly as before.
 */
export async function injectSocialMeta(html: string, originalUrl: string): Promise<string> {
  const match = PRODUCT_PATH.exec(originalUrl.split(/[?#]/)[0]);
  if (!match) return html;

  const slug = decodeURIComponent(match[1]);

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (err) {
    // A DB hiccup shouldn't cost the user the page — serve it with the
    // generic tags rather than erroring out.
    console.error(`Failed to load product for social meta (${slug}):`, err);
    return html;
  }

  // Unknown slug renders the client-side not-found state; leave the generic
  // tags alone rather than advertising a product that isn't there.
  if (!product || !product.active) return html;

  let imageUrl = FALLBACK_OG_IMAGE;
  try {
    const images = await getProductImages(product.id);
    // Mirrors ProductDetail's displayImages: product-level images first,
    // falling back to whatever exists (variation-specific ones).
    const productLevel = images.filter((img) => img.variationId == null);
    imageUrl = (productLevel[0] ?? images[0])?.url ?? FALLBACK_OG_IMAGE;
  } catch (err) {
    console.error(`Failed to load images for social meta (${slug}):`, err);
  }

  const title = `${product.name} | Brighter Days Labs`;
  const description = (
    product.shortDescription
      ? product.shortDescription
      : `${product.name} — research-grade compound with a batch-specific Certificate of Analysis. ≥99% HPLC verified. Research Use Only.`
  ).slice(0, 160);
  const url = `${SITE_URL}/compounds/${product.slug}`;

  const tags = [
    metaTag("property", "og:type", "product"),
    metaTag("property", "og:title", title),
    metaTag("property", "og:description", description),
    metaTag("property", "og:url", url),
    metaTag("property", "og:image", imageUrl),
    metaTag("property", "og:image:alt", product.name),
    metaTag("name", "twitter:card", "summary_large_image"),
    metaTag("name", "twitter:title", title),
    metaTag("name", "twitter:description", description),
    metaTag("name", "twitter:image", imageUrl),
  ].join("\n");

  const stripped = html.replace(GENERIC_SOCIAL_META, "");
  return stripped.replace("</head>", `${tags}\n  </head>`);
}
