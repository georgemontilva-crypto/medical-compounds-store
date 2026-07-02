import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useCart } from "@/contexts/CartContext";
import { Link } from "wouter";
import { ArrowRight, FlaskConical, Shield, Microscope, Award, ChevronRight, Plus, Check, Search, ChevronDown, Beaker, Dna, Zap, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";
import HeroSlider from "@/components/HeroSlider";

// ── Placeholder image component ──────────────────────────────────────────────
function VialPlaceholder({ label, size = "10mg", color = "#a78bfa", large = false }: { label: string; size?: string; color?: string; large?: boolean }) {
  const shortLabel = label.length > 9 ? label.slice(0, 9) : label;
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed] relative overflow-hidden">
      <svg viewBox="0 0 80 120" className={large ? "w-24 h-36 drop-shadow-lg" : "w-16 h-24 drop-shadow"} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="28" y="2" width="24" height="14" rx="4" fill={color} opacity="0.85" />
        <rect x="32" y="14" width="16" height="6" rx="2" fill="#d1d5db" />
        <rect x="20" y="20" width="40" height="70" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1.5" />
        <rect x="24" y="32" width="32" height="46" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
        <text x="40" y="50" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#374151" fontFamily="system-ui">{shortLabel}</text>
        <text x="40" y="59" textAnchor="middle" fontSize="4" fill="#9ca3af" fontFamily="system-ui">LYOPHILIZED POWDER</text>
        <text x="40" y="69" textAnchor="middle" fontSize="7" fontWeight="800" fill={color} fontFamily="system-ui">{size}</text>
        <rect x="20" y="88" width="40" height="8" rx="0" fill={color} opacity="0.25" />
        <text x="40" y="95" textAnchor="middle" fontSize="3.5" fill="#6b7280" fontFamily="system-ui">FOR RESEARCH USE ONLY</text>
        <rect x="20" y="90" width="40" height="8" rx="4" fill="#e5e7eb" />
      </svg>
    </div>
  );
}

