import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const FADE_MS = 250;

export default function FloatingCartButton() {
  const { itemCount, openCart } = useCart();
  const [location] = useLocation();

  // Checkout is a focused, single-task flow — a floating "buy more" button
  // doesn't belong there. Admin uses a completely different layout (no
  // storefront Navbar/cart), so it doesn't belong there either.
  const hiddenRoute = location.startsWith("/checkout") || location.startsWith("/admin");
  const shouldShow = itemCount > 0 && !hiddenRoute;

  const [mounted, setMounted] = useState(shouldShow);
  const [animateIn, setAnimateIn] = useState(shouldShow);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setAnimateIn(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <button
      onClick={openCart}
      aria-label={`Open cart (${itemCount} item${itemCount !== 1 ? "s" : ""})`}
      className={`fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[#d3c4ab] hover:bg-[#baac96] shadow-lg shadow-[#d3c4ab]/30 flex items-center justify-center transition-all ${
        animateIn ? "opacity-100 scale-100" : "opacity-0 scale-75"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <span className="pulse-ring rounded-full bg-[#d3c4ab]" />
      <ShoppingBag size={22} className="relative text-white" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] min-h-[20px] bg-white text-[#d3c4ab] text-[11px] font-bold rounded-full flex items-center justify-center leading-none px-1 shadow-sm">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}
