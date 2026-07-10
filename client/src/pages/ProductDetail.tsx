import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatVariationValue, getBulkDiscountPercent, BULK_DISCOUNT_QUANTITIES } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useCompliance } from "@/contexts/ComplianceContext";
import { Link } from "wouter";
import {
  FlaskConical,
  ChevronLeft,
  ShoppingBag,
  Check,
  ChevronRight,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  params: { slug: string };
}

export default function ProductDetail({ params }: Props) {
  const { data: product, isLoading } = trpc.products.bySlug.useQuery({ slug: params.slug });
  const { data: images } = trpc.products.images.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product }
  );
  const { data: variations } = trpc.products.variations.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product }
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: bulkTiers } = trpc.bulkDiscount.get.useQuery();

  const [selectedVariationId, setSelectedVariationId] = useState<number | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const { addItem, closeCart } = useCart();
  const { requestCheckout } = useCompliance();

  const category = categories?.find((c) => c.id === product?.categoryId);
  const catColor = category?.color || "#6366f1";
  const selectedVariation =
    variations?.find((v) => v.id === selectedVariationId) ?? variations?.[0];
  const price = selectedVariation
    ? Number(selectedVariation.price)
    : Number(product?.basePrice ?? 0);
  const inStock = selectedVariation ? selectedVariation.stock > 0 : true;

  // Buy-more-save-more: same 1/2/5 tiers for every product, percentages
  // come from admin config. Selecting a tier both sets `quantity` and
  // determines the discounted per-unit price used at Add to Cart time.
  // Products flagged excludeFromBulkDiscount always price at 0% off, but
  // keep the same quantity selector for a consistent buying flow.
  const bulkDiscountEnabled = bulkTiers && !product?.excludeFromBulkDiscount;
  const quantityOptions = bulkTiers
    ? BULK_DISCOUNT_QUANTITIES.map((qty) => {
        const percent = bulkDiscountEnabled ? getBulkDiscountPercent(qty, bulkTiers) : 0;
        return {
          qty,
          percent,
          unitPrice: price * (1 - percent / 100),
          disabled: selectedVariation ? qty > selectedVariation.stock : false,
        };
      })
    : [];
  const selectedPercent = bulkDiscountEnabled ? getBulkDiscountPercent(quantity, bulkTiers) : 0;
  const effectiveUnitPrice = price * (1 - selectedPercent / 100);

  // Prefer images uploaded for the selected variation; fall back to the
  // product's general (variationId-less) images if that variation has none.
  const displayImages = useMemo(() => {
    if (!images) return [];
    if (selectedVariation) {
      const variationSpecific = images.filter((img) => img.variationId === selectedVariation.id);
      if (variationSpecific.length > 0) return variationSpecific;
    }
    const productLevel = images.filter((img) => img.variationId == null);
    return productLevel.length > 0 ? productLevel : images;
  }, [images, selectedVariation]);

  useEffect(() => {
    setActiveImage(0);
    setQuantity(1);
  }, [selectedVariation?.id]);

  const addSelectionToCart = () => {
    if (!product) return false;
    if (variations && variations.length > 1 && !selectedVariationId) {
      toast.error("Please select a variation");
      return false;
    }
    addItem({
      productId: product.id,
      variationId: selectedVariation?.id,
      productName: product.name,
      variationLabel: selectedVariation
        ? `${formatVariationValue(selectedVariation.value)}${selectedVariation.unit}`
        : undefined,
      unitPrice: effectiveUnitPrice,
      quantity,
      image: displayImages[0]?.url,
      slug: product.slug,
    });
    return true;
  };

  const handleAddToCart = () => {
    if (!addSelectionToCart()) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!addSelectionToCart()) return;
    closeCart();
    requestCheckout();
  };

  if (isLoading) {
    return (
      <div className="container py-12">
        <div className="grid md:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-square rounded-2xl bg-secondary" />
          <div className="space-y-4">
            <div className="h-4 bg-secondary rounded w-1/4" />
            <div className="h-8 bg-secondary rounded w-3/4" />
            <div className="h-4 bg-secondary rounded w-full" />
            <div className="h-4 bg-secondary rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <FlaskConical size={40} className="text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Product not found</h2>
        <Link href="/compounds">
          <button className="lab-btn-primary mt-4">Back to Catalog</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/">
            <span className="hover:text-foreground transition-colors cursor-pointer">Home</span>
          </Link>
          <ChevronRight size={14} />
          <Link href="/compounds">
            <span className="hover:text-foreground transition-colors cursor-pointer">Compounds</span>
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl bg-secondary/40 overflow-hidden border border-border">
              {displayImages.length > 0 ? (
                <img
                  src={displayImages[activeImage]?.url}
                  alt={displayImages[activeImage]?.altText ?? product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FlaskConical size={64} className="text-muted-foreground/20" />
                </div>
              )}
            </div>
            {displayImages.length > 1 && (
              <div className="flex gap-2">
                {displayImages.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImage === i ? "border-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.altText ?? product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category + Name */}
            <div>
              {category && (
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color ?? "#6366f1" }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {category.name}
                  </span>
                </div>
              )}
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              {product.casNumber && (
                <p className="text-sm text-muted-foreground mt-1">CAS: {product.casNumber}</p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">${price.toFixed(2)}</span>
              {variations && variations.length > 1 && !selectedVariationId && (
                <span className="text-sm text-muted-foreground">Starting from</span>
              )}
            </div>

            {/* Variations */}
            {variations && variations.length > 0 && (
              <div>
                <p className="lab-section-title mb-3">Select Variation</p>
                <div className="flex flex-wrap gap-2">
                  {variations.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariationId(v.id)}
                      disabled={!v.active || v.stock === 0}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        selectedVariation?.id === v.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : v.stock === 0
                          ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                      }`}
                    >
                      {formatVariationValue(v.value)}{v.unit}
                      {v.stock === 0 && <span className="ml-1 text-xs">(Out)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity — buy more, save more */}
            <div>
              <p className="lab-section-title mb-3">Quantity</p>
              <div className="grid grid-cols-3 gap-2">
                {quantityOptions.map((opt) => {
                  const isSelected = quantity === opt.qty;
                  const isBestValue = opt.qty === 5 && opt.percent > 0 && !opt.disabled;
                  return (
                    <button
                      key={opt.qty}
                      onClick={() => setQuantity(opt.qty)}
                      disabled={opt.disabled}
                      className={`relative text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "bg-primary/10 shadow-md shadow-primary/20"
                          : opt.disabled
                          ? "border-border opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                      }`}
                      style={isSelected ? { borderColor: catColor } : undefined}
                    >
                      {isBestValue && (
                        <span
                          className="absolute -top-2 right-2 text-[#0a0a0f] text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: catColor }}
                        >
                          Best Value
                        </span>
                      )}
                      <p className="text-sm font-semibold">
                        {opt.qty} Vial{opt.qty > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">${opt.unitPrice.toFixed(2)} / vial</p>
                      {opt.percent > 0 && (
                        <p className="text-[11px] font-semibold text-green-600 mt-0.5">Save {opt.percent}%</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedVariation && (
                <p className="text-xs text-muted-foreground mt-2">{selectedVariation.stock} in stock</p>
              )}
            </div>

            {/* Research use disclaimer */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                FOR RESEARCH USE ONLY. This product is intended exclusively for laboratory research and analytical
                purposes by qualified purchasers. Not for human consumption. Not for animal or veterinary use. Not
                for therapeutic, diagnostic, clinical, cosmetic, wellness, performance-enhancement, household, or
                personal use. Not approved by the FDA for any medical use. Brighter Days Labs does not provide
                dosage, administration, reconstitution, dilution, medical, veterinary, or treatment guidance.
                Purchaser assumes all responsibility for lawful use, storage, handling, and disposal.
              </p>
            </div>

            {/* Buy Now */}
            <button
              onClick={handleBuyNow}
              disabled={!inStock}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:text-[#d3c4ab] hover:border-[#dbcfba] hover:bg-[#f2ede6]/40 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buy Now
            </button>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className={`lab-btn-primary w-full py-3 text-base ${
                added ? "bg-green-600" : ""
              }`}
            >
              {added ? (
                <>
                  <Check size={18} />
                  Added to Cart
                </>
              ) : !inStock ? (
                "Out of Stock"
              ) : (
                <>
                  <ShoppingBag size={18} />
                  Add to Cart — ${(effectiveUnitPrice * quantity).toFixed(2)}
                </>
              )}
            </button>

            {/* Lab Reports link */}
            <Link href={`/lab-reports/${params.slug}`}>
              <button className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:text-[#d3c4ab] hover:border-[#dbcfba] hover:bg-[#f2ede6]/40 text-sm font-semibold py-2.5 rounded-xl transition-colors">
                <FileText size={15} />
                View Lab Reports / COA
              </button>
            </Link>

            {/* Description */}
            {product.shortDescription && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            {/* Tabs: Description / Mechanism */}
            {(product.description || product.mechanism) && (
              <ProductTabs product={product} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductTabs({ product }: { product: { description?: string | null; mechanism?: string | null } }) {
  const [tab, setTab] = useState<"description" | "mechanism">("description");
  const tabs = [
    { id: "description" as const, label: "Description", content: product.description },
    { id: "mechanism" as const, label: "Mechanism", content: product.mechanism },
  ].filter((t) => t.content);

  if (tabs.length === 0) return null;

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/5 text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {tabs.find((t) => t.id === tab)?.content}
        </p>
      </div>
    </div>
  );
}
