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
  isBlogPostLive,
  parseBlogDoc,
  resolvePublishedAt,
  resolveScheduledFor,
  slugifyBlogTitle,
  truncateAtWord,
} from "@shared/blog";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

  it("dates a scheduled post forward, to its release date", () => {
    // The whole point: every consumer of publishedAt — the listing's sort,
    // the byline, BlogPosting's datePublished, the sitemap — then works on a
    // scheduled article without knowing scheduling exists.
    const release = new Date("2026-10-14T13:00:00Z");
    expect(resolvePublishedAt("scheduled", null, now, release)).toBe(release);
  });

  it("does not re-date an already-published article being rescheduled", () => {
    const release = new Date("2026-10-14T13:00:00Z");
    expect(resolvePublishedAt("scheduled", originally, now, release)).toBe(originally);
  });

  it("leaves a scheduled post with no date alone rather than stamping now", () => {
    // The router rejects this combination outright; if one ever reaches here,
    // silently publishing it today would be the worse failure.
    expect(resolvePublishedAt("scheduled", null, now, null)).toBeNull();
  });
});

describe("scheduledFor", () => {
  const release = new Date("2026-10-14T13:00:00Z");

  it("keeps the date on a scheduled post", () => {
    expect(resolveScheduledFor("scheduled", release)).toBe(release);
  });

  it("clears the date on every other status", () => {
    // An article published early by hand must not keep a pending date — the
    // promoter would find it later and the admin would see a live article
    // flip back to "scheduled" for no reason anyone could explain.
    expect(resolveScheduledFor("published", release)).toBeNull();
    expect(resolveScheduledFor("draft", release)).toBeNull();
  });
});

describe("what counts as live", () => {
  const now = new Date("2026-10-14T13:00:00Z");

  it("shows a published article", () => {
    expect(isBlogPostLive("published", null, now)).toBe(true);
  });

  it("hides a draft, with or without a stray date", () => {
    expect(isBlogPostLive("draft", null, now)).toBe(false);
    expect(isBlogPostLive("draft", new Date("2020-01-01T00:00:00Z"), now)).toBe(false);
  });

  it("hides a scheduled article until its moment arrives", () => {
    expect(isBlogPostLive("scheduled", new Date("2026-10-14T13:00:01Z"), now)).toBe(false);
    expect(isBlogPostLive("scheduled", new Date("2026-10-16T13:00:00Z"), now)).toBe(false);
  });

  it("shows it from that moment on", () => {
    // Inclusive at the boundary: an article scheduled for 9:00 is live at
    // 9:00, not at 9:00:01.
    expect(isBlogPostLive("scheduled", now, now)).toBe(true);
    expect(isBlogPostLive("scheduled", new Date("2026-10-09T13:00:00Z"), now)).toBe(true);
  });

  it("never shows a scheduled article with no date", () => {
    expect(isBlogPostLive("scheduled", null, now)).toBe(false);
  });
});

