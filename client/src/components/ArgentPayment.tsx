import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";

/**
 * The embedded ArgentPlatforms (PaymentJS) card form.
 *
 * The card fields live in a cross-origin iframe this component only ever
 * mounts a container for — card numbers never reach our page, our bundle or
 * our server, which is the point of the library.
 *
 * What this component reports back is deliberately thin: a payment intent id,
 * and nothing else. It does not tell the caller that a payment succeeded,
 * because it is in no position to know — it runs in the shopper's browser,
 * where a determined shopper can make any function return anything. The
 * server reads the payment back from ArgentPlatforms and decides. Treat
 * `onPaid` as "here is an id worth checking", never as "we have the money".
 */

export type ArgentConfig = {
  publicKey: string;
  environment: "development" | "production";
  reference: string;
  amount: string;
  currencyCode: string;
  descriptor: string;
};

export type ArgentBillingAddress = {
  line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
};

type Props = {
  config: ArgentConfig;
  billingAddress: ArgentBillingAddress;
  /** Shown on the pay button, already formatted. */
  amountLabel: string;
  /** Called with the payment intent id for the server to verify. */
  onPaid: (paymentIntentId: string) => void;
  /** The card was declined, or the attempt failed for a stated reason. */
  onDeclined: (message: string) => void;
  /** Something stopped a real attempt from happening at all. */
  onUnavailable: (message: string) => void;
  /** True while the server is verifying, so the button stays disabled. */
  confirming?: boolean;
};

const SCRIPT_SRC = "https://js.argentplatforms.com/payment.min.js";
const CARD_CONTAINER_ID = "argent-card-fields";
const EXPRESS_CONTAINER_ID = "argent-express-checkout";

/** Loads PaymentJS once per page, however many times this mounts. */
let scriptPromise: Promise<void> | null = null;

function loadPaymentJs(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No document"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing && window.ArgentPlatforms) {
      resolve();
      return;
    }

    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("The payment library could not be loaded"))
    );
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((err) => {
    // A failed load must not be cached as a resolved promise, or a retry
    // after the network recovers would skip loading and find no library.
    scriptPromise = null;
    throw err;
  });

  return scriptPromise;
}

/**
 * Pulls the id the server should look up out of whatever PaymentJS returns.
 *
 * The library's documentation describes the success result as a PaymentIntent
 * carrying a `payment` object, and separately shows the hosted flow returning
 * `payment_intent_id` in the query string. Both namings are accepted here
 * because the document does not settle which one the embedded callback uses.
 * Sending the wrong id is safe: the server's lookup fails and the order stays
 * unpaid, which is the correct outcome for an id we cannot resolve.
 */
export function readPaymentIntentId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const candidates = [r.payment_intent_id, r.paymentIntentId, r.id];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** A message safe to show a shopper, from whatever the library handed back. */
export function readErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    // `technical_message` is explicitly documented as not for display.
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

declare global {
  interface Window {
    ArgentPlatforms?: {
      init: (options: Record<string, unknown>) => {
        submit: (options: Record<string, unknown>) => void;
      };
    };
  }
}

