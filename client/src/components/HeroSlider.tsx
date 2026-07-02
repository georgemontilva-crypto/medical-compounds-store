import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

// ── Slide data ─────────────────────────────────────────────────────────────────
// Using gradient backgrounds as placeholders (replace bg with real images via CSS background-image)
const SLIDES = [
  {
    id: 1,
    bgImage: "/manus-storage/lab-scientist_de975453.jpg",
    gradient: "from-[#0d1a18] via-[#0f2420] to-[#071510]",
    overlay: "bg-[#0d1a18]/65",
    badge: "Research Grade · ≥99% Purity",
    badgeColor: "bg-[#7ECDC4]/20 border-[#7ECDC4]/40 text-[#7ECDC4]",
    tag: "01 · TISSUE REPAIR",
    headline: "Precision Peptides\nfor Advanced Research",
    sub: "High-purity lyophilized compounds manufactured to the strictest laboratory standards.",
    cta: "Browse Compounds",
    ctaHref: "/compounds",
    stat1: { value: "≥99%", label: "Purity Guaranteed" },
    stat2: { value: "COA", label: "Every Batch" },
    accent: "#7ECDC4",
  },
  {
    id: 2,
    bgImage: "/manus-storage/peptide-synthesis_a782e21c.jpg",
    gradient: "from-[#1a1408] via-[#2a1f0a] to-[#1a1005]",
    overlay: "bg-[#1a1408]/65",
    badge: "Cellular Research · Neural Peptides",
    badgeColor: "bg-[#C8A84B]/20 border-[#C8A84B]/40 text-[#C8A84B]",
    tag: "02 · CELLULAR & NEURAL",
    headline: "Cellular Signaling\nCompounds",
    sub: "Explore our catalog of cellular and neural research peptides with documented mechanisms.",
    cta: "View Catalog",
    ctaHref: "/compounds?category=Cellular",
    stat1: { value: "23+", label: "Compounds" },
    stat2: { value: "5", label: "Categories" },
    accent: "#C8A84B",
  },
  {
    id: 3,
    bgImage: "/manus-storage/modern-lab_a86acfc6.jpg",
    gradient: "from-[#0d1a18] via-[#163028] to-[#0a1f18]",
    overlay: "bg-[#0a1f18]/60",
    badge: "Metabolic Research · Energy Metabolism",
    badgeColor: "bg-[#5BB8AE]/20 border-[#5BB8AE]/40 text-[#5BB8AE]",
    tag: "03 · METABOLIC",
    headline: "Metabolic Research\nGrade Compounds",
    sub: "NAD+, MOTS-C and more — compounds studied for their role in cellular energy and longevity pathways.",
    cta: "Metabolic Compounds",
    ctaHref: "/compounds?category=Metabolic",
    stat1: { value: "GMP", label: "Compliant" },
    stat2: { value: "HPLC", label: "Verified" },
    accent: "#5BB8AE",
  },
  {
    id: 4,
    bgImage: "/manus-storage/lab-vials_614fc4e8.jpg",
    gradient: "from-[#1a1408] via-[#241a06] to-[#1a1005]",
    overlay: "bg-[#1a1408]/65",
    badge: "Endocrine Research · Growth Peptides",
    badgeColor: "bg-[#B8943A]/20 border-[#B8943A]/40 text-[#C8A84B]",
    tag: "04 · ENDOCRINE",
    headline: "Endocrine & Growth\nResearch Peptides",
    sub: "Sermorelin, Tesamorelin, CJC-1295 — GHRH analogues and growth-related research compounds.",
    cta: "Endocrine Compounds",
    ctaHref: "/compounds?category=Endocrine",
    stat1: { value: "US-Based", label: "Manufacturing" },
    stat2: { value: "3rd Party", label: "Tested" },
    accent: "#C8A84B",
  },
];

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

// ── HeroSlider ─────────────────────────────────────────────────────────────────
export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => { injectKBStyle(); }, []);

  const goTo = useCallback((idx: number) => {
    setPrev(current);
    setCurrent(idx);
    setAnimKey((k) => k + 1);
    setTimeout(() => setPrev(null), 700);
  }, [current]);

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);
  const back = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo]);

  // Auto-advance every 6 s
  useEffect(() => {
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[current];
  const prevSlide = prev !== null ? SLIDES[prev] : null;

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
        {slide.bgImage ? (
          <img
            src={slide.bgImage}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover object-center ${
              current % 2 === 0 ? "kb-anim" : "kb-anim-alt"
            }`}
            style={{ willChange: "transform" }}
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} ${
              current % 2 === 0 ? "kb-anim" : "kb-anim-alt"
            }`}
            style={{ willChange: "transform" }}
          />
        )}
        {/* Dark overlay for text readability */}
        <div className={`absolute inset-0 ${slide.overlay}`} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />
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
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: slide.accent }}
              />
              {slide.badge}
            </div>

            {/* Tag */}
            <p
              key={`tag-${current}`}
              className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-3"
              style={{ animation: "fadeSlideUp 0.6s ease-out both", animationDelay: "0.2s" }}
            >
              {slide.tag}
            </p>

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
              className="text-base sm:text-lg text-white/60 leading-relaxed mb-8 max-w-lg"
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
                  className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white transition-all duration-200 active:scale-[0.97] shadow-lg"
                  style={{ backgroundColor: slide.accent }}
                >
                  {slide.cta}
                  <ArrowRight size={15} />
                </button>
              </Link>
              <Link href="/compounds">
                <button className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                  View all compounds →
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
                <p className="text-2xl font-extrabold text-white">{slide.stat1.value}</p>
                <p className="text-xs text-white/40 font-medium mt-0.5">{slide.stat1.label}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-extrabold text-white">{slide.stat2.value}</p>
                <p className="text-xs text-white/40 font-medium mt-0.5">{slide.stat2.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide indicators (right side) ── */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 rounded-full transition-all duration-300 ${
              i === current ? "h-8 bg-white" : "h-2 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* ── Prev / Next arrows ── */}
      <button
        onClick={back}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-14 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
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

      {/* ── Slide counter ── */}
      <div className="absolute bottom-6 left-6 z-20 text-white/40 text-xs font-mono font-bold tracking-widest">
        {String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
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
      `}</style>
    </section>
  );
}
