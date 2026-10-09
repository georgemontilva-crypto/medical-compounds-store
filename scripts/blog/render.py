"""
Turns the article sources in this folder into the rows blog_posts expects.

The bodies are written as a small Markdown subset because that is what a
person can edit; the column stores a ProseMirror document, because that is
what the admin editor round-trips and what client/src/components/BlogContent.tsx
walks. This script is the one place that translation happens, so an article is
never hand-written as JSON.

Only the nodes and marks in shared/blog.ts are emitted. Anything the renderer
would drop silently is a build error here instead, where it is visible.

    python3 scripts/blog/render.py > scripts/blog/seed_articles.sql
"""

import json
import re
import sys
from datetime import datetime, timezone

# ─── Markdown subset → ProseMirror ───────────────────────────────────────────

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")


def inline(text):
    """Text with bold and links. Everything else is literal."""
    nodes = []

    def emit(chunk, marks):
        if chunk:
            node = {"type": "text", "text": chunk}
            if marks:
                node["marks"] = marks
            nodes.append(node)

    # Links first: a link label may contain bold, but a bold run containing a
    # whole link is not something these articles use.
    pos = 0
    for m in LINK_RE.finditer(text):
        emit_plain(nodes, text[pos : m.start()])
        emit(
            m.group(1),
            [{"type": "link", "attrs": {"href": m.group(2), "target": None, "rel": None}}],
        )
        pos = m.end()
    emit_plain(nodes, text[pos:])
    return nodes


def emit_plain(nodes, text):
    """A run with no link in it, still possibly carrying bold."""
    pos = 0
    for m in BOLD_RE.finditer(text):
        if text[pos : m.start()]:
            nodes.append({"type": "text", "text": text[pos : m.start()]})
        nodes.append({"type": "text", "text": m.group(1), "marks": [{"type": "bold"}]})
        pos = m.end()
    if text[pos:]:
        nodes.append({"type": "text", "text": text[pos:]})


def to_doc(markdown):
    """The article body as a ProseMirror doc."""
    content = []
    list_buffer = []

    def flush_list():
        nonlocal list_buffer
        if list_buffer:
            content.append(
                {
                    "type": "bulletList",
                    "content": [
                        {
                            "type": "listItem",
                            "content": [{"type": "paragraph", "content": inline(item)}],
                        }
                        for item in list_buffer
                    ],
                }
            )
            list_buffer = []

    for block in markdown.strip().split("\n\n"):
        block = block.strip()
        if not block:
            continue

        if block.startswith("- "):
            # A whole bullet list arrives as one block. A line starting with
            # "- " opens an item; anything else continues the one above, so an
            # item can wrap across lines the way prose does in these sources.
            for line in block.split("\n"):
                line = line.strip()
                if line.startswith("- "):
                    list_buffer.append(line[2:].strip())
                elif list_buffer:
                    list_buffer[-1] += " " + line
                else:
                    raise SystemExit(f"Ragged bullet list near: {line[:60]!r}")
            flush_list()
            continue

        flush_list()

        if block.startswith("### "):
            content.append(
                {"type": "heading", "attrs": {"level": 3}, "content": inline(block[4:].strip())}
            )
        elif block.startswith("## "):
            content.append(
                {"type": "heading", "attrs": {"level": 2}, "content": inline(block[3:].strip())}
            )
        elif block.startswith("# "):
            # The page supplies the h1 from the title; a second one in the body
            # undoes the per-route metadata work in seoMeta.ts.
            raise SystemExit(f"Level-1 heading in body: {block[:60]!r}")
        elif block.startswith("> "):
            content.append(
                {
                    "type": "blockquote",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": inline(
                                " ".join(l.lstrip("> ").strip() for l in block.split("\n"))
                            ),
                        }
                    ],
                }
            )
        else:
            content.append({"type": "paragraph", "content": inline(block.replace("\n", " "))})

    flush_list()
    return {"type": "doc", "content": content}


# ─── SQL ─────────────────────────────────────────────────────────────────────


