import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatVariationValue } from "@/lib/utils";

// ── Vial SVG placeholder (shown when a product has no uploaded image) ────────
export function VialPlaceholder({ label, size = "10mg", color = "#a78bfa" }: { label: string; size?: string; color?: string }) {
  const shortLabel = label.length > 9 ? label.slice(0, 9) : label;
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#f2f2f5] to-[#e8e8ed]">
      <svg viewBox="0 0 80 120" className="w-16 h-24 drop-shadow" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export type ProductCardProduct = {
  id: number;
  name: string;
  slug: string;
  basePrice: string;
  categoryId?: number | null;
  featured?: boolean | null;
};

export type ProductCardCategory = { id: number; name: string; color?: string | null };

// ── Shared product card (real DB data) — used on Home and Compounds ─────────
export default function ProductCard({
  product,
  categories,
  onAdd,
  added,
}: {
  product: ProductCardProduct;
  categories?: ProductCardCategory[];
  onAdd: (payload: {
    productId: number; variationId?: number; productName: string;
    variationLabel?: string; unitPrice: number; image?: string; slug: string;
  }) => void;
  added: boolean;
}) {
  const { data: images } = trpc.products.images.useQuery({ productId: product.id });
  const { data: variations } = trpc.products.variations.useQuery({ productId: product.id });

  const category = categories?.find((c) => c.id === product.categoryId);
  const catName = category?.name ?? "Misc";
  const catColor = category?.color || "#6b7280";
  const primaryVariationId = variations?.[0]?.id;
  const variationImage = primaryVariationId != null ? images?.find((img) => img.variationId === primaryVariationId) : undefined;
  const image = variationImage ?? images?.find((img) => img.variationId == null) ?? images?.[0];
  const minPrice = variations && variations.length > 0
    ? Math.min(...variations.map((v) => Number(v.price)))
    : Number(product.basePrice);
  const hasVariations = !!variations && variations.length > 1;
  const mainSize = variations?.[0] ? `${formatVariationValue(variations[0].value)}${variations[0].unit}` : "";
  const catGlow = `0 0 0 2px ${catColor}40, 0 8px 24px -6px ${catColor}66`;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariations) { window.location.href = `/compounds/${product.slug}`; return; }
    const variation = variations?.[0];
    onAdd({
      productId: product.id, variationId: variation?.id, productName: product.name,
      variationLabel: variation ? `${formatVariationValue(variation.value)}${variation.unit}` : undefined,
      unitPrice: variation ? Number(variation.price) : Number(product.basePrice),
      image: image?.url, slug: product.slug,
    });
  };

  return (
    <div
      className="group relative h-full flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-[var(--cat-glow)] transition-all duration-300 dark:bg-card dark:border-border"
      style={{ "--cat-glow": catGlow } as React.CSSProperties}
    >
      {product.featured && (
        <span
          className="absolute top-3 left-3 z-10 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm"
          style={{ backgroundColor: `${catColor}20`, color: catColor }}
        >
          Popular
        </span>
      )}
      <Link href={`/compounds/${product.slug}`}>
        <div className="relative h-48 cursor-pointer overflow-hidden bg-white p-2 dark:bg-card">
          {image ? (
            <img src={image.url} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <VialPlaceholder label={product.name} size={mainSize || "10mg"} color={catColor} />
          )}
          <button
            onClick={handleQuickAdd}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all duration-200 ${
              added ? "bg-[#d3c4ab] text-white opacity-100 scale-110"
                    : "bg-white text-gray-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-[#d3c4ab] hover:text-white dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            {added ? <Check size={13} /> : <Plus size={13} />}
          </button>
        </div>
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 h-4 mb-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
          <span className="text-[10px] font-semibold tracking-widest uppercase truncate" style={{ color: catColor }}>{catName}</span>
        </div>
        <Link href={`/compounds/${product.slug}`}>
          <h3 className="font-bold text-gray-950 text-sm mb-2 cursor-pointer hover:text-[#d3c4ab] transition-colors dark:text-white line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
        </Link>
        <div className="flex flex-wrap gap-1 mb-2 min-h-[22px]">
          {variations && variations.length > 0 && variations.slice(0, 3).map((v) => (
            <span key={v.id} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full font-mono dark:text-gray-500 dark:bg-white/10">{formatVariationValue(v.value)}{v.unit}</span>
          ))}
        </div>
        <p className="font-semibold text-gray-900 text-sm mt-auto dark:text-white">{hasVariations ? "From " : ""}${minPrice.toFixed(2)}</p>
      </div>
    </div>
  );
}
