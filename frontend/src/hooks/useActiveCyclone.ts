"use client";
import { useState, useEffect, useCallback } from "react";

export const STORAGE_KEY_ID = "cyclonet_selected_cyclone_id";
export const STORAGE_KEY_NAME = "cyclonet_selected_cyclone_name";
export const CYCLONET_EVENT_NAME = "cyclonet:selected-cyclone-changed";

export function useActiveCyclone(defaultId: string = "BOB05-2026") {
  // Deterministic initial state matching SSR to prevent hydration mismatch
  const [selectedCycloneId, setSelectedCycloneId] = useState<string>(defaultId);
  const [selectedCycloneName, setSelectedCycloneName] = useState<string | null>("Deep Depression (BOB-05)");
  const [isLoaded, setIsLoaded] = useState(false);

  const syncState = useCallback(() => {
    if (typeof window !== "undefined") {
      const id = localStorage.getItem(STORAGE_KEY_ID);
      const name = localStorage.getItem(STORAGE_KEY_NAME);
      if (id && id !== "BOB03-2020") {
        setSelectedCycloneId(id);
        setSelectedCycloneName(name || id);
      } else {
        setSelectedCycloneId(defaultId);
        setSelectedCycloneName("Deep Depression (BOB-05)");
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
    setSelectedCycloneId(defaultId);
    setSelectedCycloneName(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_ID);
      localStorage.removeItem(STORAGE_KEY_NAME);
      window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id: null, name: null } }));
    }
  }, [defaultId]);

  return {
    selectedCycloneId,
    selectedCycloneName,
    selectCyclone,
    clearSelectedCyclone,
    isLoaded
  };
}
