import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Slide data ─────────────────────────────────────────────────────────────────
// Using gradient backgrounds as placeholders (replace bg with real images via CSS background-image)
const SLIDES = [
  {
    id: 1,
    bgImage: "/manus-storage/lab-scientist_de975453.jpg",
    // object-position used only below 768px — the product/focal point in this
    // photo sits right-of-center, so mobile's cropped aspect cuts it off
    // unless we shift the crop origin toward it. Tune per-slide as needed.
    mobileFocal: "80% center",
    gradient: "from-[#0d1a18] via-[#0f2420] to-[#071510]",
    overlay: "#0d1a18",
    badge: "MADE IN USA",
    badgeColor: "bg-[#dbcfba]/20 border-[#dbcfba]/40 text-[#dbcfba]",
    showFlag: true,
    headline: "Brighter Days Labs\nPrecision Peptides for\nAdvanced Research",
    sub: "High-purity lyophilized compounds manufactured to the strictest laboratory standards.",
    cta: "Browse Compounds",
    ctaHref: "/compounds",
    stat1: { value: "≥99%", label: "Purity Guaranteed" },
    stat2: { value: "COA", label: "3rd-Party Lab Tested in Every Batch" },
    accent: "#dbcfba",
  },
  {
    id: 2,
    bgImage: "/manus-storage/peptide-synthesis_a782e21c.jpg",
    mobileFocal: "90% center",
    gradient: "from-[#1a1408] via-[#2a1f0a] to-[#1a1005]",
    overlay: "#1a1408",
    badge: "Cellular Research · Neural Peptides",
    badgeColor: "bg-[#C8A84B]/20 border-[#C8A84B]/40 text-[#C8A84B]",
    headline: "Brighter Days Labs\nCellular Signaling\nCompounds",
    sub: "Explore our catalog of cellular and neural research peptides with documented mechanisms.",
    cta: "View Catalog",
    ctaHref: "/compounds?category=cellular-research",
    // stat1/stat2 for this slide are overridden with live counts at render time — see LIVE_STATS_SLIDE_ID below.
    stat1: { value: "—", label: "Compounds" },
    stat2: { value: "—", label: "Categories" },
    accent: "#C8A84B",
  },
  {
    id: 3,
    bgImage: "/manus-storage/modern-lab_a86acfc6.jpg",
    mobileFocal: "80% center",
    gradient: "from-[#0d1a18] via-[#163028] to-[#0a1f18]",
    overlay: "#0a1f18",
    badge: "Metabolic Research · Energy Metabolism",
    badgeColor: "bg-[#d7cab3]/20 border-[#d7cab3]/40 text-[#d7cab3]",
    headline: "Brighter Days Labs\nMetabolic Research\nGrade Compounds",
    sub: "NAD+, MOTS-C and more — compounds studied for their role in cellular energy and longevity pathways.",
    cta: "Metabolic Compounds",
    ctaHref: "/compounds?category=metabolic-research",
    stat1: { value: "GMP", label: "Compliant" },
    stat2: { value: "HPLC", label: "Verified" },
    accent: "#d7cab3",
  },
  // Slide 4 (Endocrine — Sermorelin/Tesamorelin/CJC-1295) removed: there's no
  // real "Endocrine" category in the catalog (only Tissue/Metabolic/
  // Neural-Cognitive/Cellular exist), so its CTA had nothing real to link
  // to. Re-add once a real Endocrine category exists.
];

// Slide 2's stats are compound/category counts, not qualitative badges like
// the other slides' (≥99% Purity, COA, GMP, HPLC) — those stay hardcoded,
// but these two are replaced with live DB counts at render time.
const LIVE_STATS_SLIDE_ID = 2;

// ── Ken Burns keyframes injected once ─────────────────────────────────────────
const KB_STYLE = `
@keyframes kenburns {
  0%   { transform: scale(1)    translate(0, 0); }
  50%  { transform: scale(1.08) translate(-1%, -1%); }
  100% { transform: scale(1.12) translate(1%, 0.5%); }
}
@keyframes kenburns-alt {
  0%   { transform: scale(1)    translate(0, 0); }
  50%  { transform: scale(1.1)  translate(1%, 0.5%); }
  100% { transform: scale(1.14) translate(-0.5%, -1%); }
}
.kb-anim       { animation: kenburns     8s ease-in-out forwards; }
.kb-anim-alt   { animation: kenburns-alt 8s ease-in-out forwards; }
`;

let kbStyleInjected = false;
function injectKBStyle() {
  if (kbStyleInjected) return;
  const el = document.createElement("style");
  el.textContent = KB_STYLE;
  document.head.appendChild(el);
  kbStyleInjected = true;
}

