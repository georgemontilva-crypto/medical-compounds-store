import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  ShoppingBag,
  User,
  FlaskConical,
  ChevronDown,
  Target,
  Factory,
  ShieldCheck,
  Leaf,
  ArrowRight,
  Menu,
  X,
  Settings,
  LogOut,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Category colors ────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Tissue: "#7c3aed",
  Cellular: "#0ea5e9",
  Neural: "#6366f1",
  Metabolic: "#10b981",
  Endocrine: "#f59e0b",
  Combined: "#8b5cf6",
};

const SCIENCE_ITEMS = [
  { icon: Target, label: "Approach", desc: "How we organize compounds...", href: "/science/approach" },
  { icon: Factory, label: "Manufacturing", desc: "US-based cGMP-aligned...", href: "/science/manufacturing" },
  { icon: ShieldCheck, label: "Research Standards", desc: "Compound selection...", href: "/science/research-standards" },
  { icon: Leaf, label: "Responsible Supply", desc: "Manufacturing discipline an...", href: "/science/responsible-supply" },
];

const SCIENCE_REFS = [
  { label: "Tissue Research", color: CAT_COLORS.Tissue },
  { label: "Cellular Research", color: CAT_COLORS.Cellular },
  { label: "Neural Research", color: CAT_COLORS.Neural },
  { label: "Metabolic Research", color: CAT_COLORS.Metabolic },
  { label: "Endocrine Research", color: CAT_COLORS.Endocrine },
  { label: "Combined Research", color: CAT_COLORS.Combined },
];

