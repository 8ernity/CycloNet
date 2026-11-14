"use client";
import { formatCoordinates } from "@/lib/coordinates";
import type { WeatherSystem as ActiveSystem } from "@/types/api";
import { type DispatchReceipt, type CatalogItem } from "@/types/api";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FileText, Bell, AlertOctagon, AlertTriangle, Info, Download, Radio, ShieldAlert, Waves, Wind, CloudRain, Anchor, MapPin, CheckCircle2, Copy, Send, RefreshCw, Layers, Siren, PhoneCall, Search, ShieldCheck, Building2 } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { useClipboard } from "@/hooks/useClipboard";
import { apiFetch } from "@/lib/api";
import { POWER_SUBSTATIONS, EVACUATION_ROUTES, MEDICAL_SHELTERS, PARAMETRIC_INSURANCE_TRIGGERS, COASTAL_INUNDATION_ZONES } from "@/lib/infrastructureData";



interface Bulletin {
  id: string;
  number: number;
  title: string;
  timestamp_utc: string;
  timestamp_ist: string;
  category: string;
  intensity_knots: number | null;
  intensity_kmh: number;
  gusts_kmh: number;
  central_pressure_hpa: number;
  storm_surge_meters: number;
  wave_height_meters: number;
  alert_level: string;
  stage: string;
  full_text: string;
  is_latest: boolean;
}

interface AffectedDistrict {
  district: string;
  risk: string;
  state: string;
  shelters: string;
  evacuation: string;
}

interface PortSignal {
  signal: string;
  meaning: string;
}

interface ReportCatalogItem {
  id: string;
  name: string;
  category: string;
}