def sql_string(value):
    if value is None:
        return "NULL"
    escaped = (
        value.replace("\\", "\\\\")
        .replace("'", "''")
        .replace("\n", "\\n")
        .replace("\r", "")
    )
    return f"'{escaped}'"


def sql_time(iso):
    """
    A UTC instant as a literal.

    Readable on purpose — you can check a release time by reading the file —
    which is only safe because the generated script pins the session to
    `+00:00` first. A TIMESTAMP literal is interpreted in the session's zone,
    so without that line the same file would store a different instant
    depending on where it was run, and an article would go live four hours
    early or late with nothing in the SQL to show why.
    """
    if iso is None:
        return "NULL"
    moment = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    return f"'{moment:%Y-%m-%d %H:%M:%S}'"


def words(markdown):
    return len(re.sub(r"[#>*\-\[\]()]", " ", markdown).split())


def render(articles, categories):
    out = []
    out.append("-- Generated by scripts/blog/render.py — do not edit by hand.")
    out.append(f"-- {len(articles)} articles, built {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC.")
    out.append("--")
    out.append("-- Release times below are UTC. 13:00 UTC is 9:00 AM in Caracas,")
    out.append("-- which is the cycle's publishing hour.")
    out.append("")
    out.append("SET time_zone = '+00:00';")
    out.append("START TRANSACTION;")
    out.append("")

    out.append("-- Categories, created only if they aren't there already.")
    for name, slug, description in categories:
        out.append(
            "INSERT INTO blog_categories (name, slug, description)\n"
            f"SELECT {sql_string(name)}, {sql_string(slug)}, {sql_string(description)}\n"
            "FROM DUAL WHERE NOT EXISTS "
            f"(SELECT 1 FROM blog_categories WHERE slug = {sql_string(slug)});"
        )
    out.append("")

    for a in articles:
        doc = to_doc(a["body"])
        if len(a["excerpt"]) > 300:
            raise SystemExit(f"Excerpt too long ({len(a['excerpt'])}): {a['slug']}")
        if len(a["title"]) > 200:
            raise SystemExit(f"Title too long: {a['slug']}")

        out.append(f"-- {a['slug']}  ·  {a['status']}  ·  ~{words(a['body'])} words")
        out.append(
            "INSERT INTO blog_posts\n"
            "  (title, slug, excerpt, content, status, publishedAt, scheduledFor, authorId)\n"
            "VALUES (\n"
            f"  {sql_string(a['title'])},\n"
            f"  {sql_string(a['slug'])},\n"
            f"  {sql_string(a['excerpt'])},\n"
            f"  {sql_string(json.dumps(doc, ensure_ascii=False))},\n"
            f"  {sql_string(a['status'])},\n"
            f"  {sql_time(a['publishedAt'])},\n"
            f"  {sql_time(a['scheduledFor'])},\n"
            "  NULL\n"
            ")\n"
            "ON DUPLICATE KEY UPDATE\n"
            "  title = VALUES(title), excerpt = VALUES(excerpt), content = VALUES(content),\n"
            "  status = VALUES(status), publishedAt = VALUES(publishedAt),\n"
            "  scheduledFor = VALUES(scheduledFor);"
        )

        for cat_slug in a["categories"]:
            out.append(
                "INSERT IGNORE INTO blog_post_categories (postId, categoryId)\n"
                f"SELECT p.id, c.id FROM blog_posts p JOIN blog_categories c\n"
                f"  ON c.slug = {sql_string(cat_slug)}\n"
                f"WHERE p.slug = {sql_string(a['slug'])};"
            )
        out.append("")

    out.append("COMMIT;")
    out.append("")
    out.append("-- What landed, and when each one goes live (times shown in UTC):")
    out.append(
        "SELECT id, slug, status, publishedAt, scheduledFor FROM blog_posts ORDER BY publishedAt;"
    )
    return "\n".join(out)


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    from articles import ARTICLES, CATEGORIES  # noqa: E402

    print(render(ARTICLES, CATEGORIES))
