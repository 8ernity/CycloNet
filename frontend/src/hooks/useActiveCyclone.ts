"use client";
import { useState, useEffect, useCallback } from "react";

export const STORAGE_KEY_ID = "cyclonet_selected_cyclone_id";
export const STORAGE_KEY_NAME = "cyclonet_selected_cyclone_name";
export const CYCLONET_EVENT_NAME = "cyclonet:selected-cyclone-changed";

export function useActiveCyclone(defaultId: string = "BOB05-2026") {
  const [selectedCycloneId, setSelectedCycloneId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_ID);
      if (stored && stored !== "BOB03-2020") return stored;
    }
    return defaultId;
  });

  const [selectedCycloneName, setSelectedCycloneName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY_NAME);
    }
    return null;
  });

  const syncState = useCallback(() => {
    if (typeof window !== "undefined") {
      const id = localStorage.getItem(STORAGE_KEY_ID);
      const name = localStorage.getItem(STORAGE_KEY_NAME);
      if (id) {
        setSelectedCycloneId(id);
      }
      setSelectedCycloneName(name);
    }
  }, []);

  useEffect(() => {
    syncState();

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
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ID, id);
      if (name) {
        localStorage.setItem(STORAGE_KEY_NAME, name);
      }
      setSelectedCycloneId(id);
      if (name) setSelectedCycloneName(name);
      window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id, name } }));
    }
  }, []);

  const clearSelectedCyclone = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_ID);
      localStorage.removeItem(STORAGE_KEY_NAME);
      setSelectedCycloneId(defaultId);
      setSelectedCycloneName(null);
      window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id: null, name: null } }));
    }
  }, [defaultId]);

  return {
    selectedCycloneId,
    selectedCycloneName,
    selectCyclone,
    clearSelectedCyclone,
  };
}