// ── Static product data for hero display ─────────────────────────────────────
const FEATURED_PRODUCTS = [
  { name: "BPC-157", category: "Tissue", size: "10mg", color: "#7ECDC4", description: "Pentadecapeptide with potent tissue repair and cytoprotective properties.", price: "$60.00", slug: "bpc-157" },
  { name: "TB-500", category: "Tissue", size: "10mg", color: "#7ECDC4", description: "Thymosin Beta-4 fragment promoting actin regulation and tissue recovery.", price: "$60.00", slug: "tb-500" },
  { name: "NAD+", category: "Metabolic", size: "500mg", color: "#C8A84B", description: "Nicotinamide Adenine Dinucleotide — essential coenzyme for cellular energy metabolism.", price: "$85.00", slug: "nad-plus" },
  { name: "GHK-Cu", category: "Tissue", size: "50mg", color: "#5BB8AE", description: "Copper peptide with regenerative and anti-inflammatory signaling properties.", price: "$60.00", slug: "ghk-cu" },
  { name: "Sermorelin", category: "Endocrine", size: "5mg", color: "#B8943A", description: "GHRH analogue that stimulates natural growth hormone secretion.", price: "$55.00", slug: "sermorelin" },
  { name: "MOTS-C", category: "Metabolic", size: "10mg", color: "#C8A84B", description: "Mitochondrial-derived peptide regulating metabolic homeostasis.", price: "$90.00", slug: "mots-c" },
  { name: "PT-141", category: "Endocrine", size: "10mg", color: "#B8943A", description: "Melanocortin receptor agonist studied for central nervous system effects.", price: "$65.00", slug: "pt-141" },
  { name: "Semax", category: "Neural", size: "10mg", color: "#3A9E94", description: "Synthetic peptide analogue of ACTH with neuroprotective properties.", price: "$70.00", slug: "semax" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Tissue: "#7ECDC4",
  Cellular: "#5BB8AE",
  Neural: "#3A9E94",
  Metabolic: "#C8A84B",
  Endocrine: "#B8943A",
  Misc: "#8a9ba8",
};

const RESEARCH_CATEGORIES = [
  { icon: Dna, label: "Tissue Repair", desc: "BPC-157, TB-500, GHK-Cu, KPV", color: "from-[#E8F7F6] to-[#F0FAF9]", accent: "#7ECDC4" },
  { icon: Zap, label: "Metabolic", desc: "NAD+, MOTS-C, SS-31", color: "from-[#FBF6E8] to-[#FDF9F0]", accent: "#C8A84B" },
  { icon: Activity, label: "Neural", desc: "Semax, Selank, PT-141", color: "from-[#E8F7F6] to-[#EEF8F7]", accent: "#3A9E94" },
  { icon: Beaker, label: "Endocrine", desc: "Sermorelin, Tesamorelin, CJC-1295", color: "from-[#FBF6E8] to-[#FEF8EC]", accent: "#B8943A" },
];

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: typeof FEATURED_PRODUCTS[0] }) {
  const { addItem } = useCart();
  const catColor = CATEGORY_COLORS[product.category] ?? "#6b7280";

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300">
      {/* Image area */}
      <Link href={`/compounds/${product.slug}`}>
        <div className="relative h-52 bg-gradient-to-b from-gray-50 to-gray-100 cursor-pointer overflow-hidden">
          <VialPlaceholder label={product.name} size={product.size} color={product.color} />
          {/* Add button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              addItem({ productId: 0, productName: product.name, unitPrice: parseFloat(product.price.replace("$", "")), image: undefined, variationId: undefined, variationLabel: undefined, quantity: 1, slug: product.slug });
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
      </Link>
      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: catColor }}>
            {product.category}
          </span>
        </div>
        <Link href={`/compounds/${product.slug}`}>
          <h3 className="font-bold text-gray-900 text-base mb-1 cursor-pointer hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">{product.price}</span>
          <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-full">{product.size}</span>
        </div>
      </div>
    </div>
  );
}


// ── Category color maps (shared) ─────────────────────────────────────────────
const CAT_COLORS_MAP: Record<string, string> = {
  Tissue: "#7ECDC4", Cellular: "#5BB8AE", Neural: "#3A9E94",
  Metabolic: "#C8A84B", Endocrine: "#B8943A", Misc: "#8a9ba8",
};
const CAT_TEXT_MAP: Record<string, string> = {
  Tissue: "text-[#3A9E94]", Cellular: "text-[#3A9E94]", Neural: "text-[#2A8E84]",
  Metabolic: "text-[#A07A28]", Endocrine: "text-[#A07A28]", Misc: "text-gray-500",
};
const CAT_BG_MAP: Record<string, string> = {
  Tissue: "bg-[#E8F7F6]", Cellular: "bg-[#E8F7F6]", Neural: "bg-[#DFF4F3]",
  Metabolic: "bg-[#FBF6E8]", Endocrine: "bg-[#FBF6E8]", Misc: "bg-gray-50",
};

const CATALOG_PRODUCTS = [
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

const CATALOG_CATS = [
  { name: "Tissue", count: 6 }, { name: "Cellular", count: 4 },
  { name: "Neural", count: 3 }, { name: "Metabolic", count: 2 },
  { name: "Endocrine", count: 4 },
];

type HomeSortOption = "featured" | "price_asc" | "price_desc" | "name_asc";

function CatalogVialCard({ product, onAdd, added }: {
  product: typeof CATALOG_PRODUCTS[0]; onAdd: () => void; added: boolean;
}) {
  const catColor = CAT_COLORS_MAP[product.category] ?? "#6b7280";
  const catText = CAT_TEXT_MAP[product.category] ?? "text-gray-500";
  const catBg = CAT_BG_MAP[product.category] ?? "bg-gray-50";
  const hasVariations = product.sizes.length > 1;
  const shortLabel = product.name.length > 9 ? product.name.slice(0, 9) : product.name;

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300">
      <Link href={`/compounds/${product.slug}`}>
        <div className="relative h-48 cursor-pointer overflow-hidden bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed]">
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 80 120" className="w-16 h-24 drop-shadow" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="28" y="2" width="24" height="14" rx="4" fill={catColor} opacity="0.85" />
              <rect x="32" y="14" width="16" height="6" rx="2" fill="#d1d5db" />
              <rect x="20" y="20" width="40" height="70" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1.5" />
              <rect x="24" y="32" width="32" height="46" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
              <text x="40" y="50" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#374151" fontFamily="system-ui">{shortLabel}</text>
              <text x="40" y="59" textAnchor="middle" fontSize="4" fill="#9ca3af" fontFamily="system-ui">LYOPHILIZED POWDER</text>
              <text x="40" y="69" textAnchor="middle" fontSize="7" fontWeight="800" fill={catColor} fontFamily="system-ui">{product.sizes[0]}</text>
              <rect x="20" y="88" width="40" height="8" rx="0" fill={catColor} opacity="0.25" />
              <text x="40" y="95" textAnchor="middle" fontSize="3.5" fill="#6b7280" fontFamily="system-ui">FOR RESEARCH USE ONLY</text>
              <rect x="20" y="90" width="40" height="8" rx="4" fill="#e5e7eb" />
            </svg>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onAdd(); }}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all duration-200 ${
              added ? "bg-[#3A9E94] text-white opacity-100 scale-110"
                    : "bg-white text-gray-700 opacity-0 group-hover:opacity-100 hover:bg-[#3A9E94] hover:text-white"
            }`}
          >
            {added ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className={`text-[10px] font-semibold tracking-widest uppercase ${catText}`}>{product.category}</span>
          {product.popular && (
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

function ResearchCatalogSection() {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<HomeSortOption>("featured");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const { addItem } = useCart();

  const filtered = useMemo(() => {
    let list = [...CATALOG_PRODUCTS];
    if (selectedCat) list = list.filter((p) => p.category === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (sortBy === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    return list;
  }, [search, selectedCat, sortBy]);

  const handleAdd = (product: typeof CATALOG_PRODUCTS[0]) => {
    addItem({
      productId: product.id, productName: product.name,
      unitPrice: product.price, quantity: 1,
      image: undefined, variationId: undefined,
      variationLabel: product.sizes[0], slug: product.slug,
    });
    setAddedIds((prev) => {
      const next = new Set(prev); next.add(product.id);
      setTimeout(() => setAddedIds((p) => { const n = new Set(p); n.delete(product.id); return n; }), 2000);
      return next;
    });
  };

  const totalCount = CATALOG_PRODUCTS.length;

  return (
    <section className="py-20 bg-white">
      <div className="container">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-[#E8F7F6] border border-[#7ECDC4]/30 text-[#3A9E94] text-[11px] font-bold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7ECDC4]" />
            FULL CATALOG
          </div>
          <h2 className="text-4xl font-extrabold text-gray-950 mb-1">Research Compounds</h2>
          <div className="w-16 h-1 rounded-full bg-gradient-to-r from-[#7ECDC4] via-[#C8A84B] to-[#5BB8AE] mb-4" />
          <p className="text-gray-500 text-sm max-w-xl">
            {totalCount} compounds across {CATALOG_CATS.length} research categories. Click any card to view the full research monograph.
          </p>
        </div>

        {/* Layout: sidebar + content */}
        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 bg-white border border-gray-100 rounded-2xl p-4 sticky top-[80px] self-start">
            <button
              onClick={() => setSelectedCat(null)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                selectedCat === null ? "bg-[#3A9E94] text-white" : "text-gray-700 hover:bg-[#F5F2EC]"
              }`}
            >
              <span className="flex items-center gap-2">
                <FlaskConical size={14} />
                All Compounds
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                selectedCat === null ? "bg-white/20 text-white" : "bg-[#F5F2EC] text-gray-500"
              }`}>{totalCount}</span>
            </button>

            <div className="h-px bg-gray-100 my-2" />

            {CATALOG_CATS.map((cat) => {
              const color = CAT_COLORS_MAP[cat.name] ?? "#6b7280";
              const isActive = selectedCat === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCat(isActive ? null : cat.name)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                    isActive ? "bg-[#E8F7F6] font-semibold text-gray-900" : "text-gray-600 hover:bg-[#F5F2EC]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {cat.name}
                  </span>
                  <span className="text-xs text-gray-400">{cat.count}</span>
                </button>
              );
            })}

            <div className="h-px bg-gray-100 my-2" />

            <Link href="/compounds">
              <button className="w-full flex items-center justify-center gap-2 border border-[#7ECDC4]/50 text-[#3A9E94] hover:bg-[#E8F7F6] text-xs font-semibold py-2.5 rounded-xl transition-colors">
                <FlaskConical size={13} />
                Find Your Compound
              </button>
            </Link>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search + sort bar */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, CAS number, or mechanism..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4] transition-all"
                />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as HomeSortOption)}
                  className="appearance-none pl-4 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 cursor-pointer font-medium text-gray-700"
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name A-Z</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Mobile category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 lg:hidden">
              <button
                onClick={() => setSelectedCat(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedCat === null ? "bg-[#3A9E94] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >All ({totalCount})</button>
              {CATALOG_CATS.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedCat === cat.name ? "bg-[#3A9E94] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >{cat.name} ({cat.count})</button>
              ))}
            </div>

            {/* Product grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No compounds found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                {filtered.map((product) => (
                  <CatalogVialCard
                    key={product.id}
                    product={product}
                    onAdd={() => handleAdd(product)}
                    added={addedIds.has(product.id)}
                  />
                ))}
              </div>
            )}

            {/* View all link */}
            <div className="text-center mt-10">
              <Link href="/compounds">
                <button className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 hover:text-[#3A9E94] hover:border-[#7ECDC4]/50 hover:bg-[#E8F7F6]/40 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                  View Full Catalog <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main Home ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: liveProducts } = trpc.products.list.useQuery({ featured: true, limit: 8 });

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      <Navbar />

      {/* ── HERO SLIDER ──────────────────────────────────────────────────── */}
      <HeroSlider />

      {/* ── HERO STATIC (hidden - replaced by slider) ─────────────────────── */}
      <section className="relative overflow-hidden bg-white hidden">
        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#7ECDC4]/20 to-[#E8DCC8]/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-[#E8DCC8]/30 to-[#7ECDC4]/20 blur-2xl" />
          {/* Grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#6366f1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center py-20 lg:py-28">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{backgroundColor:"#E8F7F6", borderColor:"#7ECDC4", border:"1px solid", color:"#3A9E94"}}>
                <FlaskConical size={12} />
                Research Grade · ≥99% Purity
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 leading-[1.05] mb-6">
                Precision<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3A9E94] to-[#C8A84B]">
                  Compounds
                </span>{" "}
                for<br />
                Advanced Research
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-md">
                High-purity lyophilized peptides and research compounds manufactured to the strictest laboratory standards. Trusted by researchers worldwide.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/compounds">
                  <button className="inline-flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#3A9E94]/20">
                    Browse Compounds
                    <ArrowRight size={16} />
                  </button>
                </Link>
                <Link href="/compounds">
                  <button className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 active:scale-[0.98]">
                    View Categories
                  </button>
                </Link>
              </div>
              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E8F7F6] flex items-center justify-center">
                    <Shield size={15} style={{color:"#3A9E94"}} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Third-party Tested</p>
                    <p className="text-[11px] text-gray-400">COA on every batch</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E8F7F6] flex items-center justify-center">
                    <Microscope size={15} style={{color:"#3A9E94"}} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Lab Manufactured</p>
                    <p className="text-[11px] text-gray-400">GMP-compliant facilities</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Award size={15} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">≥99% Purity</p>
                    <p className="text-[11px] text-gray-400">HPLC verified</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Vial grid */}
            <div className="hidden lg:block relative">
              {/* Main large vial */}
              <div className="relative">
                <Link href="/compounds/bpc-157">
                  <div className="group bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed] rounded-3xl h-72 flex items-center justify-center cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 mb-4 relative">
                    <VialPlaceholder label="BPC-157" size="10mg" color="#7c3aed" large />
                    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-5 py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-sm font-extrabold text-gray-900">BPC-157</p>
                      <p className="text-xs text-gray-400">Tissue Repair · 10mg / 20mg · From $55.00</p>
                    </div>
                    <div className="absolute top-3 left-3 bg-[#3A9E94] text-white text-[10px] font-bold px-2 py-1 rounded-full">Popular</div>
                  </div>
                </Link>
                {/* Small vials row */}
                <div className="grid grid-cols-3 gap-3">
                  {FEATURED_PRODUCTS.slice(1, 4).map((p) => (
                    <Link key={p.name} href={`/compounds/${p.slug}`}>
                      <div className="group bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed] rounded-2xl h-36 flex items-center justify-center cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 overflow-hidden border border-gray-100 relative">
                        <VialPlaceholder label={p.name} size={p.size} color={p.color} />
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-2 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                          <p className="text-[11px] font-bold text-gray-900">{p.name}</p>
                          <p className="text-[9px] text-gray-400">{p.price}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <section className="bg-gray-950 text-white py-8">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "23+", label: "Research Compounds" },
              { value: "≥99%", label: "Purity Guaranteed" },
              { value: "5", label: "Research Categories" },
              { value: "COA", label: "Every Batch Tested" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold text-[#7ECDC4] mb-1">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESEARCH CATEGORIES ──────────────────────────────────────────── */}
      <section className="py-20 hex-cream">
        <div className="container">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-2">Research Areas</p>
            <h2 className="text-3xl font-extrabold text-gray-950">Explore by Category</h2>
            <p className="text-gray-400 mt-2 max-w-lg">Our catalog spans five research categories, each with compounds selected for their scientific relevance and purity profile.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {RESEARCH_CATEGORIES.map((cat) => (
              <Link key={cat.label} href="/compounds">
                <div className={`group bg-gradient-to-br ${cat.color} border border-white rounded-2xl p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.01]`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: cat.accent + "20" }}>
                    <cat.icon size={20} style={{ color: cat.accent }} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{cat.label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{cat.desc}</p>
                  <div className="flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color: cat.accent }}>
                    View compounds <ChevronRight size={12} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESEARCH COMPOUNDS CATALOG (Nulumin-style) ───────────────────── */}
      <ResearchCatalogSection />

      {/* ── COMPOUND SPOTLIGHT ───────────────────────────────────────────── */}
      <section className="py-20 hex-section">
        <div className="container">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-2">Compound Spotlight</p>
            <h2 className="text-3xl font-extrabold text-gray-950">Research Highlights</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* BPC-157 spotlight */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-md transition-all">
              <div className="flex items-start gap-6">
                <div className="w-24 h-32 shrink-0 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl overflow-hidden">
                  <VialPlaceholder label="BPC-157" size="10mg" color="#7c3aed" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7ECDC4]" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-[#3A9E94]">Tissue</span>
                    <span className="text-[10px] bg-[#E8F7F6] text-[#3A9E94] font-semibold px-2 py-0.5 rounded-full">Popular</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-950 mb-2">BPC-157</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    Body Protection Compound-157 is a pentadecapeptide derived from a protective protein found in the stomach. Extensively studied for its tissue repair, cytoprotective, and anti-inflammatory properties in preclinical models.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900">From $60.00</span>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-full">10mg · 20mg</span>
                  </div>
                  <Link href="/compounds/bpc-157">
                    <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3A9E94] hover:text-[#2A8E84] transition-colors">
                      View Research <ArrowRight size={13} />
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {/* NAD+ spotlight */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-md transition-all">
              <div className="flex items-start gap-6">
                <div className="w-24 h-32 shrink-0 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl overflow-hidden">
                  <VialPlaceholder label="NAD+" size="500mg" color="#db2777" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A84B]" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-[#A07A28]">Metabolic</span>
                    <span className="text-[10px] bg-[#FBF6E8] text-[#A07A28] font-semibold px-2 py-0.5 rounded-full">Popular</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-950 mb-2">NAD+</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    Nicotinamide Adenine Dinucleotide is an essential coenzyme found in all living cells. Research focuses on its role in cellular energy metabolism, DNA repair, and mitochondrial function as a key regulator of aging pathways.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900">From $85.00</span>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-full">250mg · 500mg</span>
                  </div>
                  <Link href="/compounds/nad-plus">
                    <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#A07A28] hover:text-[#8A6A20] transition-colors">
                      View Research <ArrowRight size={13} />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-20 hex-section">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-2">Process</p>
            <h2 className="text-3xl font-extrabold text-gray-950">How It Works</h2>
            <p className="text-gray-400 mt-2 max-w-md mx-auto">From catalog to your laboratory in a few simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "01", title: "Browse & Select", desc: "Explore our catalog of research compounds, filter by category or mechanism, and select your compound and dosage." },
              { step: "02", title: "Secure Checkout", desc: "Register, apply any discount coupon, complete your shipping details and proceed through our secure payment flow." },
              { step: "03", title: "Fast Dispatch", desc: "Orders are processed same-day. Each vial ships with a Certificate of Analysis confirming purity and identity." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F7F6] flex items-center justify-center mx-auto mb-4">
                  <span className="text-sm font-extrabold text-[#3A9E94]">{item.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-[#0d1a18] via-[#163028] to-[#0a1f18] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container relative text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
            <FlaskConical size={24} className="text-white" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
            Ready to Start Your Research?
          </h2>
          <p className="text-[#7ECDC4]/80 text-lg mb-8 max-w-md mx-auto">
            Browse our complete catalog of research-grade compounds and peptides.
          </p>
          <Link href="/compounds">
            <button className="inline-flex items-center gap-2 bg-[#7ECDC4] text-[#0d1a18] font-bold px-8 py-3.5 rounded-xl hover:bg-[#5BB8AE] transition-all duration-200 active:scale-[0.98] shadow-xl shadow-black/20">
              Explore All Compounds <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#7ECDC4] flex items-center justify-center">
                <FlaskConical size={15} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">BioLab Compounds</span>
                <p className="text-[11px] text-gray-500 leading-none mt-0.5">Research Grade · For Scientific Use Only</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center">
              For research purposes only. Not for human consumption. All compounds are intended for laboratory use.
            </p>
            <p className="text-xs text-gray-600">© 2026 BioLab Compounds</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
