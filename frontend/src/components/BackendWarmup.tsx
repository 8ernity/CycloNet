"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export function BackendWarmup() {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const check = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`${getApiBaseUrl()}/health/ready`, {
          cache: "no-store", credentials: "omit", signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (!disposed) setUnavailable(!response.ok || data?.status !== "ready");
      } catch {
        if (!disposed) setUnavailable(true);
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(check, 60000);
      }
    };
    void check();
    return () => {disposed = true; clearTimeout(timer); controller?.abort();};
  }, []);
  if (!unavailable) return null;
  return <div role="status" className="fixed bottom-2 left-2 z-40 max-w-[calc(100vw-1rem)] rounded-lg border border-amber-500/30 bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm pointer-events-none">
    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />Backend unavailable. Data may be out of date.</span>
  </div>;
}
