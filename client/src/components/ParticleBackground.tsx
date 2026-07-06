import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number };

interface ParticleFieldOptions {
  color: string;
  particleCount: number;
  linkDistance: number;
  particleRadius: number;
  particleOpacity: number;
  lineOpacity: number;
  speed: number;
}

function runParticleField(canvas: HTMLCanvasElement, opts: ParticleFieldOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const { color, particleCount, linkDistance, particleRadius, particleOpacity, lineOpacity, speed } = opts;
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
    particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
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
        if (dist < linkDistance) {
          ctx!.strokeStyle = `rgba(${color}, ${lineOpacity * (1 - dist / linkDistance)})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx!.fillStyle = `rgba(${color}, ${particleOpacity})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
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

interface ParticleBackgroundProps {
  /** "r, g, b" — e.g. "58, 158, 148" */
  color: string;
  particleCount?: number;
  linkDistance?: number;
  particleRadius?: number;
  particleOpacity?: number;
  lineOpacity?: number;
  speed?: number;
  className?: string;
}

export default function ParticleBackground({
  color,
  particleCount = 42,
  linkDistance = 130,
  particleRadius = 1.4,
  particleOpacity = 0.35,
  lineOpacity = 0.22,
  speed = 0.25,
  className = "",
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return runParticleField(canvasRef.current, {
      color,
      particleCount,
      linkDistance,
      particleRadius,
      particleOpacity,
      lineOpacity,
      speed,
    });
  }, [color, particleCount, linkDistance, particleRadius, particleOpacity, lineOpacity, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    />
  );
}
