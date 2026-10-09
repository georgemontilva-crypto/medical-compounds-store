import { Suspense, lazy, useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Tags,
  ExternalLink,
  CalendarClock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BLOG_DESCRIPTION_MAX_LENGTH,
  slugifyBlogTitle,
  type BlogNode,
  type BlogStatus,
} from "@shared/blog";

/**
 * TipTap and ProseMirror are ~115 kB gzipped. Loading them lazily keeps them
 * out of the main bundle, which every shop visitor downloads and no shop
 * visitor can open this page.
 */
const BlogEditor = lazy(() => import("@/components/BlogEditor"));

type PostForm = {
  title: string;
  slug: string;
  excerpt: string;
  /** A string once the editor has touched it; the object a read returned until then. */
  content: string | BlogNode;
  coverImageUrl: string;
  coverImageKey: string;
  status: BlogStatus;
  /**
   * The release date, in the `datetime-local` format the input wants
   * ("2026-10-14T09:00") and in the admin's own timezone. Converted to a real
   * instant on submit; empty for anything that isn't scheduled.
   */
  scheduledFor: string;
  categoryIds: number[];
};

const emptyForm: PostForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  coverImageKey: "",
  status: "draft",
  scheduledFor: "",
  categoryIds: [],
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Date and time, for a schedule where the hour is part of the decision. */
function formatDateTime(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A Date to the string `<input type="datetime-local">` accepts.
 *
 * Built from the local getters rather than toISOString(), which would shift
 * the value by the timezone offset and show an admin in Caracas a 1pm release
 * for an article going out at 9am.
 */
function toDateTimeLocal(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The next Monday, Wednesday or Friday at 9am — the cycle's publishing
 * rhythm — used as the default when an article is first switched to
 * scheduled. Only a starting point; the admin can move it.
 */
function nextWeekdayMorning(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  // Strictly in the future: scheduling for a moment that has already passed
  // would publish the article the instant it was saved.
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  while (![1, 3, 5].includes(next.getDay())) next.setDate(next.getDate() + 1);
  return next;
}

function StatusBadge({
  status,
  scheduledFor,
}: {
  status: BlogStatus;
  scheduledFor: Date | string | null;
}) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
        <Eye size={11} />
        Published
      </span>
    );
  }

  if (status === "scheduled") {
    // A scheduled post whose date has passed is already public — the server
    // decides that per request and the promoter converts the row within a few
    // minutes. Saying "Scheduled" about a live article would be a lie, so the
    // badge checks the clock rather than trusting the stored status.
    const live = scheduledFor !== null && new Date(scheduledFor).getTime() <= Date.now();
    if (live) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
          <Eye size={11} />
          Published
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full dark:bg-amber-500/10 dark:text-amber-400">
        <CalendarClock size={11} />
        {formatDateTime(scheduledFor)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full dark:bg-white/10 dark:text-gray-400">
      <EyeOff size={11} />
      Draft
    </span>
  );
}

