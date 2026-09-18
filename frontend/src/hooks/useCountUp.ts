"use client";

import { useEffect, useState, useRef } from "react";

export function useCountUp(endValue: number, decimals: number = 0, duration: number = 2000) {
  const [count, setCount] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTimestamp: number | null = null;
          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentVal = easeProgress * endValue;
            setCount(currentVal.toFixed(decimals));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setCount(endValue.toFixed(decimals));
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [endValue, decimals, duration, hasAnimated]);

  return { count, ref };
}
