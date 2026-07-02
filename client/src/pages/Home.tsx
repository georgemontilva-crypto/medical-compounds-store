import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { Link } from "wouter";
import { ArrowRight, FlaskConical, Shield, Microscope, Award, ChevronRight, Plus, Beaker, Dna, Zap, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";

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
  { name: "BPC-157", category: "Tissue", size: "10mg", color: "#7c3aed", description: "Pentadecapeptide with potent tissue repair and cytoprotective properties.", price: "$60.00", slug: "bpc-157" },
  { name: "TB-500", category: "Tissue", size: "10mg", color: "#7c3aed", description: "Thymosin Beta-4 fragment promoting actin regulation and tissue recovery.", price: "$60.00", slug: "tb-500" },
  { name: "NAD+", category: "Metabolic", size: "500mg", color: "#db2777", description: "Nicotinamide Adenine Dinucleotide — essential coenzyme for cellular energy metabolism.", price: "$85.00", slug: "nad-plus" },
  { name: "GHK-Cu", category: "Tissue", size: "50mg", color: "#0ea5e9", description: "Copper peptide with regenerative and anti-inflammatory signaling properties.", price: "$60.00", slug: "ghk-cu" },
  { name: "Sermorelin", category: "Endocrine", size: "5mg", color: "#f59e0b", description: "GHRH analogue that stimulates natural growth hormone secretion.", price: "$55.00", slug: "sermorelin" },
  { name: "MOTS-C", category: "Metabolic", size: "10mg", color: "#10b981", description: "Mitochondrial-derived peptide regulating metabolic homeostasis.", price: "$90.00", slug: "mots-c" },
  { name: "PT-141", category: "Endocrine", size: "10mg", color: "#ec4899", description: "Melanocortin receptor agonist studied for central nervous system effects.", price: "$65.00", slug: "pt-141" },
  { name: "Semax", category: "Neural", size: "10mg", color: "#6366f1", description: "Synthetic peptide analogue of ACTH with neuroprotective properties.", price: "$70.00", slug: "semax" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Tissue: "#7c3aed",
  Cellular: "#0ea5e9",
  Neural: "#6366f1",
  Metabolic: "#10b981",
  Endocrine: "#f59e0b",
  Misc: "#6b7280",
};

const RESEARCH_CATEGORIES = [
  { icon: Dna, label: "Tissue Repair", desc: "BPC-157, TB-500, GHK-Cu, KPV", color: "from-violet-50 to-purple-50", accent: "#7c3aed" },
  { icon: Zap, label: "Metabolic", desc: "NAD+, MOTS-C, SS-31", color: "from-emerald-50 to-teal-50", accent: "#10b981" },
  { icon: Activity, label: "Neural", desc: "Semax, Selank, PT-141", color: "from-indigo-50 to-blue-50", accent: "#6366f1" },
  { icon: Beaker, label: "Endocrine", desc: "Sermorelin, Tesamorelin, CJC-1295", color: "from-amber-50 to-yellow-50", accent: "#f59e0b" },
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

// ── Main Home ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: liveProducts } = trpc.products.list.useQuery({ featured: true, limit: 8 });

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white">
        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-100/60 to-indigo-50/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-50/50 to-purple-50/30 blur-2xl" />
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
              <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <FlaskConical size={12} />
                Research Grade · ≥99% Purity
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 leading-[1.05] mb-6">
                Precision<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">
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
                  <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-violet-200">
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
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Shield size={15} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Third-party Tested</p>
                    <p className="text-[11px] text-gray-400">COA on every batch</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Microscope size={15} className="text-indigo-600" />
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
                    <div className="absolute top-3 left-3 bg-violet-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">Popular</div>
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
                <p className="text-2xl font-extrabold text-violet-400 mb-1">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESEARCH CATEGORIES ──────────────────────────────────────────── */}
      <section className="py-20 bg-[#f8f8fa]">
        <div className="container">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-2">Research Areas</p>
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

      {/* ── FEATURED PRODUCTS ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-2">Featured</p>
              <h2 className="text-3xl font-extrabold text-gray-950">Popular Compounds</h2>
              <p className="text-gray-400 mt-2">Most researched peptides in our catalog</p>
            </div>
            <Link href="/compounds">
              <button className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                View all <ArrowRight size={14} />
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {FEATURED_PRODUCTS.map((product) => (
              <ProductCard key={product.name} product={product} />
            ))}
          </div>
          <div className="text-center mt-10 sm:hidden">
            <Link href="/compounds">
              <button className="lab-btn-secondary">View all compounds <ArrowRight size={14} /></button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── COMPOUND SPOTLIGHT ───────────────────────────────────────────── */}
      <section className="py-20 bg-[#f8f8fa]">
        <div className="container">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-2">Compound Spotlight</p>
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
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-violet-600">Tissue</span>
                    <span className="text-[10px] bg-violet-50 text-violet-600 font-semibold px-2 py-0.5 rounded-full">Popular</span>
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
                    <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors">
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
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-pink-600">Metabolic</span>
                    <span className="text-[10px] bg-pink-50 text-pink-600 font-semibold px-2 py-0.5 rounded-full">Popular</span>
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
                    <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors">
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
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-2">Process</p>
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
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                  <span className="text-sm font-extrabold text-violet-600">{item.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-violet-600 to-indigo-600 relative overflow-hidden">
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
          <p className="text-violet-200 text-lg mb-8 max-w-md mx-auto">
            Browse our complete catalog of research-grade compounds and peptides.
          </p>
          <Link href="/compounds">
            <button className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-8 py-3.5 rounded-xl hover:bg-violet-50 transition-all duration-200 active:scale-[0.98] shadow-xl shadow-violet-900/20">
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
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
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