export default function AdminBlog() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const { data: posts, isLoading } = trpc.blog.adminList.useQuery();
  const { data: categories = [] } = trpc.blog.adminCategories.useQuery();

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const createPost = trpc.blog.create.useMutation({
    onSuccess: () => {
      utils.blog.adminList.invalidate();
      utils.blog.adminCategories.invalidate();
      resetForm();
      toast.success("Article created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePost = trpc.blog.update.useMutation({
    onSuccess: () => {
      utils.blog.adminList.invalidate();
      utils.blog.adminCategories.invalidate();
      resetForm();
      toast.success("Article saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePost = trpc.blog.delete.useMutation({
    onSuccess: () => {
      utils.blog.adminList.invalidate();
      utils.blog.adminCategories.invalidate();
      setPendingDelete(null);
      toast.success("Article deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.blog.uploadImage.useMutation();

  /**
   * Publishing straight from the list, without opening the editor. Only the
   * status is sent, so the server keeps everything else — including the
   * original publishedAt when an article is being restored.
   *
   * Its own mutation rather than reusing `updatePost`: that one closes the
   * form on success, which would throw away an edit in progress on a
   * different article.
   */
  const toggleStatus = trpc.blog.update.useMutation({
    onSuccess: (_data, variables) => {
      utils.blog.adminList.invalidate();
      toast.success(variables.status === "published" ? "Article published" : "Moved to draft");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCoverUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Cover must be an image");
      return;
    }
    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(",")[1];
        const { url, key } = await uploadImage.mutateAsync({
          kind: "cover",
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type,
        });
        setForm((f) => ({ ...f, coverImageUrl: url, coverImageKey: key }));
        toast.success("Cover uploaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadingCover(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function startEdit(id: number) {
    try {
      const post = await utils.blog.adminById.fetch({ id });
      if (!post) {
        toast.error("Article not found");
        return;
      }
      setForm({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? "",
        content: post.content ?? "",
        coverImageUrl: post.coverImageUrl ?? "",
        coverImageKey: post.coverImageKey ?? "",
        status: post.status,
        scheduledFor: toDateTimeLocal(post.scheduledFor),
        categoryIds: post.categories.map((c) => c.id),
      });
      setEditingId(id);
      setShowForm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the article");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.status === "scheduled" && !form.scheduledFor) {
      toast.error("Pick a date and time for the scheduled article");
      return;
    }

    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      content: form.content,
      coverImageUrl: form.coverImageUrl || null,
      coverImageKey: form.coverImageKey || null,
      status: form.status,
      // `new Date("2026-10-14T09:00")` reads as local time, which is what the
      // admin typed and meant. Sent as an ISO instant so the server stores
      // the moment rather than a wall clock the database would reinterpret.
      scheduledFor:
        form.status === "scheduled" && form.scheduledFor
          ? new Date(form.scheduledFor).toISOString()
          : null,
      categoryIds: form.categoryIds,
    };

    if (editingId) updatePost.mutate({ id: editingId, ...payload });
    else createPost.mutate(payload);
  }

  const saving = createPost.isPending || updatePost.isPending;
  const excerptLength = form.excerpt.trim().length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="lab-section-title mb-1">Content</p>
            <h1 className="text-2xl font-bold">Blog</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/blog/categories">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 dark:border-border dark:hover:bg-white/5">
                <Tags size={15} />
                Categories
              </button>
            </Link>
            <button
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
              className="lab-btn-primary"
            >
              <Plus size={16} />
              New Article
            </button>
          </div>
        </div>

        {showForm && (
          <div className="lab-card p-6">
            <h2 className="font-semibold text-lg mb-5">
              {editingId ? "Edit Article" : "Create Article"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Title *</label>
                  <input
                    className="lab-input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        title: e.target.value,
                        // Only auto-fill the slug for a new article. Rewriting
                        // it on an existing one would break a live URL.
                        slug: editingId ? f.slug : slugifyBlogTitle(e.target.value),
                      }))
                    }
                    required
                    placeholder="How to read a Certificate of Analysis"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Slug *</label>
                  <input
                    className="lab-input"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                    placeholder="how-to-read-a-certificate-of-analysis"
                  />
                  <p className="text-xs text-gray-400 mt-1">/blog/{form.slug || "…"}</p>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-sm font-medium">Excerpt</label>
                  <span
                    className={`text-xs ${
                      excerptLength > BLOG_DESCRIPTION_MAX_LENGTH
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                  >
                    {excerptLength}/{BLOG_DESCRIPTION_MAX_LENGTH} shown in search results
                  </span>
                </div>
                <textarea
                  className="lab-input min-h-[80px]"
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  maxLength={300}
                  placeholder="One or two sentences. Used on the blog index and as the page's meta description."
                />
                {excerptLength > BLOG_DESCRIPTION_MAX_LENGTH && (
                  <p className="text-xs text-amber-600 mt-1">
                    Google will cut this off around {BLOG_DESCRIPTION_MAX_LENGTH} characters. It
                    still shows in full on the blog index.
                  </p>
                )}
              </div>

              {/* Cover image */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Cover image</label>
                <div className="flex items-start gap-4">
                  {form.coverImageUrl ? (
                    <div className="relative">
                      <img
                        src={form.coverImageUrl}
                        alt=""
                        className="w-40 h-24 object-cover rounded-lg border border-gray-200 dark:border-border"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            coverImageUrl: "",
                            coverImageKey: "",
                          })
                        }
                        title="Remove cover"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:bg-card dark:border-border"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-40 h-24 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-300 dark:border-border">
                      <ImageIcon size={22} />
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 text-sm font-medium border border-gray-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-border dark:hover:bg-white/5">
                    {uploadingCover ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {uploadingCover ? "Uploading…" : "Upload cover"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Categories</label>
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No categories yet —{" "}
                    <Link href="/admin/blog/categories">
                      <span className="text-[#b8943a] hover:underline cursor-pointer">
                        create one
                      </span>
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => {
                      const selected = form.categoryIds.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              categoryIds: selected
                                ? f.categoryIds.filter((id) => id !== category.id)
                                : [...f.categoryIds, category.id],
                            }))
                          }
                          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? "bg-[#dbcfba] border-[#dbcfba] text-gray-900 font-medium"
                              : "border-gray-200 text-gray-600 hover:border-[#dbcfba] dark:border-border dark:text-gray-300"
                          }`}
                        >
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Article body</label>
                <Suspense
                  fallback={
                    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-gray-200 dark:border-border">
                      <Loader2 className="animate-spin text-gray-300" size={20} />
                    </div>
                  }
                >
                  <BlogEditor
                    // Remounts the editor when switching articles: TipTap
                    // takes `content` as an initial value, not a controlled
                    // prop, so without this the previous post's body would
                    // stay on screen.
                    key={editingId ?? "new"}
                    value={form.content || null}
                    onChange={(json) => setForm((f) => ({ ...f, content: json }))}
                  />
                </Suspense>
              </div>

              {/* Status + actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-border">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status</span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden dark:border-border">
                      {(["draft", "scheduled", "published"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              status,
                              // Switching to scheduled with no date yet lands
                              // on next Monday at 9am rather than an empty
                              // field: the publishing rhythm is Mon/Wed/Fri
                              // mornings, so that is the answer far more
                              // often than not.
                              scheduledFor:
                                status === "scheduled" && !f.scheduledFor
                                  ? toDateTimeLocal(nextWeekdayMorning())
                                  : f.scheduledFor,
                            }))
                          }
                          className={`text-sm px-3 py-1.5 capitalize transition-colors ${
                            form.status === status
                              ? "bg-[#dbcfba] text-gray-900 font-medium"
                              : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.status === "scheduled" && (
                    <label className="flex items-center gap-2 text-sm">
                      <CalendarClock size={15} className="text-gray-400" />
                      <input
                        type="datetime-local"
                        value={form.scheduledFor}
                        onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                        className="lab-input py-1.5 text-sm"
                      />
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="lab-btn-primary">
                    {saving && <Loader2 size={15} className="animate-spin" />}
                    {editingId ? "Save changes" : "Create article"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="lab-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="animate-spin mx-auto" size={20} />
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500">No articles yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Title</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Categories</th>
                    <th className="px-5 py-3 font-semibold">Published</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-border">
                  {posts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {post.coverImageUrl ? (
                            <img
                              src={post.coverImageUrl}
                              alt=""
                              className="w-12 h-9 object-cover rounded shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-9 rounded bg-gray-100 flex items-center justify-center shrink-0 dark:bg-white/10">
                              <ImageIcon size={14} className="text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{post.title}</p>
                            <p className="text-xs text-gray-400 truncate">/blog/{post.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={post.status} scheduledFor={post.scheduledFor} />
                      </td>
                      <td className="px-5 py-3">
                        {post.categories.length === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-300">
                            {post.categories.map((c) => c.name).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(post.publishedAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              toggleStatus.mutate({
                                id: post.id,
                                // The eye means "make it a draft" for
                                // anything currently public or pending, and
                                // "publish now" only for a draft. Sending
                                // scheduledFor: null with the draft is what
                                // cancels a schedule rather than leaving a
                                // date the promoter would act on later.
                                status: post.status === "draft" ? "published" : "draft",
                                ...(post.status === "scheduled" ? { scheduledFor: null } : {}),
                              })
                            }
                            disabled={toggleStatus.isPending}
                            title={
                              post.status === "draft"
                                ? "Publish"
                                : post.status === "scheduled"
                                  ? "Cancel schedule"
                                  : "Unpublish"
                            }
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
                          >
                            {post.status === "draft" ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          {post.status === "published" && (
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View live"
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                          <button
                            onClick={() => startEdit(post.id)}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setPendingDelete({
                                id: post.id,
                                title: post.title,
                              })
                            }
                            title="Delete"
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl dark:bg-card">
            <h3 className="font-semibold text-lg mb-2">Delete this article?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              “{pendingDelete.title}” will be permanently removed, along with its category
              assignments. This can't be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setPendingDelete(null)}
                className="text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePost.mutate({ id: pendingDelete.id })}
                disabled={deletePost.isPending}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-60"
              >
                {deletePost.isPending && <Loader2 size={15} className="animate-spin" />}
                Delete article
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
