import { useAuthContext } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import {
  FlaskConical,
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Users,
  Ticket,
  FileText,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Image as ImageIcon,
  ShieldCheck,
  Building2,
  Share2,
  BarChart3,
} from "lucide-react";
import { useState, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/lab-reports", label: "Lab Reports", icon: FileText },
  { href: "/admin/site-images", label: "Site Images", icon: ImageIcon },
  { href: "/admin/doc-integrity", label: "Doc Integrity", icon: ShieldCheck },
  { href: "/admin/wholesale-applications", label: "Wholesale Apps", icon: Building2 },
  { href: "/admin/affiliates", label: "Affiliates", icon: Share2 },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuthContext();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: () => toast.error("Logout failed"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="lab-card p-8 text-center max-w-sm">
          <FlaskConical size={32} className="text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm mb-4">Admin access required</p>
          <Link href="/"><button className="lab-btn-primary">Go Home</button></Link>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/">
          {logoImage?.url ? (
            <div className="flex items-center cursor-pointer">
              <img src={logoImage.url} alt="Logo" className="h-8 w-auto object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FlaskConical size={15} className="text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Brighter Days Labs</p>
                <p className="text-xs text-muted-foreground">Control Panel</p>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || (href !== "/admin" && location.startsWith(href));
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users size={14} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logoutMutation.mutate()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card fixed h-full z-20">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border z-40 md:hidden flex flex-col">
            <Sidebar />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-secondary">
            <Menu size={18} />
          </button>
          <span className="font-semibold text-sm">Brighter Days Labs</span>
          <div className="w-8" />
        </div>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
