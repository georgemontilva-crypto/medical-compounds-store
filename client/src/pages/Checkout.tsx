import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  FlaskConical,
  ChevronRight,
  Tag,
  CreditCard,
  CheckCircle,
  Loader2,
  Lock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type Step = "shipping" | "payment" | "confirmation";

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user, isAuthenticated } = useAuthContext();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("shipping");
  const [shipping, setShipping] = useState<ShippingForm>({
    firstName: "",
    lastName: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
  });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: number;
    code: string;
    type: "percentage" | "fixed";
    value: number;
    discount: number;
  } | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const validateCoupon = trpc.coupons.validate.useMutation({
    onSuccess: (data) => {
      setAppliedCoupon({
        id: data.coupon.id,
        code: data.coupon.code,
        type: data.coupon.type,
        value: data.coupon.value,
        discount: data.discount,
      });
      toast.success(`Coupon applied! You save $${data.discount.toFixed(2)}`);
    },
    onError: (err) => {
      toast.error(err.message || "Invalid coupon");
    },
  });

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      setOrderId(data.orderId);
      setStep("confirmation");
      clearCart();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to place order");
    },
  });

  const discount = appliedCoupon?.discount ?? 0;
  const finalTotal = Math.max(0, total - discount);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="lab-card p-8 max-w-md w-full text-center">
          <Lock size={32} className="text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in to complete your purchase
          </p>
          <Link href="/login">
            <button className="lab-btn-primary w-full">Sign In</button>
          </Link>
          <Link href="/register">
            <button className="lab-btn-secondary w-full mt-2">Create Account</button>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && step !== "confirmation") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="lab-card p-8 max-w-md w-full text-center">
          <FlaskConical size={32} className="text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <Link href="/compounds">
            <button className="lab-btn-primary mt-4">Browse Compounds</button>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "confirmation") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="lab-card p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground mb-2">
            Thank you for your order. We'll process it shortly.
          </p>
          {orderId && (
            <p className="text-sm font-medium text-primary mb-6">Order #{orderId}</p>
          )}
          <div className="flex flex-col gap-2">
            <Link href="/my-orders">
              <button className="lab-btn-primary w-full">View My Orders</button>
            </Link>
            <Link href="/compounds">
              <button className="lab-btn-secondary w-full">Continue Shopping</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/"><span className="hover:text-foreground cursor-pointer">Home</span></Link>
          <ChevronRight size={14} />
          <Link href="/compounds"><span className="hover:text-foreground cursor-pointer">Compounds</span></Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium">Checkout</span>
        </nav>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(["shipping", "payment"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} className="text-muted-foreground" />}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {step === "shipping" && (
              <ShippingStep
                shipping={shipping}
                setShipping={setShipping}
                notes={notes}
                setNotes={setNotes}
                onNext={() => setStep("payment")}
              />
            )}
            {step === "payment" && (
              <PaymentStep
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                appliedCoupon={appliedCoupon}
                onApplyCoupon={() =>
                  validateCoupon.mutate({ code: couponCode, orderAmount: total })
                }
                isValidating={validateCoupon.isPending}
                onRemoveCoupon={() => setAppliedCoupon(null)}
                onBack={() => setStep("shipping")}
                onPlaceOrder={() => {
                  createOrder.mutate({
                    items: items.map((i) => ({
                      productId: i.productId,
                      variationId: i.variationId,
                      productName: i.productName,
                      variationLabel: i.variationLabel,
                      quantity: i.quantity,
                      unitPrice: i.unitPrice,
                    })),
                    couponCode: appliedCoupon?.code,
                    couponId: appliedCoupon?.id,
                    discountAmount: discount,
                    shipping: {
                      firstName: shipping.firstName,
                      lastName: shipping.lastName,
                      email: shipping.email,
                      phone: shipping.phone,
                      address: shipping.address,
                      city: shipping.city,
                      state: shipping.state,
                      zip: shipping.zip,
                      country: shipping.country,
                    },
                    notes,
                  });
                }}
                isPlacingOrder={createOrder.isPending}
                finalTotal={finalTotal}
              />
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              items={items}
              subtotal={total}
              discount={discount}
              finalTotal={finalTotal}
              appliedCoupon={appliedCoupon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShippingStep({
  shipping,
  setShipping,
  notes,
  setNotes,
  onNext,
}: {
  shipping: ShippingForm;
  setShipping: (s: ShippingForm) => void;
  notes: string;
  setNotes: (n: string) => void;
  onNext: () => void;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const field = (
    label: string,
    key: keyof ShippingForm,
    type = "text",
    placeholder = "",
    required = true
  ) => (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={shipping[key]}
        onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
        className="lab-input"
        required={required}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-5">Shipping Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("First Name", "firstName", "text", "John")}
          {field("Last Name", "lastName", "text", "Doe")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {field("Email", "email", "email", "john@example.com")}
          {field("Phone", "phone", "tel", "+1 (555) 000-0000", false)}
        </div>
        <div className="mt-4">
          {field("Address", "address", "text", "123 Research Blvd")}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {field("City", "city", "text", "New York")}
          {field("State / Province", "state", "text", "NY", false)}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {field("ZIP / Postal Code", "zip", "text", "10001", false)}
          {field("Country", "country", "text", "United States")}
        </div>
      </div>

      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-4">Order Notes (Optional)</h2>
        <textarea
          placeholder="Special instructions or notes for your order..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="lab-input min-h-[80px] resize-none"
          rows={3}
        />
      </div>

      <button type="submit" className="lab-btn-primary w-full py-3">
        Continue to Payment
        <ChevronRight size={16} />
      </button>
    </form>
  );
}

function PaymentStep({
  couponCode,
  setCouponCode,
  appliedCoupon,
  onApplyCoupon,
  isValidating,
  onRemoveCoupon,
  onBack,
  onPlaceOrder,
  isPlacingOrder,
  finalTotal,
}: {
  couponCode: string;
  setCouponCode: (c: string) => void;
  appliedCoupon: { code: string; discount: number } | null;
  onApplyCoupon: () => void;
  isValidating: boolean;
  onRemoveCoupon: () => void;
  onBack: () => void;
  onPlaceOrder: () => void;
  isPlacingOrder: boolean;
  finalTotal: number;
}) {
  return (
    <div className="space-y-6">
      {/* Coupon */}
      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-4">Discount Coupon</h2>
        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">{appliedCoupon.code}</span>
              <span className="text-sm text-green-600">
                — Save ${appliedCoupon.discount.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onRemoveCoupon}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="lab-input flex-1"
            />
            <button
              onClick={onApplyCoupon}
              disabled={!couponCode || isValidating}
              className="lab-btn-secondary px-4 whitespace-nowrap"
            >
              {isValidating ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
            </button>
          </div>
        )}
      </div>

      {/* Payment section */}
      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-2">Payment</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Secure payment processing. Your order will be confirmed and we'll contact you with payment instructions.
        </p>

        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
          <CreditCard size={32} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-sm">Payment Gateway</p>
          <p className="text-xs text-muted-foreground mt-1">
            Payment integration will be configured here. Your order details are saved and we'll process payment securely.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            {["Visa", "Mastercard", "PayPal", "Stripe"].map((p) => (
              <span key={p} className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-secondary/50">
          <Lock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your order information is encrypted and secure. For research purposes only.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="lab-btn-secondary flex-1 py-3">
          Back to Shipping
        </button>
        <button
          onClick={onPlaceOrder}
          disabled={isPlacingOrder}
          className="lab-btn-primary flex-1 py-3"
        >
          {isPlacingOrder ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Placing Order...
            </>
          ) : (
            <>
              <Lock size={16} />
              Place Order — ${finalTotal.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function OrderSummary({
  items,
  subtotal,
  discount,
  finalTotal,
  appliedCoupon,
}: {
  items: Array<{ id: string; productName: string; variationLabel?: string; quantity: number; unitPrice: number; image?: string }>;
  subtotal: number;
  discount: number;
  finalTotal: number;
  appliedCoupon: { code: string } | null;
}) {
  return (
    <div className="lab-card p-5 sticky top-24">
      <h3 className="font-semibold mb-4">Order Summary</h3>
      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary flex-shrink-0 overflow-hidden">
              {item.image ? (
                <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FlaskConical size={14} className="text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.productName}</p>
              {item.variationLabel && (
                <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
              )}
              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium flex-shrink-0">
              ${(item.unitPrice * item.quantity).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span className="flex items-center gap-1">
              <Tag size={12} />
              {appliedCoupon?.code}
            </span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span className="text-muted-foreground">Calculated at confirmation</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t border-border pt-2 mt-2">
          <span>Total</span>
          <span className="text-primary">${finalTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
