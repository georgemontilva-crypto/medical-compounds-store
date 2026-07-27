import { trpc } from "@/lib/trpc";
import { getLenis } from "@/lib/lenis";
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { Link } from "wouter";
import { ArrowRight, FlaskConical, Shield, Microscope, Award, Plus, Check, Search, ChevronDown, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import HeroSlider from "@/components/HeroSlider";
import Reveal from "@/components/Reveal";
import ProductCard from "@/components/ProductCard";
import ParticleBackground from "@/components/ParticleBackground";
import { useTheme } from "@/contexts/ThemeContext";

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
  { name: "BPC-157", category: "Tissue", size: "10mg", color: "#dbcfba", description: "Pentadecapeptide with potent tissue repair and cytoprotective properties.", price: "$60.00", slug: "bpc-157" },
  { name: "TB-500", category: "Tissue", size: "10mg", color: "#dbcfba", description: "Thymosin Beta-4 fragment promoting actin regulation and tissue recovery.", price: "$60.00", slug: "tb-500" },
  { name: "NAD+", category: "Metabolic", size: "500mg", color: "#C8A84B", description: "Nicotinamide Adenine Dinucleotide — essential coenzyme for cellular energy metabolism.", price: "$85.00", slug: "nad-plus" },
  { name: "GHK-Cu", category: "Tissue", size: "50mg", color: "#d7cab3", description: "Copper peptide with regenerative and anti-inflammatory signaling properties.", price: "$60.00", slug: "ghk-cu" },
  { name: "Sermorelin", category: "Endocrine", size: "5mg", color: "#B8943A", description: "GHRH analogue that stimulates natural growth hormone secretion.", price: "$55.00", slug: "sermorelin" },
  { name: "MOTS-C", category: "Metabolic", size: "10mg", color: "#C8A84B", description: "Mitochondrial-derived peptide regulating metabolic homeostasis.", price: "$90.00", slug: "mots-c" },
  { name: "PT-141", category: "Endocrine", size: "10mg", color: "#B8943A", description: "Melanocortin receptor agonist studied for central nervous system effects.", price: "$65.00", slug: "pt-141" },
  { name: "Semax", category: "Neural", size: "10mg", color: "#d3c4ab", description: "Synthetic peptide analogue of ACTH with neuroprotective properties.", price: "$70.00", slug: "semax" },
];

// ── Category color maps (shared) ─────────────────────────────────────────────
const CAT_COLORS_MAP: Record<string, string> = {
  Tissue: "#dbcfba", Cellular: "#d7cab3", Neural: "#d3c4ab",
  Metabolic: "#C8A84B", Endocrine: "#B8943A", Misc: "#8a9ba8",
};
const CAT_TEXT_MAP: Record<string, string> = {
  Tissue: "text-[#d3c4ab]", Cellular: "text-[#d3c4ab]", Neural: "text-[#baac96]",
  Metabolic: "text-[#A07A28] dark:text-[#C8A84B]", Endocrine: "text-[#A07A28] dark:text-[#C8A84B]", Misc: "text-gray-500 dark:text-gray-400",
};
const CAT_BG_MAP: Record<string, string> = {
  Tissue: "bg-[#f2ede6] dark:bg-white/10", Cellular: "bg-[#f2ede6] dark:bg-white/10", Neural: "bg-[#DFF4F3] dark:bg-white/10",
  Metabolic: "bg-[#FBF6E8] dark:bg-white/10", Endocrine: "bg-[#FBF6E8] dark:bg-white/10", Misc: "bg-gray-50 dark:bg-white/10",
};

const CATALOG_PRODUCTS_RAW = [
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
const CATALOG_PRODUCTS = CATALOG_PRODUCTS_RAW.map((p) => ({ ...p, isMock: true as const }));

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
  const catBg = CAT_BG_MAP[product.category] ?? "bg-gray-50 dark:bg-white/10";
  const hasVariations = product.sizes.length > 1;
  const shortLabel = product.name.length > 9 ? product.name.slice(0, 9) : product.name;

  return (
    <div className="group relative h-full flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 dark:bg-card dark:border-border dark:hover:border-white/20">
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
      <div className="p-4 flex-1 flex flex-col">
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
          <h3 className="font-bold text-gray-950 text-sm mb-1 cursor-pointer hover:text-[#d3c4ab] transition-colors dark:text-white line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
        </Link>
        <div className="flex flex-wrap gap-1 mb-2">
          {product.sizes.map((s) => (
            <span key={s} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full font-mono dark:text-gray-500 dark:bg-white/10">{s}</span>
          ))}
        </div>
        <p className="font-semibold text-gray-900 text-sm mt-auto dark:text-white">{hasVariations ? "From " : ""}${product.price.toFixed(2)}</p>
      </div>
    </div>
  );
}


