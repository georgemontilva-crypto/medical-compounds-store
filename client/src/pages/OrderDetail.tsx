import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Package, Truck, CheckCircle, XCircle, Clock, CreditCard } from "lucide-react";
import { Link, useParams } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle },
  processing: { label: "Processing", color: "text-purple-600 bg-purple-50 border-purple-200", icon: Package },
  shipped: { label: "Shipped", color: "text-indigo-600 bg-indigo-50 border-indigo-200", icon: Truck },
  delivered: { label: "Delivered", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  paid: { label: "Paid", color: "text-green-600 bg-green-50 border-green-200" },
  failed: { label: "Failed", color: "text-red-600 bg-red-50 border-red-200" },
  refunded: { label: "Refunded", color: "text-gray-600 bg-gray-50 border-gray-200" },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuthContext();
  const orderId = parseInt(id ?? "0", 10);

  const { data: order, isLoading, error } = trpc.orders.detail.useQuery(
    { id: orderId },
    { enabled: isAuthenticated && !!orderId }
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-lab-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-lab-muted mb-4">Please sign in to view your order.</p>
          <Link href="/login">
            <button className="btn-primary">Sign In</button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-lab-bg flex items-center justify-center">
        <div className="lab-spinner" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-lab-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-lab-muted mb-4">Order not found.</p>
          <Link href="/my-orders">
            <button className="btn-secondary">Back to Orders</button>
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const paymentCfg = PAYMENT_CONFIG[order.paymentStatus] ?? PAYMENT_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="min-h-screen bg-lab-bg">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/my-orders">
            <button className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-lab-border transition-all">
              <ArrowLeft size={18} className="text-lab-muted" />
            </button>
          </Link>
          <div>
            <p className="text-xs font-semibold tracking-widest text-lab-muted uppercase">Order Details</p>
            <h1 className="text-2xl font-bold text-lab-text">Order #{order.id}</h1>
          </div>
        </div>

        {/* Status row */}
        <div className="flex flex-wrap gap-3 mb-6">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
            <StatusIcon size={12} />
            {statusCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${paymentCfg.color}`}>
            <CreditCard size={12} />
            Payment: {paymentCfg.label}
          </span>
          <span className="text-xs text-lab-muted self-center ml-auto">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Items */}
        <div className="lab-card p-5 mb-5">
          <h2 className="font-semibold text-lab-text mb-4">Items Ordered</h2>
          <div className="divide-y divide-lab-border">
            {(order.items as Array<{
              id: number;
              productName: string;
              variationLabel?: string | null;
              quantity: number;
              unitPrice: string;
              subtotal: string;
            }>).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-lab-text truncate">{item.productName}</p>
                  {item.variationLabel && (
                    <p className="text-xs text-lab-muted mt-0.5">{item.variationLabel}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-lab-muted">
                    {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                  </p>
                  <p className="font-semibold text-lab-text">${Number(item.subtotal).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="lab-card p-5 mb-5">
          <h2 className="font-semibold text-lab-text mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-lab-muted">Subtotal</span>
              <span className="text-lab-text">${Number(order.subtotal).toFixed(2)}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-lab-muted">
                  Discount {order.couponCode && <span className="text-primary font-mono">({order.couponCode})</span>}
                </span>
                <span className="text-green-600">-${Number(order.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-lab-border font-semibold text-base">
              <span className="text-lab-text">Total</span>
              <span className="text-primary">${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="lab-card p-5">
          <h2 className="font-semibold text-lab-text mb-4">Shipping Information</h2>
          <div className="text-sm text-lab-muted space-y-1">
            <p className="text-lab-text font-medium">
              {order.shippingFirstName} {order.shippingLastName}
            </p>
            {order.shippingEmail && <p>{order.shippingEmail}</p>}
            {order.shippingPhone && <p>{order.shippingPhone}</p>}
            {order.shippingAddress && <p>{order.shippingAddress}</p>}
            <p>
              {[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(", ")}
            </p>
            {order.shippingCountry && <p>{order.shippingCountry}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
