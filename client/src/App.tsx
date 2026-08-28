import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { captureReferralFromUrl } from "@/lib/referral";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ComplianceProvider } from "./contexts/ComplianceContext";
import CartDrawer from "./components/CartDrawer";
import FloatingCartButton from "./components/FloatingCartButton";
import LoadingScreen from "./components/LoadingScreen";
import AgeVerificationModal from "./components/AgeVerificationModal";
import ComplianceModal from "./components/ComplianceModal";
import GuestOrRegisterModal from "./components/GuestOrRegisterModal";
import Footer from "./components/Footer";
import Navbar from "@/components/Navbar";
import { initLenis, getLenis } from "@/lib/lenis";
import "lenis/dist/lenis.css";

// Pages
import Home from "./pages/Home";
import Compounds from "./pages/Compounds";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import MyAccount from "./pages/MyAccount";
import OrderDetail from "./pages/OrderDetail";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminShippingSettings from "./pages/admin/AdminShippingSettings";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminLabReports from "./pages/admin/AdminLabReports";
import AdminSiteImages from "./pages/admin/AdminSiteImages";
import AdminDocIntegrity from "./pages/admin/AdminDocIntegrity";
import LabReports from "./pages/LabReports";
import LabTests from "./pages/LabTests";
import Contact from "./pages/Contact";
import WholesaleApplication from "./pages/WholesaleApplication";
import AdminWholesaleApplications from "./pages/admin/AdminWholesaleApplications";
import AdminAffiliates from "./pages/admin/AdminAffiliates";
import ScienceApproach from "./pages/ScienceApproach";
import ScienceManufacturing from "./pages/ScienceManufacturing";
import ScienceResearchStandards from "./pages/ScienceResearchStandards";
import ScienceResponsibleSupply from "./pages/ScienceResponsibleSupply";
import FAQ from "./pages/FAQ";
import LegalResearchUseOnly from "./pages/LegalResearchUseOnly";
import LegalWebsiteDisclaimer from "./pages/LegalWebsiteDisclaimer";
import LegalTermsOfService from "./pages/LegalTermsOfService";
import LegalShippingPolicy from "./pages/LegalShippingPolicy";

function PublicRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/compounds" component={Compounds} />
      <Route path="/compounds/:slug" component={ProductDetail} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/register" component={Register} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/my-account" component={MyAccount} />
      <Route path="/my-orders" component={MyOrders} />
      <Route path="/my-orders/:id" component={OrderDetail} />
      <Route path="/lab-reports/:slug" component={LabReports} />
      <Route path="/lab-tests" component={LabTests} />
      <Route path="/contact" component={Contact} />
      <Route path="/wholesale" component={WholesaleApplication} />
      <Route path="/science/approach" component={ScienceApproach} />
      <Route path="/science/manufacturing" component={ScienceManufacturing} />
      <Route path="/science/research-standards" component={ScienceResearchStandards} />
      <Route path="/science/responsible-supply" component={ScienceResponsibleSupply} />
      <Route path="/faq" component={FAQ} />
      <Route path="/legal/research-use-only" component={LegalResearchUseOnly} />
      <Route path="/legal/website-disclaimer" component={LegalWebsiteDisclaimer} />
      <Route path="/legal/terms-of-service" component={LegalTermsOfService} />
      <Route path="/legal/shipping-policy" component={LegalShippingPolicy} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Shell for every public store route.
 *
 * Navbar and Footer live here rather than in each page. The navbar used to be
 * opt-in per page, which left 13 of the 24 public pages without one at all.
 *
 * min-h-screen on a flex column with a flex-1 main is what pins the footer to
 * the bottom of the viewport when a page is short, while still scrolling
 * normally when it is long. Pages fill that main area with flex-1 of their own
 * instead of each setting min-h-screen, which made every page a full viewport
 * tall on its own and pushed the footer permanently below the fold.
 *
 * Checkout is the one public route that opts out of the footer: it is a funnel,
 * and the full marketing footer is ~1,500px of exit links sitting between the
 * shopper and the pay button.
 */
