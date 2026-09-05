import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_BLOG_MARKS,
  ALLOWED_BLOG_NODES,
  BLOG_DESCRIPTION_MAX_LENGTH,
  blogDescription,
  blogDocToPlainText,
  blogReadingMinutes,
  isSafeBlogHref,
  isSafeBlogImageSrc,
  parseBlogDoc,
  resolvePublishedAt,
  slugifyBlogTitle,
  truncateAtWord,
} from "@shared/blog";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function readSource(relative: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relative), "utf-8");
}

/**
 * Article bodies are stored as a ProseMirror node tree and rendered by walking
 * it, never by injecting a string. These tests cover the guards that walk
 * depends on — the ones that decide whether a URL from the database reaches an
 * href or a src attribute.
 */
describe("link safety", () => {
  it("accepts the schemes an author legitimately needs", () => {
    expect(isSafeBlogHref("https://www.brighterdayslabs.com/compounds")).toBe(true);
    expect(isSafeBlogHref("http://example.test/page")).toBe(true);
    expect(isSafeBlogHref("mailto:research@example.test")).toBe(true);
    expect(isSafeBlogHref("/compounds/bpc-157")).toBe(true);
  });

  it("rejects javascript: however it is dressed up", () => {
    expect(isSafeBlogHref("javascript:alert(1)")).toBe(false);
    expect(isSafeBlogHref("JavaScript:alert(1)")).toBe(false);
    expect(isSafeBlogHref("  javascript:alert(1)")).toBe(false);
    // The URL parser strips tabs and newlines inside a scheme, which is
    // exactly why the check goes through it rather than through startsWith.
    expect(isSafeBlogHref("java\nscript:alert(1)")).toBe(false);
    expect(isSafeBlogHref("java\tscript:alert(1)")).toBe(false);
  });

  it("rejects data: and other schemes nobody asked for", () => {
    expect(isSafeBlogHref("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeBlogHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeBlogHref("file:///etc/passwd")).toBe(false);
  });

  it("rejects non-strings and blanks", () => {
    expect(isSafeBlogHref(undefined)).toBe(false);
    expect(isSafeBlogHref(null)).toBe(false);
    expect(isSafeBlogHref(42)).toBe(false);
    expect(isSafeBlogHref("")).toBe(false);
    expect(isSafeBlogHref("   ")).toBe(false);
  });

  it("treats a protocol-relative URL as absolute, not as a site path", () => {
    // "//evil.test/x" starts with a slash but resolves to another origin, so
    // it must not take the relative-link shortcut.
    expect(isSafeBlogHref("//evil.test/x")).toBe(false);
  });
});

describe("image safety", () => {
  it("accepts the https URLs the upload endpoint produces", () => {
    expect(isSafeBlogImageSrc("https://pub-abc.r2.dev/blog/body/x_y.png")).toBe(true);
  });

  it("rejects anything that isn't https", () => {
    expect(isSafeBlogImageSrc("http://example.test/x.png")).toBe(false);
    expect(isSafeBlogImageSrc("data:image/svg+xml;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeBlogImageSrc("javascript:alert(1)")).toBe(false);
    expect(isSafeBlogImageSrc("/uploads/x.png")).toBe(false);
    expect(isSafeBlogImageSrc("")).toBe(false);
    expect(isSafeBlogImageSrc(null)).toBe(false);
  });
});

describe("the renderer's whitelist", () => {
  it("has no node type that could carry markup or script", () => {
    for (const forbidden of ["script", "iframe", "html", "object", "embed", "style"]) {
      expect(ALLOWED_BLOG_NODES.has(forbidden), `"${forbidden}" must not be renderable`).toBe(
        false
      );
    }
  });

  it("offers no h1 in the body — the page owns that", () => {
    // Enforced in BlogContent, which clamps every heading to level 2 or 3.
    const source = readSource("client/src/components/BlogContent.tsx");
    expect(source).toContain("node.attrs?.level === 3 ? 3 : 2");
  });

  it("never hands a database string to the DOM as markup", () => {
    // The whole security argument rests on this prop never being used. Matched
    // as a JSX attribute so the file can still name it in a comment saying so.
    const source = readSource("client/src/components/BlogContent.tsx");
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it("keeps the mark list to formatting and links", () => {
    expect([...ALLOWED_BLOG_MARKS].sort()).toEqual([
      "bold",
      "code",
      "italic",
      "link",
      "strike",
      "underline",
    ]);
  });
});

describe("parseBlogDoc", () => {
  it("reads a stored document", () => {
    const doc = parseBlogDoc('{"type":"doc","content":[{"type":"paragraph"}]}');
    expect(doc).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("accepts an already-parsed object", () => {
    expect(parseBlogDoc({ type: "doc", content: [] })).toEqual({
      type: "doc",
      content: [],
    });
  });

  it("returns null rather than throwing on anything else", () => {
    // A post whose content column is empty, truncated mid-write, or holding
    // something that isn't a document renders an empty body — it does not
    // take the article page down.
    expect(parseBlogDoc(null)).toBeNull();
    expect(parseBlogDoc("")).toBeNull();
    expect(parseBlogDoc("   ")).toBeNull();
    expect(parseBlogDoc("{not json")).toBeNull();
    expect(parseBlogDoc('{"type":"paragraph"}')).toBeNull();
    expect(parseBlogDoc("[]")).toBeNull();
    expect(parseBlogDoc(42)).toBeNull();
  });

  it("normalises a document with no content array", () => {
    expect(parseBlogDoc('{"type":"doc"}')).toEqual({
      type: "doc",
      content: [],
    });
  });
});

describe("publishedAt", () => {
  const now = new Date("2026-09-04T12:00:00Z");
  const originally = new Date("2026-01-15T09:30:00Z");

  it("stamps the first publish", () => {
    expect(resolvePublishedAt("published", null, now)).toBe(now);
  });

  it("keeps the original date when a published post is saved again", () => {
    expect(resolvePublishedAt("published", originally, now)).toBe(originally);
  });

  it("keeps the date when a post is pulled back to draft", () => {
    // Unpublishing to fix a typo must not re-date the article on the way back
    // out — Google has already seen the original datePublished.
    expect(resolvePublishedAt("draft", originally, now)).toBe(originally);
  });

  it("leaves a never-published draft with no date", () => {
    expect(resolvePublishedAt("draft", null, now)).toBeNull();
  });
});

describe("slugifyBlogTitle", () => {
  it("builds a URL-safe slug", () => {
    expect(slugifyBlogTitle("How to Read a Certificate of Analysis")).toBe(
      "how-to-read-a-certificate-of-analysis"
    );
  });

  it("unfolds accents instead of dropping them", () => {
    expect(slugifyBlogTitle("Péptidos y almacenamiento")).toBe("peptidos-y-almacenamiento");
  });

  it("collapses punctuation and trims stray dashes", () => {
    expect(slugifyBlogTitle("  BPC-157: what's in a vial?  ")).toBe("bpc-157-what-s-in-a-vial");
  });

  it("returns an empty string when nothing survives, so the caller can object", () => {
    expect(slugifyBlogTitle("!!!")).toBe("");
    expect(slugifyBlogTitle("研究")).toBe("");
  });

  it("never exceeds the slug column, and never ends on a dash", () => {
    const slug = slugifyBlogTitle("word ".repeat(80));
    expect(slug.length).toBeLessThanOrEqual(220);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("descriptions", () => {
  it("uses the excerpt when there is one", () => {
    expect(blogDescription("A short summary.", "Some title")).toBe("A short summary.");
  });

  it("falls back to a sentence built from the title", () => {
    const description = blogDescription(null, "Reconstitution basics");
    expect(description).toContain("Reconstitution basics");
    expect(description.length).toBeGreaterThan(0);
  });

  it("treats a blank excerpt as no excerpt", () => {
    expect(blogDescription("   ", "Reconstitution basics")).toBe(
      blogDescription(null, "Reconstitution basics")
    );
  });

  it("stays inside what a search result will show", () => {
    const long = "Peptide handling and storage. ".repeat(20);
    const description = blogDescription(long, "Title");
    expect(description.length).toBeLessThanOrEqual(BLOG_DESCRIPTION_MAX_LENGTH);
  });

  it("cuts at a word boundary, not mid-word", () => {
    const source = "peptide handling and storage ".repeat(20);
    const collapsed = source.replace(/\s+/g, " ").trim();
    const description = blogDescription(source, "Title");
    const body = description.replace(/…$/, "");

    expect(description.endsWith("…")).toBe(true);
    expect(collapsed.startsWith(body)).toBe(true);
    // The character just past the cut is a space, so no word was sliced.
    expect(collapsed[body.length]).toBe(" ");
  });

  it("does not leave dangling punctuation in front of the ellipsis", () => {
    expect(truncateAtWord("alpha beta. gamma delta", 13)).toBe("alpha beta…");
  });

  it("still truncates a single unbroken run of characters", () => {
    const description = truncateAtWord("x".repeat(400), 40);
    expect(description.length).toBeLessThanOrEqual(40);
    expect(description.endsWith("…")).toBe(true);
  });

  it("collapses newlines so a multi-line excerpt stays one line in the tag", () => {
    expect(truncateAtWord("one\n\ntwo   three", 100)).toBe("one two three");
  });
});

describe("plain text and reading time", () => {
  const doc = parseBlogDoc(
    JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Storage" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Keep vials cold." }],
        },
      ],
    })
  );

  it("joins blocks with a space rather than fusing them", () => {
    expect(blogDocToPlainText(doc)).toBe("Storage Keep vials cold.");
  });

  it("is empty for an unreadable document", () => {
    expect(blogDocToPlainText(null)).toBe("");
  });

  it("never reports less than a minute", () => {
    expect(blogReadingMinutes(doc)).toBe(1);
    expect(blogReadingMinutes(null)).toBe(1);
  });

  it("scales with length", () => {
    const long = parseBlogDoc(
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "word ".repeat(1000) }],
          },
        ],
      })
    );
    expect(blogReadingMinutes(long)).toBe(5);
  });
});

