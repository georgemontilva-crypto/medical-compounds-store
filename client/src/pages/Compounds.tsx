import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { Link, useSearch } from "wouter";
import { Search, FlaskConical, Plus, Check, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import ProductCard, { VialPlaceholder } from "@/components/ProductCard";

// ── Category color map ────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Tissue: "#7ECDC4", Cellular: "#5BB8AE", Neural: "#3A9E94",
  Metabolic: "#C8A84B", Endocrine: "#B8943A", Misc: "#8a9ba8",
};
const CAT_TEXT: Record<string, string> = {
  Tissue: "text-[#3A9E94]", Cellular: "text-[#3A9E94]", Neural: "text-[#2A8E84]",
  Metabolic: "text-[#A07A28]", Endocrine: "text-[#A07A28]", Misc: "text-gray-500",
};
const CAT_BG: Record<string, string> = {
  Tissue: "bg-[#E8F7F6]", Cellular: "bg-[#E8F7F6]", Neural: "bg-[#DFF4F3]",
  Metabolic: "bg-[#FBF6E8]", Endocrine: "bg-[#FBF6E8]", Misc: "bg-gray-50",
};

// ── Static fallback products ──────────────────────────────────────────────────
const STATIC_PRODUCTS_RAW = [
  { id: 1, name: "BPC-157", slug: "bpc-157", category: "Tissue", sizes: ["10mg", "20mg"], color: "#7ECDC4", price: 55, popular: true },
  { id: 2, name: "TB-500", slug: "tb-500", category: "Tissue", sizes: ["10mg"], color: "#7ECDC4", price: 60, popular: true },
  { id: 3, name: "KPV", slug: "kpv", category: "Tissue", sizes: ["5mg", "10mg"], color: "#7ECDC4", price: 40, popular: false },
  { id: 4, name: "GHK-Cu", slug: "ghk-cu", category: "Tissue", sizes: ["50mg"], color: "#5BB8AE", price: 60, popular: false },
  { id: 5, name: "RT-30", slug: "rt-30", category: "Tissue", sizes: ["30mg"], color: "#7ECDC4", price: 75, popular: false },
  { id: 6, name: "RT-10", slug: "rt-10", category: "Tissue", sizes: ["10mg"], color: "#7ECDC4", price: 55, popular: false },
  { id: 7, name: "Epithalon", slug: "epithalon", category: "Cellular", sizes: ["10mg", "30mg"], color: "#5BB8AE", price: 55, popular: true },
  { id: 8, name: "MOTS-C", slug: "mots-c", category: "Cellular", sizes: ["10mg", "20mg"], color: "#5BB8AE", price: 90, popular: false },
  { id: 9, name: "GLOW", slug: "glow", category: "Cellular", sizes: ["70mg"], color: "#5BB8AE", price: 90, popular: false },
  { id: 10, name: "KLOW", slug: "klow", category: "Cellular", sizes: ["80mg"], color: "#5BB8AE", price: 90, popular: false },
  { id: 11, name: "Semax", slug: "semax", category: "Neural", sizes: ["10mg"], color: "#3A9E94", price: 70, popular: false },
  { id: 12, name: "TZ-30", slug: "tz-30", category: "Neural", sizes: ["30mg"], color: "#3A9E94", price: 80, popular: false },
  { id: 13, name: "TZ-10", slug: "tz-10", category: "Neural", sizes: ["10mg"], color: "#3A9E94", price: 60, popular: false },
  { id: 14, name: "NAD+", slug: "nad-plus", category: "Metabolic", sizes: ["250mg", "500mg"], color: "#C8A84B", price: 75, popular: true },
  { id: 15, name: "SS-31", slug: "ss-31", category: "Metabolic", sizes: ["10mg"], color: "#C8A84B", price: 95, popular: false },
  { id: 16, name: "PT-141", slug: "pt-141", category: "Endocrine", sizes: ["10mg"], color: "#B8943A", price: 65, popular: false },
  { id: 17, name: "Sermorelin", slug: "sermorelin", category: "Endocrine", sizes: ["5mg"], color: "#B8943A", price: 55, popular: false },
  { id: 18, name: "Tesamorelin", slug: "tesamorelin", category: "Endocrine", sizes: ["10mg"], color: "#B8943A", price: 80, popular: false },
  { id: 19, name: "CJC-1295", slug: "cjc-1295", category: "Endocrine", sizes: ["2mg"], color: "#B8943A", price: 60, popular: false },
];

// isMock ids (1-19) don't exist in `products` — checkout would fail the order_items FK.
// Flagged so cards can disable "Add to cart" instead of letting users reach Checkout with them.
const STATIC_PRODUCTS = STATIC_PRODUCTS_RAW.map((p) => ({ ...p, isMock: true as const }));