function PublicShell() {
  const [location] = useLocation();
  const isCheckout = location === "/checkout";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <PublicRoutes />
      </main>
      {!isCheckout && <Footer />}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Admin routes — own AdminLayout shell, no public footer */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/shipping-settings" component={AdminShippingSettings} />
      <Route path="/admin/orders/:id" component={AdminOrderDetail} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/coupons" component={AdminCoupons} />
      <Route path="/admin/lab-reports" component={AdminLabReports} />
      <Route path="/admin/site-images" component={AdminSiteImages} />
      <Route path="/admin/doc-integrity" component={AdminDocIntegrity} />
      <Route path="/admin/wholesale-applications" component={AdminWholesaleApplications} />
      <Route path="/admin/affiliates" component={AdminAffiliates} />

      {/* Everything else is a public store route, inside the shared shell */}
      <Route>
        <PublicShell />
      </Route>
    </Switch>
  );
}

// Captures ?ref=CODE from whatever page the visitor lands on and remembers it
// for 30 days, so an affiliate still gets credit when the order happens later.
// Mounted at the app root rather than on Home because a shared product link is
// the likeliest entry point.
function ReferralCapture() {
  const [location] = useLocation();

  useEffect(() => {
    captureReferralFromUrl();
  }, [location]);

  return null;
}

/**
 * Counts a page view on every route change.
 *
 * Mounted at the app root next to ReferralCapture rather than called from each
 * page, for the same reason: any page can be the first one a visitor lands on.
 *
 * Three things it deliberately does not do.
 *
 * It sends only `window.location.pathname`, never the query string — a
 * `?token=` on the reset-password route would otherwise be written into an
 * analytics table. It skips `/admin`, which is the shop owner at work rather
 * than traffic. And it stays quiet outside a production build, because the dev
 * server talks to the same Railway database as the live site, so a local reload
 * would show up as a real visit.
 */
function PageViewTracker() {
  const [location] = useLocation();
  const record = trpc.traffic.record.useMutation();
  const recordRef = useRef(record.mutate);
  recordRef.current = record.mutate;
  const lastCounted = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (location.startsWith("/admin")) return;
    if (lastCounted.current === location) return;
    lastCounted.current = location;

    const params = new URLSearchParams(window.location.search);
    recordRef.current({
      path: window.location.pathname,
      // Only the first page of a visit carries an outside referrer; on every
      // later one it is this site, which the server files as "direct".
      referrer: document.referrer || undefined,
      utmSource: params.get("utm_source") ?? undefined,
    });
  }, [location]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}

// Syncs the admin-uploaded hex background pattern into a CSS var consumed by
// .hex-cream/.hex-section/.hex-teal. In dark mode the pattern is forced off
// site-wide — those classes fall back to a plain dark surface instead of the
// uploaded texture. Lives inside ThemeProvider so it can read the active theme.
function BackgroundPatternSync() {
  const { data: bgPattern } = trpc.siteImages.getBySlot.useQuery({ slotKey: "global_background_pattern" });
  const { theme } = useTheme();

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.style.setProperty("--hex-bg-pattern", "none");
      document.documentElement.style.removeProperty("--hex-bg-size");
    } else if (bgPattern?.url) {
      document.documentElement.style.setProperty("--hex-bg-pattern", `url("${bgPattern.url}")`);
      document.documentElement.style.setProperty("--hex-bg-size", "auto");
    } else {
      document.documentElement.style.removeProperty("--hex-bg-pattern");
      document.documentElement.style.removeProperty("--hex-bg-size");
    }
  }, [bgPattern, theme]);

  return null;
}

// Points the static <link rel="icon"> in index.html at the admin-uploaded
// favicon once it's loaded. Runs after mount, so the static/placeholder icon
// is what shows until this query resolves.
function FaviconSync() {
  const { data: favicon } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_favicon" });

  useEffect(() => {
    if (!favicon?.url) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    link?.setAttribute("href", favicon.url);
  }, [favicon]);

  return null;
}

function App() {
  useEffect(() => {
    initLenis();
  }, []);

  // No <HelmetProvider>: no page renders a <Helmet> any more. Every route's
  // head tags are written server-side by server/_core/seoMeta.ts, which is
  // the only way a crawler that doesn't run JS ever sees them.
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <AuthProvider>
            <CartProvider>
              <ComplianceProvider>
                <AgeVerificationModal />
                <LoadingScreen />
                <Toaster position="top-right" />
                <ReferralCapture />
                <PageViewTracker />
                <ScrollToTop />
                <BackgroundPatternSync />
                <FaviconSync />
                <Router />
                <CartDrawer />
                <FloatingCartButton />
                <ComplianceModal />
                <GuestOrRegisterModal />
              </ComplianceProvider>
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
