import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider } from "./contexts/AuthContext";
import CartDrawer from "./components/CartDrawer";
import LoadingScreen from "./components/LoadingScreen";
import { initLenis } from "@/lib/lenis";
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
import Contact from "./pages/Contact";
import WholesaleApplication from "./pages/WholesaleApplication";
import AdminWholesaleApplications from "./pages/admin/AdminWholesaleApplications";
import ScienceApproach from "./pages/ScienceApproach";
import ScienceManufacturing from "./pages/ScienceManufacturing";
import ScienceResearchStandards from "./pages/ScienceResearchStandards";

function Router() {
  return (
    <Switch>
      {/* Public store routes */}
      <Route path="/" component={Home} />
      <Route path="/compounds" component={Compounds} />
      <Route path="/compounds/:slug" component={ProductDetail} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/my-orders" component={MyOrders} />
      <Route path="/my-orders/:id" component={OrderDetail} />
      <Route path="/lab-reports/:slug" component={LabReports} />
      <Route path="/contact" component={Contact} />
      <Route path="/wholesale" component={WholesaleApplication} />
      <Route path="/science/approach" component={ScienceApproach} />
      <Route path="/science/manufacturing" component={ScienceManufacturing} />
      <Route path="/science/research-standards" component={ScienceResearchStandards} />

      {/* Admin routes */}
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

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { data: bgPattern } = trpc.siteImages.getBySlot.useQuery({ slotKey: "global_background_pattern" });

  useEffect(() => {
    initLenis();
  }, []);

  useEffect(() => {
    if (bgPattern?.url) {
      document.documentElement.style.setProperty("--hex-bg-pattern", `url("${bgPattern.url}")`);
      document.documentElement.style.setProperty("--hex-bg-size", "auto");
    } else {
      document.documentElement.style.removeProperty("--hex-bg-pattern");
      document.documentElement.style.removeProperty("--hex-bg-size");
    }
  }, [bgPattern]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AuthProvider>
            <CartProvider>
              <LoadingScreen />
              <Toaster position="top-right" />
              <Router />
              <CartDrawer />
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
