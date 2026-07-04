import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { FlaskConical, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const utils = trpc.useUtils();
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Welcome back!");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "Invalid email or password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email: form.email, password: form.password });
  };

  return (
    <div className="min-h-dvh hex-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            {logoImage?.url ? (
              <div className="inline-flex items-center cursor-pointer">
                <img src={logoImage.url} alt="Logo" className="h-10 w-auto object-contain" />
              </div>
            ) : (
              <div className="inline-flex items-center gap-2.5 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <FlaskConical size={20} className="text-primary-foreground" />
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
          <h1 className="text-2xl font-bold mb-1">Sign In</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Access your Brighter Days Labs account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="lab-input pr-10"
                  required
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

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="lab-btn-primary w-full py-3 mt-2"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href="/register">
              <span className="text-primary font-medium hover:underline cursor-pointer">
                Create Account
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
