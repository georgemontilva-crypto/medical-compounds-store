import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface LocalCartItem {
  id: string; // local temp id
  productId: number;
  variationId?: number;
  productName: string;
  variationLabel?: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  slug: string;
}

interface CartContextValue {
  items: LocalCartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<LocalCartItem, "id">) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LocalCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback((newItem: Omit<LocalCartItem, "id">) => {
    setItems((prev) => {
      const key = `${newItem.productId}-${newItem.variationId ?? "base"}`;
      const existing = prev.find(
        (i) => i.productId === newItem.productId && i.variationId === newItem.variationId
      );
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
        );
      }
      return [...prev, { ...newItem, id: key + "-" + Date.now() }];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, isOpen, openCart, closeCart, addItem, updateQuantity, removeItem, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
