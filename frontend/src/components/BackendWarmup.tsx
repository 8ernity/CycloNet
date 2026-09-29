"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { Server, RefreshCw, CheckCircle2 } from "lucide-react";

export function BackendWarmup() {
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const pingBackend = async (attempt: number = 0) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok && isMounted) {
          setIsReady(true);
          setIsWarmingUp(false);
          return;
        }
      } catch {
        // Backend is still spinning up (cold-start)
        if (isMounted) {
          setIsWarmingUp(true);
          if (attempt < 5) {
            timer = setTimeout(() => pingBackend(attempt + 1), 3000);
          }
        }
      }
    };

    // Immediate warmup ping upon page load
    pingBackend();

    // Periodic heartbeat every 3 minutes while browser tab is open to keep Render/Cloud dyno active
    const heartbeat = setInterval(() => {
      pingBackend(0);
    }, 3 * 60 * 1000);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      clearInterval(heartbeat);
    };
  }, []);

  if (!isWarmingUp || isReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
      <div className="px-3.5 py-2 rounded-xl bg-card/95 border border-sky-500/30 text-text-primary text-xs shadow-xl backdrop-blur-md flex items-center gap-2.5">
        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span className="font-medium text-[11px] text-text-muted">
          Waking up cloud backend service...
        </span>
      </div>
    </div>
  );
}
