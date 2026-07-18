import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatVariationValue } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  Upload,
  X,
  Check,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  basePrice: string;
  featured: boolean;
  active: boolean;
  mechanism: string;
  casNumber: string;
  excludeFromBulkDiscount: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  description: "",
  shortDescription: "",
  categoryId: "",
  basePrice: "",
  featured: false,
  active: true,
  mechanism: "",
  casNumber: "",
  excludeFromBulkDiscount: false,
};

type VariationForm = { unit: "mg" | "ml"; value: string; price: string; stock: string; sku: string };
const emptyVariation: VariationForm = { unit: "mg", value: "", price: "", stock: "0", sku: "" };

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [variationForm, setVariationForm] = useState<VariationForm>(emptyVariation);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = trpc.products.listAdmin.useQuery({});
  const { data: categories } = trpc.categories.list.useQuery();

  const createProduct = trpc.products.create.useMutation({
    onSuccess: (result) => {
      utils.products.listAdmin.invalidate();
      setForm(emptyForm);
      setShowForm(false);
      const insertId = (result as unknown as { insertId?: number })?.insertId;
      if (insertId) {
        setExpandedId(insertId);
        toast.success("Product created — scroll down to add images and variations");
      } else {
        toast.success("Product created");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.listAdmin.invalidate();
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("Product updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => { utils.products.listAdmin.invalidate(); toast.success("Product deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.products.uploadImage.useMutation({
    onSuccess: () => {
      utils.products.images.invalidate();
      toast.success("Image uploaded");
      setUploadingFor(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteImage = trpc.products.deleteImage.useMutation({
    onSuccess: () => { utils.products.images.invalidate(); toast.success("Image removed"); },
    onError: (e) => toast.error(e.message),
  });

  const createVariation = trpc.products.createVariation.useMutation({
    onSuccess: () => { utils.products.variations.invalidate(); setVariationForm(emptyVariation); toast.success("Variation added"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteVariation = trpc.products.deleteVariation.useMutation({
    onSuccess: () => { utils.products.variations.invalidate(); toast.success("Variation removed"); },
    onError: (e) => toast.error(e.message),
  });

  const updateVariation = trpc.products.updateVariation.useMutation({
    onSuccess: () => { utils.products.variations.invalidate(); toast.success("Variation updated"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
    };
    if (editingId) {
      updateProduct.mutate({ id: editingId, ...data });
    } else {
      createProduct.mutate(data);
    }
  };

  const startEdit = (p: { id: number; name: string; slug: string; description?: string | null; shortDescription?: string | null; categoryId?: number | null; basePrice: string; featured: boolean; active: boolean; mechanism?: string | null; casNumber?: string | null; excludeFromBulkDiscount?: boolean }) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      shortDescription: p.shortDescription ?? "",
      categoryId: p.categoryId?.toString() ?? "",
      basePrice: p.basePrice,
      featured: p.featured,
      active: p.active,
      mechanism: p.mechanism ?? "",
      casNumber: p.casNumber ?? "",
      excludeFromBulkDiscount: p.excludeFromBulkDiscount ?? false,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileUpload = async (productId: number, file: File, sortOrder: number, variationId?: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadImage.mutate({
        productId,
        variationId,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        sortOrder,
      });
    };
    reader.readAsDataURL(file);
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="lab-section-title mb-1">Catalog</p>
            <h1 className="text-2xl font-bold">Products</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="lab-btn-primary"
          >
            <Plus size={16} />
            New Product
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="lab-card p-6">
            <h2 className="font-semibold text-lg mb-5">
              {editingId ? "Edit Product" : "Create New Product"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Product Name *</label>
                  <input
                    className="lab-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
                    required
                    placeholder="BPC-157"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Slug *</label>
                  <input
                    className="lab-input"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                    placeholder="bpc-157"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Category</label>
                  <select
                    className="lab-input"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">No category</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Base Price ($) *</label>
                  <input
                    className="lab-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.basePrice}
                    onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                    required
                    placeholder="55.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">CAS Number</label>
                  <input
                    className="lab-input"
                    value={form.casNumber}
                    onChange={(e) => setForm({ ...form, casNumber: e.target.value })}
                    placeholder="137525-51-0"
                  />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.excludeFromBulkDiscount}
                      onChange={(e) => setForm({ ...form, excludeFromBulkDiscount: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Exclude from bulk volume discount</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Short Description</label>
                <input
                  className="lab-input"
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  placeholder="Brief product summary (max 500 chars)"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Full Description</label>
                <textarea
                  className="lab-input min-h-[100px] resize-none"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed product description..."
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Mechanism of Action</label>
                <textarea
                  className="lab-input min-h-[80px] resize-none"
                  value={form.mechanism}
                  onChange={(e) => setForm({ ...form, mechanism: e.target.value })}
                  placeholder="How this compound works..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="lab-btn-primary"
                >
                  {(createProduct.isPending || updateProduct.isPending) ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Check size={14} /> {editingId ? "Update Product" : "Create Product"}</>
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

        {/* Products list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="lab-card p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : !products || products.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <FlaskConical size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No products yet. Create your first compound.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                categories={categories}
                expanded={expandedId === product.id}
                onToggle={() => setExpandedId(expandedId === product.id ? null : product.id)}
                onEdit={() => startEdit(product)}
                onDelete={() => {
                  if (confirm("Delete this product?")) deleteProduct.mutate({ id: product.id });
                }}
                onUploadImage={(file, sortOrder, variationId) => handleFileUpload(product.id, file, sortOrder, variationId)}
                onDeleteImage={(id) => deleteImage.mutate({ id })}
                variationForm={variationForm}
                setVariationForm={setVariationForm}
                onAddVariation={() =>
                  createVariation.mutate({
                    productId: product.id,
                    unit: variationForm.unit,
                    value: variationForm.value,
                    price: variationForm.price,
                    stock: Number(variationForm.stock),
                    sku: variationForm.sku || undefined,
                  })
                }
                onDeleteVariation={(id) => deleteVariation.mutate({ id })}
                onUpdateVariation={(id, data) => updateVariation.mutate({ id, ...data })}
                fileInputRef={fileInputRef}
                uploadingFor={uploadingFor}
                setUploadingFor={setUploadingFor}
                isUploading={uploadImage.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function ProductRow({
  product,
  categories,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onUploadImage,
  onDeleteImage,
  variationForm,
  setVariationForm,
  onAddVariation,
  onDeleteVariation,
  onUpdateVariation,
  fileInputRef,
  uploadingFor,
  setUploadingFor,
  isUploading,
}: {
  product: { id: number; name: string; slug: string; basePrice: string; active: boolean; featured: boolean; categoryId?: number | null };
  categories?: Array<{ id: number; name: string }>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUploadImage: (file: File, sortOrder: number, variationId?: number) => void;
  onDeleteImage: (id: number) => void;
  variationForm: VariationForm;
  setVariationForm: (v: VariationForm) => void;
  onAddVariation: () => void;
  onDeleteVariation: (id: number) => void;
  onUpdateVariation: (id: number, data: { unit: "mg" | "ml"; value: string; price: string; stock: number }) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploadingFor: number | null;
  setUploadingFor: (id: number | null) => void;
  isUploading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}) {
  const { data: images } = trpc.products.images.useQuery({ productId: product.id }, { enabled: expanded });
  const { data: variations } = trpc.products.variations.useQuery({ productId: product.id }, { enabled: expanded });
  const category = categories?.find((c) => c.id === product.categoryId);

  const [nextOrder, setNextOrder] = useState(0);
  useEffect(() => {
    if (images) setNextOrder(images.length);
  }, [images]);

  const [editingVariationId, setEditingVariationId] = useState<number | null>(null);
  const [editVariationForm, setEditVariationForm] = useState<VariationForm>(emptyVariation);

  const startEditVariation = (v: { id: number; unit: "mg" | "ml"; value: string; price: string; stock: number }) => {
    setEditingVariationId(v.id);
    setEditVariationForm({ unit: v.unit, value: v.value, price: v.price, stock: String(v.stock), sku: "" });
  };

  const saveEditVariation = () => {
    if (editingVariationId == null) return;
    onUpdateVariation(editingVariationId, {
      unit: editVariationForm.unit,
      value: editVariationForm.value,
      price: editVariationForm.price,
      stock: Number(editVariationForm.stock),
    });
    setEditingVariationId(null);
  };

  return (
    <div className="lab-card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical size={14} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{product.name}</p>
              {product.featured && (
                <span className="lab-badge bg-yellow-100 text-yellow-700 text-[10px]">Featured</span>
              )}
              {!product.active && (
                <span className="lab-badge bg-secondary text-muted-foreground text-[10px]">Inactive</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {category?.name ?? "No category"} · ${Number(product.basePrice).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <Pencil size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 size={14} className="text-muted-foreground" />
          </button>
          <button onClick={onToggle} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-5 bg-secondary/20">
          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Images</p>
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Order</label>
                  <input
                    type="number"
                    min={0}
                    className="lab-input py-1 text-xs w-16"
                    value={nextOrder}
                    onChange={(e) => setNextOrder(Number(e.target.value))}
                  />
                </div>
                <label className="lab-btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                  <Upload size={12} />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setUploadingFor(product.id); onUploadImage(file, nextOrder); }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            {isUploading && uploadingFor === product.id && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 size={14} className="animate-spin" /> Uploading...
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {images && images.length > 0 ? (
                images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.url}
                      alt={img.altText ?? ""}
                      className="w-16 h-16 rounded-xl object-cover border border-border"
                    />
                    <span className="absolute -bottom-1.5 -left-1.5 w-5 h-5 bg-card border border-border text-[10px] font-bold rounded-full flex items-center justify-center text-muted-foreground">
                      {img.sortOrder}
                    </span>
                    <button
                      onClick={() => onDeleteImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon size={14} />
                  No images yet
                </div>
              )}
            </div>
          </div>

          {/* Variations */}
          <div>
            <p className="text-sm font-semibold mb-3">Variations (MG / ML)</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {variations && variations.length > 0 ? (
                variations.map((v) => {
                  const variationImage = images?.find((img) => img.variationId === v.id);

                  if (editingVariationId === v.id) {
                    return (
                      <div
                        key={v.id}
                        className="flex flex-wrap gap-2 items-end bg-card border border-primary rounded-xl px-3 py-2"
                      >
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Unit</label>
                          <select
                            className="lab-input py-1.5 text-xs w-20"
                            value={editVariationForm.unit}
                            onChange={(e) => setEditVariationForm({ ...editVariationForm, unit: e.target.value as "mg" | "ml" })}
                          >
                            <option value="mg">mg</option>
                            <option value="ml">ml</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Value</label>
                          <input
                            className="lab-input py-1.5 text-xs w-20"
                            type="number"
                            step="0.01"
                            value={editVariationForm.value}
                            onChange={(e) => setEditVariationForm({ ...editVariationForm, value: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Price ($)</label>
                          <input
                            className="lab-input py-1.5 text-xs w-24"
                            type="number"
                            step="0.01"
                            value={editVariationForm.price}
                            onChange={(e) => setEditVariationForm({ ...editVariationForm, price: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Stock</label>
                          <input
                            className="lab-input py-1.5 text-xs w-20"
                            type="number"
                            value={editVariationForm.stock}
                            onChange={(e) => setEditVariationForm({ ...editVariationForm, stock: e.target.value })}
                          />
                        </div>
                        <button
                          onClick={saveEditVariation}
                          disabled={!editVariationForm.value || !editVariationForm.price}
                          className="lab-btn-primary py-1.5 px-3 text-xs"
                        >
                          <Check size={12} />
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingVariationId(null)}
                          className="lab-btn-secondary py-1.5 px-3 text-xs"
                        >
                          <X size={12} />
                          Cancelar
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5"
                    >
                      {variationImage ? (
                        <img
                          src={variationImage.url}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <ImageIcon size={12} className="text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="text-xs font-medium">{formatVariationValue(v.value)}{v.unit}</span>
                      <span className="text-xs text-muted-foreground">${Number(v.price).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">Stock: {v.stock}</span>
                      <label
                        className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Upload image for this variation"
                      >
                        <Upload size={12} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setUploadingFor(product.id); onUploadImage(file, nextOrder, v.id); }
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={() => startEditVariation(v)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit variation"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteVariation(v.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No variations yet</p>
              )}
            </div>
            {/* Add variation form */}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                <select
                  className="lab-input py-1.5 text-xs w-20"
                  value={variationForm.unit}
                  onChange={(e) => setVariationForm({ ...variationForm, unit: e.target.value as "mg" | "ml" })}
                >
                  <option value="mg">mg</option>
                  <option value="ml">ml</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Value</label>
                <input
                  className="lab-input py-1.5 text-xs w-20"
                  type="number"
                  step="0.01"
                  placeholder="10"
                  value={variationForm.value}
                  onChange={(e) => setVariationForm({ ...variationForm, value: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Price ($)</label>
                <input
                  className="lab-input py-1.5 text-xs w-24"
                  type="number"
                  step="0.01"
                  placeholder="55.00"
                  value={variationForm.price}
                  onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Stock</label>
                <input
                  className="lab-input py-1.5 text-xs w-20"
                  type="number"
                  placeholder="100"
                  value={variationForm.stock}
                  onChange={(e) => setVariationForm({ ...variationForm, stock: e.target.value })}
                />
              </div>
              <button
                onClick={onAddVariation}
                disabled={!variationForm.value || !variationForm.price}
                className="lab-btn-primary py-1.5 px-3 text-xs"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
