import { useEffect, useRef } from "react";

declare global {
  interface Window {
    liquidGlass?: (
      el: HTMLElement,
      opts?: {
        scale?: number;
        chroma?: number;
        border?: number;
        mapBlur?: number;
        blur?: number;
        saturate?: number;
        radius?: number | null;
        fallbackBlur?: number;
      }
    ) => {
      supported: boolean;
      refresh: () => void;
      destroy: () => void;
    };
  }
}

export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !ref.current) return;

    let glassInstance: { refresh: () => void; destroy: () => void } | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const init = () => {
      if (!ref.current || !window.liquidGlass) return false;
      try {
        glassInstance = window.liquidGlass(ref.current, {
          scale: -150,    // Stronger refraction
          chroma: 10,     // More color splitting (chromatic aberration)
          mapBlur: 24,    // Smoother glass surface
          blur: 12,       // Subtle frosted blur behind refraction
          saturate: 1.8,  // Boost colors underneath
        });
        return true;
      } catch (err) {
        console.warn("Failed to initialize liquid glass", err);
        return false;
      }
    };

    if (!init()) {
      let attempts = 0;
      pollTimer = setInterval(() => {
        attempts++;
        if (init() || attempts > 25) {
          if (pollTimer) clearInterval(pollTimer);
        }
      }, 80);
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (glassInstance && glassInstance.destroy) {
        glassInstance.destroy();
      }
    };
  }, [enabled]);

  return ref;
}
