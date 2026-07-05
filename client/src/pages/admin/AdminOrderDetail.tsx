import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FlaskConical, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
const PAYMENT_OPTIONS = ["pending", "paid", "failed", "refunded"] as const;

type OrderStatus = typeof STATUS_OPTIONS[number];
type PaymentStatus = typeof PAYMENT_OPTIONS[number];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-[#f2ede6] text-[#d3c4ab]",
  shipped: "bg-[#d0f0ed] text-[#baac96]",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Props { params: { id: string } }

export default function AdminOrderDetail({ params }: Props) {
  const orderId = Number(params.id);
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.adminDetail.useQuery({ id: orderId });

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { utils.orders.adminDetail.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Order not found</p>
          <Link href="/admin/orders"><button className="lab-btn-primary mt-4">Back to Orders</button></Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <button className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={18} />
            </button>
          </Link>
          <div>
            <p className="lab-section-title mb-0.5">Orders</p>
            <h1 className="text-2xl font-bold">Order #{order.id}</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Items</h2>
              <div className="space-y-3">
                {order.items.map((item: { id: number; productName: string; variationLabel?: string | null; quantity: number; unitPrice: string }) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <FlaskConical size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      {item.variationLabel && (
                        <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">
                      ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Number(order.subtotal).toFixed(2)}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                    <span>-${Number(order.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="text-primary">${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping */}
            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Shipping Address</h2>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p className="text-foreground font-medium">
                  {order.shippingFirstName} {order.shippingLastName}
                </p>
                <p>{order.shippingEmail}</p>
                {order.shippingPhone && <p>{order.shippingPhone}</p>}
                <p>{order.shippingAddress}</p>
                <p>
                  {order.shippingCity}{order.shippingState && `, ${order.shippingState}`} {order.shippingZip}
                </p>
                <p>{order.shippingCountry}</p>
              </div>
              {order.notes && (
                <div className="mt-4 p-3 rounded-xl bg-secondary/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status management */}
          <div className="space-y-4">
            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Order Status</h2>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus.mutate({ id: order.id, status })}
                    disabled={updateStatus.isPending}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      order.status === status
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-secondary"
                    }`}
                  >
                    <span className="capitalize">{status}</span>
                    {order.status === status && (
                      <span className={`lab-badge text-xs ${STATUS_COLORS[status]}`}>Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Payment Status</h2>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((pStatus) => (
                  <button
                    key={pStatus}
                    onClick={() => updateStatus.mutate({ id: order.id, status: order.status as OrderStatus, paymentStatus: pStatus })}
                    disabled={updateStatus.isPending}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      order.paymentStatus === pStatus
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-secondary"
                    }`}
                  >
                    <span className="capitalize">{pStatus}</span>
                    {order.paymentStatus === pStatus && (
                      <span className="lab-badge text-xs bg-green-100 text-green-700">Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card p-5">
              <p className="text-xs text-muted-foreground">
                Created: {new Date(order.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Updated: {new Date(order.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
