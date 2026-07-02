import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { ShoppingBag, User, LogOut, Settings, FlaskConical, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Navbar() {
  const { itemCount, openCart } = useCart();
  const { user, isAuthenticated, isAdmin } = useAuthContext();
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: () => toast.error("Logout failed"),
  });

  return (
    <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FlaskConical size={16} className="text-primary-foreground" />
              </div>
              <div>
                <span className="font-semibold text-base tracking-tight">BioLab</span>
                <span className="text-xs text-muted-foreground block leading-none">
                  Compounds
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/compounds">
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Compounds
              </span>
            </Link>
            {isAuthenticated && (
              <Link href="/my-orders">
                <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  My Orders
                </span>
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <button
              onClick={openCart}
              className="relative p-2.5 rounded-xl hover:bg-secondary transition-colors"
            >
              <ShoppingBag size={18} className="text-foreground" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] min-h-[18px] px-0.5">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            {/* User */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={14} className="text-primary" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">
                    {user?.name ?? user?.email}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-xs text-muted-foreground">Signed in as</p>
                        <p className="text-sm font-medium truncate">{user?.email}</p>
                      </div>
                      <Link href="/my-orders" onClick={() => setUserMenuOpen(false)}>
                        <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary transition-colors cursor-pointer text-sm">
                          <ShoppingBag size={14} />
                          My Orders
                        </div>
                      </Link>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary transition-colors cursor-pointer text-sm text-primary font-medium">
                            <Settings size={14} />
                            Admin Panel
                          </div>
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logoutMutation.mutate();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary transition-colors text-sm text-destructive border-t border-border"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login">
                  <button className="lab-btn-secondary text-sm py-2 px-4">Sign In</button>
                </Link>
                <Link href="/register">
                  <button className="lab-btn-primary text-sm py-2 px-4">Register</button>
                </Link>
              </div>
            )}

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-secondary transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-1">
            <Link href="/compounds" onClick={() => setMenuOpen(false)}>
              <div className="px-2 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm font-medium cursor-pointer">
                Compounds
              </div>
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/my-orders" onClick={() => setMenuOpen(false)}>
                  <div className="px-2 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm font-medium cursor-pointer">
                    My Orders
                  </div>
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)}>
                    <div className="px-2 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm font-medium text-primary cursor-pointer">
                      Admin Panel
                    </div>
                  </Link>
                )}
                <button
                  onClick={() => { setMenuOpen(false); logoutMutation.mutate(); }}
                  className="w-full text-left px-2 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm font-medium text-destructive"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  <button className="lab-btn-secondary text-sm flex-1">Sign In</button>
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)}>
                  <button className="lab-btn-primary text-sm flex-1">Register</button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
