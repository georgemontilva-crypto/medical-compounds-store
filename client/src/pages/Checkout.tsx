import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  FlaskConical,
  ChevronDown,
  Tag,
  Mail,
  CheckCircle,
  Users,
  AlertCircle,
  HelpCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getStoredReferralCode } from "@/lib/referral";
import { AFFILIATE_UI_ENABLED } from "@shared/affiliate";
import { COUNTRIES, DEFAULT_COUNTRY } from "@shared/countries";
import { AGE_REQUIREMENT_MESSAGE, MINIMUM_AGE, isOfLegalAge } from "@shared/age";

type Step = "form" | "confirmation";

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
  const [step, setStep] = useState<Step>(paymentReturn ? "confirmation" : "form");
  const [shipping, setShipping] = useState<ShippingForm>({
    firstName: "",
    lastName: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: DEFAULT_COUNTRY,
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
  const [referralCode, setReferralCode] = useState(() =>
    AFFILIATE_UI_ENABLED ? (getStoredReferralCode() ?? "") : ""
  );
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
  // reaches the form, so a self-referral is surfaced before they pay rather
  // than only if they happen to touch the field.
  const prefilledReferralChecked = useRef(false);
  useEffect(() => {
    if (prefilledReferralChecked.current) return;
    if (!AFFILIATE_UI_ENABLED) return;
    if (step !== "form" || !referralCode.trim()) return;
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

  // The pay bar is fixed to the bottom of the viewport on small screens, which
  // is where the injected chat widget also lives. index.css lifts the widget
  // while this flag is set; clearing it on unmount puts it back everywhere else.
  const showPayBar = step === "form" && items.length > 0;
  useEffect(() => {
    if (!showPayBar) return;
    document.body.setAttribute("data-checkout-paybar", "1");
    return () => document.body.removeAttribute("data-checkout-paybar");
  }, [showPayBar]);

  const placeOrder = () => {
    createOrder.mutate({
      // Prices and names are re-derived server side; sending them
      // from here would let the browser set what Stripe charges.
      items: items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        quantity: i.quantity,
      })),
      couponCode: appliedCoupon?.code,
      referralCode: referralState.kind === "valid" ? referralState.code : undefined,
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
  };

  const isPlacingOrder = createOrder.isPending || createCheckoutSession.isPending;
  const canPlaceOrder = !quote.isLoading && quoteError === null;

  // Shown only once a date has been entered: an empty field is the browser's
  // `required` to complain about, not an age failure to accuse someone of.
  const ageError =
    shipping.dateOfBirth && !isOfLegalAge(shipping.dateOfBirth)
      ? AGE_REQUIREMENT_MESSAGE
      : null;

  if (items.length === 0 && step !== "confirmation") {
    return (
      <div className="flex-1 hex-cream flex items-center justify-center p-4">
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
      <div className="flex-1 hex-cream flex items-center justify-center p-4">
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
    <div className="flex-1 bg-background">
      {/* pb-28 clears the fixed mobile pay bar; the desktop layout has none. */}
      <div className="container py-8 pb-28 lg:pb-8">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canPlaceOrder || isPlacingOrder) return;
            // The server rejects an underage order anyway; stopping here turns
            // that into an explanation next to the field instead of a failed
            // request after the shopper has committed to paying.
            if (!isOfLegalAge(shipping.dateOfBirth)) {
              toast.error(AGE_REQUIREMENT_MESSAGE);
              document.getElementById("dob-error")?.scrollIntoView({ block: "center" });
              return;
            }
            placeOrder();
          }}
        >
          {/* The summary leads on mobile — it is what the shopper is deciding
              about — and moves to the sticky right rail from lg up. */}
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-1 lg:order-last">
              <OrderSummary
                items={items}
                subtotal={subtotal}
                discount={discount}
                finalTotal={finalTotal}
                appliedCoupon={appliedCoupon}
                quotedLines={quoted?.items}
                isPricing={quote.isLoading}
                priceError={quoteError}
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                onApplyCoupon={() =>
                  validateCoupon.mutate({ code: couponCode, orderAmount: total })
                }
                isValidatingCoupon={validateCoupon.isPending}
                onRemoveCoupon={() => setAppliedCoupon(null)}
                referralCode={referralCode}
                setReferralCode={setReferralCode}
                referralState={referralState}
                onCheckReferral={checkReferral}
                isCheckingReferral={validateReferral.isPending}
                isPlacingOrder={isPlacingOrder}
                canPlaceOrder={canPlaceOrder}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <DetailsForm
                shipping={shipping}
                setShipping={setShipping}
                notes={notes}
                setNotes={setNotes}
                isAuthenticated={isAuthenticated}
                ageError={ageError}
              />
            </div>
          </div>

          <MobilePayBar
            finalTotal={finalTotal}
            isPricing={quote.isLoading}
            isPlacingOrder={isPlacingOrder}
            canPlaceOrder={canPlaceOrder}
          />
        </form>
      </div>
    </div>
  );
}