// ── Doc Integrity Section ─────────────────────────────────────────────────────
const CALLOUT_POSITION_CLASS: Record<string, string> = {
  top: "top-8",
  middle: "top-1/2 -translate-y-1/2",
  bottom: "bottom-8",
};

function DocIntegrityCallout({ position, title, description }: {
  position: string;
  title?: string | null;
  description?: string | null;
}) {
  if (!title) return null;
  return (
    <div className={`absolute right-4 ${CALLOUT_POSITION_CLASS[position] ?? "top-8"} w-[180px] max-w-[45%] z-10`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-px bg-[#dbcfba]/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#dbcfba]" />
      </div>
      <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-3">
        <p className="text-white font-semibold text-xs mb-1">{title}</p>
        {description && <p className="text-white/60 text-[11px] leading-snug">{description}</p>}
      </div>
    </div>
  );
}

// Mobile-only: callouts stack below the image as a plain list instead of
// overlaying it (position: absolute over a portrait bottle photo left almost
// no visible product on small screens).
function DocIntegrityCalloutRow({ title, description }: {
  title?: string | null;
  description?: string | null;
}) {
  if (!title) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#dbcfba] shrink-0" />
      <div>
        <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
        {description && <p className="text-white/60 text-xs leading-snug">{description}</p>}
      </div>
    </div>
  );
}

function DocIntegritySection() {
  const { data } = trpc.docIntegrity.get.useQuery();

  const eyebrowText = data?.eyebrowText || "DOCUMENTATION BY DESIGN";
  const headingLine1 = data?.headingLine1 || "Research-grade integrity,";
  const headingLine2 = data?.headingLine2 || "documented at every layer.";
  const bodyText = data?.bodyText || "Brighter Days Labs documents every batch with lab-verified data researchers can trust — from synthesis to shipment.";
  const cardBadge = data?.cardBadge || "COA-LINKED";
  const cardSubtext = data?.cardSubtext || "Lot-traceable";
  const cardTitle = data?.cardTitle || "Batch-specific documentation";
  const cardDetail = data?.cardDetail || "QR access on every vial · ≥99% HPLC verified · US-made, GMP-aligned";

  return (
    <section className="py-20 bg-[#0a0a0f] dark:bg-black">
      <div className="container grid md:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#dbcfba] mb-4">{eyebrowText}</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-5">
            {headingLine1}<br />{headingLine2}
          </h2>
          <p className="text-white/60 text-base leading-relaxed mb-8 max-w-md">{bodyText}</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#dbcfba]/20 text-[#dbcfba] tracking-wide">{cardBadge}</span>
              <span className="text-xs text-white/40">{cardSubtext}</span>
            </div>
            <p className="text-white font-bold text-sm mb-2">{cardTitle}</p>
            <p className="text-white/50 text-xs leading-relaxed">{cardDetail}</p>
          </div>
        </div>

        {/* Right: hero image + callouts */}
        <div>
          <div className="relative rounded-3xl overflow-hidden h-72 md:h-[500px] bg-gradient-to-b from-white/5 to-transparent border border-white/10 dark:bg-none dark:bg-background">
            {data?.heroImageUrl ? (
              <img src={data.heroImageUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FlaskConical size={64} className="text-white/10" />
              </div>
            )}
            {/* Desktop only: callouts overlaid on the image at fixed positions */}
            <div className="hidden md:block">
              <DocIntegrityCallout position={data?.callout1Position ?? "top"} title={data?.callout1Title} description={data?.callout1Description} />
              <DocIntegrityCallout position={data?.callout2Position ?? "middle"} title={data?.callout2Title} description={data?.callout2Description} />
              <DocIntegrityCallout position={data?.callout3Position ?? "bottom"} title={data?.callout3Title} description={data?.callout3Description} />
            </div>
          </div>

          {/* Mobile only: callouts stacked below the image as a plain list */}
          <div className="md:hidden mt-6 space-y-4">
            <DocIntegrityCalloutRow title={data?.callout1Title} description={data?.callout1Description} />
            <DocIntegrityCalloutRow title={data?.callout2Title} description={data?.callout2Description} />
            <DocIntegrityCalloutRow title={data?.callout3Title} description={data?.callout3Description} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Category Showcase (sticky horizontal scroll) ─────────────────────────────
// Navbar.tsx renders <header className="sticky top-0 ..."> with an inner h-16
// (64px) row plus a 1px border-b — the showcase's own sticky pin must start
// below that, or the navbar overlaps the first ~65px of each slide.
const NAVBAR_HEIGHT = 65;

type ShowcaseCategory = {
  id: number;
  name: string;
  slug: string;
  color?: string | null;
  heroImageUrl?: string | null;
  badgeCode?: string | null;
  tagline?: string | null;
  ctaText?: string | null;
  questionText?: string | null;
  sortOrder?: number | null;
};

function CategorySlideContent({ category, index, total, roundedClassName = "rounded-3xl overflow-hidden" }: {
  category: ShowcaseCategory;
  index: number;
  total: number;
  // On mobile the stack wrapper (CategoryShowcase) owns rounding + clipping
  // itself, since it needs to animate the corner radius per scroll frame —
  // pass "" there to avoid double-rounding/clipping.
  roundedClassName?: string;
}) {
  const { data: products = [] } = trpc.products.list.useQuery({ categoryId: category.id, limit: 30 });
  const { theme } = useTheme();
  const accent = category.color || "#6366f1";
  const badge = category.badgeCode || category.name.slice(0, 3).toUpperCase();
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  // Dark keeps the existing near-black card with a bolder accent tint; light
  // swaps to the site's off-white --background with a much subtler tint so
  // the card reads as "light with a hint of accent" instead of dark either way.
  const cardBase = theme === "dark" ? "#0a0a0f" : "#F5F2EC";
  const imageAccentAlpha = theme === "dark" ? "40" : "14";
  // Dark: unchanged diagonal accent-to-black blend. Light: flat neutral base
  // with a soft accent glow pinned to the top-left corner instead of a
  // diagonal tint, so it reads as "light card with a glow" not "gradient".
  const cardBackground =
    theme === "dark"
      ? `linear-gradient(135deg, ${accent}33 0%, ${cardBase} 55%)`
      : `radial-gradient(circle at top left, ${accent}25 0%, transparent 50%), ${cardBase}`;
  // Text/border tokens hardcoded to white only worked because the card was
  // always dark — now that light mode has a near-white cardBase, they need
  // to flip to dark-on-light too, or they'd be near-invisible.
  const textPrimary = theme === "dark" ? "text-white" : "text-[#0a0a0f]";
  const textSecondary = theme === "dark" ? "text-white/60" : "text-black/55";
  const textTertiary = theme === "dark" ? "text-white/30" : "text-black/35";
  const chipText = theme === "dark" ? "text-white/70" : "text-black/70";
  const chipBg = theme === "dark" ? "bg-white/5" : "bg-black/5";
  const chipBorder = theme === "dark" ? "border-white/10" : "border-black/10";

  // Mobile-only "Read more" for the tagline — measured once (while still
  // clamped, since this runs before any expansion) via scrollHeight vs
  // clientHeight, the standard way to detect line-clamp truncation.
  const [taglineExpanded, setTaglineExpanded] = useState(false);
  const [taglineOverflows, setTaglineOverflows] = useState(false);
  const taglineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = taglineRef.current;
    if (!el) return;
    setTaglineOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [category.tagline]);

  return (
    <div
      className={`relative h-full w-full flex flex-col md:flex-row items-start md:items-center ${roundedClassName}`}
      style={{ background: cardBackground, backgroundColor: cardBase }}
    >
      {/* Subtle grid pattern tinted with the category accent, fading out via a radial mask */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${accent}30 1px, transparent 1px), linear-gradient(90deg, ${accent}30 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          WebkitMaskImage: "radial-gradient(circle at 30% 45%, black 0%, transparent 70%)",
          maskImage: "radial-gradient(circle at 30% 45%, black 0%, transparent 70%)",
        }}
      />
      {/* Padding used to live on the root, which also wrapped the mobile hero
          image below — that's why it stayed inset instead of reaching the
          card's edges. Padding now lives here, on the text container only,
          so the root itself stays edge-to-edge for the image sibling. */}
      <div className="container relative z-10 grid md:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] gap-6 md:gap-10 items-start md:items-center p-6 md:px-0 md:py-10">
        {/* Left */}
        <div>
          <div className="flex items-center gap-3 mb-3 md:mb-6">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: `${accent}25`, color: accent }}
            >
              {badge} · {products.length} COMPOUND{products.length !== 1 ? "S" : ""}
            </span>
            <span className={`text-xs font-mono ${textTertiary}`}>{counter}</span>
          </div>
          <h2 className={`text-2xl md:text-4xl lg:text-5xl font-extrabold ${textPrimary} leading-tight mb-3 md:mb-4`}>
            {category.name}
          </h2>
          {category.tagline && (
            <div className="mb-3 md:mb-6 max-w-md">
              <p
                ref={taglineRef}
                className={`${textSecondary} text-sm md:text-base leading-relaxed md:line-clamp-none ${
                  taglineExpanded ? "" : "line-clamp-2"
                }`}
              >
                {category.tagline}
              </p>
              {taglineOverflows && (
                <button
                  type="button"
                  onClick={() => setTaglineExpanded((v) => !v)}
                  className="md:hidden text-xs font-semibold mt-1"
                  style={{ color: accent }}
                >
                  {taglineExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
          {products.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 md:mb-8">
              {products.slice(0, 8).map((p) => (
                <span key={p.id} className={`text-xs ${chipText} ${chipBg} border ${chipBorder} px-3 py-1.5 rounded-full`}>
                  {p.name}
                </span>
              ))}
            </div>
          )}
          <Link href={`/compounds?category=${category.slug}`}>
            <button
              className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-[#0a0a0f] transition-transform active:scale-[0.97]"
              style={{ backgroundColor: accent }}
            >
              {category.ctaText || "Explore Category"}
              <ArrowRight size={16} />
            </button>
          </Link>
        </div>

        {/* Hero image (desktop only) — the mobile version renders full-bleed below, outside .container's padding */}
        <div
          className="hidden md:block relative rounded-3xl overflow-hidden md:h-[70vh] md:max-h-[560px]"
          style={{ background: `linear-gradient(160deg, ${accent}${imageAccentAlpha}, ${cardBase})` }}
        >
          {category.heroImageUrl ? (
            <img src={category.heroImageUrl} alt={category.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FlaskConical size={64} style={{ color: accent }} className="opacity-40" />
            </div>
          )}

          {/* Floating question card, bottom corner of the hero image */}
          {category.questionText && (
            <div
              className="absolute bottom-4 left-4 right-4 rounded-2xl p-5 border-t-2"
              style={{ backgroundColor: "rgba(10,10,15,0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTopColor: accent }}
            >
              <p className="text-white font-semibold text-sm leading-snug mb-3">{category.questionText}</p>
              {products.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {products.slice(0, 4).map((p) => (
                    <span key={p.id} className="text-[10px] text-white/80 bg-white/10 px-2 py-1 rounded-full">
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              {category.tagline && (
                <p className="text-[11px] text-gray-400 mb-3 leading-relaxed line-clamp-2">{category.tagline}</p>
              )}
              <Link href={`/compounds?category=${category.slug}`}>
                <button
                  className="text-xs font-bold tracking-wide px-4 py-2 rounded-lg transition-transform active:scale-[0.97]"
                  style={{ backgroundColor: accent, color: "#0a0a0f" }}
                >
                  EXPLORE {category.name.toUpperCase()} COMPOUNDS
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only hero image — direct child of the (now unpadded) root, so
          it spans the full card width with zero extra work; flex-1 makes it
          fill all height left over after the text block, down to the card's
          bottom edge. No rounding of its own — it's clipped by the outer
          card wrapper (CategoryShowcase on mobile), which owns the card's
          real (scroll-driven) corner radius. object-cover (not contain) so
          it always fills the strip with no empty letterboxed space. */}
      <div className="md:hidden relative flex-1 w-full min-h-0" style={{ background: `linear-gradient(160deg, ${accent}${imageAccentAlpha}, ${cardBase})` }}>
        {category.heroImageUrl ? (
          <img src={category.heroImageUrl} alt={category.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FlaskConical size={48} style={{ color: accent }} className="opacity-40" />
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryShowcase() {
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const sorted = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );
  const n = sorted.length;

  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Scroll-progress writes transforms straight to the DOM via refs instead of
  // React state. Driving this through setState re-rendered the whole
  // CategoryShowcase tree (and every CategorySlideContent's own data hooks)
  // on every scroll tick, which is what caused the visible jank on mobile.
  // useLayoutEffect (not useEffect) so the first transform is applied before
  // paint — otherwise cards briefly flash at their untransformed position.
  useLayoutEffect(() => {
    if (n <= 1) return;
    let rafId = 0;
    const MAX_STACK_DEPTH = 3;

    // stickyHeight/scrollable only change on resize (or orientation change),
    // never on scroll — cached here instead of recomputed every frame inside
    // measure(). The only per-frame DOM read left is getBoundingClientRect()
    // for the section's live position, which is the one value that actually
    // changes as the user scrolls.
    let stickyHeight = 0;
    let scrollable = 0;

    function recomputeMeasurements() {
      const el = sectionRef.current;
      if (!el) return;
      stickyHeight = window.innerHeight - NAVBAR_HEIGHT;
      scrollable = el.offsetHeight - stickyHeight;
    }

    function applyTransforms(progress: number) {
      const activeIndex = progress * (n - 1);
      if (isDesktop) {
        const track = trackRef.current;
        if (track) {
          track.style.transform = `translateX(-${(progress * (n - 1) * 100) / n}%)`;
        }
      } else {
        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          const raw = activeIndex - i;
          const isUpcoming = raw <= 0;
          const t = Math.max(0, Math.min(1, raw + 1));
          const depth = Math.max(0, Math.min(raw, MAX_STACK_DEPTH));
          el.style.transform = isUpcoming
            ? `translateY(${(1 - t) * 100}%) scale(1)`
            : `translateY(${-depth * 10}px) scale(${1 - depth * 0.02})`;
          // Only the settled, front-most card shows a rounded top edge.
          // Cards still sliding in or already receded behind it are flat, so
          // the peeking strip below reads as a plain block of that
          // category's color instead of a card cut off mid-corner.
          const activeness = Math.max(0, 1 - Math.abs(raw) / 0.5);
          const topRadius = Math.round(24 * activeness);
          el.style.borderRadius = `${topRadius}px ${topRadius}px 0 0`;
        });
      }
    }

    function measure() {
      rafId = 0;
      const el = sectionRef.current;
      if (!el || scrollable <= 0) return;
      // The sticky child is pinned at top: NAVBAR_HEIGHT with height
      // calc(100vh - NAVBAR_HEIGHT), so the scrollable pin range is the
      // section height minus that (smaller) sticky height — not the full
      // viewport height as it would be for a plain top:0/h-screen sticky.
      const raw = (NAVBAR_HEIGHT - el.getBoundingClientRect().top) / scrollable;
      applyTransforms(Math.min(1, Math.max(0, raw)));
    }

    function onNativeScroll() {
      if (rafId) return;
      rafId = requestAnimationFrame(measure);
    }

    function onResize() {
      recomputeMeasurements();
      measure();
    }

    recomputeMeasurements();

    // Lenis drives the real document scroll position itself (not a virtual
    // transform), so getBoundingClientRect() above stays accurate — but the
    // documented, supported way to react to that scroll (mirroring Lenis's
    // own GSAP ScrollTrigger integration example) is lenis.on("scroll", ...),
    // not assuming native window scroll events still fire the same way
    // during smoothing. Falls back to the native listener if Lenis hasn't
    // initialized yet for some reason.
    //
    // Lenis's own 'scroll' event already fires once per its internal rAF
    // tick (autoRaf: true), so measure() is called directly here — wrapping
    // it in another requestAnimationFrame just deferred everything to the
    // NEXT frame for no throttling benefit, adding ~16ms of avoidable lag on
    // every scroll update. The rAF guard is kept only for the native
    // fallback, where it's still needed since native scroll events can fire
    // more than once per frame.
    const lenis = getLenis();
    if (lenis) {
      lenis.on("scroll", measure);
    } else {
      window.addEventListener("scroll", onNativeScroll, { passive: true });
    }
    window.addEventListener("resize", onResize);
    measure();
    return () => {
      if (lenis) {
        lenis.off("scroll", measure);
      } else {
        window.removeEventListener("scroll", onNativeScroll);
      }
      window.removeEventListener("resize", onResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [n, isDesktop]);

  if (n === 0) return null;

  return (
    <section ref={sectionRef} className="relative bg-white dark:bg-background" style={{ height: `${n * 100}vh` }}>
      <div
        className="sticky w-full overflow-hidden bg-white dark:bg-background"
        style={{ top: NAVBAR_HEIGHT, height: `calc(100vh - ${NAVBAR_HEIGHT}px)` }}
      >
        {isDesktop ? (
          <div
            ref={trackRef}
            className="flex h-full"
            style={{ width: `${n * 100}%`, willChange: "transform" }}
          >
            {sorted.map((cat, i) => (
              <div key={cat.id} className="h-full shrink-0 px-6 sm:px-10 py-14" style={{ width: `${100 / n}%` }}>
                <CategorySlideContent category={cat} index={i} total={n} />
              </div>
            ))}
          </div>
        ) : (
          // Mobile "deck of cards": every slide is stacked in the same spot,
          // z-index rising with index so later categories cover earlier ones.
          // Cards not yet reached slide up from below; cards already passed
          // settle into a shallow, capped-depth stack peeking out above.
          <div className="relative w-full h-full">
            {sorted.map((cat, i) => (
              <div
                key={cat.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="absolute inset-x-0 top-5 bottom-0 overflow-hidden"
                style={{ zIndex: 10 + i, willChange: "transform, border-radius" }}
              >
                <CategorySlideContent category={cat} index={i} total={n} roundedClassName="" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ResearchCatalogSection() {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<HomeSortOption>("featured");
  const [sortOpen, setSortOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const SORT_LABELS: Record<HomeSortOption, string> = {
    featured: "Featured",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    name_asc: "Name A-Z",
  };
  const { addItem } = useCart();

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: liveProducts = [], isLoading } = trpc.products.list.useQuery({ featured: true, limit: 8 });

  // Show the mock catalog only when the DB has no featured products yet.
  const useStaticData = liveProducts.length === 0 && !isLoading;

  const filteredStatic = useMemo(() => {
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

  const filteredLive = useMemo(() => {
    let list = [...liveProducts];
    if (selectedCategoryId) list = list.filter((p) => p.categoryId === selectedCategoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (sortBy === "price_asc") list.sort((a, b) => Number(a.basePrice) - Number(b.basePrice));
    else if (sortBy === "price_desc") list.sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
    else if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return list;
  }, [liveProducts, search, selectedCategoryId, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    liveProducts.forEach((p) => { if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1; });
    return counts;
  }, [liveProducts]);

  const handleAdd = (product: typeof CATALOG_PRODUCTS[0]) => {
    if (product.isMock) return;
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

  const handleLiveAdd = (payload: {
    productId: number; variationId?: number; productName: string;
    variationLabel?: string; unitPrice: number; image?: string; slug: string;
  }) => {
    addItem({ ...payload, quantity: 1 });
    setAddedIds((prev) => {
      const next = new Set(prev); next.add(payload.productId);
      setTimeout(() => setAddedIds((p) => { const n = new Set(p); n.delete(payload.productId); return n; }), 2000);
      return next;
    });
  };

  const totalCount = useStaticData ? CATALOG_PRODUCTS.length : liveProducts.length;

  const sidebarCats = useStaticData
    ? CATALOG_CATS.map((c) => ({ key: c.name as string | number, name: c.name, color: CAT_COLORS_MAP[c.name] ?? "#6b7280", count: c.count }))
    : categories
        .filter((c) => (categoryCounts[c.id] ?? 0) > 0)
        .map((c) => ({ key: c.id as string | number, name: c.name, color: c.color ?? CAT_COLORS_MAP[c.name] ?? "#6b7280", count: categoryCounts[c.id] ?? 0 }));

  const isAllActive = useStaticData ? selectedCat === null : selectedCategoryId === undefined;
  const isCatActive = (key: string | number) => (useStaticData ? selectedCat === key : selectedCategoryId === key);
  const handleAllClick = () => { setSelectedCat(null); setSelectedCategoryId(undefined); };
  const handleCatClick = (key: string | number) => {
    if (useStaticData) setSelectedCat(selectedCat === key ? null : (key as string));
    else setSelectedCategoryId(selectedCategoryId === key ? undefined : (key as number));
  };

  return (
    <section className="py-20 bg-white relative overflow-hidden dark:bg-background">
      <ParticleBackground
        color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
        particleRadius={3.5}
        particleOpacity={0.22}
        lineOpacity={0.14}
        linkDistance={150}
        className="absolute inset-0 w-full h-full"
      />
      <div className="container relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-[#f2ede6] border border-[#dbcfba]/30 text-[#d3c4ab] text-[11px] font-bold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#dbcfba]" />
            FULL CATALOG
          </div>
          <h2 className="text-4xl font-extrabold text-gray-950 mb-1 dark:text-white">Research Compounds</h2>
          <div className="w-16 h-1 rounded-full bg-gradient-to-r from-[#dbcfba] via-[#C8A84B] to-[#d7cab3] mb-4" />
          <p className="text-gray-500 text-sm max-w-xl dark:text-gray-400">
            {totalCount} compounds across {sidebarCats.length} research categories. Click any card to view the full research monograph.
          </p>
        </div>

        {/* Layout: sidebar + content */}
        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 bg-white border border-gray-100 rounded-2xl p-4 sticky top-[80px] self-start dark:bg-card dark:border-border">
            <button
              onClick={handleAllClick}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isAllActive ? "bg-[#d3c4ab] text-white" : "text-gray-700 hover:bg-[#F5F2EC] dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-2">
                <FlaskConical size={14} />
                All Compounds
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isAllActive ? "bg-white/20 text-white" : "bg-[#F5F2EC] text-gray-500 dark:bg-white/10 dark:text-gray-400"
              }`}>{totalCount}</span>
            </button>

            <div className="h-px bg-gray-100 my-2 dark:bg-white/10" />

            {sidebarCats.map((cat) => {
              const isActive = isCatActive(cat.key);
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCatClick(cat.key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                    isActive ? "bg-[#f2ede6] font-semibold text-gray-900 dark:bg-white/10 dark:text-white" : "text-gray-600 hover:bg-[#F5F2EC] dark:text-gray-300 dark:hover:bg-white/5"
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

            <div className="h-px bg-gray-100 my-2 dark:bg-white/10" />

            <Link href="/compounds">
              <button className="w-full flex items-center justify-center gap-2 border border-[#dbcfba]/50 text-[#d3c4ab] hover:bg-[#f2ede6] text-xs font-semibold py-2.5 rounded-xl transition-colors dark:hover:bg-white/10">
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
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name, CAS number, or mechanism..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/30 focus:border-[#dbcfba] transition-all dark:border-border dark:bg-card"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium hover:border-[#dbcfba] hover:text-[#baac96] transition-all whitespace-nowrap dark:bg-card dark:border-border dark:text-gray-300"
                >
                  {SORT_LABELS[sortBy]}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${sortOpen ? "rotate-180 text-[#baac96]" : "text-gray-400 dark:text-gray-500"}`} />
                </button>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#C8D8D6] rounded-xl shadow-lg shadow-[#d3c4ab]/10 z-20 overflow-hidden dark:bg-card dark:border-border dark:shadow-black/40">
                      {(Object.entries(SORT_LABELS) as [HomeSortOption, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => { setSortBy(val); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            sortBy === val
                              ? "bg-[#f2ede6] text-[#baac96] font-semibold border-l-2 border-[#d3c4ab]"
                              : "text-gray-700 hover:bg-[#F5F2EC] hover:text-[#d3c4ab] dark:text-gray-300 dark:hover:bg-white/5"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 lg:hidden">
              <button
                onClick={handleAllClick}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isAllActive ? "bg-[#d3c4ab] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                }`}
              >All ({totalCount})</button>
              {sidebarCats.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleCatClick(cat.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    isCatActive(cat.key) ? "bg-[#d3c4ab] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                  }`}
                >{cat.name} ({cat.count})</button>
              ))}
            </div>

            {/* Product grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
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
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                  <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No compounds found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                  {filteredStatic.map((product) => (
                    <CatalogVialCard
                      key={product.id}
                      product={product}
                      onAdd={() => handleAdd(product)}
                      added={addedIds.has(product.id)}
                    />
                  ))}
                </div>
              )
            ) : filteredLive.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No compounds found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                {filteredLive.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categories={categories}
                    onAdd={handleLiveAdd}
                    added={addedIds.has(product.id)}
                  />
                ))}
              </div>
            )}

            {/* View all link */}
            <div className="text-center mt-10">
              <Link href="/compounds">
                <button className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 hover:text-[#d3c4ab] hover:border-[#dbcfba]/50 hover:bg-[#f2ede6]/40 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors dark:border-border dark:text-gray-300 dark:hover:bg-white/5">
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
  const { theme } = useTheme();
  const { data: siteImages = [] } = trpc.siteImages.list.useQuery();
  const imageBySlot = Object.fromEntries(siteImages.map((img) => [img.slotKey, img.url]));
  const { data: allProducts = [] } = trpc.products.list.useQuery();
  const { data: allCategories = [] } = trpc.categories.list.useQuery();

  return (
    <div className="min-h-screen bg-[#f8f8fa] dark:bg-background">
      <Navbar />

      {/* ── HERO SLIDER ──────────────────────────────────────────────────── */}
      <Reveal>
        <HeroSlider />
      </Reveal>

      {/* ── HERO STATIC (hidden - replaced by slider) ─────────────────────── */}
      <section className="relative overflow-hidden bg-white hidden">
        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#dbcfba]/20 to-[#E8DCC8]/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-[#E8DCC8]/30 to-[#dbcfba]/20 blur-2xl" />
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
              <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{backgroundColor:"#f2ede6", borderColor:"#dbcfba", border:"1px solid", color:"#d3c4ab"}}>
                <FlaskConical size={12} />
                Research Grade · ≥99% Purity
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-950 leading-[1.05] mb-6">
                Precision<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d3c4ab] to-[#C8A84B]">
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
                  <button className="inline-flex items-center gap-2 bg-[#d3c4ab]/60 hover:bg-[#baac96]/60 text-gray-950 font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#d3c4ab]/20">
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
                  <div className="w-8 h-8 rounded-lg bg-[#f2ede6] flex items-center justify-center">
                    <Shield size={15} style={{color:"#d3c4ab"}} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Third-party Tested</p>
                    <p className="text-[11px] text-gray-400">COA on every batch</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#f2ede6] flex items-center justify-center">
                    <Microscope size={15} style={{color:"#d3c4ab"}} />
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
                    <div className="absolute top-3 left-3 bg-[#d3c4ab] text-white text-[10px] font-bold px-2 py-1 rounded-full">Popular</div>
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
      <section className="bg-gray-950 dark:bg-black text-white py-8">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: String(allProducts.length), label: "Research Compounds" },
              { value: "≥99%", label: "Purity Guaranteed" },
              { value: String(allCategories.length), label: "Research Categories" },
              { value: "Lab Tested", label: "Every Batch Verified" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold text-[#dbcfba] mb-1">{stat.value}</p>
                <p className="text-xs text-gray-400 font-medium tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESEARCH CATEGORIES (sticky horizontal showcase) ──────────────── */}
      <CategoryShowcase />

      {/* ── RESEARCH COMPOUNDS CATALOG (Nulumin-style) ───────────────────── */}
      <ResearchCatalogSection />


      {/* ── LAB QUALITY BANNER ─────────────────────────────────────────────── */}
      {/* Mobile (<768px): stacked image + solid card, dark text on light bg */}
      <Reveal>
      <section className="md:hidden">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={imageBySlot["home_lab_banner"] ?? "/manus-storage/modern-lab_a86acfc6.jpg"}
            alt="Modern research laboratory"
            className="w-full h-full object-cover object-[85%_center]"
          />
        </div>
        <div className="bg-[#F5F2EC] px-6 py-8 dark:bg-background">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#d3c4ab] mb-3">Quality Assurance</p>
          <h2 className="text-2xl font-extrabold text-gray-950 leading-tight mb-4 dark:text-white">
            Manufactured to the <span className="text-[#d3c4ab]">Highest Standards</span>
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6 dark:text-gray-400">
            Every compound is produced in GMP-compliant facilities, lyophilized for maximum stability, and verified by third-party HPLC analysis.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "GMP Compliant" },
              { label: "HPLC Verified" },
              { label: "MADE IN USA" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 dark:bg-white/10 dark:border-white/10">
                <Check size={12} className="text-[#d3c4ab]" />
                <span className="text-gray-700 text-xs font-semibold dark:text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Desktop (≥768px): image with text overlay — unchanged */}
      <Reveal>
      <section className="hidden md:block relative overflow-hidden aspect-[1738/796]">
        <img
          src={imageBySlot["home_lab_banner"] ?? "/manus-storage/modern-lab_a86acfc6.jpg"}
          alt="Modern research laboratory"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1a18]/80 via-[#0d1a18]/50 to-transparent dark:bg-none dark:bg-background/70" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <div className="max-w-lg">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#dbcfba] mb-3">Quality Assurance</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-4">
                Manufactured to the
                <br />
                <span className="text-[#dbcfba]">Highest Standards</span>
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-sm">
                Every compound is produced in GMP-compliant facilities, lyophilized for maximum stability, and verified by third-party HPLC analysis.
              </p>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: "GMP Compliant", icon: "✓" },
                  { label: "HPLC Verified", icon: "✓" },
                  { label: "MADE IN USA", icon: "✓" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5">
                    <span className="text-[#dbcfba] font-bold text-xs">{item.icon}</span>
                    <span className="text-white text-xs font-semibold">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      </Reveal>

      {/* ── DOCUMENTATION BY DESIGN ──────────────────────────────────────── */}
      <Reveal>
        <DocIntegritySection />
      </Reveal>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <ParticleBackground
          color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
          particleRadius={3.5}
          particleOpacity={0.22}
          lineOpacity={0.14}
          linkDistance={150}
          className="absolute inset-0 w-full h-full"
        />
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: image */}
            <div className="relative rounded-3xl overflow-hidden shadow-xl h-80 lg:h-[420px]">
              <img
                src={imageBySlot["home_how_it_works"] ?? "/manus-storage/lab-scientist_de975453.jpg"}
                alt="Scientist working in research laboratory"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a18]/60 via-transparent to-transparent dark:bg-none dark:bg-background/70" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-white font-bold text-lg leading-tight">GMP-Compliant Manufacturing</p>
                <p className="text-white/70 text-sm mt-1">Every batch produced under strict quality controls</p>
              </div>
            </div>
            {/* Right: steps */}
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#d3c4ab] mb-2">Process</p>
              <h2 className="text-3xl font-extrabold text-gray-950 mb-3 dark:text-white">How It Works</h2>
              <p className="text-gray-400 mb-10 max-w-md dark:text-gray-500">From catalog to your laboratory in a few simple steps.</p>
              <div className="flex flex-col gap-6">
                {[
                  { step: "01", title: "Browse & Select", desc: "Explore our catalog of research compounds, filter by category or mechanism, and select your compound and dosage." },
                  { step: "02", title: "Secure Checkout", desc: "Register, apply any discount coupon, complete your shipping details and proceed through our secure payment flow." },
                  { step: "03", title: "Fast Dispatch", desc: "Orders are processed same-day. Each vial ships with a Certificate of Analysis confirming purity and identity." },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#f2ede6] flex items-center justify-center shrink-0 dark:bg-white/10">
                      <span className="text-sm font-extrabold text-[#d3c4ab]">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed dark:text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-[#0d1a18] via-[#163028] to-[#0a1f18] relative overflow-hidden dark:bg-none dark:bg-black">
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
          <p className="text-[#dbcfba]/80 text-lg mb-8 max-w-md mx-auto">
            Browse our complete catalog of research-grade compounds and peptides.
          </p>
          <Link href="/compounds">
            <button className="inline-flex items-center gap-2 bg-[#dbcfba] text-[#0d1a18] font-bold px-8 py-3.5 rounded-xl hover:bg-[#d7cab3] transition-all duration-200 active:scale-[0.98] shadow-xl shadow-black/20">
              Explore All Compounds <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}
