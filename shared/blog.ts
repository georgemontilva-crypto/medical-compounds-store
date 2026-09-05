/**
 * Blog rules shared by the server and the public renderer.
 *
 * The whitelists and URL guards below are the security boundary for article
 * content. They live here rather than next to the React component because
 * vitest.config.ts only collects tests under server/ — putting them in shared/
 * is what lets server/blog.test.ts assert the rules the browser actually
 * applies, instead of a copy of them.
 */

// ─── The stored document ─────────────────────────────────────────────────────

/**
 * A ProseMirror node, which is what `editor.getJSON()` returns and what the
 * `blog_posts.content` column holds. Loosely typed on purpose: this describes
 * bytes that came out of a database, so every field is treated as unknown
 * until a guard below vouches for it.
 */
export type BlogNode = {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
  text?: unknown;
};

export type BlogDoc = { type: "doc"; content: BlogNode[] };

/**
 * Node types the renderer knows how to draw. Anything absent here is dropped
 * silently — which is the point: a `script` or `iframe` node written straight
 * into the database by some future bug has no case to fall into.
 *
 * `heading` is allowed but the renderer clamps its level to 2 or 3. The page
 * supplies the h1 from the post title, and a second h1 in the body is exactly
 * the kind of thing that undoes the per-route metadata work in seoMeta.ts.
 */
export const ALLOWED_BLOG_NODES = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
]);

/** Inline marks the renderer knows how to draw. */
export const ALLOWED_BLOG_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
]);

/**
 * Reads a stored document, returning null for anything that isn't one.
 *
 * Never throws: a post whose content is null, empty, truncated, or simply not
 * JSON renders as an empty body rather than taking the page down with it.
 */
export function parseBlogDoc(raw: unknown): BlogDoc | null {
  if (raw == null) return null;

  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || value === null) return null;
  const doc = value as BlogNode;
  if (doc.type !== "doc") return null;
  return {
    type: "doc",
    content: Array.isArray(doc.content) ? (doc.content as BlogNode[]) : [],
  };
}

/** The children of a node, or an empty list if it has none worth walking. */
export function blogNodeChildren(node: BlogNode): BlogNode[] {
  return Array.isArray(node.content) ? (node.content as BlogNode[]) : [];
}

// ─── URL guards ──────────────────────────────────────────────────────────────

// `javascript:` and `data:` are the two that matter. Both are rejected by
// being absent, so a scheme nobody has thought of yet is rejected too.
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Whether a link's href can be rendered.
 *
 * Delegates the parse to `new URL()` rather than pattern-matching the string,
 * because the URL parser strips the tabs, newlines and leading control
 * characters that a hand-rolled `startsWith("javascript:")` check misses —
 * a scheme split across a newline is still a working URL in a browser and
 * would sail past a naive prefix test.
 */
export function isSafeBlogHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (trimmed === "") return false;

  // A site-relative link. "//evil.test" is protocol-relative, not relative,
  // so it has to go through the parser like any other absolute URL.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

/**
 * Whether an inline image's src can be rendered. Stricter than links: every
 * image in an article was uploaded through the admin and lives on R2 over
 * https, so `data:` URIs and plain http have nothing legitimate to do here.
 */
export function isSafeBlogImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (trimmed === "") return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Slugs ───────────────────────────────────────────────────────────────────

/** Matches `blog_posts.slug`, which the admin form pre-fills from the title. */
export const BLOG_SLUG_MAX_LENGTH = 220;

/**
 * Title to URL slug. Accents are unfolded rather than stripped, so "Péptidos"
 * becomes "peptidos" instead of "p-ptidos".
 */
export function slugifyBlogTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BLOG_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

// ─── Publication ─────────────────────────────────────────────────────────────

export type BlogStatus = "draft" | "published";

/**
 * What `publishedAt` becomes when a post is saved with `nextStatus`.
 *
 * Stamped the first time a post goes live and never cleared afterwards.
 * Unpublishing to fix a typo therefore keeps the original date, so
 * republishing doesn't re-date an article Google has already indexed or move
 * its `datePublished` in the BlogPosting block.
 */
export function resolvePublishedAt(
  nextStatus: BlogStatus,
  currentPublishedAt: Date | null,
  now: Date = new Date()
): Date | null {
  if (nextStatus === "published") return currentPublishedAt ?? now;
  return currentPublishedAt;
}

// ─── Summaries ───────────────────────────────────────────────────────────────

/** Google stops showing a description somewhere around here. */
export const BLOG_DESCRIPTION_MAX_LENGTH = 160;

/**
 * Truncates at the last word boundary that fits, rather than mid-word.
 * A meta description is prose read by a human in the results page; "…batch
 * documenta" reads like a bug, which is what a plain slice() produces.
 */
export function truncateAtWord(value: string, maxLength: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;

  // -1 leaves room for the ellipsis.
  const clipped = collapsed.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  // Falling back to the hard clip when the last space is very early keeps a
  // single enormous "word" (a URL, say) from truncating to just an ellipsis.
  const body = lastSpace > maxLength * 0.5 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.replace(/[,;:.\-—]+$/, "")}…`;
}

/**
 * The meta description for an article: its excerpt, or a sentence built from
 * the title when the author left the excerpt blank. Never returns an empty
 * string — a post with no description inherits nothing useful from the page
 * around it.
 */
export function blogDescription(excerpt: string | null | undefined, title: string): string {
  const trimmed = (excerpt ?? "").trim();
  if (trimmed !== "") return truncateAtWord(trimmed, BLOG_DESCRIPTION_MAX_LENGTH);
  return truncateAtWord(
    `${title} — from the Brighter Days Labs research blog, covering peptide handling, documentation, and laboratory practice.`,
    BLOG_DESCRIPTION_MAX_LENGTH
  );
}

/**
 * Flattens a stored document to plain prose. Used for the article's reading
 * time and as a last-resort excerpt; block nodes are joined with spaces so
 * words from two paragraphs never run together.
 */
export function blogDocToPlainText(doc: BlogDoc | null): string {
  if (!doc) return "";

  const parts: string[] = [];
  const walk = (node: BlogNode) => {
    if (typeof node.text === "string") parts.push(node.text);
    for (const child of blogNodeChildren(node)) walk(child);
    // Block-level nodes end with a break so their text doesn't fuse with the
    // next block's. Collapsed back to single spaces below.
    if (node.type !== "text") parts.push(" ");
  };

  for (const node of doc.content) walk(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** Rounded up, floored at one minute, on the usual 200 wpm assumption. */
export function blogReadingMinutes(doc: BlogDoc | null): number {
  const words = blogDocToPlainText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
