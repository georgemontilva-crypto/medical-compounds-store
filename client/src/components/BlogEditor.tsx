import { useCallback, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Link2Off,
  Image as ImageIcon,
  Minus,
  Undo2,
  Redo2,
  Loader2,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { isSafeBlogHref } from "@shared/blog";

/**
 * The admin's article editor.
 *
 * Only ever imported through React.lazy from AdminBlog, which is what keeps
 * TipTap and ProseMirror (~115 kB gzipped) out of the bundle a shop visitor
 * downloads. Nothing on the public side imports this file.
 *
 * It hands back `JSON.stringify(editor.getJSON())` rather than HTML. See
 * BlogContent.tsx for the other half of that decision.
 */

type Props = {
  /** Stringified ProseMirror document, or null for a new post. */
  value: string | null;
  onChange: (json: string) => void;
};

// Not h1: the article's h1 is its title, rendered by the page and written into
// the served HTML by seoMeta.ts. Offering a second one in the body would let a
// well-meaning author quietly break the page's structure.
const HEADING_LEVELS = [2, 3] as const;

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active ?? false}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-[#dbcfba] text-gray-900"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-border" />;
}

function Toolbar({ editor, onInsertImage }: { editor: Editor; onInsertImage: () => void }) {
  // Subscribing to just the flags the toolbar draws, so typing a paragraph
  // doesn't re-render every button on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link URL", previous ?? "https://");

    // Cancelled — leave the document alone.
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // The same guard the public renderer applies, run here so the author is
    // told now rather than finding a dead link on the live page.
    if (!isSafeBlogHref(trimmed)) {
      toast.error("That link can't be used — enter an http(s), mailto, or /site-relative URL");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/70 px-2 py-1.5 dark:border-border dark:bg-white/5">
      {HEADING_LEVELS.map((level) => (
        <ToolbarButton
          key={level}
          title={`Heading ${level}`}
          active={level === 2 ? state.h2 : state.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          H{level}
        </ToolbarButton>
      ))}
      <ToolbarButton
        title="Paragraph"
        active={!state.h2 && !state.h3}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        ¶
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 size={15} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Bulleted list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={15} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="Add or edit link" active={state.link} onClick={setLink}>
        <LinkIcon size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Remove link"
        disabled={!state.link}
        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
      >
        <Link2Off size={15} />
      </ToolbarButton>
      <ToolbarButton title="Insert image" onClick={onInsertImage}>
        <ImageIcon size={15} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={15} />
      </ToolbarButton>
    </div>
  );
}

export default function BlogEditor({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadImage = trpc.blog.uploadImage.useMutation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [...HEADING_LEVELS] },
        link: {
          openOnClick: false,
          autolink: true,
          // Matches shared/blog.ts, so the editor can't produce a link the
          // renderer would then refuse to draw.
          protocols: ["http", "https", "mailto"],
        },
      }),
      // allowBase64 off: an image has to go through the upload endpoint and
      // end up on R2. A pasted data: URI would inflate the row and then be
      // dropped by the renderer's https-only check anyway.
      Image.configure({ inline: false, allowBase64: false }),
    ],
    // Parsing failures are the editor's business — an unreadable document
    // opens blank rather than throwing inside a hook.
    content: (() => {
      if (!value) return "";
      try {
        return JSON.parse(value);
      } catch {
        return "";
      }
    })(),
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] px-5 py-4 focus:outline-none text-gray-800 dark:text-gray-200 leading-[1.75] [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[#dbcfba] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_a]:text-[#b8943a] [&_a]:underline [&_img]:rounded-xl [&_img]:my-4 [&_hr]:my-6",
      },
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!editor) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files can be inserted");
        return;
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(",")[1];
          const { url } = await uploadImage.mutateAsync({
            kind: "body",
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type,
          });
          // Alt text defaults to the filename minus its extension; the author
          // can rewrite it, and an empty alt is better than a wrong one.
          const alt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
          editor.chain().focus().setImage({ src: url, alt }).run();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [editor, uploadImage]
  );

  if (!editor) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-gray-200 dark:border-border">
        <Loader2 className="animate-spin text-gray-300" size={20} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
      <Toolbar editor={editor} onInsertImage={() => fileInputRef.current?.click()} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so re-picking the same file fires change again.
          e.target.value = "";
        }}
      />

      <div className="relative">
        <EditorContent editor={editor} />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/40">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              <Loader2 className="animate-spin" size={16} />
              Uploading image…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
