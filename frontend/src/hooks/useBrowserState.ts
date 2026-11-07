"use client";
import { useCallback, useSyncExternalStore } from "react";
const noSubscribe = () => () => {};
export function useMounted() { return useSyncExternalStore(noSubscribe, () => true, () => false); }
export function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
export function useStoredValue(key: string, fallback: string | null = null) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener("cyclonet:preferences", notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener("cyclonet:preferences", notify);
    };
  }, []);
  const value = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }, () => fallback);
  const setValue = useCallback((next: string | null) => {
    if (next == null) localStorage.removeItem(key); else localStorage.setItem(key, next);
    window.dispatchEvent(new Event("cyclonet:preferences"));
  }, [key]);
  return [value, setValue] as const;
}
