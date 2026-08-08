import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { FlaskConical, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import ParticleBackground from "@/components/ParticleBackground";
import { CHECKOUT_OFFER_PENDING_KEY } from "@/contexts/ComplianceContext";

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const utils = trpc.useUtils();
  const { theme } = useTheme();
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });
  const { data: footerLogoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const activeLogoUrl = theme === "dark" ? footerLogoImage?.url : logoImage?.url;
  const cameFromCheckoutOffer =
    typeof window !== "undefined" && sessionStorage.getItem(CHECKOUT_OFFER_PENDING_KEY) === "1";
  const { data: newCustomerOffer } = trpc.coupons.getActiveNewCustomerOffer.useQuery(undefined, {
    enabled: cameFromCheckoutOffer,
  });

  const claimWelcomeOffer = trpc.coupons.claimWelcomeOffer.useMutation();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      utils.auth.me.invalidate();
      toast.success("Account created! Welcome to Brighter Days Labs.");

      if (sessionStorage.getItem(CHECKOUT_OFFER_PENDING_KEY) === "1") {
        sessionStorage.removeItem(CHECKOUT_OFFER_PENDING_KEY);
        try {
          const offer = await claimWelcomeOffer.mutateAsync();
          sessionStorage.setItem("pendingCoupon", offer.code);
          toast.success(`Welcome code ${offer.code} applied to your order!`);
        } catch {
          // Offer may have been deactivated between showing the modal and registering — proceed without it.
        }
        navigate("/checkout");
        return;
      }

      navigate("/");
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("Email already registered. Please sign in.");
      } else {
        toast.error(err.message || "Registration failed. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    registerMutation.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
    });
  };

  return (
    <div className="min-h-dvh relative overflow-hidden bg-background flex items-center justify-center p-4" style={{ minHeight: "100dvh" }}>
      {/* Same reason as Login: without this the route inherits index.html's
          head wholesale — the home's title and rel=canonical — on a page that
          has no business being in search results at all. */}
      <Helmet>
        <title>Create Account — Brighter Days Labs</title>
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://www.brighterdayslabs.com/register" />
      </Helmet>
      <ParticleBackground
        color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
        particleRadius={3.5}
        particleOpacity={0.22}
        lineOpacity={0.14}
        linkDistance={150}
        className="absolute inset-0 w-full h-full"
      />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            {activeLogoUrl ? (
              <div className="inline-flex items-center cursor-pointer">
                <img src={activeLogoUrl} alt="Brighter Days Labs logo" className="h-16 w-auto object-contain" />
              </div>
            ) : (
              <div className="inline-flex items-center gap-2.5 cursor-pointer">
                <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center">
                  <FlaskConical size={30} className="text-primary-foreground" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-lg block leading-tight">Brighter Days Labs</span>
                  <span className="text-xs text-muted-foreground">Compounds</span>
                </div>
              </div>
            )}
          </Link>
        </div>

        <div className="lab-card p-8">
          <h1 className="text-2xl font-bold mb-1">Create Account</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Join Brighter Days Labs to access our research compound catalog
          </p>

          {cameFromCheckoutOffer && newCustomerOffer && (
            <div className="mb-6 p-3.5 rounded-xl bg-[#f2ede6] border border-[#e5dccc] text-sm text-gray-800 font-medium">
              Complete registration to get{" "}
              {newCustomerOffer.type === "percentage"
                ? `${newCustomerOffer.value}%`
                : `$${newCustomerOffer.value.toFixed(2)}`}{" "}
              off your first order.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="Dr. Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="lab-input"
                required
                minLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="researcher@lab.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="lab-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="lab-input pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className="lab-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="lab-btn-primary w-full py-3 mt-2"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-primary font-medium hover:underline cursor-pointer">
                Sign In
              </span>
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          For research purposes only. Not for human consumption.
        </p>
      </div>
    </div>
  );
}
