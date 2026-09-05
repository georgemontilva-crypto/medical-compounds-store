import { Fragment, type ReactNode } from "react";
import {
  ALLOWED_BLOG_MARKS,
  ALLOWED_BLOG_NODES,
  blogNodeChildren,
  isSafeBlogHref,
  isSafeBlogImageSrc,
  parseBlogDoc,
  type BlogDoc,
  type BlogNode,
} from "@shared/blog";

/**
 * Renders a stored article body.
 *
 * The security property this component exists to hold: **no string from the
 * database is ever interpreted as markup.** There is no `dangerouslySetInnerHTML`
 * here and there must never be one. The stored content is a ProseMirror node
 * tree (see drizzle/schema.ts), and this walks it, matching each node against
 * a whitelist and emitting a React element. Text reaches the page as a React
 * child, which React escapes.
 *
 * That makes the usual injection routes structurally unavailable rather than
 * filtered: a `<script>` in an article can only exist as *text* inside a
 * paragraph, where it renders as the visible characters `<script>`. A node
 * type nobody wrote a case for — however it got into the column — falls
 * through to null.
 *
 * The two places a string does reach the DOM as something other than text are
 * a link's href and an image's src, and both go through the guards in
 * shared/blog.ts (`javascript:` and `data:` rejected, `https:` only for
 * images). server/blog.test.ts covers them.
 */

type Props = {
  /** The raw `blog_posts.content` value: a JSON string, or already parsed. */
  content: unknown;
  className?: string;
};

/** Marks wrap the text they apply to, innermost first. */
function applyMarks(node: BlogNode, text: ReactNode): ReactNode {
  const marks = Array.isArray(node.marks) ? (node.marks as BlogNode[]) : [];
  let result = text;

  for (const mark of marks) {
    const type = typeof mark.type === "string" ? mark.type : "";
    if (!ALLOWED_BLOG_MARKS.has(type)) continue;

    switch (type) {
      case "bold":
        result = <strong className="font-semibold">{result}</strong>;
        break;
      case "italic":
        result = <em>{result}</em>;
        break;
      case "underline":
        result = <u>{result}</u>;
        break;
      case "strike":
        result = <s>{result}</s>;
        break;
      case "code":
        result = (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-800 dark:bg-white/10 dark:text-gray-200">
            {result}
          </code>
        );
        break;
      case "link": {
        const href = mark.attrs?.href;
        // An unsafe href drops the anchor, not the text: the words stay
        // readable, they just stop being clickable.
        if (!isSafeBlogHref(href)) break;
        const external = !href.startsWith("/");
        result = (
          <a
            href={href}
            className="font-medium text-[#b8943a] underline underline-offset-2 hover:text-[#C8A84B]"
            {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          >
            {result}
          </a>
        );
        break;
      }
    }
  }

  return result;
}

function renderChildren(node: BlogNode): ReactNode[] {
  return blogNodeChildren(node).map((child, index) => (
    <Fragment key={index}>{renderNode(child)}</Fragment>
  ));
}

function renderNode(node: BlogNode): ReactNode {
  const type = typeof node.type === "string" ? node.type : "";
  if (!ALLOWED_BLOG_NODES.has(type)) return null;

  switch (type) {
    case "text":
      return typeof node.text === "string" ? applyMarks(node, node.text) : null;

    case "paragraph": {
      const children = renderChildren(node);
      // An empty paragraph is how the editor represents a blank line.
      if (children.length === 0) return null;
      return <p className="mb-5 leading-[1.75] text-gray-700 dark:text-gray-300">{children}</p>;
    }

    case "heading": {
      // Clamped to h2/h3. The page owns the h1 — it comes from the post title,
      // and seoMeta.ts writes that same string into the served HTML.
      const level = node.attrs?.level === 3 ? 3 : 2;
      const children = renderChildren(node);
      return level === 2 ? (
        <h2 className="mt-10 mb-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {children}
        </h2>
      ) : (
        <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
          {children}
        </h3>
      );
    }

    case "bulletList":
      return (
        <ul className="mb-5 list-disc space-y-2 pl-6 text-gray-700 dark:text-gray-300">
          {renderChildren(node)}
        </ul>
      );

    case "orderedList":
      return (
        <ol className="mb-5 list-decimal space-y-2 pl-6 text-gray-700 dark:text-gray-300">
          {renderChildren(node)}
        </ol>
      );

    case "listItem":
      // The paragraph inside a list item would otherwise add its own bottom
      // margin between bullets, so it renders tight here.
      return <li className="leading-[1.7] [&>p]:mb-0">{renderChildren(node)}</li>;

    case "blockquote":
      return (
        <blockquote className="mb-5 border-l-2 border-[#dbcfba] pl-5 italic text-gray-600 dark:text-gray-400">
          {renderChildren(node)}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre className="mb-5 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100">
          <code>{renderChildren(node)}</code>
        </pre>
      );

    case "horizontalRule":
      return <hr className="my-10 border-gray-200 dark:border-border" />;

    case "hardBreak":
      return <br />;

    case "image": {
      const src = node.attrs?.src;
      if (!isSafeBlogImageSrc(src)) return null;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return (
        <figure className="my-8">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-full rounded-2xl border border-gray-100 dark:border-border"
          />
          {alt ? (
            <figcaption className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              {alt}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    default:
      return null;
  }
}

export default function BlogContent({ content, className }: Props) {
  const doc: BlogDoc | null = parseBlogDoc(content);
  if (!doc || doc.content.length === 0) return null;

  return (
    <div className={className}>
      {doc.content.map((node, index) => (
        <Fragment key={index}>{renderNode(node)}</Fragment>
      ))}
    </div>
  );
}
