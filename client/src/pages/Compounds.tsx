import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { Link, useSearch } from "wouter";
import { Search, FlaskConical, Plus, Check, ChevronDown, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import ProductCard, { VialPlaceholder } from "@/components/ProductCard";
import Reveal from "@/components/Reveal";

// ── Category color map ────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Tissue: "#dbcfba", Cellular: "#d7cab3", Neural: "#d3c4ab",
  Metabolic: "#C8A84B", Endocrine: "#B8943A", Misc: "#8a9ba8",
};
const CAT_TEXT: Record<string, string> = {
  Tissue: "text-[#d3c4ab]", Cellular: "text-[#d3c4ab]", Neural: "text-[#baac96]",
  Metabolic: "text-[#A07A28] dark:text-[#C8A84B]", Endocrine: "text-[#A07A28] dark:text-[#C8A84B]", Misc: "text-gray-500 dark:text-gray-400",
};
const CAT_BG: Record<string, string> = {
  Tissue: "bg-[#f2ede6] dark:bg-white/10", Cellular: "bg-[#f2ede6] dark:bg-white/10", Neural: "bg-[#DFF4F3] dark:bg-white/10",
  Metabolic: "bg-[#FBF6E8] dark:bg-white/10", Endocrine: "bg-[#FBF6E8] dark:bg-white/10", Misc: "bg-gray-50 dark:bg-white/10",
};

