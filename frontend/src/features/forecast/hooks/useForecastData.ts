"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { WeatherSystem } from "@/types/api";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { apiFetch } from "@/lib/api";
import type { CycloneCatalogItem } from "../utils/forecastTransforms";

export function useForecastData() {
  const { selectedCycloneId, selectCyclone, clearSelectedCyclone } = useActiveCyclone();
  const selectedId = selectedCycloneId ?? "";
  const [cyclonesList, setCyclonesList] = useState<CycloneCatalogItem[]>([]);
  const [system, setSystem] = useState<WeatherSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState(false);

  const pendingRequest = useRef<AbortController | null>(null);
  useEffect(() => () => pendingRequest.current?.abort(), []);

  const fetchSystem = useCallback(async (cycloneId: string) => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    setSystem(null);
    setSourceError(false);
    try {
      const data = await apiFetch<WeatherSystem[]>(
        `/api/active-systems${cycloneId ? `?cyclone_id=${encodeURIComponent(cycloneId)}` : ""}`,
        { signal: controller.signal, maxRetries: 0 }
      );
      if (controller.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error("Invalid track response");
      setSystem(data[0] ?? null);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Failed to fetch system:", err);
      setSourceError(true);
      setSystem(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void fetchSystem(selectedId), 0);
    return () => {
      window.clearTimeout(task);
      pendingRequest.current?.abort();
    };
  }, [selectedId, fetchSystem]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("cyclone_id");
    if (requested) selectCyclone(requested);
  }, [selectCyclone]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchCatalog() {
      try {
        const list = await apiFetch<CycloneCatalogItem[]>("/api/history/search", {
          signal: controller.signal,
          maxRetries: 0,
        });
        if (!controller.signal.aborted && Array.isArray(list) && list.length) {
          setCyclonesList(list);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error loading historical catalogue:", error);
        }
      }
    }
    void fetchCatalog();
    return () => controller.abort();
  }, []);

  const handleSelectCyclone = useCallback(
    (cId: string) => {
      const match = cyclonesList.find((c) => c.id === cId);
      if (cId) selectCyclone(cId, match?.name);
      else clearSelectedCyclone();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (cId) url.searchParams.set("cyclone_id", cId);
        else url.searchParams.delete("cyclone_id");
        window.history.replaceState({}, "", url.toString());
      }
    },
    [cyclonesList, selectCyclone, clearSelectedCyclone]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__cyclonet_current_context = {
        page: "Track Forecast",
        activeSystem: system
          ? {
              id: system.id,
              name: system.name,
              basin: system.basin,
              category: system.category,
              intensity_knots: system.intensity_knots,
              lat: system.lat,
              lon: system.lon,
            }
          : null,
      };
    }
  }, [system]);

  return {
    selectedId,
    cyclonesList,
    system,
    loading,
    sourceError,
    fetchSystem,
    handleSelectCyclone,
  };
}
