import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { trpc } from "@/lib/trpc";
import { Link, useLocation, useSearch } from "wouter";
import { FlaskConical, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import ParticleBackground from "@/components/ParticleBackground";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });
  const { data: footerLogoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const activeLogoUrl = theme === "dark" ? footerLogoImage?.url : logoImage?.url;

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated — you can sign in now.");
      navigate("/login");
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Both checks are here rather than left to the server. The confirm field
    // exists only to catch a typo and the server has no use for it; the length
    // is enforced there too, but its rejection arrives as a raw Zod payload,
    // which is not something to put in front of someone resetting a password.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    reset.mutate({ token, password });
  };

  return (
    <div
      className="min-h-dvh relative overflow-hidden bg-background flex items-center justify-center p-4"
      style={{ minHeight: "100dvh" }}
    >
      <Helmet>
        <title>Choose a New Password — Brighter Days Labs</title>
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://www.brighterdayslabs.com/reset-password" />
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
          <h1 className="text-2xl font-bold mb-1">Choose a new password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Pick something you haven't used here before.
          </p>

          {!token ? (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                This link is missing its token.{" "}
                <Link href="/forgot-password">
                  <span className="font-medium underline cursor-pointer">Request a new one</span>
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="lab-input pr-10"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
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
                  placeholder="Type it again"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="lab-input"
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={reset.isPending}
                className="lab-btn-primary w-full py-3 mt-2"
              >
                {reset.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/login">
              <span className="text-primary font-medium hover:underline cursor-pointer">
                Back to sign in
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
