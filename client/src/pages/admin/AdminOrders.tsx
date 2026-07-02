import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { ShoppingCart, ChevronRight, Clock, Package } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

export default function AdminOrders() {
  const { data: orders, isLoading } = trpc.orders.adminList.useQuery({ limit: 100 });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="lab-section-title mb-1">Commerce</p>
          <h1 className="text-2xl font-bold">Orders</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="lab-card p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/3 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <ShoppingCart size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          <div className="lab-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Order</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Payment</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium">#{order.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.shippingFirstName} {order.shippingLastName}</p>
                        <p className="text-xs text-muted-foreground">{order.shippingEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`lab-badge text-xs ${STATUS_COLORS[order.status] ?? "bg-secondary"}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`lab-badge text-xs ${PAYMENT_COLORS[order.paymentStatus] ?? "bg-secondary"}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        ${Number(order.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${order.id}`}>
                          <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