describe("the scheduler is housekeeping, not the mechanism", () => {
  const dbSource = readSource("server/db.ts");

  it("promotes only posts whose date has passed, and does it idempotently", () => {
    const start = dbSource.indexOf("export async function promoteDueBlogPosts");
    expect(start, "promoteDueBlogPosts is missing").toBeGreaterThan(-1);
    const body = dbSource.slice(start, dbSource.indexOf("\nexport ", start + 1));

    // Excluding rows a previous run already converted is what makes a second
    // process, or a restart mid-sweep, harmless.
    expect(body).toContain('eq(blogPosts.status, "scheduled")');
    expect(body).toContain("lte(blogPosts.scheduledFor");

    // publishedAt is set when the post is scheduled and must not be touched
    // here — rewriting it on promotion would move the date Google indexed.
    expect(body).not.toContain("publishedAt:");
  });

  it("does not gate public visibility on the promoter having run", () => {
    // The regression this guards against is someone "simplifying"
    // blogIsPublic down to a status check, which would make every article's
    // release depend on a background timer nobody is watching at 9am.
    const start = dbSource.indexOf("const blogIsPublic");
    const fragment = dbSource.slice(start, dbSource.indexOf(";", start));
    expect(fragment).toContain("scheduledFor");
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

  it("filters on visibility inside the published queries", () => {
    // Not a parameter with a default the client could override — the filter is
    // written into the query itself. It used to read
    // `eq(blogPosts.status, "published")`; since scheduling landed the same
    // rule lives in one SQL fragment, which is what these must apply.
    for (const fn of [
      "getPublishedBlogPosts",
      "getPublishedBlogPostBySlug",
      "getPublishedBlogPostSlugs",
    ]) {
      const start = dbSource.indexOf(`export async function ${fn}`);
      expect(start, `${fn} is missing`).toBeGreaterThan(-1);
      const body = dbSource.slice(start, dbSource.indexOf("\nexport ", start + 1));
      expect(body, `${fn} must filter on blogIsPublic`).toContain("blogIsPublic");
      expect(body, `${fn} must not hand-roll the status filter`).not.toContain(
        'eq(blogPosts.status, "published")'
      );
    }
  });

  it("defines visibility once, and a pending article is not part of it", () => {
    const start = dbSource.indexOf("const blogIsPublic");
    expect(start, "blogIsPublic is missing").toBeGreaterThan(-1);
    const fragment = dbSource.slice(start, dbSource.indexOf(";", start));

    // A published post is live, and a scheduled one only once its date has
    // passed. The `is not null` guard matters on its own: in MySQL a NULL
    // comparison is NULL rather than false, but a scheduled row with no date
    // is a bug worth excluding explicitly rather than relying on that.
    expect(fragment).toContain("'published'");
    expect(fragment).toContain("'scheduled'");
    expect(fragment).toContain("is not null");
    expect(fragment).toContain("<= now()");
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

/**
 * The admin editor's save path, end to end.
 *
 * blog_posts.content is a MySQL `json` column, so mysql2 hands the document
 * back already parsed: the string the editor saved returns as an object. Every
 * write that follows a read — reopening an article, flipping a draft to
 * published — therefore carries an object where the create path carried a
 * string, and both shapes have to clear the input contract. When only the
 * string does, an article can be saved solely by retyping its body from
 * scratch.
 *
 * These run without DATABASE_URL (dotenv is loaded by the server entrypoint,
 * not by vitest), so getDb() returns null and nothing here can reach a real
 * database. Every call that clears validation dies afterwards at the data
 * layer instead, which is exactly the signal these tests read.
 */
describe("the admin editor's round trip: create → edit → publish", () => {
  const DOC = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Reconstitution and storage." }] },
    ],
  };
  /** What BlogEditor emits: JSON.stringify(editor.getJSON()). */
  const AS_SAVED = JSON.stringify(DOC);

  /** What a read of the json column returns, forced past an input type that still says string. */
  const asStored = (doc: object) => doc as unknown as string;

  function adminCaller() {
    const ctx = {
      user: {
        id: 1,
        openId: "admin_test",
        email: "admin@biolab.com",
        name: "Admin User",
        loginMethod: "email",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: { cookie: () => {}, clearCookie: () => {} },
    } as unknown as TrpcContext;
    return appRouter.createCaller(ctx);
  }

  /**
   * The message of an input-contract refusal, or null when the payload was
   * accepted. A NOT_FOUND or a raw "DB unavailable" means validation passed
   * and the call only failed for want of a database, which is success here.
   */
  async function inputRejection(call: () => Promise<unknown>) {
    try {
      await call();
      return null;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      return e?.code === "BAD_REQUEST" ? e.message ?? "rejected" : null;
    }
  }

  it("creates an article from the string the editor emits", async () => {
    const rejection = await inputRejection(() =>
      adminCaller().blog.create({
        title: "How to read a Certificate of Analysis",
        content: AS_SAVED,
        status: "draft",
      })
    );
    expect(rejection).toBeNull();
  });

  it("edits an article whose body came back from the database as an object", async () => {
    const rejection = await inputRejection(() =>
      adminCaller().blog.update({
        id: 1,
        title: "How to read a Certificate of Analysis",
        content: asStored(DOC),
        status: "draft",
      })
    );
    expect(rejection).toBeNull();
  });

  it("publishes a draft nobody retyped, body still the object the read returned", async () => {
    // The reported failure: open a draft, change nothing but the status, save.
    const rejection = await inputRejection(() =>
      adminCaller().blog.update({
        id: 1,
        content: asStored(DOC),
        status: "published",
      })
    );
    expect(rejection).toBeNull();
  });

  it("still refuses a body that is not a ProseMirror document", async () => {
    // Asserted through create, not update: update checks the row exists before
    // it looks at the content, so without a database it answers NOT_FOUND long
    // before any body would be judged.
    //
    // Widening the contract must not become "accept anything": a bare
    // paragraph is not a document, in either shape, and neither is a string
    // that does not parse.
    const invalid = [asStored({ type: "paragraph" }), "{not json", asStored([])];
    for (const content of invalid) {
      expect(
        await inputRejection(() =>
          adminCaller().blog.create({ title: "Draft", content, status: "draft" })
        ),
        `${JSON.stringify(content)} should not be storable as an article body`
      ).not.toBeNull();
    }
  });
});
