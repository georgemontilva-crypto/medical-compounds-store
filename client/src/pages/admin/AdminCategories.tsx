import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Tag, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type CatForm = { name: string; slug: string; description: string; color: string };
const emptyForm: CatForm = { name: "", slug: "", description: "", color: "#6366f1" };

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b",
];

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<CatForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: categories, isLoading } = trpc.categories.list.useQuery();

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setForm(emptyForm); setShowForm(false); toast.success("Category created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setForm(emptyForm); setEditingId(null); setShowForm(false); toast.success("Category updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCategory = trpc.categories.delete.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); toast.success("Category deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateCategory.mutate({ id: editingId, ...form });
    } else {
      createCategory.mutate(form);
    }
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="lab-section-title mb-1">Catalog</p>
            <h1 className="text-2xl font-bold">Categories</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
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
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
                    required
                    placeholder="Tissue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Slug *</label>
                  <input
                    className="lab-input"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                    placeholder="tissue"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <input
                  className="lab-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Category description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-7 h-7 rounded-full cursor-pointer border border-border"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createCategory.isPending || updateCategory.isPending}
                  className="lab-btn-primary"
                >
                  {(createCategory.isPending || updateCategory.isPending) ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Check size={14} /> {editingId ? "Update" : "Create"}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                  className="lab-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="lab-card p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : !categories || categories.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <Tag size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No categories yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="lab-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color ?? "#6366f1" }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(cat.id);
                      setForm({
                        name: cat.name,
                        slug: cat.slug,
                        description: cat.description ?? "",
                        color: cat.color ?? "#6366f1",
                      });
                      setShowForm(true);
                    }}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Pencil size={13} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this category?")) deleteCategory.mutate({ id: cat.id }); }}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