/** A short "why are you asking?" note attached to a field label. */
function WhyTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          className="text-muted-foreground/70 hover:text-foreground transition-colors align-middle"
        >
          <HelpCircle size={13} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[15rem]">{text}</TooltipContent>
    </Tooltip>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="lab-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

function DetailsForm({
  shipping,
  setShipping,
  notes,
  setNotes,
  isAuthenticated,
  ageError,
}: {
  shipping: ShippingForm;
  setShipping: (s: ShippingForm) => void;
  notes: string;
  setNotes: (n: string) => void;
  isAuthenticated: boolean;
  ageError: string | null;
}) {
  const [notesOpen, setNotesOpen] = useState(notes.length > 0);

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
    <div className="lab-card p-5 sm:p-6 space-y-7">
      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Checking out as a guest.{" "}
          <Link href="/login">
            <span className="font-medium text-primary hover:underline cursor-pointer">
              Sign in
            </span>
          </Link>
        </p>
      )}

      <FieldGroup title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Email", "email", "email", "john@example.com")}
          {field("Phone", "phone", "tel", "+1 (555) 000-0000", false)}
        </div>
      </FieldGroup>

      <FieldGroup title="Shipping address">
        <div className="grid grid-cols-2 gap-4">
          {field("First Name", "firstName", "text", "John")}
          {field("Last Name", "lastName", "text", "Doe")}
        </div>
        <div className="mt-4">{field("Address", "address", "text", "123 Research Blvd")}</div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {field("City", "city", "text", "New York")}
          {field("State / Province", "state", "text", "NY")}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {field("ZIP / Postal Code", "zip", "text", "10001")}
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-1.5">
              Country <span className="text-destructive">*</span>
            </label>
            <select
              value={shipping.country}
              onChange={(e) => setShipping({ ...shipping, country: e.target.value })}
              className="lab-input"
              required
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="Research use">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Researcher type <span className="text-destructive">*</span>{" "}
              <WhyTooltip text="Required to confirm these compounds are going to a research setting." />
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
              <option value="government_entity_researcher">Government Entity Researcher</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-1.5">
              Date of Birth <span className="text-destructive">*</span>{" "}
              <WhyTooltip text={`Required to verify you meet the ${MINIMUM_AGE}+ age requirement.`} />
            </label>
            <div className="overflow-hidden rounded-xl">
              <input
                type="date"
                value={shipping.dateOfBirth}
                onChange={(e) => setShipping({ ...shipping, dateOfBirth: e.target.value })}
                className={`lab-input min-w-0 max-w-full box-border${
                  ageError ? " border-destructive focus:border-destructive" : ""
                }`}
                style={{ fontSize: 16 }}
                aria-invalid={ageError ? true : undefined}
                aria-describedby={ageError ? "dob-error" : undefined}
                required
              />
            </div>
            {ageError && (
              <p id="dob-error" role="alert" className="text-xs text-destructive mt-1.5">
                {ageError}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>

      <div className="border-t border-border pt-5">
        {notesOpen ? (
          <div>
            <label className="block text-sm font-medium mb-1.5">Order notes</label>
            <textarea
              placeholder="Special instructions or notes for your order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="lab-input min-h-[80px] resize-none"
              rows={3}
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Add order notes
          </button>
        )}
      </div>
    </div>
  );
}

type ReferralState =
  | { kind: "idle" }
  | { kind: "valid"; code: string; discountPercent: number }
  | { kind: "invalid"; message: string };

