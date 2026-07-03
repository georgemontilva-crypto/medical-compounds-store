import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider } from "./contexts/AuthContext";
import CartDrawer from "./components/CartDrawer";

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
import LabReports from "./pages/LabReports";
import Contact from "./pages/Contact";

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

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AuthProvider>
            <CartProvider>
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
