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
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const SCIENCE_ITEMS = [
  { icon: Target, label: "Approach", desc: "How we organize compounds...", href: "/science/approach" },
  { icon: Factory, label: "Manufacturing", desc: "US-based cGMP-aligned...", href: "/science/manufacturing" },
  { icon: ShieldCheck, label: "Research Standards", desc: "Compound selection...", href: "/science/research-standards" },
  { icon: Leaf, label: "Responsible Supply", desc: "Manufacturing discipline an...", href: "/science/responsible-supply" },
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
          active ? "text-[#d3c4ab] font-semibold" : "text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 text-gray-400 dark:text-gray-500 ${open ? "rotate-180" : ""}`}
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
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45 z-10 dark:bg-card dark:border-border" />
        <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-200/60 overflow-hidden dark:bg-card dark:border-border dark:shadow-black/40">
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
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  // Real categories for the Shop/Science dropdowns' "Reference" links —
  // replaces the old hardcoded SCIENCE_REFS list, which drifted out of sync
  // with the real catalog (it had 6 static entries incl. Endocrine/Combined,
  // which don't exist as real categories, and slugified names that didn't
  // match real slugs like "neural-cognitive-rsearch").
  const { data: realCategories = [] } = trpc.categories.list.useQuery();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileScienceOpen, setMobileScienceOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });
  const { data: footerLogoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  // Dark mode reuses the footer's logo slot — it's already the version meant
  // to sit on a dark surface, same need as the navbar in dark mode.
  const activeLogoUrl = theme === "dark" ? footerLogoImage?.url : logoImage?.url;

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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm dark:bg-background/95 dark:border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/">
            {activeLogoUrl ? (
              <div className="flex items-center cursor-pointer shrink-0">
                <img src={activeLogoUrl} alt="Brighter Days Labs logo" className="h-12 w-auto object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d3c4ab] to-[#d7cab3] flex items-center justify-center shadow-md shadow-[#d3c4ab]/20">
                  <FlaskConical size={17} className="text-white" />
                </div>
                <div className="leading-none">
                  <span className="font-extrabold text-gray-950 text-base tracking-tight dark:text-white">Brighter Days Labs</span>
                  <p className="text-[9px] font-semibold tracking-[0.15em] uppercase text-gray-400 leading-none mt-0.5 dark:text-gray-500">
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
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 px-1 dark:text-gray-500">
                  Reference
                </p>
                <div className="grid grid-cols-2 gap-0.5">
                  {realCategories.map((cat) => (
                    <Link key={cat.id} href={`/compounds?category=${cat.slug}`}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group dark:hover:bg-white/5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#6b7280" }}
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium dark:text-gray-300 dark:group-hover:text-white">
                          {cat.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border">
                  <Link href="/compounds">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#f2ede6] cursor-pointer transition-colors group dark:hover:bg-white/10">
                      <span className="text-sm font-semibold text-[#d3c4ab] group-hover:text-[#baac96]">
                        All Compounds
                      </span>
                      <ArrowRight size={13} className="text-[#dbcfba]" />
                    </div>
                  </Link>
                </div>
              </div>
            </NavDropdown>

            {/* Science dropdown */}
            <NavDropdown label="Science">
              <div className="flex">
                <div className="p-4 border-r border-gray-50 dark:border-border" style={{ width: 260 }}>
                  {SCIENCE_ITEMS.map((item) => {
                    const content = (
                      <div className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group dark:hover:bg-white/5">
                        <div className="w-9 h-9 rounded-xl bg-[#F5F2EC] flex items-center justify-center shrink-0 group-hover:bg-[#f2ede6] transition-colors dark:bg-white/10 dark:group-hover:bg-white/15">
                          <item.icon
                            size={15}
                            className="text-gray-500 group-hover:text-[#d3c4ab] transition-colors dark:text-gray-400"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 dark:text-gray-100 dark:group-hover:text-white">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{item.desc}</p>
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
                  <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 px-1 dark:text-gray-500">
                    Reference
                  </p>
                  {realCategories.map((cat) => (
                    <Link key={cat.id} href={`/compounds?category=${cat.slug}`}>
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group dark:hover:bg-white/5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#6b7280" }}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">
                          {cat.name}
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
                  location.startsWith("/lab-tests") ? "text-[#d3c4ab] font-semibold" : "text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                Lab Tests
              </button>
            </Link>

            {/* Wholesale */}
            <Link href="/wholesale">
              <button className="ml-2 text-sm font-semibold border border-[#dbcfba] text-[#d3c4ab] hover:bg-[#f2ede6] px-4 py-1.5 rounded-full transition-colors duration-150 dark:hover:bg-white/10">
                Apply for Wholesale
              </button>
            </Link>

            {/* Ask Sunny — links straight to the hosted Lynx chat rather than
                the old /ask-sunny.html iframe wrapper. External destination, so
                it stays a plain anchor opening in a new tab. Solid fill against
                Wholesale's outline so the two read as different kinds of action
                rather than a pair. */}
            <a
              href="https://www.lynxaiassistant.com/chat/lx_d9bc4b4dded89638fd1ade26797509c4936fa6dd257117de"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="ml-2 inline-flex items-center gap-1.5 text-sm font-semibold bg-[#d3c4ab] hover:bg-[#baac96] text-white px-4 py-1.5 rounded-full transition-colors duration-150 shadow-sm shadow-[#d3c4ab]/20">
                <Sparkles size={14} />
                Ask Sunny
              </button>
            </a>

            <Link href="/contact">
              <button className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg transition-colors ml-1 dark:text-gray-300 dark:hover:text-white">
                Contact
              </button>
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {/* Cart */}
            <button
              onClick={openCart}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-white/10"
            >
              <ShoppingBag size={18} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] min-h-[18px] bg-[#d3c4ab] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-1">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            {/* User menu */}
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors dark:hover:bg-white/10"
                >
                  <div className="w-7 h-7 rounded-full bg-[#f2ede6] flex items-center justify-center dark:bg-white/10">
                    <span className="text-xs font-bold text-[#d3c4ab]">
                      {(user?.name ?? user?.email ?? "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate dark:text-gray-300">
                    {user?.name ?? user?.email}
                  </span>
                  <ChevronDown size={13} className="text-gray-400 dark:text-gray-500" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50 dark:bg-card dark:border-border dark:shadow-black/40">
                    <div className="px-4 py-3 border-b border-gray-50 dark:border-border">
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-800 truncate dark:text-gray-100">{user?.email}</p>
                    </div>
                    <Link href="/my-orders">
                      <div
                        className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors dark:text-gray-300 dark:hover:bg-white/5"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShoppingBag size={14} className="text-gray-400 dark:text-gray-500" />
                        My Orders
                      </div>
                    </Link>
                    {isAdmin && (
                      <Link href="/admin">
                        <div
                          className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[#d3c4ab] hover:bg-[#f2ede6] cursor-pointer transition-colors dark:hover:bg-white/10"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings size={14} />
                          Admin Panel
                        </div>
                      </Link>
                    )}
                    <button
                      onClick={() => { setUserMenuOpen(false); logoutMutation.mutate(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:border-border"
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
                  <button className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10">
                    <User size={14} />
                    Sign In
                  </button>
                </Link>
                <Link href="/register">
                  <button className="text-sm font-semibold bg-[#d3c4ab] hover:bg-[#baac96] text-white px-4 py-1.5 rounded-xl transition-colors shadow-sm shadow-[#d3c4ab]/20">
                    Register
                  </button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger — 3 bars animated to X */}
            <button
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
              className="md:hidden flex flex-col gap-[5px] p-2 rounded-xl hover:bg-gray-100 transition-colors dark:hover:bg-white/10"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-transform duration-300 ease-in-out dark:bg-gray-300"
                style={mobileOpen ? { transform: "translateY(7.5px) rotate(45deg)" } : {}}
              />
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-opacity duration-300 ease-in-out dark:bg-gray-300"
                style={mobileOpen ? { opacity: 0 } : {}}
              />
              <span
                className="block w-[22px] h-[2.5px] bg-gray-700 rounded-full transition-transform duration-300 ease-in-out dark:bg-gray-300"
                style={mobileOpen ? { transform: "translateY(-7.5px) rotate(-45deg)" } : {}}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — absolute overlay, white solid, does not push content */}
      <div
        className="md:hidden absolute left-0 right-0 bg-white border-b border-gray-200 shadow-lg overflow-hidden z-50 dark:bg-card dark:border-border dark:shadow-black/40"
        style={{
          top: "100%",
          maxHeight: mobileOpen ? "800px" : "0",
          transition: "max-height 0.35s ease",
        }}
      >
        <div className="px-4 py-4 space-y-1">
          <Link href="/compounds">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
            >
              Shop
            </div>
          </Link>
          <div>
            <button
              onClick={() => setMobileScienceOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Science
              <ChevronDown
                size={15}
                className={`text-gray-400 transition-transform duration-200 dark:text-gray-500 ${mobileScienceOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{ maxHeight: mobileScienceOpen ? `${SCIENCE_ITEMS.length * 44}px` : "0px" }}
            >
              <div className="pl-3 pb-1 space-y-0.5">
                {SCIENCE_ITEMS.map((item) => (
                  <Link key={item.label} href={item.href ?? "#"}>
                    <div
                      className="px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
                      onClick={() => { setMobileOpen(false); setMobileScienceOpen(false); }}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/lab-tests">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
            >
              Lab Tests
            </div>
          </Link>
          <Link href="/wholesale">
            <div
              className="mx-3 my-1 text-center border border-[#dbcfba] text-[#d3c4ab] hover:bg-[#f2ede6] px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-colors duration-150 dark:hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              Apply for Wholesale
            </div>
          </Link>
          {/* Ask Sunny — same hosted Lynx chat as the desktop button above, so
              likewise a plain anchor to an external URL. Matches the Wholesale
              pill's footprint here but filled, to stay distinct. */}
          <a
            href="https://www.lynxaiassistant.com/chat/lx_d9bc4b4dded89638fd1ade26797509c4936fa6dd257117de"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
          >
            <div className="mx-3 my-1 flex items-center justify-center gap-1.5 bg-[#d3c4ab] hover:bg-[#baac96] text-white px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-colors duration-150 shadow-sm shadow-[#d3c4ab]/20">
              <Sparkles size={14} />
              Ask Sunny
            </div>
          </a>
          <Link href="/contact">
            <div
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
            >
              Contact
            </div>
          </Link>
          <div className="border-t border-gray-100 pt-2 mt-2 space-y-1 dark:border-border">
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link href="/admin">
                    <div
                      className="px-3 py-2.5 rounded-xl text-sm font-semibold text-[#d3c4ab] hover:bg-[#f2ede6] cursor-pointer dark:hover:bg-white/10"
                      onClick={() => setMobileOpen(false)}
                    >
                      Admin Panel
                    </div>
                  </Link>
                )}
                <Link href="/my-orders">
                  <div
                    className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
                    onClick={() => setMobileOpen(false)}
                  >
                    My Orders
                  </div>
                </Link>
                <button
                  onClick={() => { logoutMutation.mutate(); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login">
                  <button
                    className="flex-1 text-sm font-medium border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </button>
                </Link>
                <Link href="/register">
                  <button
                    className="flex-1 text-sm font-semibold bg-[#d3c4ab] text-white px-4 py-2 rounded-xl hover:bg-[#baac96] transition-colors"
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
