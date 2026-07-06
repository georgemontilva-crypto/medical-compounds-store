import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const SESSION_KEY = "ageVerified";
const FADE_MS = 200;
const DECLINE_REDIRECT_URL = "https://www.google.com";

export default function AgeVerificationModal() {
  // Lazy init runs synchronously before first paint, same pattern as
  // LoadingScreen — a returning-session visitor never sees a flash of
  // this appearing then disappearing. Independent sessionStorage key and
  // no shared state with LoadingScreen; a higher z-index (10000 vs its
  // 9999) is all that's needed to sit on top of it when both show on a
  // first visit.
  const [shouldShow] = useState(() => typeof window !== "undefined" && !sessionStorage.getItem(SESSION_KEY));
  const [mounted, setMounted] = useState(shouldShow);
  const [fadingOut, setFadingOut] = useState(false);
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

  if (!mounted) return null;

  function handleConfirm() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setFadingOut(true);
  }

  function handleDecline() {
    window.location.href = DECLINE_REDIRECT_URL;
  }

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-opacity ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onTransitionEnd={() => {
        if (fadingOut) setMounted(false);
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 text-center dark:bg-card dark:border-border dark:shadow-black/40">
        <div className="flex justify-center mb-6">
          {activeLogoUrl ? (
            <img src={activeLogoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d3c4ab] to-[#d7cab3] flex items-center justify-center shadow-md shadow-[#d3c4ab]/20">
                <FlaskConical size={17} className="text-white" />
              </div>
              <span className="font-extrabold text-gray-950 text-base tracking-tight dark:text-white">Brighter Days Labs</span>
            </div>
          )}
        </div>

        <h2 className="text-xl font-extrabold text-gray-950 mb-3 dark:text-white">Age Verification Required</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6 dark:text-gray-400">
          This website contains information about research compounds intended for laboratory and scientific use
          only. You must be 21 years of age or older to enter this site.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={handleDecline}
            className="flex-1 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-3 rounded-full transition-colors dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
          >
            No, I am not
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 text-sm font-semibold bg-[#d3c4ab] hover:bg-[#baac96] text-white px-5 py-3 rounded-full transition-colors"
          >
            Yes, I am 21 or older
          </button>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed dark:text-gray-500">
          By entering, you confirm that you meet the age requirement and agree to use any products purchased
          strictly for research purposes.
        </p>
      </div>
    </div>
  );
}
