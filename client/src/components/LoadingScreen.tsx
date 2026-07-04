import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";

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

type Particle = { x: number; y: number; vx: number; vy: number };

function runParticleField(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const PARTICLE_COUNT = 42;
  const LINK_DISTANCE = 130;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let particles: Particle[] = [];
  let rafId = 0;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
    }));
  }

  function tick() {
    ctx!.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < LINK_DISTANCE) {
          ctx!.strokeStyle = `rgba(58, 158, 148, ${0.22 * (1 - dist / LINK_DISTANCE)})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx!.fillStyle = "rgba(58, 158, 148, 0.35)";
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx!.fill();
    }

    rafId = requestAnimationFrame(tick);
  }

  resize();
  seed();
  rafId = requestAnimationFrame(tick);
  window.addEventListener("resize", resize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
  };
}

export default function LoadingScreen() {
  // Lazy init runs synchronously before first paint, so a returning-session
  // visitor never sees a flash of the splash appearing then disappearing.
  const [shouldShow] = useState(() => typeof window !== "undefined" && !sessionStorage.getItem(SESSION_KEY));
  const [mounted, setMounted] = useState(shouldShow);
  const [fadingOut, setFadingOut] = useState(false);
  const [percent, setPercent] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery(
    { slotKey: "site_logo" },
    { enabled: shouldShow }
  );

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

  useEffect(() => {
    if (!shouldShow || !canvasRef.current) return;
    return runParticleField(canvasRef.current);
  }, [shouldShow]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8f8fa] transition-opacity ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onTransitionEnd={() => {
        if (fadingOut) setMounted(false);
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {logoImage?.url ? (
          <img src={logoImage.url} alt="Logo" className="h-14 w-auto object-contain" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3A9E94] to-[#5BB8AE] flex items-center justify-center shadow-lg shadow-[#3A9E94]/30">
              <FlaskConical size={28} className="text-white" />
            </div>
            <div className="leading-none text-left">
              <span className="font-extrabold text-gray-950 text-2xl tracking-tight">Brighter Days Labs</span>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 leading-none mt-1">
                Compounds
              </p>
            </div>
          </div>
        )}
        <p className="text-gray-400 text-sm font-mono tracking-widest">{percent}%</p>
      </div>
    </div>
  );
}
