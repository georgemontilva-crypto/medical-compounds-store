import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  FlaskConical,
  ChevronRight,
  Tag,
  Mail,
  CreditCard,
  CheckCircle,
  Users,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { getStoredReferralCode } from "@/lib/referral";

type Step = "shipping" | "payment" | "confirmation";

type ResearcherType =
  | ""
  | "private_researcher"
  | "lab_company_researcher"
  | "government_entity_researcher";

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
  researcherType: ResearcherType;
  dateOfBirth: string;
}

/**
 * Stripe returns the shopper to /checkout with the outcome in the query string.
 * Read synchronously during the first render: resolving it in an effect would
 * flash the empty-cart screen before the confirmation appears.
 */
function readPaymentReturn(): { paid: boolean; orderId: number | null } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (payment !== "success" && payment !== "cancelled") return null;
  const id = Number(params.get("orderId"));
  return {
    paid: payment === "success",
    orderId: Number.isInteger(id) && id > 0 ? id : null,
  };
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user, isAuthenticated } = useAuthContext();
  const [, navigate] = useLocation();

  const [paymentReturn] = useState(readPaymentReturn);
  const [step, setStep] = useState<Step>(paymentReturn ? "confirmation" : "shipping");
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
    researcherType: "",
    dateOfBirth: "",
  });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: number;
    code: string;
    type: "percentage" | "fixed";
    value: number;
    discount: number;
  } | null>(null);
  const [orderId, setOrderId] = useState<number | null>(paymentReturn?.orderId ?? null);
  const [notes, setNotes] = useState("");
  /** How the confirmation screen should read: payment taken, or still owed. */
  const [paymentOutcome, setPaymentOutcome] = useState<"paid" | "unpaid">(
    paymentReturn && !paymentReturn.paid ? "unpaid" : "paid"
  );

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

  // Sends the shopper to Stripe Checkout. The order already exists at this
  // point, so a failure here is recoverable — we fall back to the confirmation
  // screen and the order can be settled by hand rather than being lost.
  const createCheckoutSession = trpc.payments.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => {
      toast.error(
        err.message || "We couldn't open the payment page. We'll email you to arrange payment."
      );
      setPaymentOutcome("unpaid");
      setStep("confirmation");
    },
  });

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      setOrderId(data.orderId);
      clearCart();
      createCheckoutSession.mutate({ orderId: data.orderId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to place order");
    },
  });

  // Side effects of that return. The screen state itself is already set above.
  const paymentReturnHandled = useRef(false);
  useEffect(() => {
    if (!paymentReturn || paymentReturnHandled.current) return;
    paymentReturnHandled.current = true;

    if (paymentReturn.paid) {
      clearCart();
    } else {
      toast.info("Payment cancelled. Your order is saved — we'll email you about payment.");
    }
    // Drop the params so a refresh doesn't replay this.
    window.history.replaceState({}, "", "/checkout");
  }, [paymentReturn, clearCart]);

  // ─── Referral ──────────────────────────────────────────────────────────────
  // Prefilled from a ?ref= click captured up to 30 days ago, and editable.
  const [referralCode, setReferralCode] = useState(() => getStoredReferralCode() ?? "");
  const [referralState, setReferralState] = useState<
    | { kind: "idle" }
    | { kind: "valid"; code: string; discountPercent: number }
    | { kind: "invalid"; message: string }
  >({ kind: "idle" });

  const validateReferral = trpc.affiliate.validateCode.useMutation({
    onSuccess: (result) => {
      if (result.valid) {
        setReferralState({
          kind: "valid",
          code: result.code,
          discountPercent: result.discountPercent,
        });
      } else {
        // Self-referral lands here: the shopper is told before paying, and may
        // continue without the code rather than being blocked.
        setReferralState({ kind: "invalid", message: result.message });
      }
    },
    onError: () => {
      setReferralState({ kind: "invalid", message: "Couldn't check that code. Try again." });
    },
  });

  const checkReferral = (code: string) => {
    if (!code.trim()) {
      setReferralState({ kind: "idle" });
      return;
    }
    validateReferral.mutate({ code, email: shipping.email || undefined });
  };

  // Validate a code carried in from a ?ref= click as soon as the shopper
  // reaches this step, so a self-referral is surfaced before they pay rather
  // than only if they happen to touch the field.
  const prefilledReferralChecked = useRef(false);
  useEffect(() => {
    if (prefilledReferralChecked.current) return;
    if (step !== "payment" || !referralCode.trim()) return;
    prefilledReferralChecked.current = true;
    checkReferral(referralCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, referralCode]);

  // ─── Authoritative pricing ─────────────────────────────────────────────────
  // The cart's own arithmetic is only a placeholder until this resolves. It
  // sums prices captured when each item was added, which drift from the catalog
  // whenever a line crosses a volume tier or an admin edits a price — the same
  // numbers the server re-derives and Stripe is charged. Quoting from the
  // server makes the summary and the charge the same figure by construction.
  const quote = trpc.orders.quote.useQuery(
    {
      items: items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        quantity: i.quantity,
      })),
      couponCode: appliedCoupon?.code,
      referralCode: referralState.kind === "valid" ? referralState.code : undefined,
      email: shipping.email || undefined,
    },
    { enabled: items.length > 0 && step !== "confirmation" }
  );

  const quoted = quote.data;
  const subtotal = quoted?.subtotal ?? total;
  const discount = quoted?.discount ?? 0;
  const finalTotal = quoted?.total ?? Math.max(0, total - discount);
  // Blocked rather than merely unpriced: orders.create would reject the same
  // cart, so sending the shopper to Stripe could only fail later.
  const quoteError = quote.error?.message ?? null;

  // Auto-apply the welcome coupon assigned right after registering via the checkout incentive modal.
  const pendingCouponHandled = useRef(false);
  useEffect(() => {
    if (pendingCouponHandled.current || total <= 0) return;
    const pendingCode = sessionStorage.getItem("pendingCoupon");
    if (pendingCode) {
      pendingCouponHandled.current = true;
      sessionStorage.removeItem("pendingCoupon");
      validateCoupon.mutate({ code: pendingCode, orderAmount: total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (items.length === 0 && step !== "confirmation") {
    return (
      <div className="min-h-screen hex-cream flex items-center justify-center p-4">
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
      <div className="min-h-screen hex-cream flex items-center justify-center p-4">
        <div className="lab-card p-10 max-w-md w-full text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              paymentOutcome === "paid" ? "bg-green-100" : "bg-amber-100"
            }`}
          >
            {paymentOutcome === "paid" ? (
              <CheckCircle size={32} className="text-green-600" />
            ) : (
              <Mail size={32} className="text-amber-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {paymentOutcome === "paid" ? "Payment Received!" : "Order Saved"}
          </h1>
          <p className="text-muted-foreground mb-2">
            {paymentOutcome === "paid"
              ? "Thank you — your payment went through and we'll process your order shortly."
              : "Your order is saved but payment wasn't completed. Our team will email you to arrange it."}
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
    <div className="min-h-screen hex-cream">
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
                isAuthenticated={isAuthenticated}
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
                referralCode={referralCode}
                setReferralCode={setReferralCode}
                referralState={referralState}
                onCheckReferral={checkReferral}
                isCheckingReferral={validateReferral.isPending}
                onRemoveCoupon={() => setAppliedCoupon(null)}
                onBack={() => setStep("shipping")}
                onPlaceOrder={() => {
                  createOrder.mutate({
                    // Prices and names are re-derived server side; sending them
                    // from here would let the browser set what Stripe charges.
                    items: items.map((i) => ({
                      productId: i.productId,
                      variationId: i.variationId,
                      quantity: i.quantity,
                    })),
                    couponCode: appliedCoupon?.code,
                    referralCode:
                      referralState.kind === "valid" ? referralState.code : undefined,
                    researcherType: shipping.researcherType as
                      | "private_researcher"
                      | "lab_company_researcher"
                      | "government_entity_researcher",
                    dateOfBirth: shipping.dateOfBirth,
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
                isPlacingOrder={createOrder.isPending || createCheckoutSession.isPending}
                finalTotal={finalTotal}
                canPlaceOrder={!quote.isLoading && quoteError === null}
              />
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              items={items}
              subtotal={subtotal}
              discount={discount}
              finalTotal={finalTotal}
              appliedCoupon={appliedCoupon}
              quotedLines={quoted?.items}
              isPricing={quote.isLoading}
              priceError={quoteError}
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
  isAuthenticated,
}: {
  shipping: ShippingForm;
  setShipping: (s: ShippingForm) => void;
  notes: string;
  setNotes: (n: string) => void;
  onNext: () => void;
  isAuthenticated: boolean;
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
  ) => {
    const isDate = type === "date";
    const input = (
      <input
        type={type}
        placeholder={placeholder}
        value={shipping[key]}
        onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
        className={`lab-input${isDate ? " min-w-0 max-w-full box-border" : ""}`}
        style={isDate ? { fontSize: 16 } : undefined}
        required={required}
      />
    );
    return (
      <div className="min-w-0">
        <label className="block text-sm font-medium mb-1.5">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {isDate ? <div className="overflow-hidden rounded-xl">{input}</div> : input}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isAuthenticated && (
        <div className="lab-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Checking out as a guest. Have an account?
          </p>
          <Link href="/login">
            <button type="button" className="text-sm font-medium text-primary hover:underline">
              Sign in for faster checkout & order tracking
            </button>
          </Link>
        </div>
      )}
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
        <h2 className="font-semibold text-lg mb-5">Additional Required Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              What type of researcher are you? <span className="text-destructive">*</span>
            </label>
            <select
              value={shipping.researcherType}
              onChange={(e) =>
                setShipping({ ...shipping, researcherType: e.target.value as ResearcherType })
              }
              className="lab-input"
              required
            >
              <option value="" disabled>
                Select an option…
              </option>
              <option value="private_researcher">Private Researcher</option>
              <option value="lab_company_researcher">Lab/Company Researcher</option>
              <option value="government_entity_researcher">
                Government Entity Researcher
              </option>
            </select>
          </div>
          {field("Date of Birth", "dateOfBirth", "date", "", true)}
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

type ReferralState =
  | { kind: "idle" }
  | { kind: "valid"; code: string; discountPercent: number }
  | { kind: "invalid"; message: string };

function PaymentStep({
  couponCode,
  setCouponCode,
  appliedCoupon,
  onApplyCoupon,
  isValidating,
  onRemoveCoupon,
  referralCode,
  setReferralCode,
  referralState,
  onCheckReferral,
  isCheckingReferral,
  onBack,
  onPlaceOrder,
  isPlacingOrder,
  finalTotal,
  canPlaceOrder,
}: {
  couponCode: string;
  setCouponCode: (c: string) => void;
  appliedCoupon: { code: string; discount: number } | null;
  onApplyCoupon: () => void;
  isValidating: boolean;
  onRemoveCoupon: () => void;
  referralCode: string;
  setReferralCode: (c: string) => void;
  referralState: ReferralState;
  onCheckReferral: (code: string) => void;
  isCheckingReferral: boolean;
  onBack: () => void;
  onPlaceOrder: () => void;
  isPlacingOrder: boolean;
  finalTotal: number;
  canPlaceOrder: boolean;
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

      {/* Referral code */}
      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-1">Referral Code</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Optional. Using a friend's code takes 10% off your order.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter referral code"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            onBlur={(e) => onCheckReferral(e.target.value)}
            className="lab-input flex-1"
          />
          <button
            onClick={() => onCheckReferral(referralCode)}
            disabled={!referralCode || isCheckingReferral}
            className="lab-btn-secondary px-4 whitespace-nowrap"
          >
            {isCheckingReferral ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
          </button>
        </div>

        {referralState.kind === "valid" && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-green-50 border border-green-200">
            <Users size={15} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">
              Referral code <span className="font-medium">{referralState.code}</span> applied —{" "}
              {referralState.discountPercent}% off.
            </p>
          </div>
        )}

        {referralState.kind === "invalid" && (
          // Shown before payment, not after: the shopper can clear the field and
          // continue without a discount rather than being stuck.
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{referralState.message}</p>
          </div>
        )}
      </div>

      {/* Payment section */}
      <div className="lab-card p-6">
        <h2 className="font-semibold text-lg mb-2">Payment</h2>
        <p className="text-sm text-muted-foreground mb-5">
          You'll pay by card on Stripe's secure checkout page, right after this step.
        </p>

        <div className="border border-border rounded-xl p-6 text-center">
          <CreditCard size={32} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-sm">Secure card payment</p>
          <p className="text-xs text-muted-foreground mt-1">
            Continuing takes you to Stripe to complete payment. Your order is
            confirmed as soon as the payment goes through, and we start
            processing it right away.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-secondary/50">
          <Lock size={14} className="text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Card details are entered on Stripe and never touch our servers. For
            research purposes only.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="lab-btn-secondary flex-1 py-3">
          Back to Shipping
        </button>
        <button
          onClick={onPlaceOrder}
          disabled={isPlacingOrder || !canPlaceOrder}
          className="lab-btn-primary flex-1 py-3"
        >
          {isPlacingOrder ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Redirecting to payment...
            </>
          ) : (
            <>
              <Lock size={16} />
              Continue to Payment — ${finalTotal.toFixed(2)}
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
  quotedLines,
  isPricing,
  priceError,
}: {
  items: Array<{ id: string; productId: number; variationId?: number; productName: string; variationLabel?: string; quantity: number; unitPrice: number; image?: string }>;
  subtotal: number;
  discount: number;
  finalTotal: number;
  appliedCoupon: { code: string } | null;
  quotedLines:
    | Array<{ productId: number; variationId?: number; unitPrice: number; subtotal: number }>
    | undefined;
  isPricing: boolean;
  priceError: string | null;
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
              ${(
                quotedLines?.find(
                  (l) => l.productId === item.productId && l.variationId === item.variationId
                )?.subtotal ?? item.unitPrice * item.quantity
              ).toFixed(2)}
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
              Discount
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
          {isPricing ? (
            <Loader2 size={15} className="animate-spin text-muted-foreground" />
          ) : (
            <span className="text-primary">${finalTotal.toFixed(2)}</span>
          )}
        </div>

        {priceError && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{priceError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
