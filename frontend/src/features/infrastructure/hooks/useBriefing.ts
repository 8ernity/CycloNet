"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Briefing, SurgeCalculation, WeatherSystem } from "@/types/api";
import { apiFetch } from "@/lib/api";

export function useBriefing(params: {
  scenarioMode: boolean;
  scenarioKey: string;
  system: WeatherSystem | null;
  surgeCalcData: SurgeCalculation | null;
  displayCategory: string;
  knots: number | null;
  kmh: number | null;
}) {
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<Briefing | null>(null);
  const [briefingError, setBriefingError] = useState(false);
  const pendingBriefing = useRef<AbortController | null>(null);
  const briefingDialog = useRef<HTMLDivElement | null>(null);
  const briefingOpener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setBriefingData(null);
      setBriefingLoading(false);
      setBriefingModalOpen(false);
      setBriefingError(false);
    }, 0);
    return () => {
      window.clearTimeout(reset);
      pendingBriefing.current?.abort();
    };
  }, [params.scenarioKey]);

  const closeBriefing = useCallback(() => {
    pendingBriefing.current?.abort();
    setBriefingModalOpen(false);
    setBriefingLoading(false);
    setBriefingData(null);
  }, []);

  useEffect(() => {
    if (!briefingModalOpen) return;
    const previous = briefingOpener.current;
    const dialog = briefingDialog.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBriefing();
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        )
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    dialog?.addEventListener("keydown", onKey);
    return () => {
      dialog?.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [briefingModalOpen, closeBriefing]);

  const generateBriefing = useCallback(
    async (lang = "en") => {
      if (!params.scenarioMode || !params.surgeCalcData) return;
      if (!briefingModalOpen && document.activeElement instanceof HTMLElement) {
        briefingOpener.current = document.activeElement;
      }
      pendingBriefing.current?.abort();
      const controller = new AbortController();
      pendingBriefing.current = controller;
      setBriefingData(null);
      setBriefingError(false);
      setBriefingModalOpen(true);
      setBriefingLoading(true);
      try {
        const stormPayload = {
          name: params.system?.name || "Cyclone System",
          category: params.displayCategory,
          intensity_knots: params.knots,
          wind_kmh: params.kmh,
          surge_m: params.surgeCalcData.peak_surge_height_m,
          basin: params.system?.basin || "Bay of Bengal",
        };
        const data = await apiFetch<{ briefing: Briefing }>("/api/ai/pre-landfall-briefing", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "SCENARIO", storm_data: stormPayload, language: lang }),
        });
        if (controller.signal.aborted) return;
        if (
          typeof data?.briefing?.executive_summary !== "string" ||
          !Array.isArray(data.briefing.action_checklist) ||
          !data.briefing.action_checklist.every((item) => typeof item === "string")
        ) {
          throw new Error("Invalid scenario summary");
        }
        setBriefingData(data.briefing);
      } catch (err) {
        if (controller.signal.aborted) return;
        setBriefingError(true);
        console.error("Failed to generate briefing", err);
      } finally {
        if (!controller.signal.aborted) setBriefingLoading(false);
      }
    },
    [briefingModalOpen, params]
  );

  return {
    briefingModalOpen,
    briefingLoading,
    briefingData,
    briefingError,
    briefingDialog,
    generateBriefing,
    closeBriefing,
  };
}
