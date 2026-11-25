"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DispatchResult, SurgeCalculation, WeatherSystem } from "@/types/api";
import { apiFetch } from "@/lib/api";

export function useDispatchExercise(params: {
  scenarioMode: boolean;
  scenarioKey: string;
  system: WeatherSystem | null;
  surgeCalcData: SurgeCalculation | null;
  simWindKts: number;
  showToast: (msg: string) => void;
}) {
  const [dispatchRegion, setDispatchRegion] = useState<string>("Sundarbans & Odisha Coastal Corridor");
  const [dispatchRiskLevel, setDispatchRiskLevel] = useState<string>("CRITICAL");
  const [dispatchChannels, setDispatchChannels] = useState<string[]>(["CAP", "SMS", "SACHET", "SIREN", "VHF"]);
  const [dispatchLoading, setDispatchLoading] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [dispatchViewerTab, setDispatchViewerTab] = useState<"cap" | "sms" | "sachet" | "siren" | "vhf" | "directives">("cap");
  const pendingDispatch = useRef<AbortController | null>(null);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setDispatchResult(null);
      setDispatchLoading(false);
    }, 0);
    return () => {
      window.clearTimeout(reset);
      pendingDispatch.current?.abort();
    };
  }, [params.scenarioKey, dispatchRegion, dispatchRiskLevel, dispatchChannels]);

  const toggleChannel = useCallback((channelId: string) => {
    setDispatchChannels((prev) => (prev.includes(channelId) ? prev.filter((c) => c !== channelId) : [...prev, channelId]));
  }, []);

  const executeDispatch = useCallback(async () => {
    if (dispatchLoading || !params.scenarioMode) return;
    if (!params.surgeCalcData) {
      params.showToast("Scenario calculation unavailable. Retry before generating a draft.");
      return;
    }
    pendingDispatch.current?.abort();
    const controller = new AbortController();
    pendingDispatch.current = controller;
    setDispatchLoading(true);
    setDispatchResult(null);
    try {
      const payload = {
        region: dispatchRegion,
        risk_level: dispatchRiskLevel,
        surge: params.surgeCalcData.peak_surge_height_m,
        wind: params.simWindKts,
        channels: dispatchChannels,
        cyclone_name: params.system?.name || "Exercise cyclone",
      };
      const data = await apiFetch<DispatchResult>("/api/alerts/dispatch", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (controller.signal.aborted) return;
      if (
        typeof data?.dispatch_id !== "string" ||
        typeof data.cap_xml !== "string" ||
        !data.sms_payload ||
        typeof data.sms_payload !== "object" ||
        Array.isArray(data.sms_payload) ||
        !Object.values(data.sms_payload).every((value) => value === null || typeof value === "string") ||
        typeof data.vhf_payload !== "string" ||
        !Array.isArray(data.municipal_briefing) ||
        !data.municipal_briefing.every((value) => typeof value === "string")
      ) {
        throw new Error("Invalid exercise draft");
      }
      setDispatchResult(data);
      params.showToast("Exercise generated. No real broadcast was sent.");
    } catch {
      if (controller.signal.aborted) return;
      setDispatchResult(null);
      params.showToast("Exercise request failed. No broadcast was sent.");
    } finally {
      if (!controller.signal.aborted) setDispatchLoading(false);
    }
  }, [dispatchChannels, dispatchLoading, dispatchRegion, dispatchRiskLevel, params]);

  return {
    dispatchRegion,
    setDispatchRegion,
    dispatchRiskLevel,
    setDispatchRiskLevel,
    dispatchChannels,
    toggleChannel,
    dispatchLoading,
    dispatchResult,
    dispatchViewerTab,
    setDispatchViewerTab,
    executeDispatch,
  };
}
