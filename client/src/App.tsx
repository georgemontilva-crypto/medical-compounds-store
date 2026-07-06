import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
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
import Footer from "./components/Footer";
import { initLenis, getLenis } from "@/lib/lenis";
import "lenis/dist/lenis.css";

// Pages
import Home from "./pages/Home";
import Compounds from "./pages/Compounds";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import OrderDetail from "./pages/OrderDetail";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders from "./pages/admin/AdminOrders";
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
      <Route path="/register" component={Register} />
      <Route path="/checkout" component={Checkout} />
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

function Router() {
  return (
    <Switch>
      {/* Admin routes — own AdminLayout shell, no public footer */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/orders/:id" component={AdminOrderDetail} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/coupons" component={AdminCoupons} />
      <Route path="/admin/lab-reports" component={AdminLabReports} />
      <Route path="/admin/site-images" component={AdminSiteImages} />
      <Route path="/admin/doc-integrity" component={AdminDocIntegrity} />
      <Route path="/admin/wholesale-applications" component={AdminWholesaleApplications} />

      {/* Everything else is a public store route, always rendered with the shared Footer */}
      <Route>
        <PublicRoutes />
        <Footer />
      </Route>
    </Switch>
  );
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

function App() {
  useEffect(() => {
    initLenis();
  }, []);

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
                <ScrollToTop />
                <BackgroundPatternSync />
                <Router />
                <CartDrawer />
                <FloatingCartButton />
                <ComplianceModal />
              </ComplianceProvider>
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