// ── Static fallback products ──────────────────────────────────────────────────
const STATIC_PRODUCTS_RAW = [
  { id: 1, name: "BPC-157", slug: "bpc-157", category: "Tissue", sizes: ["10mg", "20mg"], color: "#dbcfba", price: 55, popular: true },
  { id: 2, name: "TB-500", slug: "tb-500", category: "Tissue", sizes: ["10mg"], color: "#dbcfba", price: 60, popular: true },
  { id: 3, name: "KPV", slug: "kpv", category: "Tissue", sizes: ["5mg", "10mg"], color: "#dbcfba", price: 40, popular: false },
  { id: 4, name: "GHK-Cu", slug: "ghk-cu", category: "Tissue", sizes: ["50mg"], color: "#d7cab3", price: 60, popular: false },
  { id: 5, name: "RT-30", slug: "rt-30", category: "Tissue", sizes: ["30mg"], color: "#dbcfba", price: 75, popular: false },
  { id: 6, name: "RT-10", slug: "rt-10", category: "Tissue", sizes: ["10mg"], color: "#dbcfba", price: 55, popular: false },
  { id: 7, name: "Epithalon", slug: "epithalon", category: "Cellular", sizes: ["10mg", "30mg"], color: "#d7cab3", price: 55, popular: true },
  { id: 8, name: "MOTS-C", slug: "mots-c", category: "Cellular", sizes: ["10mg", "20mg"], color: "#d7cab3", price: 90, popular: false },
  { id: 9, name: "GLOW", slug: "glow", category: "Cellular", sizes: ["70mg"], color: "#d7cab3", price: 90, popular: false },
  { id: 10, name: "KLOW", slug: "klow", category: "Cellular", sizes: ["80mg"], color: "#d7cab3", price: 90, popular: false },
  { id: 11, name: "Semax", slug: "semax", category: "Neural", sizes: ["10mg"], color: "#d3c4ab", price: 70, popular: false },
  { id: 12, name: "TZ-30", slug: "tz-30", category: "Neural", sizes: ["30mg"], color: "#d3c4ab", price: 80, popular: false },
  { id: 13, name: "TZ-10", slug: "tz-10", category: "Neural", sizes: ["10mg"], color: "#d3c4ab", price: 60, popular: false },
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
  const catBg = CAT_BG[product.category] ?? "bg-gray-50 dark:bg-white/10";
  const hasVariations = product.sizes.length > 1;
  const catGlow = `0 0 0 2px ${catColor}40, 0 8px 24px -6px ${catColor}66`;

  return (
    <div
      className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-[var(--cat-glow)] transition-all duration-300 dark:bg-card dark:border-border"
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
                ? "bg-gray-100 text-gray-300 cursor-not-allowed opacity-0 group-hover:opacity-100 dark:bg-white/10 dark:text-gray-500"
                : added ? "bg-[#d3c4ab] text-white opacity-100 scale-110"
                        : "bg-white text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-[#d3c4ab] hover:text-white dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            {product.isMock ? <X size={13} /> : added ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className={`text-[10px] font-semibold tracking-widest uppercase ${catText}`}>{product.category}</span>
          {product.isMock ? (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500">Coming soon</span>
          ) : product.popular && (
            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catBg} ${catText}`}>Popular</span>
          )}
        </div>
        <Link href={`/compounds/${product.slug}`}>
          <h3 className="font-bold text-gray-950 text-sm mb-1 cursor-pointer hover:text-[#d3c4ab] transition-colors dark:text-white">{product.name}</h3>
        </Link>
        <div className="flex flex-wrap gap-1 mb-2">
          {product.sizes.map((s) => (
            <span key={s} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full font-mono dark:text-gray-500 dark:bg-white/10">{s}</span>
          ))}
        </div>
        <p className="font-semibold text-gray-900 text-sm dark:text-white">{hasVariations ? "From " : ""}${product.price.toFixed(2)}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Compounds() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  // CategoryShowcase/Navbar/HeroSlider all link here with ?category=<slug>
  // (stable and URL-friendly, unlike a numeric id or a display name that
  // can drift out of sync with the real catalog).
  const categorySlug = params.get("category") || undefined;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedStaticCat, setSelectedStaticCat] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const { addItem } = useCart();

  const { data: categories = [] } = trpc.categories.list.useQuery();

  // Resolve the URL slug to a real category id once categories have
  // loaded. If the slug doesn't match any real category (e.g. a stale
  // link), selectedCategory just stays undefined and the page shows the
  // full catalog instead of silently rendering empty.
  useEffect(() => {
    if (!categorySlug || categories.length === 0) return;
    const match = categories.find((c) => c.slug === categorySlug);
    if (match) setSelectedCategory(match.id);
  }, [categorySlug, categories]);

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
    <div className="min-h-screen bg-white dark:bg-background">
      <Navbar />
      <div className="container py-10">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#d3c4ab] mb-1">Full Catalog</p>
          <h1 className="text-3xl font-extrabold text-gray-950 dark:text-white">Research Compounds</h1>
          <div className="w-10 h-0.5 bg-gradient-to-r from-[#dbcfba] to-[#C8A84B] mt-2 mb-3 rounded-full" />
          <p className="text-gray-400 text-sm dark:text-gray-500">
            {totalCount} compound{totalCount !== 1 ? "s" : ""} across {sidebarCats.length} research categories.
            Click any card to view the full research monograph.
          </p>
        </div>

        <div className="flex gap-7 items-start">
          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-3 w-56 shrink-0 sticky top-[80px] self-start">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm dark:bg-card dark:border-border">
              {/* All */}
              <button
                onClick={() => { setSelectedCategory(undefined); setSelectedStaticCat(null); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
                  !selectedCategory && !selectedStaticCat
                    ? "bg-[#d3c4ab] text-white"
                    : "text-gray-700 hover:bg-[#F5F2EC] dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2"><FlaskConical size={14} />All Compounds</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${!selectedCategory && !selectedStaticCat ? "bg-white/20 text-white" : "bg-[#F5F2EC] text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>
                  {useStaticData ? STATIC_PRODUCTS.length : allProducts.length}
                </span>
              </button>
              {/* Categories */}
              <div className="divide-y divide-gray-50 dark:divide-white/10">
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
                        active ? "bg-[#f2ede6] text-[#baac96] font-semibold dark:bg-white/10" : "text-gray-600 hover:bg-[#F5F2EC] dark:text-gray-300 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Find CTA */}
            <button className="w-full flex items-center justify-center gap-2 border border-[#dbcfba]/50 text-[#d3c4ab] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#f2ede6] transition-colors dark:hover:bg-white/10">
              <FlaskConical size={12} />Find Your Compound
            </button>
          </aside>

          {/* ── Main ────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Search + sort */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, CAS number, or mechanism..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/30 focus:border-[#dbcfba] transition-all dark:bg-card dark:border-border dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium hover:border-gray-300 transition-all whitespace-nowrap dark:bg-card dark:border-border dark:text-gray-300 dark:hover:border-white/20"
                >
                  {SORT_LABELS[sortBy]}<ChevronDown size={14} className={`transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                </button>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden dark:bg-card dark:border-border dark:shadow-black/40">
                      {Object.entries(SORT_LABELS).map(([val, label]) => (
                        <button key={val} onClick={() => { setSortBy(val as SortOption); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sortBy === val ? "bg-[#f2ede6] text-[#baac96] font-semibold" : "text-gray-700 hover:bg-[#F5F2EC] dark:text-gray-300 dark:hover:bg-white/5"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 lg:hidden">
              <button
                onClick={() => { setSelectedCategory(undefined); setSelectedStaticCat(null); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  !selectedCategory && !selectedStaticCat ? "bg-[#d3c4ab] text-white border-[#d3c4ab]" : "bg-white text-gray-600 border-gray-200 dark:bg-card dark:text-gray-300 dark:border-border"
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
                      active ? "bg-[#d3c4ab] text-white border-[#d3c4ab]" : "bg-white text-gray-600 border-gray-200 dark:bg-card dark:text-gray-300 dark:border-border"
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
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse dark:bg-card dark:border-border">
                    <div className="h-48 bg-gray-100 dark:bg-white/10" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-1/3 dark:bg-white/10" /><div className="h-4 bg-gray-100 rounded w-2/3 dark:bg-white/10" /><div className="h-3 bg-gray-100 rounded w-1/4 dark:bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : useStaticData ? (
              filteredStatic.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-4"><FlaskConical size={24} className="text-gray-300 dark:text-gray-600" /></div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No compounds found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Try adjusting your search or filters</p>
                  <button onClick={() => { setSearch(""); setSelectedStaticCat(null); }} className="mt-4 text-sm text-[#d3c4ab] font-semibold hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredStatic.map((p) => (
                    <Reveal key={p.id}>
                      <StaticCard product={p} onAdd={() => handleStaticAdd(p)} added={addedIds.has(`static-${p.id}`)} />
                    </Reveal>
                  ))}
                </div>
              )
            ) : dbProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mb-4"><FlaskConical size={24} className="text-gray-300 dark:text-gray-600" /></div>
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No compounds found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {dbProducts.map((product) => (
                  <Reveal key={product.id}>
                    <ProductCard
                      product={product}
                      categories={categories}
                      onAdd={handleLiveAdd}
                      added={addedIds.has(`card-${product.id}`)}
                    />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
