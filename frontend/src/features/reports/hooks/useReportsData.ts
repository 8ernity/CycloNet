"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CatalogItem, DispatchReceipt, WeatherSystem } from "@/types/api";
import { apiFetch } from "@/lib/api";
import { formatCatalogStormName } from "@/lib/catalogObservation";
import { useToastMessage } from "@/hooks/useToastMessage";
import type { AffectedDistrict, Bulletin, PortSignal, ReportCatalogItem } from "../types";

export function useReportsData(selectedCycloneId: string | null) {
  const [system, setSystem] = useState<WeatherSystem | null>(null);
  const [cyclonesList, setCyclonesList] = useState<ReportCatalogItem[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [affectedDistricts, setAffectedDistricts] = useState<AffectedDistrict[]>([]);
  const [portSignals, setPortSignals] = useState<PortSignal[]>([]);
  const [capXml, setCapXml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const { toast, showToast } = useToastMessage();
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState("EXPERIMENTAL_ANALYSIS");

  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "dispatching" | "completed">("idle");
  const [dispatchReceipt, setDispatchReceipt] = useState<DispatchReceipt | null>(null);

  const pendingReport = useRef<AbortController | null>(null);
  const pendingDispatch = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      pendingReport.current?.abort();
      pendingDispatch.current?.abort();
    },
    []
  );

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
              id: c.id,
              name: formatCatalogStormName(c.name),
              category: c.max_category || c.maxCategory || c.category || "Not available",
            }))
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to load full cyclone list in reports", err);
        }
      }
    }
    void fetchAllCyclones();
    return () => controller.abort();
  }, []);

  const fetchReportData = useCallback(
    async (demo = false, lifecycleSignal?: AbortSignal) => {
      pendingReport.current?.abort();
      const controller = new AbortController();
      pendingReport.current = controller;
      const signal = lifecycleSignal ? AbortSignal.any([lifecycleSignal, controller.signal]) : controller.signal;
      await Promise.resolve();
      if (signal?.aborted) return;

      setLoading(true);
      setReportError(null);
      setSystem(null);
      pendingDispatch.current?.abort();
      setDispatchReceipt(null);
      setDispatchStatus("idle");
      setBulletins([]);
      setSelectedBulletin(null);
      setCapXml("");
      setPortSignals([]);
      setAffectedDistricts([]);

      try {
        const params = new URLSearchParams();
        if (demo) params.set("simulate", "true");
        else if (selectedCycloneId) params.set("cyclone_id", selectedCycloneId);

        const data = await apiFetch<{
          system: WeatherSystem;
          mode: string;
          bulletins: Bulletin[];
          cap_xml?: string;
          port_signals?: PortSignal[];
          affected_districts?: AffectedDistrict[];
        }>(`/api/reports/bulletins?${params}`, { signal, maxRetries: 0 });

        if (signal?.aborted) return;
        if (!data.system || !Array.isArray(data.bulletins)) throw new Error("Report unavailable");

        setSystem(data.system);
        setReportMode(data.mode);
        setBulletins(data.bulletins);
        setSelectedBulletin(data.bulletins[0] ?? null);
        setCapXml(data.cap_xml ?? "");
        setPortSignals(data.port_signals ?? []);
        setAffectedDistricts(data.affected_districts ?? []);
      } catch {
        if (signal?.aborted) return;
        setReportError("Report unavailable. Source data could not be loaded.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [selectedCycloneId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => void fetchReportData(false, controller.signal), 0);
    return () => {
      window.clearTimeout(task);
      controller.abort();
      pendingReport.current?.abort();
      pendingDispatch.current?.abort();
    };
  }, [fetchReportData]);

  const dispatchExerciseDraft = useCallback(
    async (alertType: string, selectedChannels: string[]) => {
      if (dispatchStatus === "dispatching") return;
      pendingDispatch.current?.abort();
      const controller = new AbortController();
      pendingDispatch.current = controller;
      setDispatchStatus("dispatching");
      setDispatchReceipt(null);
      try {
        const data = await apiFetch<DispatchReceipt>("/api/alerts/broadcast-test", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_id: system?.id || selectedCycloneId,
            alert_type: alertType,
            channels: selectedChannels,
          }),
        });
        if (controller.signal.aborted) return;
        if (typeof data?.dispatch_id !== "string" || typeof data.message_payload !== "string") {
          throw new Error("Invalid draft response");
        }
        setDispatchReceipt(data);
        setDispatchStatus("completed");
        showToast("Exercise generated. No real broadcast was sent.");
      } catch {
        if (controller.signal.aborted) return;
        setDispatchStatus("idle");
        setDispatchReceipt(null);
        showToast("Exercise request failed. No broadcast was sent.");
      }
    },
    [dispatchStatus, selectedCycloneId, showToast, system]
  );

  return {
    system,
    cyclonesList,
    bulletins,
    affectedDistricts,
    portSignals,
    capXml,
    loading,
    selectedBulletin,
    setSelectedBulletin,
    toast,
    showToast,
    reportError,
    reportMode,
    dispatchStatus,
    dispatchReceipt,
    fetchReportData,
    dispatchExerciseDraft,
  };
}