export default function ReportsPage() {
  const {copyText, copyStatus} = useClipboard();
  const { selectedCycloneId, selectCyclone } = useActiveCyclone();
  const {
    getConvertedKnots,
    getConvertedKmh,
    getConvertedCategory,
    getSourceBadge,
  } = useDataSource();

  const sourceBadge = getSourceBadge();
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [cyclonesList, setCyclonesList] = useState<ReportCatalogItem[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [affectedDistricts, setAffectedDistricts] = useState<AffectedDistrict[]>([]);
  const [portSignals, setPortSignals] = useState<PortSignal[]>([]);
  const [capXml, setCapXml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"hazards" | "bulletins" | "broadcast">("hazards");
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Broadcast dispatch simulation state
  const [alertType, setAlertType] = useState<string>("EVACUATION_WARNING");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sms", "siren", "vhf", "sachet"]);
  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "dispatching" | "completed">("idle");
  const pendingDispatch = useRef<AbortController | null>(null);
  const [dispatchReceipt, setDispatchReceipt] = useState<DispatchReceipt | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const controller = new AbortController();
    async function fetchAllCyclones() {
      try {
        const data = await apiFetch<CatalogItem[]>("/api/history/search", {signal: controller.signal, maxRetries: 0});
        if (!controller.signal.aborted) {
          if (Array.isArray(data) && data.length > 0) {
            setCyclonesList(data.map((c: CatalogItem) => ({
              id: c.id,
              name: c.name.startsWith("Cyclone ") || c.name.startsWith("Deep Depression") || c.name.startsWith("Depression") || c.name.startsWith("Super Cyclone") || c.name.includes("Cyclone") ? c.name : `Cyclone ${c.name}`,
              category: c.max_category || c.maxCategory || c.category || "Not available",
            })));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Failed to load full cyclone list in reports", err);
      }
    }
    fetchAllCyclones();
    return () => controller.abort();
  }, []);

  const [reportError, setReportError] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState("EXPERIMENTAL_ANALYSIS");
  const pendingReport = useRef<AbortController | null>(null);
  const fetchReportData = useCallback(async (demo = false, lifecycleSignal?: AbortSignal) => {
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
      const data = await apiFetch<{system: ActiveSystem; mode: string; bulletins: Bulletin[];
        cap_xml?: string; port_signals?: PortSignal[]; affected_districts?: AffectedDistrict[]}>(
        `/api/reports/bulletins?${params}`, { signal, maxRetries: 0 });
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
  }, [selectedCycloneId]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => void fetchReportData(false, controller.signal), 0);
    return () => { window.clearTimeout(task); controller.abort(); pendingReport.current?.abort(); pendingDispatch.current?.abort(); };
  }, [fetchReportData]);

  // Alert Badge Details
  const alertInfo = useMemo(() => {
    const rawKnots = system?.intensity_knots ?? null;
    const knots = getConvertedKnots(rawKnots);
    if (knots == null) return { level: "DATA_UNAVAILABLE", title: "Wind measurement not available", desc: "Hazard cannot be evaluated. Consult official agencies.", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/40", icon: <Info className="w-8 h-8" /> };
    if (knots >= 120) return { level: "RED", title: "Experimental high-wind scenario", desc: "Wind threshold category only. Landfall timing, surge, and evacuation requirements are not established by this report.", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/40", icon: <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" /> };
    if (knots >= 90) return { level: "ORANGE", title: "Experimental wind assessment", desc: "Wind threshold category only. Consult official agencies for impact forecasts.", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40", icon: <AlertTriangle className="w-8 h-8 text-orange-500 animate-bounce" /> };
    if (knots >= 48) return { level: "ORANGE", title: "Experimental wind assessment", desc: "Wind threshold category only. Rainfall and coastal impacts are not established.", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40", icon: <AlertTriangle className="w-8 h-8 text-orange-500" /> };
    if (knots >= 34) return { level: "YELLOW", title: "Experimental wind assessment", desc: "Wind threshold category only. Sea conditions and coastal squalls are not established by this measurement.", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40", icon: <AlertTriangle className="w-8 h-8 text-yellow-500" /> };
    return { level: "GREEN", title: "Experimental low-wind assessment", desc: "Low measured wind does not establish basin-wide calm or absence of other hazards.", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", icon: <Info className="w-8 h-8 text-emerald-500" /> };
  }, [system, getConvertedKnots]);

  // Filtered Bulletins
  const filteredBulletins = useMemo(() => {
    return bulletins.filter((b) => {
      const matchesFilter = filterLevel === "ALL" || b.alert_level.toUpperCase() === filterLevel;
      const matchesSearch = !searchQuery.trim() || 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.full_text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bulletins, filterLevel, searchQuery]);

  const handleDownloadPdf = async () => {
    if (pdfLoading || !system) return;
    setPdfLoading(true);
    try {
      const activeSystem = system;
      if (!activeSystem) return;
      const { generateCyclonePdfReport } = await import("@/lib/pdfReportGenerator");
      generateCyclonePdfReport({
        system: activeSystem,
        alertInfo,
        bulletins: bulletins && bulletins.length > 0 ? bulletins : [],
        affectedDistricts,
        portSignals,

      });
      showToast("Experimental PDF report download started.");
    } catch (err: unknown) {
      console.error("PDF generation failed:", err);
      showToast(`PDF generation error: ${(err instanceof Error ? (err instanceof Error ? err.message : "Request failed") : "Request failed") || "Please check console"}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadXml = () => {
    if (!capXml) { showToast("CAP exercise unavailable"); return; }
    const xmlContent = capXml;
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP-EXERCISE-${system?.name || "CYCLONE"}-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded OASIS CAP-CP XML Exercise Document");
  };

  const handleDownloadJson = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      mode: reportMode,
      disclaimer: "Experimental source summary. Not an official warning or independently validated forecast.",
      displayPreference: sourceBadge,
      system,
      alertInfo,
      bulletins,
      affectedDistricts,
      portSignals,
      infrastructureExposure: {
        is_simulation: true,
        disclaimer: "Illustrative planning fixtures; not measured storm exposure or verified facility status.",
        powerSubstations: POWER_SUBSTATIONS,
        evacuationRoutes: EVACUATION_ROUTES,
        medicalShelters: MEDICAL_SHELTERS,
        inundationZones: COASTAL_INUNDATION_ZONES
      },
      parametricInsuranceTriggers: { is_simulation: true, disclaimer: "Illustrative thresholds; no coverage or payout established.", scenarios: PARAMETRIC_INSURANCE_TRIGGERS }
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CYCLONET-MET-REPORT-${system?.name || "CYCLONE"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded Complete JSON Meteorological Report");
  };

  // Generate an exercise document; no provider or hardware delivery is performed.
  const handleDispatchSimulation = async () => {
    if (dispatchStatus === "dispatching") return;
    pendingDispatch.current?.abort();
    const controller = new AbortController();
    pendingDispatch.current = controller;
    setDispatchStatus("dispatching");
    setDispatchReceipt(null);
    try {
      const data = await apiFetch<DispatchReceipt>("/api/alerts/broadcast-test", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({system_id: system?.id || selectedCycloneId, alert_type: alertType, channels: selectedChannels})
      });
      if (controller.signal.aborted) return;
      if (typeof data?.dispatch_id !== "string" || typeof data.message_payload !== "string") throw new Error("Invalid draft response");
      setDispatchReceipt(data);
      setDispatchStatus("completed");
      showToast("Exercise generated. No real broadcast was sent.");
    } catch {
      if (controller.signal.aborted) return;
      setDispatchStatus("idle");
      setDispatchReceipt(null);
      showToast("Exercise request failed. No broadcast was sent.");
    }
  };

  const toggleChannel = (ch: string) => {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length > 1) {
        setSelectedChannels(selectedChannels.filter(c => c !== ch));
      }
    } else {
      setSelectedChannels([...selectedChannels, ch]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading source reports...</p>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground gap-4">
        <Bell className="w-12 h-12 opacity-40 text-primary" />
        <p className="text-base font-semibold text-foreground">Report unavailable</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{reportError ?? "No report source is available."}</p>
        <button onClick={() => fetchReportData()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">Retry</button>
        <button onClick={() => fetchReportData(true)}>Open synthetic demonstration report</button>
        <div className="flex flex-wrap gap-2 mt-2 max-w-2xl justify-center">
          {cyclonesList.slice(0, 8).map((s) => (
            <button
              key={s.id}
              onClick={() => selectCyclone(s.id, s.name)}
              className="px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-all"
            >
              {s.name} ({s.category ? s.category.split(" ")[0] : "Storm"})
            </button>
          ))}
        </div>
      </div>
    );
  }

  const rawKnots = system.intensity_knots;
  const knots = getConvertedKnots(rawKnots);
  const kmh = getConvertedKmh(rawKnots);
  const gusts = system.gusts_kmh ?? null;
  const displayCategory = getConvertedCategory(rawKnots);
  const surgeM = null;
  const waveM = null;
  const pressureHpa = system.central_pressure_hpa ?? "Not available";

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full">
      <p role="status" className="text-sm text-amber-400">{reportMode}: CycloNet experimental analysis — not an official warning. {system.is_simulation ? "Synthetic / historical replay." : "Source telemetry."} Source: {system.source ?? "Not available"}. Issue time: {system.observation_time_utc ?? "Not available"}. Retrieved: {system.retrieved_at ?? "Not available"}.</p>
      {/* ── Top Header & Operational Action Bar ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              RSMC / IMD Warning Center
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${sourceBadge.badgeClass}`}>
              {sourceBadge.shortLabel}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${alertInfo.bg} ${alertInfo.color} border ${alertInfo.border}`}>
              {alertInfo.level} — EXPERIMENTAL ACTIVE
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Fix: {formatCoordinates(system.lat, system.lon)} • {system.basin}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Alerts & Meteorological Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            CycloNet experimental analyses, OASIS CAP-CP warning protocols (Exercise), infrastructure exposure, and parametric insurance scenarios.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          {/* Storm Switcher Dropdown */}
          <select
            aria-label="Select report storm"
            value={selectedCycloneId || system.id}
            onChange={(e) => {
              const storm = cyclonesList.find(s => s.id === e.target.value);
              selectCyclone(e.target.value, storm?.name);
            }}
            className="px-3 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
          >
            {cyclonesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.category ? `(${s.category})` : ""}
              </option>
            ))}
          </select>

          {/* Export JSON */}
          <button
            onClick={handleDownloadJson}
            title="Download full JSON dataset with infrastructure and parametric triggers"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>

          {/* Export CAP-CP XML */}
          <button
            onClick={handleDownloadXml}
            title="Download OASIS CAP-CP v1.2 XML Document (Exercise Status)"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> CAP XML
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            aria-busy={pdfLoading}
            title="Download experimental source summary (not an official warning)"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> {pdfLoading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? "glass-card p-3 text-sm" : "sr-only"}>{copyStatus}</div>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Main Multi-Hazard Warning Banner ───────────────────────────────── */}
      <div className={`glass-card p-6 md:p-7 border-2 ${alertInfo.border} ${alertInfo.bg} transition-all`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="p-3.5 rounded-2xl bg-background/80 border border-border shadow-inner shrink-0">
              {alertInfo.icon}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xl sm:text-2xl font-black tracking-wider ${alertInfo.color}`}>
                  {alertInfo.level} — EXPERIMENTAL
                </span>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-background text-foreground uppercase border border-border">
                  {displayCategory}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                  System: {system.name}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{alertInfo.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
                {alertInfo.desc} The system is sustaining winds of <strong className="text-foreground">{knots ?? "Not available"} knots ({kmh ?? "Not available"} km/h)</strong> with gusts up to <strong className="text-foreground">{gusts ?? "Not available"} km/h</strong> and central pressure of <strong className="text-foreground">{pressureHpa} hPa</strong>.
              </p>
            </div>
          </div>

          <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto shrink-0 gap-2 border-t md:border-t-0 border-border/40 pt-4 md:pt-0">
            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Max Sustained Wind ({sourceBadge.shortLabel})</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-primary">{kmh ?? "Not available"} <span className="text-sm font-normal text-muted-foreground">km/h</span></p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded">
                Gusts {gusts ?? "Not available"} km/h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("hazards")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "hazards"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Hazard Matrix & Threats
          </button>

          <button
            onClick={() => setActiveTab("bulletins")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "bulletins"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <FileText className="w-4 h-4" /> Experimental Analyses ({bulletins.length})
          </button>

          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "broadcast"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Radio className="w-4 h-4 text-red-400 animate-pulse" /> Emergency Broadcast Hub
          </button>
        </div>

        <a
          href={system ? `/infrastructure?cyclone_id=${encodeURIComponent(system.id)}` : "/infrastructure"}
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-semibold text-foreground transition-all shrink-0 shadow-xs hover:scale-[1.02]"
        >
          <Building2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Infrastructure & Resilience →</span>
        </a>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: MULTI-HAZARD MATRIX & COASTAL THREATS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "hazards" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 4-Stage Warning Timeline */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              IMD 4-Stage Tropical Cyclone Early Warning Protocol
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={`p-4 rounded-xl border ${knots != null && knots >= 34 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 1 (72h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">YELLOW</span>
                </div>
                <p className="font-bold text-sm text-foreground">Pre-Cyclone Watch</p>
                <p className="text-xs text-muted-foreground mt-1">Deep depression detection in oceanic basin. Marine warnings issued to off-shore vessels.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots != null && knots >= 48 ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 2 (48h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">ORANGE</span>
                </div>
                <p className="font-bold text-sm text-foreground">Cyclone Alert</p>
                <p className="text-xs text-muted-foreground mt-1">Gale wind warning and coastal district mobilization. Fishing operations suspended.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots != null && knots >= 64 ? "bg-red-500/10 border-red-500/40 text-red-400 ring-1 ring-red-500/30" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 3 (24h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">RED</span>
                </div>
                <p className="font-bold text-sm text-foreground">Cyclone Warning</p>
                <p className="text-xs text-muted-foreground mt-1">Landfall sector identified. Consult local disaster management authorities for evacuation directives.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots != null && knots >= 64 ? "bg-red-500/5 border-red-500/20 text-foreground" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 4 (12h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">OUTLOOK</span>
                </div>
                <p className="font-bold text-sm text-foreground">Post-Landfall Outlook</p>
                <p className="text-xs text-muted-foreground mt-1">Inland severe gale path, flash flooding, and heavy debris clearance operations.</p>
              </div>
            </div>
          </div>

          {/* Multi-Hazard Parameter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Wind Hazard */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Wind className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Gale Force</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Sustained Wind & Gusts</p>
                <p className="text-2xl font-mono font-black text-foreground">{kmh ?? "Not available"} <span className="text-xs font-normal text-muted-foreground">km/h</span></p>
                <p className="text-xs text-orange-400 font-semibold mt-0.5">Peak Gusts: {gusts ?? "Not available"} km/h</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Uprooting of large trees, extensive damage to kutcha houses, and disruption of power lines.
              </p>
            </div>

            {/* Storm Surge */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Waves className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Inundation</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Observed Storm Surge</p>
                <p className="text-2xl font-mono font-black text-foreground">{surgeM ?? "Not available"} <span className="text-xs font-normal text-muted-foreground">meters</span></p>
                <p className="text-xs text-cyan-400 font-semibold mt-0.5">Wave Height: {waveM ?? "Not available"}m</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Flood extent cannot be inferred from wind alone. No observed inundation data is supplied.
              </p>
            </div>

            {/* Heavy Rain & Flash Flood */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CloudRain className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Red Alert</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">24h Rainfall Forecast</p>
                <p className="text-2xl font-mono font-black text-foreground">Not available <span className="text-xs font-normal text-muted-foreground">mm</span></p>
                <p className="text-xs text-indigo-400 font-semibold mt-0.5">Rainfall observation not available</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                No verified rainfall or flood forecast is supplied.
              </p>
            </div>

            {/* Port & Maritime Warning */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Anchor className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Not available</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Nautical Port Warning</p>
                <p className="text-base font-bold text-foreground truncate">{portSignals[0]?.signal || "Not available"}</p>
                <p className="text-xs text-amber-400 font-semibold mt-0.5">Consult port authorities</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                No verified port directive is available. Consult official port authorities.
              </p>
            </div>
          </div>

          {/* Vulnerable Coastal Districts Table */}
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  High-Risk Coastal Districts & Evacuation Readiness
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No independently verified district exposure data is supplied.
                </p>
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 w-fit">
                {affectedDistricts.length} Verified district records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 text-xs text-muted-foreground uppercase font-semibold">
                    <th className="pb-3 pl-2">District / Jurisdiction</th>
                    <th className="pb-3">State</th>
                    <th className="pb-3">Threat Rating</th>
                    <th className="pb-3">Cyclone Shelters</th>
                    <th className="pb-3 text-right pr-2">Evacuation Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-xs">
                  {affectedDistricts.map((d, i) => (
                    <tr key={i} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 pl-2 font-sans font-semibold text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {d.district}
                      </td>
                      <td className="py-3.5 font-sans text-muted-foreground">{d.state}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          d.risk.includes("Extremely") ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                          d.risk.includes("High") ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" :
                          "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                        }`}>
                          {d.risk}
                        </span>
                      </td>
                      <td className="py-3.5 text-foreground">{d.shelters}</td>
                      <td className="py-3.5 text-right pr-2">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          d.evacuation.includes("Hazard") ? "bg-red-500/20 text-red-400 border border-red-500/30 font-sans" :
                          "bg-secondary text-foreground font-sans"
                        }`}>
                          {d.evacuation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: OFFICIAL METEOROLOGICAL BULLETINS (RSMC / IMD)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "bulletins" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Bulletin Selector & Filter Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Bulletins Feed
                </h3>
                <span className="text-xs text-muted-foreground">{filteredBulletins.length} available</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search bulletin text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Warning Level Filters */}
              <div className="flex gap-1.5 flex-wrap">
                {["ALL", "RED", "ORANGE", "YELLOW"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      filterLevel === lvl
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Bulletins */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredBulletins.map((b) => (
                <button
                  type="button"
                  aria-label={`Select bulletin ${b.number}`}
                  aria-pressed={selectedBulletin?.id === b.id}
                  key={b.id}
                  onClick={() => setSelectedBulletin(b)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedBulletin?.id === b.id
                      ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/30"
                      : "bg-secondary/20 hover:bg-secondary/40 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-foreground">Bulletin #{b.number}</span>
                    {b.is_latest && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-primary text-primary-foreground tracking-wider animate-pulse">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{b.category} • {b.intensity_knots ?? "Not available"} kts</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40 font-mono">
                    <span>{b.timestamp_ist}</span>
                    <span className={`font-bold ${b.alert_level === "RED" ? "text-red-400" : "text-orange-400"}`}>
                      {b.alert_level}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Full Bulletin Previewer */}
          <div className="lg:col-span-2 space-y-4">
            {selectedBulletin ? (
              <div className="glass-card p-6 border-border space-y-5">
                {/* Bulletin Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">BULLETIN RECORD</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground">
                        {selectedBulletin.id}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mt-1">{selectedBulletin.title}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Issued: {selectedBulletin.timestamp_utc ?? "Not available"} ({selectedBulletin.timestamp_ist ?? "Not available"})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void copyText(selectedBulletin.full_text)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={pdfLoading}
                      aria-busy={pdfLoading}
                      title="Download experimental source summary (not an official warning)"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> {pdfLoading ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  </div>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Wind Speed ({sourceBadge.shortLabel})</p>
                    <p className="text-lg font-mono font-bold text-foreground">{getConvertedKnots(selectedBulletin.intensity_knots)} kts</p>
                    <p className="text-xs text-muted-foreground">{getConvertedKmh(selectedBulletin.intensity_knots)} km/h</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Peak Gusts</p>
                    <p className="text-lg font-mono font-bold text-orange-400">{selectedBulletin.gusts_kmh ?? "Not available"} km/h</p>
                    <p className="text-xs text-muted-foreground">Gale force</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Storm Surge</p>
                    <p className="text-lg font-mono font-bold text-cyan-400">{selectedBulletin.storm_surge_meters} m</p>
                    <p className="text-xs text-muted-foreground">Above tide</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Central Pressure</p>
                    <p className="text-lg font-mono font-bold text-foreground">{selectedBulletin.central_pressure_hpa ?? "Not available"} hPa</p>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </div>
                </div>

                {/* Experimental Analysis Text View */}
                <div className="p-5 rounded-xl bg-zinc-950/80 border border-border font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text shadow-inner max-h-[450px] overflow-y-auto">
                  {selectedBulletin.full_text}
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p>Select a bulletin from the left panel to inspect full technical text.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: LOCAL EXERCISE TEMPLATES
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "broadcast" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Broadcast Status Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><PhoneCall className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">SIMULATED DRILL</span>
              </div>
              <p className="text-xs text-muted-foreground">Cell Broadcast & SMS Pipeline</p>
              <p className="text-xl font-mono font-bold text-foreground">No delivery adapter</p>
              <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-red-500/10 text-red-400"><Siren className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">SIMULATED DRILL</span>
              </div>
              <p className="text-xs text-muted-foreground">Coastal Acoustic Sirens</p>
              <p className="text-xl font-mono font-bold text-foreground">No hardware connection</p>
              <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Radio className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">DRAFT ONLY</span>
              </div>
              <p className="text-xs text-muted-foreground">Radio exercise template</p>
              <p className="text-xl font-mono font-bold text-foreground">No hardware connection</p>
              <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><ShieldCheck className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">SIMULATED DRILL</span>
              </div>
              <p className="text-xs text-muted-foreground">Official agency resources</p>
              <p className="text-xl font-mono font-bold text-foreground">OASIS CAP v1.2</p>
              <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
            </div>
          </div>

          {/* Interactive Broadcast Dispatch Tool */}
          <div className="glass-card p-6 border-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  Local exercise draft generator
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a local exercise document. No public warning, transmission, gateway handshake or hardware activation occurs.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded">
                Protocol: OASIS-CAP-1.2-IN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuration Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Alert Directive Type
                  </label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value)}
                    disabled={dispatchStatus === "dispatching"}
                    className="w-full px-3 py-2 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="EVACUATION_WARNING">RED ALERT: Coastal Hazard Advisory Simulation (Exercise Only)</option>
                    <option value="STORM_SURGE_EMERGENCY">ORANGE ALERT: Storm Surge & Inundation Warning</option>
                    <option value="FISHERMEN_RECALL">YELLOW ALERT: Marine Return & Total Sea Suspension</option>
                    <option value="ALL_CLEAR">ALL CLEAR: Threat Passed / Return Safe</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Transmission Channels
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "sms", label: "Cell Broadcast & SMS" },
                      { id: "siren", label: "Acoustic Sirens" },
                      { id: "vhf", label: "Marine VHF / Navtex" },
                      { id: "sachet", label: "Exercise notification template" },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannel(ch.id)}
                        disabled={dispatchStatus === "dispatching"}
                        className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                          selectedChannels.includes(ch.id)
                            ? "bg-primary/15 border-primary/50 text-foreground ring-1 ring-primary/20"
                            : "bg-secondary/40 border-border text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${selectedChannels.includes(ch.id) ? "bg-primary" : "bg-muted-foreground"}`} />
                          {ch.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Targeted Coastal Districts ({affectedDistricts.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-secondary/20 border border-border">
                    {affectedDistricts.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-foreground">
                        {d.district}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleDispatchSimulation}
                  disabled={dispatchStatus === "dispatching"}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {dispatchStatus === "dispatching" ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Generating exercise draft...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 animate-pulse" /> Generate exercise draft
                    </>
                  )}
                </button>
              </div>

              {/* Live Pipeline Animation & Receipt */}
              <div className="p-5 rounded-xl bg-zinc-950/80 border border-border flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-mono font-bold text-primary uppercase">Exercise draft status</p>
                  
                  <div role="status" className="text-xs text-muted-foreground">
                    {dispatchStatus === "dispatching" ? "Requesting a local exercise document. Nothing has been transmitted."
                      : dispatchStatus === "completed" ? "Draft received. No transmission or hardware activation occurred."
                      : "No exercise document has been generated for this request."}
                  </div>
                </div>

                {dispatchReceipt && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1 font-mono">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Exercise draft receipt: {dispatchReceipt.dispatch_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Time: {dispatchReceipt.timestamp}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      Payload: &quot;{dispatchReceipt.message_payload}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
