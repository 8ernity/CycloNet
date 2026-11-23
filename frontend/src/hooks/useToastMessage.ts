"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages transient toast banners with automatic timer cleanup on overwrite or unmount.
 */
export function useToastMessage(durationMs: number = 3000) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    []
  );

  return { toast, showToast };
}
