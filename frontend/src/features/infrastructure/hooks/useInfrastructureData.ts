"use client";

import { useState, useEffect } from "react";
import type { CatalogItem, WeatherSystem } from "@/types/api";
import { apiFetch } from "@/lib/api";
import { catalogObservation, formatCatalogStormName } from "@/lib/catalogObservation";
import { useToastMessage } from "@/hooks/useToastMessage";
import type { InfrastructureStormPreset } from "../types";

export function useInfrastructureData(selectedCycloneId: string | null) {
  const [system, setSystem] = useState<WeatherSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState(false);
  const [sourceRetry, setSourceRetry] = useState(0);
  const [cyclonesList, setCyclonesList] = useState<InfrastructureStormPreset[]>([]);
  const { toast, showToast } = useToastMessage();

  useEffect(() => {
    const controller = new AbortController();
    async function fetchAllCyclones() {
      try {
        const data = await apiFetch<CatalogItem[]>("/api/history/search", {
          signal: controller.signal,
          maxRetries: 0,
        });
        if (!controller.signal.aborted && Array.isArray(data) && data.length > 0) {
          setCyclonesList(
            data.map((c: CatalogItem) => ({
              ...catalogObservation(c),
              name: formatCatalogStormName(c.name),
            }))
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Failed to load full cyclone list", err);
      }
    }
    void fetchAllCyclones();
    return () => controller.abort();
  }, [sourceRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchSystem = async () => {
      setLoading(true);
      setSourceError(false);
      setSystem(null);
      try {
        const query = selectedCycloneId ? `?cyclone_id=${encodeURIComponent(selectedCycloneId)}` : "";
        const data = await apiFetch<WeatherSystem[]>(`/api/active-systems${query}`, {
          signal: controller.signal,
          maxRetries: 0,
        });
        if (!Array.isArray(data)) throw new Error("Invalid source response");
        if (!controller.signal.aborted) setSystem(data[0] ?? null);
      } catch {
        if (!controller.signal.aborted) setSourceError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchSystem();
    return () => controller.abort();
  }, [selectedCycloneId, sourceRetry]);

  return {
    system,
    loading,
    sourceError,
    cyclonesList,
    toast,
    showToast,
    retrySource: () => setSourceRetry((v) => v + 1),
  };
}
