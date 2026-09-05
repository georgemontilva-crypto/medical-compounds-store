import { useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Tags } from "lucide-react";
import { toast } from "sonner";
import { slugifyBlogTitle } from "@shared/blog";

type CategoryForm = { name: string; slug: string; description: string };
const emptyForm: CategoryForm = { name: "", slug: "", description: "" };

export default function AdminBlogCategories() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
    postCount: number;
  } | null>(null);

  const { data: categories, isLoading } = trpc.blog.adminCategories.useQuery();

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const invalidate = () => {
    utils.blog.adminCategories.invalidate();
    utils.blog.categories.invalidate();
    utils.blog.adminList.invalidate();
  };

  const createCategory = trpc.blog.createCategory.useMutation({
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Category created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCategory = trpc.blog.updateCategory.useMutation({
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Category updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCategory = trpc.blog.deleteCategory.useMutation({
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success("Category deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
    };
    if (editingId) updateCategory.mutate({ id: editingId, ...payload });
    else createCategory.mutate(payload);
  }

  const saving = createCategory.isPending || updateCategory.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/blog">
              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 mb-1 dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft size={13} />
                Blog
              </button>
            </Link>
            <h1 className="text-2xl font-bold">Blog Categories</h1>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="lab-btn-primary"
          >
            <Plus size={16} />
            New Category
          </button>
        </div>

        {showForm && (
          <div className="lab-card p-6">
            <h2 className="font-semibold text-lg mb-5">
              {editingId ? "Edit Category" : "Create Category"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input
                    className="lab-input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value,
                        // Renaming an existing category leaves its slug alone —
                        // the URL is already out there.
                        slug: editingId ? f.slug : slugifyBlogTitle(e.target.value),
                      }))
                    }
                    required
                    placeholder="Handling & Storage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Slug *</label>
                  <input
                    className="lab-input"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                    placeholder="handling-and-storage"
                  />
                  <p className="text-xs text-gray-400 mt-1">/blog?category={form.slug || "…"}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  className="lab-input min-h-[70px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={1000}
                  placeholder="Optional — an internal note about what belongs here."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="lab-btn-primary">
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editingId ? "Save changes" : "Create category"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="lab-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="animate-spin mx-auto" size={20} />
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 dark:bg-white/10">
                <Tags size={22} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">No categories yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-5 py-3 font-semibold">Slug</th>
                    <th className="px-5 py-3 font-semibold">Articles</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-border">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50/60 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-xs text-gray-400 truncate max-w-md">
                            {category.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{category.slug}</td>
                      <td className="px-5 py-3 text-gray-500">{category.postCount}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setForm({
                                name: category.name,
                                slug: category.slug,
                                description: category.description ?? "",
                              });
                              setEditingId(category.id);
                              setShowForm(true);
                            }}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setPendingDelete({
                                id: category.id,
                                name: category.name,
                                postCount: Number(category.postCount),
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

      {/*
        Deleting a category never touches an article. The dialog says how many
        lose the tag so the scope is visible before confirming, which is the
        protection here rather than blocking the action.
      */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl dark:bg-card">
            <h3 className="font-semibold text-lg mb-2">Delete “{pendingDelete.name}”?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pendingDelete.postCount === 0
                ? "No articles use this category."
                : `This will remove the category from ${pendingDelete.postCount} article${
                    pendingDelete.postCount === 1 ? "" : "s"
                  }.`}{" "}
              The articles themselves are not affected.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setPendingDelete(null)}
                className="text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCategory.mutate({ id: pendingDelete.id })}
                disabled={deleteCategory.isPending}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-60"
              >
                {deleteCategory.isPending && <Loader2 size={15} className="animate-spin" />}
                Delete category
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