// Converts a slide's solid hex accent (e.g. "#dbcfba") to an rgba() string
// so the CTA button background can carry alpha without a second color token.
function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── HeroSlider ─────────────────────────────────────────────────────────────────
export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const { data: siteImages = [] } = trpc.siteImages.list.useQuery();
  const imageBySlot = Object.fromEntries(siteImages.map((img) => [img.slotKey, img.url]));

  const { data: heroConfigs = [] } = trpc.heroSlidesConfig.list.useQuery();
  const heroConfigBySlot = Object.fromEntries(heroConfigs.map((c) => [c.slotKey, c]));

  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: categories = [] } = trpc.categories.list.useQuery();

  useEffect(() => { injectKBStyle(); }, []);

  // Admin can deactivate individual slides — skip them without leaving a gap.
  // Falls back to showing all slides if every one is somehow deactivated, so
  // the hero never renders empty.
  const activeSlides = SLIDES.filter((s) => heroConfigBySlot[`hero_slide_${s.id}`]?.active !== false);
  const visibleSlides = activeSlides.length > 0 ? activeSlides : SLIDES;
  const safeCurrent = current % visibleSlides.length;

  const goTo = useCallback((idx: number) => {
    setPrev(current);
    setCurrent(idx);
    setAnimKey((k) => k + 1);
    setTimeout(() => setPrev(null), 700);
  }, [current]);

  const next = useCallback(() => goTo((safeCurrent + 1) % visibleSlides.length), [safeCurrent, goTo, visibleSlides.length]);
  const back = useCallback(() => goTo((safeCurrent - 1 + visibleSlides.length) % visibleSlides.length), [safeCurrent, goTo, visibleSlides.length]);

  // Auto-advance every 6 s — nothing to advance to with a single (or zero)
  // visible slide, so skip starting the timer entirely rather than having
  // it tick forever just to re-select the same slide.
  useEffect(() => {
    if (visibleSlides.length <= 1) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next, visibleSlides.length]);

  const slide = visibleSlides[safeCurrent];
  const prevSlide = prev !== null ? visibleSlides[prev % visibleSlides.length] : null;
  const bgImage = imageBySlot[`hero_slide_${slide.id}`] ?? slide.bgImage;
  const mobileBgImage = imageBySlot[`hero_slide_${slide.id}_mobile`];
  const animationEnabled = heroConfigBySlot[`hero_slide_${slide.id}`]?.animationEnabled !== false;

  const stat1 =
    slide.id === LIVE_STATS_SLIDE_ID ? { value: String(products.length), label: "Compounds" } : slide.stat1;
  const stat2 =
    slide.id === LIVE_STATS_SLIDE_ID ? { value: String(categories.length), label: "Categories" } : slide.stat2;

  return (
    <section className="relative w-full overflow-hidden" style={{ height: "100vh", minHeight: 560, maxHeight: 900 }}>

      {/* ── Previous slide (fading out) ── */}
      {prevSlide && (
        <div
          key={`prev-${prev}`}
          className="absolute inset-0 z-0 transition-opacity duration-700 opacity-0"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${prevSlide.gradient}`} />
        </div>
      )}

      {/* ── Current slide background with Ken Burns ── */}
      <div key={`bg-${current}-${animKey}`} className="absolute inset-0 z-0 overflow-hidden">
        {/* Real photo background */}
        {bgImage ? (
          <picture>
            {/* Admin can upload a separate mobile/tablet crop per slide — if
                they haven't, this <source> is simply omitted and the <img>
                below (desktop image + mobileFocal object-position) is what
                renders at every width, same as before this existed.
                srcset (unlike a plain src) uses raw whitespace as a
                candidate/descriptor delimiter — uploaded filenames routinely
                contain spaces (R2 keys keep the original filename), which
                silently breaks that candidate and falls back to the desktop
                img. Encode just the spaces so the URL parses as one candidate. */}
            {mobileBgImage && (
              <source media="(max-width: 767px)" srcSet={mobileBgImage.replace(/ /g, "%20")} />
            )}
            <img
              src={bgImage}
              alt=""
              aria-hidden="true"
              className={`hero-bg-img absolute inset-0 w-full h-full object-cover ${
                animationEnabled ? (safeCurrent % 2 === 0 ? "kb-anim" : "kb-anim-alt") : ""
              }`}
              style={{
                ...(animationEnabled ? { willChange: "transform" } : {}),
                // mobileFocal only makes sense as a crop-origin shift for the
                // desktop image being force-fit into a narrow viewport — a
                // dedicated mobile image is already composed/cropped for that
                // width, so it should render centered, not re-shifted.
                "--hero-mobile-focal": mobileBgImage ? "center" : slide.mobileFocal ?? "center",
              } as React.CSSProperties}
            />
          </picture>
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} ${
              animationEnabled ? (safeCurrent % 2 === 0 ? "kb-anim" : "kb-anim-alt") : ""
            }`}
            style={animationEnabled ? { willChange: "transform" } : undefined}
          />
        )}
        {/* Dark overlay for text readability — darkest over the text (left), fading
            to fully transparent on the right so the image shows through unobscured */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${hexToRgba(slide.overlay, 0.75)} 0%, ${hexToRgba(
              slide.overlay,
              0.35
            )} 40%, ${hexToRgba(slide.overlay, 0)} 70%)`,
          }}
        />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Mobile-only vertical vignette — additional layer stacked on top of the
            horizontal overlay above (not a replacement). Darkest at the bottom
            (where text/badges sit), fading to transparent at 50% height.
            Desktop is untouched: the class resolves to no background above 767px. */}
        <div className="absolute inset-0 hero-mobile-vignette pointer-events-none" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 h-full flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
          <div className="max-w-2xl">

            {/* Badge */}
            <div
              key={`badge-${current}`}
              className={`inline-flex items-center gap-2 border text-xs font-semibold px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm ${slide.badgeColor}`}
              style={{ animation: "fadeSlideUp 0.6s ease-out both", animationDelay: "0.1s" }}
            >
              {slide.showFlag ? (
                <img
                  src="https://pub-f9dc97453f1244a0a96fa1fb85c35d2e.r2.dev/site-images/Flag_of_the_United_States.svg"
                  alt=""
                  aria-hidden="true"
                  className="w-4 h-3 rounded-[1px] object-cover flex-shrink-0"
                />
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: slide.accent }}
                />
              )}
              {slide.badge}
            </div>

            {/* Headline */}
            <h1
              key={`h1-${current}`}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.04] mb-6 whitespace-pre-line"
              style={{ animation: "fadeSlideUp 0.7s ease-out both", animationDelay: "0.25s" }}
            >
              {slide.headline}
            </h1>

            {/* Sub */}
            <p
              key={`sub-${current}`}
              className="text-base sm:text-lg text-white leading-relaxed mb-8 max-w-lg"
              style={{ animation: "fadeSlideUp 0.7s ease-out both", animationDelay: "0.35s" }}
            >
              {slide.sub}
            </p>

            {/* CTA */}
            <div
              key={`cta-${current}`}
              className="flex items-center gap-4"
              style={{ animation: "fadeSlideUp 0.7s ease-out both", animationDelay: "0.45s" }}
            >
              <Link href={slide.ctaHref}>
                <button
                  className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-lg"
                  style={{ backgroundColor: hexToRgba(slide.accent, 0.6), color: "#3a2f1f" }}
                >
                  {slide.cta}
                  <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div
              key={`stats-${current}`}
              className="flex items-center gap-8 mt-10 pt-8 border-t border-white/10"
              style={{ animation: "fadeSlideUp 0.7s ease-out both", animationDelay: "0.55s" }}
            >
              <div>
                <p className="text-2xl font-extrabold text-white">{stat1.value}</p>
                <p className="text-xs text-white font-medium mt-0.5">{stat1.label}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-extrabold text-white">{stat2.value}</p>
                <p className="text-xs text-white font-medium mt-0.5">{stat2.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide indicators (right side) ── */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        {visibleSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 rounded-full transition-all duration-300 ${
              i === safeCurrent ? "h-8 bg-white" : "h-2 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* ── Prev / Next arrows ── */}
      <button
        onClick={back}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 items-center justify-center text-white transition-all duration-200 hover:scale-105"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="hidden md:flex absolute right-14 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 items-center justify-center text-white transition-all duration-200 hover:scale-105"
      >
        <ChevronRight size={18} />
      </button>

      {/* ── Progress bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/10">
        <div
          key={`progress-${current}`}
          className="h-full bg-white/50"
          style={{
            animation: "progressBar 6s linear forwards",
          }}
        />
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .hero-bg-img { object-position: center; }
        @media (max-width: 767px) {
          .hero-bg-img { object-position: var(--hero-mobile-focal, center); }
        }
        .hero-mobile-vignette { background: transparent; }
        @media (max-width: 767px) {
          .hero-mobile-vignette {
            background: linear-gradient(to top, rgba(61, 53, 39, 0.8) 0%, transparent 50%);
          }
        }
      `}</style>
    </section>
  );
}
