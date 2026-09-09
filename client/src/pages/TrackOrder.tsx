import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import { Package, Truck, CheckCircle, XCircle, Clock, Search } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle },
  processing: { label: "Processing", color: "text-[#d3c4ab] bg-[#f2ede6] border-[#dbcfba]", icon: Package },
  shipped: { label: "Shipped", color: "text-[#baac96] bg-[#f2ede6] border-[#d7cab3]", icon: Truck },
  delivered: { label: "Delivered", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

function money(value: unknown): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

/**
 * Order lookup for buyers who checked out as guests.
 *
 * They have no account, so /my-orders can never show them anything. What they
 * do have is the confirmation email: an order number and the address it was
 * sent to. Those two together are the key.
 *
 * The order number and email prefill from the query string so the link in the
 * confirmation email lands on a filled form, but both stay editable for
 * somebody arriving cold.
 */
export default function TrackOrder() {
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [submitted, setSubmitted] = useState<{ orderId: number; email: string } | null>(() => {
    const id = Number(params.get("order"));
    const mail = params.get("email");
    return id > 0 && mail ? { orderId: id, email: mail } : null;
  });

  const { data: order, isLoading, error } = trpc.orders.track.useQuery(submitted!, {
    enabled: submitted !== null,
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(orderNumber.replace(/[^0-9]/g, ""));
    if (id > 0 && email.trim()) setSubmitted({ orderId: id, email: email.trim() });
  }

  const status = order ? (STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending) : null;
  const StatusIcon = status?.icon ?? Clock;

  return (
    <div className="flex-1 bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-lab-ink mb-1">Track your order</h1>
        <p className="text-sm text-lab-muted mb-8">
          Enter the order number from your confirmation email and the email address you used.
        </p>

        <form onSubmit={handleSubmit} className="lab-card p-6 mb-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Order number</label>
              <input
                className="lab-input"
                placeholder="8001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                className="lab-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Search size={15} />
            Find my order
          </button>
        </form>

        {isLoading && submitted && (
          <div className="flex justify-center py-8">
            <div className="lab-spinner" />
          </div>
        )}

        {error && (
          <div className="lab-card p-6 text-center">
            <p className="text-lab-muted">{error.message}</p>
          </div>
        )}

        {order && status && (
          <div className="lab-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-5 border-b border-gray-100 dark:border-border">
              <div>
                <p className="text-xs text-lab-muted">Order</p>
                <p className="text-lg font-bold text-lab-ink">#{order.id}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${status.color}`}
              >
                <StatusIcon size={13} />
                {status.label}
              </span>
            </div>

            {order.trackingNumber && (
              <div className="mb-5 p-4 rounded-xl bg-[#f2ede6] dark:bg-card">
                <p className="text-xs text-lab-muted mb-1">
                  Tracking number{order.shippingServiceName ? ` · ${order.shippingServiceName}` : ""}
                </p>
                <p className="font-bold tracking-wide mb-3">{order.trackingNumber}</p>
                <a
                  href={`https://www.ups.com/track?tracknum=${encodeURIComponent(order.trackingNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  <Truck size={14} />
                  Track shipment
                </a>
              </div>
            )}

            <table className="w-full text-sm">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-border">
                    <td className="py-2.5">
                      {item.productName}
                      {item.variationLabel && (
                        <span className="text-lab-muted"> ({item.variationLabel})</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center text-lab-muted">{item.quantity}</td>
                    <td className="py-2.5 text-right">{money(item.subtotal)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} className="pt-3 text-lab-muted">
                    Subtotal
                  </td>
                  <td className="pt-3 text-right">{money(order.subtotal)}</td>
                </tr>
                {Number(order.shippingCost) > 0 && (
                  <tr>
                    <td colSpan={2} className="py-1 text-lab-muted">
                      Shipping
                    </td>
                    <td className="py-1 text-right">{money(order.shippingCost)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="pt-2 font-bold">
                    Total
                  </td>
                  <td className="pt-2 text-right font-bold">{money(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
