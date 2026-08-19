import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { FlaskConical, Package, ChevronRight, Clock } from "lucide-react";
import CompletePaymentButton, { isAwaitingPayment } from "@/components/CompletePaymentButton";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-[#f2ede6] text-[#d3c4ab]",
  shipped: "bg-[#d0f0ed] text-[#baac96]",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function MyOrders() {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="container py-12">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="lab-card p-5 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/4 mb-3" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to view your orders</p>
        <Link href="/login">
          <button className="lab-btn-primary">Sign In</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen hex-cream">
      <div className="container py-8">
        <div className="mb-8">
          <p className="lab-section-title mb-1">Account</p>
          <h1 className="text-3xl font-bold">My Orders</h1>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <Package size={40} className="text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">
              Your order history will appear here
            </p>
            <Link href="/compounds">
              <button className="lab-btn-primary">Browse Compounds</button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/my-orders/${order.id}`}>
                <div className="lab-card p-5 cursor-pointer hover:border-primary/30 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FlaskConical size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Order #{order.id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={12} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      {isAwaitingPayment(order) && (
                        <span className="lab-badge text-xs font-medium bg-amber-100 text-amber-700">
                          Payment due
                        </span>
                      )}
                      <span
                        className={`lab-badge text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-secondary text-muted-foreground"}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <p className="font-semibold text-primary">${Number(order.total).toFixed(2)}</p>
                      {isAwaitingPayment(order) && (
                        <CompletePaymentButton orderId={order.id} size="small" />
                      )}
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