export default function ArgentPayment({
  config,
  billingAddress,
  amountLabel,
  onPaid,
  onDeclined,
  onUnavailable,
  confirming = false,
}: Props) {
  const [fieldsReady, setFieldsReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expressReady, setExpressReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clientRef = useRef<{ submit: (o: Record<string, unknown>) => void } | null>(null);
  // The callbacks are read out of a ref inside PaymentJS's own closures, which
  // are created once. Without this, every callback would keep calling the
  // first render's props.
  const handlers = useRef({ onPaid, onDeclined, onUnavailable });
  handlers.current = { onPaid, onDeclined, onUnavailable };

  useEffect(() => {
    let cancelled = false;

    loadPaymentJs()
      .then(() => {
        if (cancelled) return;
        const sdk = window.ArgentPlatforms;
        if (!sdk) throw new Error("The payment library did not initialise");

        clientRef.current = sdk.init({
          public_key: config.publicKey,
          environment: config.environment,
          reference: config.reference,
          containerId: CARD_CONTAINER_ID,
          expressContainerId: EXPRESS_CONTAINER_ID,
          // Required for the Apple Pay / Google Pay buttons to appear at all.
          amount: config.amount,
          currencyCode: config.currencyCode,
          descriptor: config.descriptor,

          fields: {
            name: { placeholder: "Name on card" },
            number: { placeholder: "Card number" },
            expiry: { placeholder: "MM/YY" },
            cvc: { placeholder: "CVC" },
          },

          // The fields render inside a cross-origin iframe, so the page's own
          // CSS cannot reach them; these rules are passed through instead.
          style: {
            fonts: ["https://fonts.googleapis.com/css?family=Inter:400,500"],
            styles: {
              input: {
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 15,
                borderRadius: 8,
                border: "1px solid #e5e0d6",
                padding: "11px 13px",
                color: "#2d2a26",
              },
              "&::placeholder": { color: "#a39d93" },
              "&:focus": { outline: "none", borderColor: "#dbcfba" },
              ".field[ev-valid=false] input": { color: "#b4423a", borderColor: "#b4423a" },
            },
          },

          onFieldsLoaded: () => !cancelled && setFieldsReady(true),
          onFieldsUpdated: (state: { complete?: boolean }) =>
            !cancelled && setCardComplete(Boolean(state?.complete)),
          onLoading: (isLoading: boolean) => !cancelled && setSubmitting(isLoading),
          onExpressCheckoutReady: () => !cancelled && setExpressReady(true),
          onExpressCheckoutUnavailable: () => !cancelled && setExpressReady(false),

          onPaymentSuccess: (result: unknown) => {
            const id = readPaymentIntentId(result);
            if (!id) {
              // The library says it worked but gave us nothing to verify with.
              // We cannot confirm the order from here, and we must not pretend
              // we can — a human reconciles this one.
              handlers.current.onUnavailable(
                "Your payment went through but we couldn't record it automatically. " +
                  "Don't pay again — we'll email you shortly."
              );
              return;
            }
            handlers.current.onPaid(id);
          },

          onPaymentFailure: (result: unknown) => {
            handlers.current.onDeclined(
              readErrorMessage(result, "Your card was declined. Try another card.")
            );
          },

          onError: (error: unknown) => {
            handlers.current.onUnavailable(
              readErrorMessage(error, "We couldn't process the payment. Please try again.")
            );
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          readErrorMessage(err, "The payment form couldn't load. Check your connection.")
        );
      });

    return () => {
      cancelled = true;
    };
    // Initialised once per payment. The config is fixed for an order, and
    // re-initialising would tear down fields the shopper is typing into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePay() {
    const client = clientRef.current;
    if (!client || submitting || confirming) return;
    setSubmitting(true);
    client.submit({
      amount: config.amount,
      currencyCode: config.currencyCode,
      descriptor: config.descriptor,
      billing_address: billingAddress,
    });
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {loadError}
      </div>
    );
  }

  const busy = submitting || confirming;

  return (
    <div className="space-y-4">
      {/* Apple Pay / Google Pay. Hidden until the wallet reports itself
          usable, so an empty gap never appears above the card form. */}
      <div className={expressReady ? "space-y-3" : "hidden"}>
        <div id={EXPRESS_CONTAINER_ID} />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-200 dark:bg-border" />
          <span className="text-xs uppercase tracking-wide text-gray-400">or pay by card</span>
          <span className="h-px flex-1 bg-gray-200 dark:bg-border" />
        </div>
      </div>

      <div className="relative">
        <div id={CARD_CONTAINER_ID} />
        {!fieldsReady && (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 size={15} className="animate-spin" />
            Loading secure card form…
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={!fieldsReady || !cardComplete || busy}
        className="lab-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {confirming ? "Confirming payment…" : "Processing…"}
          </>
        ) : (
          <>Pay {amountLabel}</>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <Lock size={12} />
        Card details are entered directly with our payment processor and never reach our servers.
      </p>
    </div>
  );
}
