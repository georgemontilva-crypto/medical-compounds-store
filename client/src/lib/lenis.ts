import Lenis from "lenis";

// Single shared instance for the whole app. Anything that needs to react to
// scroll (e.g. CategoryShowcase's sticky/deck math) must subscribe via
// getLenis()?.on("scroll", ...) instead of a native window scroll listener —
// Lenis does drive the real document scroll position, but the documented,
// supported way to hook into it (matching their own GSAP ScrollTrigger
// integration example) is its own event, not assuming native events still
// fire the same way during smoothing.
let lenisInstance: Lenis | null = null;

export function initLenis(): Lenis {
  if (lenisInstance) return lenisInstance;
  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    syncTouch: false, // native touch scroll on mobile, not smoothed
    autoRaf: true,
  });
  return lenisInstance;
}

export function getLenis(): Lenis | null {
  return lenisInstance;
}
