"use client";

import { useEffect } from "react";

export function BackendWarmup() {
  useEffect(() => {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const cleanUrl = rawApiUrl.startsWith("http")
      ? rawApiUrl.replace(/\/api\/?$/, "")
      : `https://${rawApiUrl.replace(/\/api\/?$/, "")}`;

    const pingBackend = async () => {
      try {
        await fetch(`${cleanUrl}/health`, {
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

    // Periodic heartbeat every 4 minutes while browser tab is active
    const interval = setInterval(pingBackend, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
