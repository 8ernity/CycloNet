"use client";
import { useState, useEffect, useCallback } from "react";

export type DataSourceType = "IMD" | "JTWC" | "CUSTOM";

export const STORAGE_KEY_SOURCE = "cyclonet_data_source";
export const STORAGE_KEY_CUSTOM_URL = "cyclonet_custom_api_url";
export const CYCLONET_SOURCE_EVENT = "cyclonet:data-source-changed";

export interface DataSourceBadge {
  type: DataSourceType;
  label: string;
  shortLabel: string;
  avgWindow: string;
  badgeClass: string;
  scaleName: string;
  desc: string;
}

export function useDataSource() {
  const [dataSource, setDataSourceState] = useState<DataSourceType>("IMD");
  const [customApiUrl, setCustomApiUrlState] = useState<string>("http://localhost:8000/api");

  const syncState = useCallback(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_SOURCE);
      if (stored === "JTWC" || stored === "CUSTOM" || stored === "IMD") {
        setDataSourceState(stored as DataSourceType);
      } else {
        setDataSourceState("IMD");
      }
      const customUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_URL);
      if (customUrl) {
        setCustomApiUrlState(customUrl);
      }
    }
  }, []);

  useEffect(() => {
    syncState();

    const handleCustomEvent = () => syncState();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SOURCE || e.key === STORAGE_KEY_CUSTOM_URL) {
        syncState();
      }
    };

    window.addEventListener(CYCLONET_SOURCE_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(CYCLONET_SOURCE_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [syncState]);

  const setDataSource = useCallback((source: DataSourceType) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SOURCE, source);
      setDataSourceState(source);
      window.dispatchEvent(new CustomEvent(CYCLONET_SOURCE_EVENT, { detail: { source } }));
    }
  }, []);

  const setCustomApiUrl = useCallback((url: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CUSTOM_URL, url);
      setCustomApiUrlState(url);
      window.dispatchEvent(new CustomEvent(CYCLONET_SOURCE_EVENT, { detail: { customApiUrl: url } }));
    }
  }, []);

  // ── Conversion Utilities ──────────────────────────────────────────────────

  const getConvertedKnots = useCallback((baseKnots: number): number => {
    if (!baseKnots || baseKnots <= 0) return 0;
    if (dataSource === "JTWC") {
      // 1-minute sustained wind is typically ~1.14x the 3-minute IMD wind standard
      return Math.round(baseKnots * 1.14);
    }
    return baseKnots;
  }, [dataSource]);

  const getConvertedKmh = useCallback((baseKnots: number): number => {
    const kts = getConvertedKnots(baseKnots);
    return Math.round(kts * 1.852);
  }, [getConvertedKnots]);

  const getConvertedGusts = useCallback((baseKnots: number): number => {
    const kmh = getConvertedKmh(baseKnots);
    return Math.round(kmh * 1.25);
  }, [getConvertedKmh]);

  const getConvertedCategory = useCallback((baseKnots: number, fallback?: string): string => {
    const kts = getConvertedKnots(baseKnots);

    if (dataSource === "JTWC") {
      if (kts < 34) return "Tropical Depression";
      if (kts < 64) return "Tropical Storm";
      if (kts < 83) return "Category 1 Cyclone";
      if (kts < 96) return "Category 2 Cyclone";
      if (kts < 113) return "Category 3 Major Cyclone";
      if (kts < 137) return "Category 4 Major Cyclone";
      return "Category 5 Super Cyclone";
    }

    // Default IMD Standard
    if (kts < 17) return "Low Pressure Area";
    if (kts < 28) return "Depression";
    if (kts < 34) return "Deep Depression";
    if (kts < 48) return "Cyclonic Storm";
    if (kts < 64) return "Severe Cyclonic Storm";
    if (kts < 90) return "Very Severe Cyclonic Storm";
    if (kts < 120) return "Extremely Severe Cyclonic Storm";
    return "Super Cyclonic Storm";
  }, [dataSource, getConvertedKnots]);

  const getSourceBadge = useCallback((): DataSourceBadge => {
    if (dataSource === "JTWC") {
      return {
        type: "JTWC",
        label: "JTWC Standard (1-Min Avg)",
        shortLabel: "JTWC (1-min)",
        avgWindow: "1-Minute Sustained (+14%)",
        badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        scaleName: "Saffir-Simpson (Cat 1–5)",
        desc: "US Joint Typhoon Warning Center standard using 1-minute sustained wind measurements."
      };
    }
    if (dataSource === "CUSTOM") {
      return {
        type: "CUSTOM",
        label: "Custom API Endpoint",
        shortLabel: "Custom API",
        avgWindow: "User Defined",
        badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        scaleName: "Custom Research Scale",
        desc: "Local or experimental forecasting model endpoint."
      };
    }
    return {
      type: "IMD",
      label: "IMD Standard (3-Min Avg)",
      shortLabel: "IMD (3-min)",
      avgWindow: "3-Minute Sustained (Standard)",
      badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      scaleName: "WMO RSMC New Delhi Scale",
      desc: "India Meteorological Department standard using 3-minute sustained wind measurements."
    };
  }, [dataSource]);

  return {
    dataSource,
    customApiUrl,
    setDataSource,
    setCustomApiUrl,
    getConvertedKnots,
    getConvertedKmh,
    getConvertedGusts,
    getConvertedCategory,
    getSourceBadge,
  };
}