const STATIC_CATS = [
  { name: "Tissue", count: 6 }, { name: "Cellular", count: 4 },
  { name: "Neural", count: 3 }, { name: "Metabolic", count: 2 },
  { name: "Endocrine", count: 4 },
];

type SortOption = "featured" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

// ── Static Card (fallback) ────────────────────────────────────────────────────
function StaticCard({ product, onAdd, added }: {
  product: typeof STATIC_PRODUCTS[0]; onAdd: () => void; added: boolean;
}) {
  const catColor = CAT_COLORS[product.category] ?? "#6b7280";
  const catText = CAT_TEXT[product.category] ?? "text-gray-500";
  const catBg = CAT_BG[product.category] ?? "bg-gray-50";
  const hasVariations = product.sizes.length > 1;
  const catGlow = `0 0 0 2px ${catColor}40, 0 8px 24px -6px ${catColor}66`;

  return (
    <div
      className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-[var(--cat-glow)] transition-all duration-300"
      style={{ "--cat-glow": catGlow } as React.CSSProperties}
    >
      <Link href={`/compounds/${product.slug}`}>
        <div className="relative h-48 cursor-pointer overflow-hidden bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed]">
          <VialPlaceholder label={product.name} size={product.sizes[0]} color={product.color} />
          <button
            onClick={(e) => { e.preventDefault(); if (!product.isMock) onAdd(); }}
            disabled={product.isMock}
            title={product.isMock ? "Coming soon — demo product, not yet purchasable" : undefined}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all duration-200 ${
              product.isMock
                ? "bg-gray-100 text-gray-300 cursor-not-allowed opacity-0 group-hover:opacity-100"
                : added ? "bg-[#3A9E94] text-white opacity-100 scale-110"
                        : "bg-white text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-[#3A9E94] hover:text-white"
            }`}
          >
            {product.isMock ? <X size={13} /> : added ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className={`text-[10px] font-semibold tracking-widest uppercase ${catText}`}>{product.category}</span>
          {product.isMock ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Coming soon</span>
          ) : product.popular && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catBg} ${catText}`}>Popular</span>
          )}
        </div>
        <Link href={`/compounds/${product.slug}`}>
          <h3 className="font-bold text-gray-950 text-sm mb-1 cursor-pointer hover:text-[#3A9E94] transition-colors">{product.name}</h3>
        </Link>
        <div className="flex flex-wrap gap-1 mb-2">
          {product.sizes.map((s) => (
            <span key={s} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full font-mono">{s}</span>
          ))}
        </div>
        <p className="font-semibold text-gray-900 text-sm">{hasVariations ? "From " : ""}${product.price.toFixed(2)}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Compounds() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialCategory = params.get("category") ? Number(params.get("category")) : undefined;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialCategory);
  const [selectedStaticCat, setSelectedStaticCat] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { addItem } = useCart();

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: dbProducts = [], isLoading } = trpc.products.list.useQuery({
    categoryId: selectedCategory, search: search || undefined, sortBy,
  });
  const { data: allProducts = [] } = trpc.products.list.useQuery({});

  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    allProducts.forEach((p) => { if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1; });
    return counts;
  }, [allProducts]);

  // Static filtered products
  const filteredStatic = useMemo(() => {
    let p = [...STATIC_PRODUCTS];
    if (search) p = p.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
    if (selectedStaticCat) p = p.filter((x) => x.category === selectedStaticCat);
    if (sortBy === "price_asc") p.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") p.sort((a, b) => b.price - a.price);
    if (sortBy === "name_asc") p.sort((a, b) => a.name.localeCompare(b.name));
    return p;
  }, [search, selectedStaticCat, sortBy]);

  const useStaticData = dbProducts.length === 0 && !isLoading;
  const totalCount = useStaticData ? filteredStatic.length : dbProducts.length;

  function handleStaticAdd(product: typeof STATIC_PRODUCTS[0]) {
    if (product.isMock) return;
    addItem({
      productId: product.id, productName: product.name,
      unitPrice: product.price, quantity: 1, slug: product.slug,
      variationLabel: product.sizes[0],
    });
    const key = `static-${product.id}`;
    setAddedIds((prev) => { const n = new Set(prev); n.add(key); return n; });
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(`static-${product.id}`); return n; }), 2000);
  }

  function handleLiveAdd(payload: {
    productId: number; variationId?: number; productName: string;
    variationLabel?: string; unitPrice: number; image?: string; slug: string;
  }) {
    addItem({ ...payload, quantity: 1 });
    const key = `card-${payload.productId}`;
    setAddedIds((prev) => { const n = new Set(prev); n.add(key); return n; });
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(key); return n; }), 2000);
  }

  const SORT_LABELS: Record<string, string> = {
    featured: "Featured", price_asc: "Price: Low to High",
    price_desc: "Price: High to Low", name_asc: "Name A–Z", name_desc: "Name Z–A",
  };

  // Sidebar categories
  const sidebarCats = categories.length > 0
    ? categories.map((c) => ({ id: c.id, name: c.name, color: c.color ?? "#6b7280", count: categoryCounts[c.id] ?? 0 }))
    : STATIC_CATS.map((c, i) => ({ id: i + 1, name: c.name, color: CAT_COLORS[c.name] ?? "#6b7280", count: c.count }));

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="container py-10">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-1">Full Catalog</p>
          <h1 className="text-3xl font-extrabold text-gray-950">Research Compounds</h1>
          <div className="w-10 h-0.5 bg-gradient-to-r from-[#7ECDC4] to-[#C8A84B] mt-2 mb-3 rounded-full" />
          <p className="text-gray-400 text-sm">
            {totalCount} compound{totalCount !== 1 ? "s" : ""} across {sidebarCats.length} research categories.
            Click any card to view the full research monograph.
          </p>
        </div>

        <div className="flex gap-7 items-start">
          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-3 w-56 shrink-0 sticky top-[80px] self-start">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {/* All */}
              <button
                onClick={() => { setSelectedCategory(undefined); setSelectedStaticCat(null); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                  !selectedCategory && !selectedStaticCat
                    ? "bg-[#3A9E94] text-white"
                    : "text-gray-700 hover:bg-[#F5F2EC]"
                }`}
              >
                <span className="flex items-center gap-2"><FlaskConical size={14} />All Compounds</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${!selectedCategory && !selectedStaticCat ? "bg-white/20 text-white" : "bg-[#F5F2EC] text-gray-500"}`}>
                  {useStaticData ? STATIC_PRODUCTS.length : allProducts.length}
                </span>
              </button>
              {/* Categories */}
              <div className="divide-y divide-gray-50">
                {sidebarCats.map((cat) => {
                  const active = categories.length > 0 ? selectedCategory === cat.id : selectedStaticCat === cat.name;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        if (categories.length > 0) setSelectedCategory(active ? undefined : cat.id);
                        else setSelectedStaticCat(active ? null : cat.name);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        active ? "bg-[#E8F7F6] text-[#2A8E84] font-semibold" : "text-gray-600 hover:bg-[#F5F2EC]"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-400">{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Find CTA */}
            <button className="w-full flex items-center justify-center gap-2 border border-[#7ECDC4]/50 text-[#3A9E94] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#E8F7F6] transition-colors">
              <FlaskConical size={12} />Find Your Compound
            </button>
          </aside>

          {/* ── Main ────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Search + sort */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, CAS number, or mechanism..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4] transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium hover:border-gray-300 transition-all whitespace-nowrap"
                >
                  {SORT_LABELS[sortBy]}<ChevronDown size={14} className={`transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                </button>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                      {Object.entries(SORT_LABELS).map(([val, label]) => (
                        <button key={val} onClick={() => { setSortBy(val as SortOption); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sortBy === val ? "bg-[#E8F7F6] text-[#2A8E84] font-semibold" : "text-gray-700 hover:bg-[#F5F2EC]"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Mobile filter */}
              <button onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="lg:hidden flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700">
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* Mobile category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 lg:hidden">
              <button
                onClick={() => { setSelectedCategory(undefined); setSelectedStaticCat(null); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  !selectedCategory && !selectedStaticCat ? "bg-[#3A9E94] text-white border-[#3A9E94]" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                <FlaskConical size={11} /> All
              </button>
              {sidebarCats.map((cat) => {
                const active = categories.length > 0 ? selectedCategory === cat.id : selectedStaticCat === cat.name;
                return (
                  <button key={cat.id}
                    onClick={() => {
                      if (categories.length > 0) setSelectedCategory(active ? undefined : cat.id);
                      else setSelectedStaticCat(active ? null : cat.name);
                    }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active ? "bg-[#3A9E94] text-white border-[#3A9E94]" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
                    <div className="h-48 bg-gray-100" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-1/3" /><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : useStaticData ? (
              filteredStatic.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><FlaskConical size={24} className="text-gray-300" /></div>
                  <p className="font-semibold text-gray-700 mb-1">No compounds found</p>
                  <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
                  <button onClick={() => { setSearch(""); setSelectedStaticCat(null); }} className="mt-4 text-sm text-[#3A9E94] font-semibold hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredStatic.map((p) => (
                    <StaticCard key={p.id} product={p} onAdd={() => handleStaticAdd(p)} added={addedIds.has(`static-${p.id}`)} />
                  ))}
                </div>
              )
            ) : dbProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><FlaskConical size={24} className="text-gray-300" /></div>
                <p className="font-semibold text-gray-700 mb-1">No compounds found</p>
                <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {dbProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categories={categories}
                    onAdd={handleLiveAdd}
                    added={addedIds.has(`card-${product.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
