import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Users, Package, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: recentOrders } = trpc.orders.adminList.useQuery({ limit: 5 });

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-purple-100 text-purple-700",
    shipped: "bg-indigo-100 text-indigo-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const metrics = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingCart, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Products", value: stats?.totalProducts ?? 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Revenue", value: `$${(stats?.revenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="lab-section-title mb-1">Overview</p>
          <h1 className="text-2xl font-bold">Dashboard</h1>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="lab-card p-5">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold">
                {isLoading ? (
                  <span className="inline-block w-16 h-6 bg-secondary rounded animate-pulse" />
                ) : (
                  value
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/admin/products", label: "Products", icon: Package },
            { href: "/admin/categories", label: "Categories", icon: TrendingUp },
            { href: "/admin/coupons", label: "Coupons", icon: ShoppingCart },
            { href: "/admin/orders", label: "View Orders", icon: ShoppingCart },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="lab-card p-4 text-center cursor-pointer hover:border-primary/30 transition-all group">
                <Icon size={20} className="text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent orders */}
        <div className="lab-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link href="/admin/orders">
              <span className="text-sm text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
          {!recentOrders || recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">Order #{order.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.shippingFirstName} {order.shippingLastName} · {order.shippingEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`lab-badge text-xs ${STATUS_COLORS[order.status] ?? "bg-secondary text-muted-foreground"}`}>
                        {order.status}
                      </span>
                      <span className="font-semibold text-sm text-primary">
                        ${Number(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
