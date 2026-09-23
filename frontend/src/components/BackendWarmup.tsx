"use client";

import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";

export function BackendWarmup() {
  useEffect(() => {
    const pingBackend = async () => {
      try {
        await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
      } catch {
        // Silently ignore ping errors (e.g. while server is waking up)
      }
    };

    // Immediate warmup ping upon page load
    pingBackend();

    // Periodic heartbeat every 2 minutes while browser tab is open
    const interval = setInterval(pingBackend, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
