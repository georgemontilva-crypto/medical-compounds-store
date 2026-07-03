import { useEffect, useRef, useState } from "react";

// Like Reveal's observer, but exposes the boolean itself instead of just
// applying a fade/translate class — needed to gate mounting recharts
// charts so their built-in mount animation plays on scroll-into-view
// instead of immediately on page load.
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
