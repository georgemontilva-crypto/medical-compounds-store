import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import ParticleBackground from "@/components/ParticleBackground";

const SESSION_KEY = "splashShown";
const DURATION_MS = 1800;
const FADE_MS = 350;

function easeOutQuad(t: number) {
  return 1 - (1 - t) * (1 - t);
}
function easeInQuad(t: number) {
  return t * t;
}
// Fast at the start, slows through the middle, fast again at the end —
// two eased halves stitched together instead of a single symmetric curve.
function easeFastSlowFast(t: number) {
  return t < 0.5 ? 0.5 * easeOutQuad(t * 2) : 0.5 + 0.5 * easeInQuad((t - 0.5) * 2);
}

export default function LoadingScreen() {
  // Lazy init runs synchronously before first paint, so a returning-session
  // visitor never sees a flash of the splash appearing then disappearing.
  const [shouldShow] = useState(() => typeof window !== "undefined" && !sessionStorage.getItem(SESSION_KEY));
  const [mounted, setMounted] = useState(shouldShow);
  const [fadingOut, setFadingOut] = useState(false);
  const [percent, setPercent] = useState(0);
  const { theme } = useTheme();

  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery(
    { slotKey: "site_logo" },
    { enabled: shouldShow }
  );
  const { data: footerLogoImage } = trpc.siteImages.getBySlot.useQuery(
    { slotKey: "site_logo_footer" },
    { enabled: shouldShow }
  );
  const activeLogoUrl = theme === "dark" ? footerLogoImage?.url : logoImage?.url;

  useEffect(() => {
    if (!shouldShow) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const start = performance.now();
    let rafId = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setPercent(Math.round(easeFastSlowFast(t) * 100));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setFadingOut(true);
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8f8fa] dark:bg-background transition-opacity ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onTransitionEnd={() => {
        if (fadingOut) setMounted(false);
      }}
    >
      <ParticleBackground color="58, 158, 148" className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {activeLogoUrl ? (
          <img src={activeLogoUrl} alt="Brighter Days Labs logo" className="h-14 w-auto object-contain" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d3c4ab] to-[#d7cab3] flex items-center justify-center shadow-lg shadow-[#d3c4ab]/30">
              <FlaskConical size={28} className="text-white" />
            </div>
            <div className="leading-none text-left">
              <span className="font-extrabold text-gray-950 text-2xl tracking-tight dark:text-white">Brighter Days Labs</span>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 leading-none mt-1 dark:text-gray-500">
                Compounds
              </p>
            </div>
          </div>
        )}
        <p className="text-gray-400 text-sm font-mono tracking-widest dark:text-gray-500">{percent}%</p>
      </div>
    </div>
  );
}
