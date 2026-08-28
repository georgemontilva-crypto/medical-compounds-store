import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { FlaskConical, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import ParticleBackground from "@/components/ParticleBackground";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { theme } = useTheme();
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo" });
  const { data: footerLogoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const activeLogoUrl = theme === "dark" ? footerLogoImage?.url : logoImage?.url;

  // No onError branch on purpose: the endpoint answers identically whether or
  // not the address is registered, and a visible failure here would give back
  // the distinction the server works to withhold.
  const request = trpc.auth.requestPasswordReset.useMutation({
    onSettled: () => setSent(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    request.mutate({ email });
  };

  return (
    <div
      className="min-h-dvh relative overflow-hidden bg-background flex items-center justify-center p-4"
      style={{ minHeight: "100dvh" }}
    >
      {/* No <Helmet> here: title, robots and rel=canonical for this route are
          written server-side by server/_core/seoMeta.ts, so a crawler that
          never runs JS sees them too. NOINDEX_ROUTE_TITLES holds the title. */}
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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MailCheck size={22} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Check your inbox</h1>
              <p className="text-sm text-muted-foreground mb-6">
                If that address is registered, we've sent a reset link. It works once and
                expires in an hour.
              </p>
              <Link href="/login">
                <span className="text-primary font-medium hover:underline cursor-pointer text-sm inline-flex items-center gap-1.5">
                  <ArrowLeft size={14} />
                  Back to sign in
                </span>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email and we'll send you a link to choose a new one.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="researcher@lab.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="lab-input"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={request.isPending}
                  className="lab-btn-primary w-full py-3 mt-2"
                >
                  {request.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link href="/login">
                  <span className="text-primary font-medium hover:underline cursor-pointer">
                    Back to sign in
                  </span>
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
