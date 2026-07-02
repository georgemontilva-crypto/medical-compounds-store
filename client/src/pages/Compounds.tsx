import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { Link, useSearch } from "wouter";
import { Search, FlaskConical, Plus, Check, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

type SortOption = "featured" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

export default function Compounds() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialCategory = params.get("category") ? Number(params.get("category")) : undefined;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCategory);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: products, isLoading } = trpc.products.list.useQuery({
    categoryId: selectedCategory,
    search: search || undefined,
    sortBy,
  });

  // Count products per category
  const { data: allProducts } = trpc.products.list.useQuery({});
  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allProducts?.forEach((p) => {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
    });
    return counts;
  }, [allProducts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="lab-section-title mb-1">Research Catalog</p>
          <h1 className="text-3xl font-bold">All Compounds</h1>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Filters — Desktop */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <CategorySidebar
              categories={categories}
              categoryCounts={categoryCounts}
              allCount={allProducts?.length ?? 0}
              selectedCategory={selectedCategory}
              onSelect={(id) => setSelectedCategory(id)}
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search + Sort + Mobile filter toggle */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="Search by name, CAS number, or mechanism..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="lab-input pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="lab-input w-auto min-w-[160px]"
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A–Z</option>
                  <option value="name_desc">Name: Z–A</option>
                </select>
                <button
                  className="md:hidden lab-btn-secondary px-3"
                  onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                >
                  <SlidersHorizontal size={16} />
                </button>
              </div>
            </div>

            {/* Mobile filters */}
            {mobileFiltersOpen && (
              <div className="md:hidden mb-6">
                <CategorySidebar
                  categories={categories}
                  categoryCounts={categoryCounts}
                  allCount={allProducts?.length ?? 0}
                  selectedCategory={selectedCategory}
                  onSelect={(id) => { setSelectedCategory(id); setMobileFiltersOpen(false); }}
                />
              </div>
            )}

            {/* Products grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="lab-card overflow-hidden animate-pulse">
                    <div className="aspect-square bg-secondary" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-secondary rounded w-1/2" />
                      <div className="h-4 bg-secondary rounded w-3/4" />
                      <div className="h-3 bg-secondary rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products && products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <CompoundCard
                    key={product.id}
                    product={product}
                    categories={categories}
                    addedIds={addedIds}
                    setAddedIds={setAddedIds}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <FlaskConical size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">No compounds found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategorySidebar({
  categories,
  categoryCounts,
  allCount,
  selectedCategory,
  onSelect,
}: {
  categories?: Array<{ id: number; name: string; color?: string | null }>;
  categoryCounts: Record<number, number>;
  allCount: number;
  selectedCategory?: number;
  onSelect: (id: number | undefined) => void;
}) {
  return (
    <div className="lab-card p-4 space-y-1">
      <button
        onClick={() => onSelect(undefined)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          !selectedCategory
            ? "bg-primary text-primary-foreground"
            : "hover:bg-secondary text-foreground"
        }`}
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={14} />
          All Compounds
        </div>
        <span className={`text-xs ${!selectedCategory ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {allCount}
        </span>
      </button>

      {categories?.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedCategory === cat.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color ?? "#6366f1" }}
            />
            {cat.name}
          </div>
          <span className={`text-xs ${selectedCategory === cat.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {categoryCounts[cat.id] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

function CompoundCard({
  product,
  categories,
  addedIds,
  setAddedIds,
}: {
  product: { id: number; name: string; slug: string; basePrice: string; shortDescription?: string | null; categoryId?: number | null };
  categories?: Array<{ id: number; name: string; color?: string | null }>;
  addedIds: Set<string>;
  setAddedIds: (fn: (prev: Set<string>) => Set<string>) => void;
}) {
  const { data: images } = trpc.products.images.useQuery({ productId: product.id });
  const { data: variations } = trpc.products.variations.useQuery({ productId: product.id });
  const { addItem } = useCart();

  const category = categories?.find((c) => c.id === product.categoryId);
  const image = images?.[0];
  const minPrice = variations && variations.length > 0
    ? Math.min(...variations.map((v) => Number(v.price)))
    : Number(product.basePrice);
  const hasVariations = variations && variations.length > 1;
  const cardKey = `card-${product.id}`;
  const isAdded = addedIds.has(cardKey);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasVariations) {
      // Navigate to product page to select variation
      window.location.href = `/compounds/${product.slug}`;
      return;
    }

    const variation = variations?.[0];
    addItem({
      productId: product.id,
      variationId: variation?.id,
      productName: product.name,
      variationLabel: variation ? `${variation.value}${variation.unit}` : undefined,
      unitPrice: variation ? Number(variation.price) : Number(product.basePrice),
      quantity: 1,
      image: image?.url,
      slug: product.slug,
    });

    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(cardKey);
      setTimeout(() => setAddedIds((p) => { const n = new Set(p); n.delete(cardKey); return n; }), 2000);
      return next;
    });
  };

  return (
    <Link href={`/compounds/${product.slug}`}>
      <div className="lab-card overflow-hidden cursor-pointer group relative">
        {/* Quick add button */}
        <button
          onClick={handleQuickAdd}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${
            isAdded
              ? "bg-green-500 text-white scale-110"
              : "bg-card text-foreground hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {isAdded ? <Check size={14} /> : <Plus size={14} />}
        </button>

        {/* Image */}
        <div className="aspect-square bg-secondary/40 overflow-hidden">
          {image ? (
            <img
              src={image.url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FlaskConical size={28} className="text-muted-foreground/20" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          {category && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: category.color ?? "#6366f1" }}
              />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {category.name}
              </span>
            </div>
          )}
          <h3 className="font-semibold text-sm leading-tight mb-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {variations && variations.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {variations.slice(0, 3).map((v) => (
                <span key={v.id} className="lab-badge bg-secondary text-muted-foreground text-[10px]">
                  {v.value}{v.unit}
                </span>
              ))}
              {variations.length > 3 && (
                <span className="lab-badge bg-secondary text-muted-foreground text-[10px]">
                  +{variations.length - 3}
                </span>
              )}
            </div>
          )}
          <p className="font-semibold text-sm text-primary">
            {hasVariations ? "From " : ""}${minPrice.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
