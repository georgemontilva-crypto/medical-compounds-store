import { trpc } from "@/lib/trpc";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Sends an unpaid order back to Stripe Checkout.
 *
 * An order created but never paid for sits at paymentStatus "pending" until its
 * checkout session expires a day later. Without this the shopper can see the
 * order but has no way to finish paying it — the server has always allowed a
 * fresh session for a pending order, there was simply nothing to click.
 */
export function isAwaitingPayment(order: {
  paymentStatus: string;
  status: string;
}): boolean {
  return order.paymentStatus === "pending" && order.status !== "cancelled";
}

export default function CompletePaymentButton({
  orderId,
  className = "",
  size = "default",
}: {
  orderId: number;
  className?: string;
  size?: "default" | "small";
}) {
  const createCheckoutSession = trpc.payments.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => {
      toast.error(err.message || "Couldn't open the payment page. Please try again.");
    },
  });

  const padding = size === "small" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm";

  return (
    <button
      onClick={(e) => {
        // These buttons sit inside order rows that are themselves links.
        e.preventDefault();
        e.stopPropagation();
        createCheckoutSession.mutate({ orderId });
      }}
      disabled={createCheckoutSession.isPending}
      className={`lab-btn-primary ${padding} ${className}`}
    >
      {createCheckoutSession.isPending ? (
        <>
          <Loader2 size={size === "small" ? 12 : 15} className="animate-spin" />
          Opening…
        </>
      ) : (
        <>
          <CreditCard size={size === "small" ? 12 : 15} />
          Complete Payment
        </>
      )}
    </button>
  );
}
