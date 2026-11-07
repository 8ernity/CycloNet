"use client";
import { useCallback } from "react";
import { useMounted, useStoredValue } from "./useBrowserState";
export const STORAGE_KEY_ID = "cyclonet_selected_cyclone_id";
export const STORAGE_KEY_NAME = "cyclonet_selected_cyclone_name";
export const CYCLONET_EVENT_NAME = "cyclonet:selected-cyclone-changed";
export function useActiveCyclone(defaultId: string | null = null) {
  const [id, setId] = useStoredValue(STORAGE_KEY_ID, defaultId);
  const [name, setName] = useStoredValue(STORAGE_KEY_NAME);
  const isLoaded = useMounted();
  const selectCyclone = useCallback((id: string, name?: string) => {
    setId(id); setName(name ?? id);
    window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id, name } }));
  }, [setId, setName]);
  const clearSelectedCyclone = useCallback(() => {
    setId(null); setName(null);
    window.dispatchEvent(new CustomEvent(CYCLONET_EVENT_NAME, { detail: { id: null, name: null } }));
  }, [setId, setName]);
  return { selectedCycloneId: id === "LIVE_SCAN" ? null : id, selectedCycloneName: name, selectCyclone, clearSelectedCyclone, isLoaded };
}