describe("the public list cannot be talked into returning drafts", () => {
  const dbSource = readSource("server/db.ts");

  it("filters on status inside the published queries", () => {
    // Not a parameter with a default the client could override — the filter is
    // written into the query itself.
    for (const fn of [
      "getPublishedBlogPosts",
      "getPublishedBlogPostBySlug",
      "getPublishedBlogPostSlugs",
    ]) {
      const start = dbSource.indexOf(`export async function ${fn}`);
      expect(start, `${fn} is missing`).toBeGreaterThan(-1);
      const body = dbSource.slice(start, dbSource.indexOf("\nexport ", start + 1));
      expect(body, `${fn} must filter on published status`).toContain(
        'eq(blogPosts.status, "published")'
      );
    }
  });

  it("routes the public procedures at the published helpers", () => {
    const routers = readSource("server/routers.ts");
    const blogRouter = routers.slice(routers.indexOf("  blog: router({"));
    expect(blogRouter).toContain("list: publicProcedure");
    expect(blogRouter).toContain("getPublishedBlogPosts({");
    expect(blogRouter).toContain("getPublishedBlogPostBySlug(input.slug)");
    // The admin reads are behind adminProcedure, not a flag on the public one.
    expect(blogRouter).toContain("adminList: adminProcedure");
    expect(blogRouter).toContain("adminById: adminProcedure");
  });
});
