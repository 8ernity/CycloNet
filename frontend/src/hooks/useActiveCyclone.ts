"use client";
import { useState, useEffect, useCallback } from "react";

export const STORAGE_KEY_ID = "cyclonet_selected_cyclone_id";
export const STORAGE_KEY_NAME = "cyclonet_selected_cyclone_name";
export const CYCLONET_EVENT_NAME = "cyclonet:selected-cyclone-changed";

export function useActiveCyclone(defaultId: string | null = null) {
  // Deterministic initial state matching SSR: starts null (LIVE mode) unless user selected storm (LIVE-01)
  const [selectedCycloneId, setSelectedCycloneId] = useState<string | null>(defaultId);
  const [selectedCycloneName, setSelectedCycloneName] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const syncState = useCallback(() => {
    if (typeof window !== "undefined") {
      const id = localStorage.getItem(STORAGE_KEY_ID);
      const name = localStorage.getItem(STORAGE_KEY_NAME);
      if (id && id !== "LIVE_SCAN") {
        setSelectedCycloneId(id);
        setSelectedCycloneName(name || id);
      } else {
        setSelectedCycloneId(defaultId);
        setSelectedCycloneName(null);
      }
    }
  }, [defaultId]);

  useEffect(() => {
    syncState();
    setIsLoaded(true);

    const handleCustomEvent = () => syncState();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_ID || e.key === STORAGE_KEY_NAME) {
        syncState();
      }
    };

    window.addEventListener(CYCLONET_EVENT_NAME, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(CYCLONET_EVENT_NAME, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [syncState]);

  const selectCyclone = useCallback((id: string, name?: string) => {
    setSelectedCycloneId(id);
    if (name) setSelectedCycloneName(name);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ID, id);
      if (name) {
        localStorage.setItem(STORAGE_KEY_NAME, name);
      } else {
        localStorage.removeItem(STORAGE_KEY_NAME);
      }
      window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id, name } }));
    }
  }, []);

  const clearSelectedCyclone = useCallback(() => {
    setSelectedCycloneId(null);
    setSelectedCycloneName(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_ID);
      localStorage.removeItem(STORAGE_KEY_NAME);
      window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id: null, name: null } }));
    }
  }, []);

  return {
    selectedCycloneId,
    selectedCycloneName,
    selectCyclone,
    clearSelectedCyclone,
    isLoaded
  };
}