// ── Dropdown wrapper ───────────────────────────────────────────────────────────
function NavDropdown({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  function handleMouseEnter() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  }

  function handleMouseLeave() {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 200);
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`flex items-center gap-1 text-sm font-medium px-2 py-1.5 rounded-lg transition-colors duration-150 ${
          active ? "text-[#3A9E94] font-semibold" : "text-gray-700 hover:text-gray-900"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 text-gray-400 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 transition-all duration-200 origin-top ${
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{ minWidth: 480 }}
      >
        {/* Arrow tip — pt-2 above (not mt-2 on this whole container) keeps the
            gap between button and panel inside this element's own hoverable
            box, instead of an invisible margin dead-zone outside it. */}
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45 z-10" />
        <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-200/60 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main Navbar ────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { itemCount, openCart } = useCart();
  const { user, isAuthenticated, isAdmin } = useAuthContext();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: () => toast.error("Logout failed"),
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/">
            {logoImage?.url ? (
              <div className="flex items-center cursor-pointer shrink-0">
                <img src={logoImage.url} alt="Logo" className="h-10 w-auto object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3A9E94] to-[#5BB8AE] flex items-center justify-center shadow-md shadow-[#3A9E94]/20">
                  <FlaskConical size={17} className="text-white" />
                </div>
                <div className="leading-none">
                  <span className="font-extrabold text-gray-950 text-base tracking-tight">Brighter Days Labs</span>
                  <p className="text-[9px] font-semibold tracking-[0.15em] uppercase text-gray-400 leading-none mt-0.5">
                    Compounds
                  </p>
                </div>
              </div>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">

            {/* Shop dropdown */}
            <NavDropdown label="Shop" active={location.startsWith("/compounds")}>
              <div className="p-5" style={{ minWidth: 340 }}>
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 px-1">
                  Reference
                </p>
                <div className="grid grid-cols-2 gap-0.5">
                  {SCIENCE_REFS.map((cat) => (
                    <Link
                      key={cat.label}
                      href={`/compounds?category=${encodeURIComponent(cat.label.replace(" Research", ""))}`}
                    >
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                          {cat.label}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link href="/compounds">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#E8F7F6] cursor-pointer transition-colors group">
                      <span className="text-sm font-semibold text-[#3A9E94] group-hover:text-[#2A8E84]">
                        All Compounds
                      </span>
                      <ArrowRight size={13} className="text-[#7ECDC4]" />
                    </div>
                  </Link>
                </div>
              </div>
            </NavDropdown>

            {/* Science dropdown */}
            <NavDropdown label="Science">
              <div className="flex">
                <div className="p-4 border-r border-gray-50" style={{ width: 260 }}>
                  {SCIENCE_ITEMS.map((item) => {
                    const content = (
                      <div className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                        <div className="w-9 h-9 rounded-xl bg-[#F5F2EC] flex items-center justify-center shrink-0 group-hover:bg-[#E8F7F6] transition-colors">
                          <item.icon
                            size={15}
                            className="text-gray-500 group-hover:text-[#3A9E94] transition-colors"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    );
                    return item.href ? (
                      <Link key={item.label} href={item.href}>{content}</Link>
                    ) : (
                      <div key={item.label}>{content}</div>
                    );
                  })}
                </div>
                <div className="p-4" style={{ width: 220 }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 px-1">
                    Reference
                  </p>
                  {SCIENCE_REFS.map((ref) => (
                    <Link
                      key={ref.label}
                      href={`/compounds?category=${encodeURIComponent(ref.label.replace(" Research", ""))}`}
                    >
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: ref.color }}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900">
                          {ref.label}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </NavDropdown>

            {/* Lab Tests — direct link, no dropdown */}
            <Link href="/lab-tests">
              <button
                className={`text-sm font-medium px-2 py-1.5 rounded-lg transition-colors duration-150 ${
                  location.startsWith("/lab-tests") ? "text-[#3A9E94] font-semibold" : "text-gray-700 hover:text-gray-900"
                }`}
              >
                Lab Tests
              </button>
            </Link>

            {/* Wholesale */}
            <Link href="/wholesale">
              <button className="ml-2 text-sm font-semibold border border-[#7ECDC4] text-[#3A9E94] hover:bg-[#E8F7F6] px-4 py-1.5 rounded-full transition-colors duration-150">
                Apply for Wholesale
              </button>
            </Link>

            <Link href="/contact">
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg transition-colors ml-1">
                Contact
              </button>
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            {/* Cart */}
            <button
              onClick={openCart}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ShoppingBag size={18} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] min-h-[18px] bg-[#3A9E94] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-1">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            {/* User menu */}
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#E8F7F6] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#3A9E94]">
                      {(user?.name ?? user?.email ?? "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                    {user?.name ?? user?.email}
                  </span>
                  <ChevronDown size={13} className="text-gray-400" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="text-[11px] text-gray-400">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
                    </div>
                    <Link href="/my-orders">
                      <div
                        className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShoppingBag size={14} className="text-gray-400" />
                        My Orders
                      </div>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <div
                          className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[#3A9E94] hover:bg-[#E8F7F6] cursor-pointer transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings size={14} />
                          Admin Panel
                        </div>
                      </Link>
                    )}
                    <button
                      onClick={() => { setUserMenuOpen(false); logoutMutation.mutate(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-50"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <button className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                    <User size={14} />
                    Sign In
                  </button>
                </Link>
                <Link href="/register">
                  <button className="text-sm font-semibold bg-[#3A9E94] hover:bg-[#2A8E84] text-white px-4 py-1.5 rounded-xl transition-colors shadow-sm shadow-[#3A9E94]/20">
                    Register
                  </button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger — 3 bars animated to X */}
            <button
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
              className="md:hidden flex flex-col gap-[5px] p-2 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-transform duration-300 ease-in-out"
                style={mobileOpen ? { transform: "translateY(7.5px) rotate(45deg)" } : {}}
              />
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-opacity duration-300 ease-in-out"
                style={mobileOpen ? { opacity: 0 } : {}}
              />
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-transform duration-300 ease-in-out"
                style={mobileOpen ? { transform: "translateY(-7.5px) rotate(-45deg)" } : {}}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — absolute overlay, white solid, does not push content */}
      <div
        className="md:hidden absolute left-0 right-0 bg-white border-b border-gray-200 shadow-lg overflow-hidden z-50"
        style={{
          top: "100%",
          maxHeight: mobileOpen ? "800px" : "0",
          transition: "max-height 0.35s ease",
        }}
      >
        <div className="px-4 py-4 space-y-1">
          <Link href="/compounds">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Shop
            </div>
          </Link>
          <div className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 cursor-default">
            Science
          </div>
          <Link href="/lab-tests">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Lab Tests
            </div>
          </Link>
          <Link href="/wholesale">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3A9E94] hover:bg-[#E8F7F6] cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Apply for Wholesale
            </div>
          </Link>
          <Link href="/contact">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Contact
            </div>
          </Link>
          <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link href="/admin">
                    <div
                      className="px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3A9E94] hover:bg-[#E8F7F6] cursor-pointer"
                      onClick={() => setMobileOpen(false)}
                    >
                      Admin Panel
                    </div>
                  </Link>
                )}
                <Link href="/my-orders">
                  <div
                    className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setMobileOpen(false)}
                  >
                    My Orders
                  </div>
                </Link>
                <button
                  onClick={() => { logoutMutation.mutate(); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login">
                  <button
                    className="flex-1 text-sm font-medium border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </button>
                </Link>
                <Link href="/register">
                  <button
                    className="flex-1 text-sm font-semibold bg-[#3A9E94] text-white px-4 py-2 rounded-xl hover:bg-[#2A8E84] transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Register
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