function MobilePayBar({
  finalTotal,
  isPricing,
  isPlacingOrder,
  canPlaceOrder,
}: {
  finalTotal: number;
  isPricing: boolean;
  isPlacingOrder: boolean;
  canPlaceOrder: boolean;
}) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
        {isPricing ? (
          <Loader2 size={15} className="animate-spin text-muted-foreground" />
        ) : (
          <p className="font-bold text-lg leading-tight">${finalTotal.toFixed(2)}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPlacingOrder || !canPlaceOrder}
        className="lab-btn-primary flex-1 py-3"
      >
        {isPlacingOrder ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            <Lock size={15} />
            Pay with Stripe
          </>
        )}
      </button>
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
  couponCode,
  setCouponCode,
  onApplyCoupon,
  isValidatingCoupon,
  onRemoveCoupon,
  referralCode,
  setReferralCode,
  referralState,
  onCheckReferral,
  isCheckingReferral,
  isPlacingOrder,
  canPlaceOrder,
}: {
  items: Array<{ id: string; productId: number; variationId?: number; productName: string; variationLabel?: string; quantity: number; unitPrice: number; image?: string }>;
  subtotal: number;
  discount: number;
  finalTotal: number;
  appliedCoupon: { code: string; discount: number } | null;
  quotedLines:
    | Array<{ productId: number; variationId?: number; unitPrice: number; subtotal: number }>
    | undefined;
  isPricing: boolean;
  priceError: string | null;
  couponCode: string;
  setCouponCode: (c: string) => void;
  onApplyCoupon: () => void;
  isValidatingCoupon: boolean;
  onRemoveCoupon: () => void;
  referralCode: string;
  setReferralCode: (c: string) => void;
  referralState: ReferralState;
  onCheckReferral: (code: string) => void;
  isCheckingReferral: boolean;
  isPlacingOrder: boolean;
  canPlaceOrder: boolean;
}) {
  // Collapsed on mobile so the form starts near the top of the screen; always
  // open from lg up, where it has its own column and nothing to compete with.
  const [open, setOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="lab-card p-5 lg:sticky lg:top-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:hidden w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="font-semibold">
          Order summary
          <span className="text-muted-foreground font-normal">
            {" "}
            · {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="font-semibold">${finalTotal.toFixed(2)}</span>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <h2 className="hidden lg:block font-semibold mb-4">Order summary</h2>

      <div className={`${open ? "block mt-4" : "hidden"} lg:block`}>
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

        {/* Discounts sit with the money, which is where shoppers look for them. */}
        <div className="border-t border-border pt-4">
          {appliedCoupon ? (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={15} className="text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-green-700 truncate">
                  {appliedCoupon.code}
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ) : couponOpen ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="lab-input flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={!couponCode || isValidatingCoupon}
                className="lab-btn-secondary px-4 whitespace-nowrap"
              >
                {isValidatingCoupon ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Have a coupon?
            </button>
          )}

          {AFFILIATE_UI_ENABLED && (
            <div className="mt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Referral code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  onBlur={(e) => onCheckReferral(e.target.value)}
                  className="lab-input flex-1"
                />
                <button
                  type="button"
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
          )}
        </div>

        <div className="border-t border-border mt-4 pt-4 space-y-2">
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
            <span className="text-muted-foreground flex items-center gap-1">
              Shipping
              <WhyTooltip text="Shipping is quoted once we confirm your order — we'll email the final amount before it ships." />
            </span>
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

      <div className="hidden lg:block mt-5">
        <button
          type="submit"
          disabled={isPlacingOrder || !canPlaceOrder}
          className="lab-btn-primary w-full py-3"
        >
          {isPlacingOrder ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Redirecting to payment…
            </>
          ) : (
            <>
              <Lock size={15} />
              Pay ${finalTotal.toFixed(2)} with Stripe
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Pay securely on Stripe — your card details never touch our servers.
      </p>

      {/* The one notice on this page with legal weight, kept outside the
          collapsible body so it is on screen even when the summary is folded,
          and set apart so it reads as a notice rather than as the tail of the
          reassurance copy. */}
      <p className="mt-4 pt-3 border-t border-border text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        For research purposes only.
      </p>
    </div>
  );
}
