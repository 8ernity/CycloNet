"use client";
import type { WeatherSystem as ActiveSystem } from "@/types/api";
import { type SurgeCalculation, type SurgeSector, type RainfallPathway, type Briefing, type DispatchResult, type CatalogItem } from "@/types/api";
import { ObservationValue } from "@/components/ObservationValue";
import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { Building2, Zap, Navigation, Coins, Waves, RefreshCw, CheckCircle2, Radio, Siren, Search, ShieldAlert, Sparkles, CloudRain, Layers, Cpu, CheckCircle, X, Send, Copy, ArrowRight, Check, AlertOctagon, Terminal } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { useClipboard } from "@/hooks/useClipboard";
import { apiFetch } from "@/lib/api";
import { POWER_SUBSTATIONS as SCENARIO_POWER_SUBSTATIONS, EVACUATION_ROUTES as SCENARIO_EVACUATION_ROUTES, MEDICAL_SHELTERS as SCENARIO_MEDICAL_SHELTERS, PARAMETRIC_INSURANCE_TRIGGERS as SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS, calculateSubstationVulnerability, calculateRouteVulnerability, calculateShelterSuitability } from "@/lib/infrastructureData";



import { catalogObservation } from '@/lib/catalogObservation';
import { evaluateIllustrativeTrigger } from '@/lib/infrastructureData';
const PRESET_STORMS: {id:string;name:string;basin:string;category:string;knots:number|null}[] = [];

function subscribeLocation(notify: () => void) { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify); }
function readTab() { const tab = new URLSearchParams(window.location.search).get("tab"); return tab === "surge" ? "surge_rain" : tab ?? "grid"; }
export default function InfrastructurePage() {
  const {copyText, copyStatus} = useClipboard();
  const [scenarioMode, setScenarioMode] = useState(false);
  const PARAMETRIC_INSURANCE_TRIGGERS = scenarioMode ? SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS : [];
  const POWER_SUBSTATIONS = scenarioMode ? SCENARIO_POWER_SUBSTATIONS : [];
  const MEDICAL_SHELTERS = scenarioMode ? SCENARIO_MEDICAL_SHELTERS : [];
  const EVACUATION_ROUTES = scenarioMode ? SCENARIO_EVACUATION_ROUTES : [];
  const { selectedCycloneId, selectCyclone } = useActiveCyclone();
  const { getConvertedKnots, getConvertedKmh, getConvertedCategory, getSourceBadge } = useDataSource();

  const sourceBadge = getSourceBadge();
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState(false);
  const [sourceRetry, setSourceRetry] = useState(0);
  const [cyclonesList, setCyclonesList] = useState(PRESET_STORMS);
  const queryTab = useSyncExternalStore(subscribeLocation, readTab, () => "grid");
  const [tabOverride, setActiveTab] = useState<string | null>(null);
  const activeTab = tabOverride ?? queryTab;
  const [infraFilter, setInfraFilter] = useState<"all" | "critical" | "high">("all");
  const [searchFilter, setSearchFilter] = useState<string>("" );
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [toast, setToast] = useState<string | null>(null);

  // Hydrodynamic Surge & GEE Simulator State
  const [simPressureHpa, setSimPressureHpa] = useState<number>(945);
  const [simWindKts, setSimWindKts] = useState<number>(115);
  const [simTideM, setSimTideM] = useState<number>(1.8);
  const simForwardSpeed = 18;
  const [simAngleDeg, setSimAngleDeg] = useState<number>(75);
  const simRainMm = 240;
  const scenarioKey = JSON.stringify([scenarioMode, selectedCycloneId, system, simWindKts, simPressureHpa, simTideM, simAngleDeg]);
  const [scenarioResult, setScenarioResult] = useState<{key:string; surge:SurgeCalculation; sectors:SurgeSector[]; pathways:RainfallPathway[]} | null>(null);
  const currentScenario = scenarioMode && scenarioResult?.key === scenarioKey ? scenarioResult : null;
  const surgeCalcData = currentScenario?.surge ?? null;
  const surgeSectors = currentScenario?.sectors ?? [];
  const rainfallPathways = currentScenario?.pathways ?? [];
  const [scenarioError, setScenarioError] = useState(false);
  const [scenarioRetry, setScenarioRetry] = useState(0);

  // Deterministic source and scenario briefing state
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<Briefing | null>(null);
  const pendingBriefing = useRef<AbortController | null>(null);
  const briefingDialog = useRef<HTMLDivElement | null>(null);
  const briefingOpener = useRef<HTMLElement | null>(null);
  const [briefingError, setBriefingError] = useState(false);
  const briefingLanguage = "en";

  // Automated Multi-Channel Warning Dispatcher State
  const [dispatchRegion, setDispatchRegion] = useState<string>("Sundarbans & Odisha Coastal Corridor");
  const [dispatchRiskLevel, setDispatchRiskLevel] = useState<string>("CRITICAL");
  const [dispatchChannels, setDispatchChannels] = useState<string[]>(["CAP", "SMS", "SACHET", "SIREN", "VHF"]);
  const [dispatchLoading, setDispatchLoading] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const pendingDispatch = useRef<AbortController | null>(null);
  const [dispatchViewerTab, setDispatchViewerTab] = useState<"cap" | "sms" | "sachet" | "siren" | "vhf" | "directives">("cap");

  // Parametric insurance simulation state
  const [insuranceSimulationTier, setInsuranceSimulationTier] = useState<number>(0);
  const [thresholdResult, setThresholdResult] = useState<{key:string; value:ReturnType<typeof evaluateIllustrativeTrigger>} | null>(null);
  const thresholdKey = JSON.stringify([scenarioKey, insuranceSimulationTier, surgeCalcData?.peak_surge_height_m]);
  const currentThresholdResult = scenarioMode && surgeCalcData && thresholdResult?.key === thresholdKey ? thresholdResult.value : null;

  const changeScenarioMode = (enabled: boolean) => {
    setScenarioMode(enabled);
    setThresholdResult(null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setDispatchResult(null); setDispatchLoading(false);
    }, 0);
    return () => { window.clearTimeout(reset); pendingDispatch.current?.abort(); };
  }, [scenarioKey, dispatchRegion, dispatchRiskLevel, dispatchChannels]);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setBriefingData(null); setBriefingLoading(false); setBriefingModalOpen(false); setBriefingError(false);
    }, 0);
    return () => { window.clearTimeout(reset); pendingBriefing.current?.abort(); };
  }, [scenarioKey]);

  const closeBriefing = useCallback(() => {
    pendingBriefing.current?.abort();
    setBriefingModalOpen(false); setBriefingLoading(false); setBriefingData(null);
  }, [setBriefingModalOpen, setBriefingLoading, setBriefingData]);

  useEffect(() => {
    if (!briefingModalOpen) return;
    const previous = briefingOpener.current;
    const dialog = briefingDialog.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeBriefing(); }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener("keydown", onKey);
    return () => {
      dialog?.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [briefingModalOpen, closeBriefing]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchAllCyclones() {
      try {
        const data = await apiFetch<CatalogItem[]>("/api/history/search", {signal: controller.signal, maxRetries: 0});
        if (!controller.signal.aborted) {
          if (Array.isArray(data) && data.length > 0) {
            setCyclonesList(data.map((c: CatalogItem) => ({
              ...catalogObservation(c),
              name: c.name.startsWith("Cyclone ") || c.name.startsWith("Deep Depression") || c.name.startsWith("Depression") || c.name.startsWith("Super Cyclone") || c.name.includes("Cyclone") ? c.name : `Cyclone ${c.name}`,
            })));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Failed to load full cyclone list", err);
      }
    }
    fetchAllCyclones();
    return () => controller.abort();
  }, [sourceRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchSystem = async () => {
      setLoading(true);
      setSourceError(false);
      setSystem(null);
      try {
        const query = selectedCycloneId ? `?cyclone_id=${encodeURIComponent(selectedCycloneId)}` : "";
        const data = await apiFetch<ActiveSystem[]>(`/api/active-systems${query}`, {signal: controller.signal, maxRetries: 0});
        if (!Array.isArray(data)) throw new Error("Invalid source response");
        if (!controller.signal.aborted) setSystem(data[0] ?? null);
      } catch {
        if (!controller.signal.aborted) setSourceError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchSystem();
    return () => controller.abort();
  }, [selectedCycloneId, sourceRetry]);

  const rawKnots = scenarioMode ? simWindKts : system?.intensity_knots ?? null;
  const knots = getConvertedKnots(rawKnots);
  const kmh = getConvertedKmh(rawKnots);
  const displayCategory = getConvertedCategory(rawKnots);
  const surgeM = scenarioMode ? surgeCalcData?.peak_surge_height_m ?? null : null;

  // Explicit scenario calculations; changes cancel and clear older results.
  useEffect(() => {
    const controller = new AbortController();
    async function fetchSurgeAndGee() {
      setScenarioResult(null); setScenarioError(false);
      if (!scenarioMode) return;
      try {
        const lat = system?.lat ?? 18.2;
        const lon = system?.lon ?? 84.8;
        const basin = system?.basin || "Bay of Bengal";

        const options = {signal: controller.signal, maxRetries: 0};
        const [surge, sectors, pathways] = await Promise.all([
          apiFetch<SurgeCalculation>(`/api/surge/calculate?knots=${simWindKts}&pressure_hpa=${simPressureHpa}&forward_speed=${simForwardSpeed}&angle_deg=${simAngleDeg}&tide_m=${simTideM}&basin=${encodeURIComponent(basin)}`, options),
          apiFetch<{sectors: SurgeSector[]}>(`/api/surge/profile?name=${encodeURIComponent(system?.name || "Cyclone")}&lat=${lat}&lon=${lon}&knots=${simWindKts}`, options),
          apiFetch<{pathways: RainfallPathway[]}>(`/api/gee/rainfall-pathways?lat=${lat}&lon=${lon}&rain_mm=${simRainMm}`, options),
        ]);

        if (controller.signal.aborted) return;
        if (!surge || !Number.isFinite(surge.peak_surge_height_m) || !Array.isArray(sectors?.sectors) || !Array.isArray(pathways?.pathways)) throw new Error("Invalid scenario response");
        // Publish only a complete calculation for the current inputs.
        setScenarioResult({key:scenarioKey, surge, sectors:sectors.sectors, pathways:pathways.pathways});
      } catch (err) {
        if (controller.signal.aborted) return;
        setScenarioError(true);
        controller.abort();
        console.error("Scenario calculation unavailable", err);
      }
    }
    const debounce = window.setTimeout(() => void fetchSurgeAndGee(), 350);
    return () => { controller.abort(); window.clearTimeout(debounce); };
  }, [scenarioMode, system, simWindKts, simPressureHpa, simTideM, simForwardSpeed, simAngleDeg, simRainMm, scenarioRetry, scenarioKey]);

  // Handle Multi-Channel Early Warning Dispatch
  const handleExecuteDispatch = async () => {
    if (dispatchLoading || !scenarioMode) return;
    if (!surgeCalcData) { showToast("Scenario calculation unavailable. Retry before generating a draft."); return; }
    pendingDispatch.current?.abort();
    const controller = new AbortController();
    pendingDispatch.current = controller;
    setDispatchLoading(true);
    setDispatchResult(null);
    try {
      const payload = {
        region: dispatchRegion,
        risk_level: dispatchRiskLevel,
        surge: surgeCalcData.peak_surge_height_m,
        wind: simWindKts,
        channels: dispatchChannels,
        cyclone_name: system?.name || "Exercise cyclone"
      };
      const data = await apiFetch<DispatchResult>("/api/alerts/dispatch", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (controller.signal.aborted) return;
      if (typeof data?.dispatch_id !== "string" || typeof data.cap_xml !== "string" ||
          !data.sms_payload || typeof data.sms_payload !== "object" || Array.isArray(data.sms_payload) ||
          !Object.values(data.sms_payload).every(value => value === null || typeof value === "string") ||
          typeof data.vhf_payload !== "string" || !Array.isArray(data.municipal_briefing) ||
          !data.municipal_briefing.every(value => typeof value === "string")) throw new Error("Invalid exercise draft");
      setDispatchResult(data);
      showToast("Exercise generated. No real broadcast was sent.");
    } catch {
      if (controller.signal.aborted) return;
      setDispatchResult(null);
      showToast("Exercise request failed. No broadcast was sent.");
    } finally {
      if (!controller.signal.aborted) setDispatchLoading(false);
    }
  };

  const handleGenerateBriefing = async (lang = briefingLanguage) => {
    if (!scenarioMode || !surgeCalcData) return;
    if (!briefingModalOpen && document.activeElement instanceof HTMLElement) briefingOpener.current = document.activeElement;
    pendingBriefing.current?.abort();
    const controller = new AbortController();
    pendingBriefing.current = controller;
    setBriefingData(null);
    setBriefingError(false);
    setBriefingModalOpen(true);
    setBriefingLoading(true);
    try {
      const stormPayload = {
        name: system?.name || "Cyclone System",
        category: displayCategory,
        intensity_knots: knots,
        wind_kmh: kmh,
        surge_m: surgeCalcData.peak_surge_height_m,
        basin: system?.basin || "Bay of Bengal"
      };
      const data = await apiFetch<{briefing: Briefing}>("/api/ai/pre-landfall-briefing", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "SCENARIO", storm_data: stormPayload, language: lang })
      });
      if (controller.signal.aborted) return;
      if (typeof data?.briefing?.executive_summary !== "string" || !Array.isArray(data.briefing.action_checklist) ||
          !data.briefing.action_checklist.every(item => typeof item === "string")) throw new Error("Invalid scenario summary");
      setBriefingData(data.briefing);
    } catch (err) {
      if (controller.signal.aborted) return;
      setBriefingError(true);
      console.error("Failed to generate briefing", err);
    } finally {
      if (!controller.signal.aborted) setBriefingLoading(false);
    }
  };

  // Filtered Substations with IVF Scores
  const analyzedSubstations = POWER_SUBSTATIONS.map(sub => ({
    ...sub,
    ivf: surgeCalcData ? calculateSubstationVulnerability(sub, simWindKts, surgeCalcData.peak_surge_height_m, simRainMm) : null
  }));

  const filteredSubstations = analyzedSubstations.filter(sub => {
    const matchesCriticality = infraFilter === "all" ||
      (infraFilter === "critical" && sub.ivf?.riskCategory === "CRITICAL") ||
      (infraFilter === "high" && (sub.ivf?.riskCategory === "CRITICAL" || sub.ivf?.riskCategory === "HIGH"));
    const matchesRegion = regionFilter === "ALL" || sub.region.toLowerCase().includes(regionFilter.toLowerCase());
    const matchesSearch = !searchFilter || sub.name.toLowerCase().includes(searchFilter.toLowerCase()) || sub.type.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCriticality && matchesRegion && matchesSearch;
  });

  // Filtered Routes with Vulnerability
  const analyzedRoutes = EVACUATION_ROUTES.map(r => ({
    ...r,
    vuln: surgeCalcData ? calculateRouteVulnerability(r, simWindKts, surgeCalcData.peak_surge_height_m, simRainMm) : null
  }));

  // Filtered Shelters with Suitability
  const analyzedShelters = MEDICAL_SHELTERS.map(s => ({
    ...s,
    suitability: calculateShelterSuitability(s, simWindKts)
  }));

  const filteredShelters = analyzedShelters.filter(shl => {
    const matchesRegion = regionFilter === "ALL" || shl.region.toLowerCase().includes(regionFilter.toLowerCase());
    const matchesSearch = !searchFilter || shl.name.toLowerCase().includes(searchFilter.toLowerCase()) || shl.type.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  const totalShelterCapacity = MEDICAL_SHELTERS.reduce((acc, s) => acc + s.capacityPersons, 0);
  const totalMedicalBeds = MEDICAL_SHELTERS.reduce((acc, s) => acc + s.medicalBeds, 0);
  const totalGridCapacity = POWER_SUBSTATIONS.reduce((acc, s) => acc + s.capacityMVA, 0);
  const criticalSubstationsCount = surgeCalcData ? analyzedSubstations.filter(s => s.ivf?.riskCategory === "CRITICAL").length : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading coastal infrastructure and resilience telemetry...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="glass-card p-4 border-border" role="status">
        <p>{scenarioMode ? "ILLUSTRATIVE SCENARIO — asset names, coordinates, capacities and risk calculations are unverified examples." : "Operational status not verified. No authorized infrastructure observations are connected."}</p>
        {system && <p>Source: {system.source ?? "Unavailable"} · Observation: {system.observation_time_utc ?? "Unavailable"} · {system.is_stale ? "STALE" : "Check source freshness"}</p>}
        <label><input type="checkbox" checked={scenarioMode} onChange={e => changeScenarioMode(e.target.checked)} /> Show illustrative scenario assets</label>
      </div>
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Building2 className="w-3.5 h-3.5" />
              Critical Infrastructure & Vulnerability Forecaster
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${sourceBadge.badgeClass}`}>
              {sourceBadge.shortLabel}
            </span>
            {system && (
              <span className="text-xs text-muted-foreground font-mono">
                {system.provenance ?? "UNKNOWN"}: {system.name} ({displayCategory} • {rawKnots ?? "Unavailable"} KT)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Infrastructure observations & explicit scenarios
          </h1>
          <p className="text-sm text-muted-foreground max-w-4xl">
            Inspect unavailable field observations or opt into illustrative infrastructure and surge scenarios. Exercise communications remain local drafts.
          </p>

          {/* Field Operational Verification Advisory (#50 & #51) */}
          <div className="mt-3 p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wide text-[10px] block mb-0.5">Field Operational Verification Advisory</span>
              <p className="text-muted-foreground leading-relaxed">
                Example asset names, locations and capacities have no verified source inventory. Current operational attributes remain unavailable until authorized field observations are supplied.
              </p>
            </div>
          </div>
        </div>

        {/* Storm Selector & AI Briefing Actions */}
        <div className="flex items-center gap-2.5 z-10 shrink-0 flex-wrap">
          <select
            aria-label="Selected cyclone"
            value={selectedCycloneId || system?.id}
            onChange={(e) => {
              const storm = cyclonesList.find(s => s.id === e.target.value);
              selectCyclone(e.target.value, storm?.name);
            }}
            className="px-3 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors shadow-xs"
          >
            {cyclonesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.category ? `(${s.category})` : ""}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleGenerateBriefing(briefingLanguage)}
            disabled={!surgeCalcData || briefingLoading}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Scenario summary</span>
          </button>

          <button
            onClick={() => setActiveTab("dispatch")}
            className="px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Siren className="w-3.5 h-3.5 text-red-400" />
            <span>Exercise drafts</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {sourceError && <div role="status" className="glass-card p-4 text-sm">
        <p>Source unavailable. Operational conditions are not verified.</p>
        <button onClick={() => setSourceRetry(value => value + 1)} className="mt-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground">Retry source</button>
      </div>}
      {scenarioMode && scenarioError && <div role="status" className="glass-card p-4 text-sm">
        <p>Scenario calculation unavailable. No complete result was received.</p>
        <button onClick={() => setScenarioRetry(value => value + 1)} className="mt-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground">Retry scenario</button>
      </div>}
      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? "glass-card p-3 text-sm" : "sr-only"}>{copyStatus}</div>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Metric Summary Tiles ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              {scenarioMode ? criticalSubstationsCount === null ? "Exposure unavailable" : `${criticalSubstationsCount} critical scenario nodes` : "Unverified inventory"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Power Transmission Grid IVF</p>
          <p className="text-2xl font-mono font-black text-foreground">{scenarioMode ? `${(totalGridCapacity / 1000).toFixed(1)}k (assumed)` : "Unavailable"} <span className="text-xs font-normal text-muted-foreground">MVA Capacity</span></p>
          <p className="text-[11px] text-amber-400 font-semibold">Multi-factor: Flood (30%) + Wind (25%) + Elev (15%)</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Waves className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Hydrodynamic</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Peak Storm Surge Height</p>
          <p className="text-2xl font-mono font-black text-foreground">
            {surgeM ?? "Unavailable"} <span className="text-xs font-normal text-muted-foreground">meters AMSL</span>
          </p>
          <p className="text-[11px] text-cyan-400 font-semibold">
            Inland Penetration: {surgeCalcData?.inland_penetration_km ?? "Unavailable"} km
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{scenarioMode ? `${MEDICAL_SHELTERS.length} illustrative shelters` : "Unverified inventory"}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Cyclone Shelters Capacity</p>
          <p className="text-2xl font-mono font-black text-foreground">{scenarioMode ? `${totalShelterCapacity.toLocaleString()} (assumed)` : "Unavailable"} <span className="text-xs font-normal text-muted-foreground">persons</span></p>
          <p className="text-[11px] text-emerald-400 font-semibold">{scenarioMode ? `${totalMedicalBeds} assumed beds` : "Medical beds unavailable"}</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Radio className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">OASIS CAP-CP</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Early Warning Broadcast</p>
          <p className="text-2xl font-mono font-black text-foreground">5 Channels</p>
          <p className="text-[11px] text-red-400 font-semibold">CAP XML • SMS • SACHET • Siren • VHF</p>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "grid"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" /> Power Grid IVF Scoring ({POWER_SUBSTATIONS.length})
        </button>

        <button
          onClick={() => setActiveTab("routes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "routes"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Navigation className="w-4 h-4 text-blue-400" /> Road scenario exposure ({EVACUATION_ROUTES.length})
        </button>

        <button
          onClick={() => setActiveTab("shelters")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "shelters"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" /> Cyclone Shelters & Decisions ({MEDICAL_SHELTERS.length})
        </button>

        <button
          onClick={() => setActiveTab("surge_rain")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "surge_rain"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Waves className="w-4 h-4 text-cyan-400" /> Storm Surge & Drainage Choke Points
        </button>

        <button
          onClick={() => setActiveTab("dispatch")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "dispatch"
              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
              : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
          }`}
        >
          <Siren className="w-4 h-4 text-red-300 animate-pulse" /> 🚨 Multi-Channel Advisory Dispatch
        </button>

        <button
          onClick={() => setActiveTab("insurance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "insurance"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Coins className="w-4 h-4 text-cyan-400" /> Parametric Insurance (₹455 Cr)
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: POWER GRID TRANSMISSION & IVF VULNERABILITY MATRIX
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "grid" && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Methodology Banner */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Infrastructure Vulnerability Index (IVF) Mathematical Framework
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Risk Score = (0.30 &times; Flood Depth) + (0.25 &times; Wind Exposure) + (0.15 &times; Elevation Deficit) + (0.10 &times; Coastal Proximity) + (0.20 &times; Criticality)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono shrink-0">
              <span className="px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30">75–100 CRITICAL</span>
              <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">50–74 HIGH</span>
              <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">25–49 MODERATE</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by substation name or type..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
                />
              </div>

              <div className="flex gap-1">
                {(["all", "critical", "high"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setInfraFilter(lvl)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                      infraFilter === lvl
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl} Risk
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Showing {filteredSubstations.length} of {POWER_SUBSTATIONS.length} Grid Nodes</span>
            </div>
          </div>

          {/* Substation IVF Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubstations.map((sub, i) => {
              const ivf = sub.ivf;
              if (!ivf) return <div key={sub.id} className="glass-card p-5 border-border space-y-2">
                <h4 className="text-sm font-bold">{sub.name}</h4>
                <p className="text-xs text-muted-foreground">Grid exposure unavailable: a complete current scenario calculation is required.</p>
              </div>;
              return (
                <div key={i} className="glass-card p-5 border-border space-y-3 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{sub.id} • {sub.type}</span>
                        <h4 className="text-sm font-bold text-foreground leading-snug">{sub.name}</h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-black shrink-0 ${
                        ivf.riskCategory === "CRITICAL" ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                        ivf.riskCategory === "HIGH" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                        "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                      }`}>
                        {ivf.riskScore}/100 illustrative {ivf.riskCategory}
                      </span>
                    </div>

                    {/* Progress Score Bar */}
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ivf.riskCategory === "CRITICAL" ? "bg-red-500" :
                          ivf.riskCategory === "HIGH" ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${ivf.riskScore}%` }}
                      />
                    </div>

                    {/* Telemetry Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Illustrative flood depth:</span>
                        <span className={`font-bold ${ivf.floodDepthM >= 1.5 ? "text-red-400" : "text-foreground"}`}>
                          {ivf.floodDepthM}m
                        </span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Illustrative wind exposure:</span>
                        <span className="font-bold text-foreground">{ivf.windExposureKts} kt</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Elevation:</span>
                        <span className="font-bold text-foreground">{sub.elevationMeters}m AMSL</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Coast Dist:</span>
                        <span className="font-bold text-foreground">{sub.coastalDistanceKm} km</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40 col-span-2">
                        <span className="text-[10px] text-muted-foreground block">Assumed backup duration:</span>
                        <span className="font-bold text-muted-foreground">{ivf.backupCapacityHrs} hours (unverified)</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Directive */}
                  <div className="pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground">
                    <p className="font-bold text-foreground mb-1">Recommended Action:</p>
                    <p className="line-clamp-2 leading-relaxed">{ivf.recommendedAction}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: EVACUATION CORRIDORS & ROAD REROUTING
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "routes" && (
        <div className="space-y-6 animate-in fade-in duration-300">

          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                Road observations and illustrative scenarios
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Road conditions require current authorized observations. Scenario exposure uses assumed terrain and cannot identify a safe evacuation route.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono shrink-0">
              <span className="text-muted-foreground">Illustrative exposure only · Road status unknown</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {analyzedRoutes.map((route, i) => {
              const v = route.vuln;
              if (!v) return <div key={route.id} className="glass-card p-5 border-border space-y-2">
                <h4 className="text-sm font-bold">{route.name}</h4>
                <p className="text-xs text-muted-foreground">Road exposure unavailable: a complete current scenario calculation is required.</p>
              </div>;
              return (
                <div key={i} className="glass-card p-5 border-border space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {route.highwayCode}
                      </span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded" style={{ color: v.statusColor, backgroundColor: `${v.statusColor}15` }}>
                        {v.statusBadge}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-foreground leading-snug">{route.name}</h4>

                    <div className="space-y-2 text-xs font-mono pt-1">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Illustrative flood depth:</span>
                        <strong className="text-foreground">{v.floodDepthM}m</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Assumed scenario inundation lag:</span>
                        <strong className="text-amber-400">{v.etaToInundationHrs} Hours</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Avg Elevation:</span>
                        <strong className="text-foreground">{route.elevationAvgM}m MSL</strong>
                      </div>
                    </div>

                    {/* Safe Alternative Box */}
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Recommended Alternative Corridor:</span>
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {v.alternativeRouteName}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-muted-foreground">
                    <p className="font-bold text-foreground">Action Directive:</p>
                    <p>{v.recommendedAction}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: CYCLONE SHELTERS & HOSPITALS DECISION SUPPORT
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "shelters" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls */}
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by facility name or location..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
                />
              </div>

              <select
                aria-label="Filter facilities by state"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-1.5 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground"
              >
                <option value="ALL">All States (Odisha, AP, WB, TN, Gujarat)</option>
                <option value="Odisha">Odisha Coastal Belt</option>
                <option value="Andhra">Andhra Pradesh</option>
                <option value="West Bengal">West Bengal / Sundarbans</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Gujarat">Gujarat / Kutch</option>
              </select>
            </div>

            <span className="text-xs font-mono text-muted-foreground">
              Showing {filteredShelters.length} Facilities
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShelters.map((shl, i) => {
              const suit = shl.suitability;
              return (
                <div key={i} className="glass-card p-5 border-border space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-muted-foreground">{shl.id} • {shl.region}</span>
                        <h4 className="text-sm font-bold text-foreground leading-snug">{shl.name}</h4>
                      </div>
                      {suit.isRecommendedDestination && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          AUTHORIZED DESTINATION APPROVAL
                        </span>
                      )}
                    </div>

                    {/* Occupancy Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-muted-foreground">Occupancy ({suit.occupancyPercentage ?? "Unavailable"}%):</span>
                        <span className="font-bold text-foreground"><ObservationValue attribute={suit.observations?.occupancy} /> / {suit.capacity ?? "Unavailable"}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(suit.occupancyPercentage ?? 0) >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${suit.occupancyPercentage ?? "Unavailable"}%` }}
                        />
                      </div>
                    </div>

                    {/* Key Status Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Medical Beds:</span>
                        <span className="font-bold text-emerald-400">{suit.medicalBeds ?? "Unavailable"}</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground block">Road Access:</span>
                        <span className="font-bold text-sky-400">{suit.roadAccessStatus ?? "Unavailable"}</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/30 border border-border/40 col-span-2">
                        <span className="text-[10px] text-muted-foreground block">Power Backup:</span>
                        <span className="font-bold text-emerald-400">{suit.powerBackupStatus ?? "Unavailable"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                    <p>{suit.decisionNote}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: HYDRODYNAMIC STORM SURGE & GEE DRAINAGE CHOKE POINTS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "surge_rain" && scenarioMode && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Top Banner */}
          <div className="glass-card p-5 border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/20 via-background to-cyan-950/20">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Waves className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Parametric Hydrodynamic Surge Simulator (Jelesnianski Formulation)
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Satellite observations unavailable
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  Compound Coastal Storm Surge & Catchment Runoff Forecaster
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
                  Simulates inverted barometer ocean rise, shallow continental shelf wind stress, astronomical tide phase superposition, and digital elevation catchment drainage choke points.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleGenerateBriefing(briefingLanguage)}
              disabled={!surgeCalcData || briefingLoading}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Generate scenario summary</span>
            </button>
          </div>

          {/* Real-Time Parametric Surge Calculation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">Peak Storm Surge (S-peak)</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeM ?? "Unavailable"} <span className="text-sm font-normal text-muted-foreground">meters</span>
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {surgeCalcData?.severity_level ?? "Severity unavailable"}
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">Inverted Barometer Effect</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.inverted_barometer_m ?? "Unavailable"} <span className="text-sm font-normal text-muted-foreground">m rise</span>
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                ΔP = {1013 - simPressureHpa} hPa below standard
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">Wind Stress On Shelf</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.wind_setup_m ?? "Unavailable"} <span className="text-sm font-normal text-muted-foreground">m setup</span>
              </p>
              <p className="text-[11px] text-amber-400 font-semibold font-mono">
                {system?.basin?.includes("Bengal") ? "Assumed Bay of Bengal shelf" : "Assumed Arabian Sea shelf"}
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">Inland Flood Penetration</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.inland_penetration_km ?? "Unavailable"} <span className="text-sm font-normal text-muted-foreground">km inland</span>
              </p>
              <p className="text-[11px] text-purple-400 font-semibold">
                Based on an assumed slope; no terrain raster is connected
              </p>
            </div>
          </div>

          {/* Interactive Physics Sliders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="glass-card p-5 border-border space-y-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
                <Cpu className="w-4 h-4 text-primary" />
                Parametric Simulation Controls
              </h4>

              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Sustained Wind Speed:</span>
                    <span className="font-mono text-primary font-bold">{simWindKts} Knots ({Math.round(simWindKts*1.852)} km/h)</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Scenario sustained wind in knots"
                    min="35"
                    max="155"
                    step="5"
                    value={simWindKts}
                    onChange={(e) => setSimWindKts(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Central Barometric Pressure:</span>
                    <span className="font-mono text-cyan-400">{simPressureHpa} hPa</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Scenario central pressure in hectopascals"
                    min="900"
                    max="1000"
                    step="1"
                    value={simPressureHpa}
                    onChange={(e) => setSimPressureHpa(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Astronomical Tide Stage:</span>
                    <span className="font-mono text-blue-400">+{simTideM.toFixed(1)} m (High Spring Tide)</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Scenario tide height in meters"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={simTideM}
                    onChange={(e) => setSimTideM(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Landfall Approach Angle:</span>
                    <span className="font-mono text-amber-400">{simAngleDeg}° Normal</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Scenario approach angle in degrees"
                    min="30"
                    max="90"
                    step="5"
                    value={simAngleDeg}
                    onChange={(e) => setSimAngleDeg(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Coastal Quadrants Threat Matrix */}
            <div className="glass-card p-5 border-border space-y-4 lg:col-span-2">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Quadrant Coastal Surge Transect Hazard Footprint
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {surgeSectors.map((sec, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-foreground line-clamp-1">{sec.sector_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        sec.risk_rating === "EXTREME" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        sec.risk_rating === "CRITICAL" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}>
                        {sec.risk_rating}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-mono text-primary font-bold text-sm">{sec.estimated_surge_m}m Peak Surge</p>
                      <p className="text-[11px] text-muted-foreground">Inundation: <strong>{sec.inundation_depth_m}</strong></p>
                      <p className="text-[10.5px] text-muted-foreground">Sector: {sec.offset_km}</p>
                    </div>

                    <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                      <p className="font-semibold text-foreground mb-0.5">Critical Assets:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {sec.critical_assets.map((ast: string, aIdx: number) => (
                          <li key={aIdx} className="line-clamp-1">{ast}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── DEDICATED RAIN / RUNOFF & DRAINAGE CHOKE-POINTS PANEL ───────────── */}
          <div className="glass-card p-6 border-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-blue-400" />
                  Assumed-Terrain Catchment Runoff & Drainage Choke Points
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assumed-terrain catchment runoff pathway simulation and compound estuarine backwater bottleneck analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20">
                  Simulated Rainfall: <strong>{simRainMm} mm</strong> (24h Window)
                </span>
                <span className="text-xs font-mono bg-red-500/10 text-red-400 px-3 py-1 rounded-lg border border-red-500/20 font-bold">
                  Runoff Risk: CRITICAL
                </span>
              </div>
            </div>

            {/* Visual Channel Legend */}
            <div className="flex items-center gap-4 text-xs font-mono flex-wrap bg-secondary/30 p-2.5 rounded-lg border border-border/60">
              <span className="text-muted-foreground">Channel Classification:</span>
              <span className="flex items-center gap-1 text-sky-400 font-semibold">🔵 Main River Basin</span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold">🟡 Runoff Pathway</span>
              <span className="flex items-center gap-1 text-orange-400 font-semibold">🟠 Terrain Gravity Vector</span>
              <span className="flex items-center gap-1 text-red-400 font-semibold animate-pulse">🔴 Simulated Flood Choke Point</span>
            </div>

            {/* Choke Points Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rainfallPathways.map((path) => (
                <div key={path.id} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-foreground">{path.name}</h5>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      {path.discharge_rate_cumecs} cumecs
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground font-mono">
                    Catchment: <strong className="text-foreground">{path.basin}</strong> • Assumed slope: <strong className="text-primary">{path.assumed_slope_deg}°</strong>
                  </p>

                  <div className="space-y-2 text-xs pt-1 border-t border-border/40">
                    <p className="font-bold text-red-400 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      Critical Choke Points (ETA & Inundation Depth):
                    </p>
                    <div className="space-y-1.5 font-mono">
                      {path.critical_choke_points?.map((chk, cIdx) => (
                        <div key={cIdx} className="p-2 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-foreground block">{chk.name}</span>
                            <span className="text-[10px] text-muted-foreground">{chk.status}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-red-400 font-bold block">Depth: {chk.depth_m}m</span>
                            <span className="text-[10px] text-amber-400">ETA: {chk.eta_hours}h</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: 🚨 AUTOMATED MULTI-CHANNEL ADVISORY DISPATCHER
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dispatch" && scenarioMode && (
        <div className="space-y-6 animate-in fade-in duration-300">

          <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-background to-orange-950/30 border border-red-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3.5 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <Siren className="w-7 h-7 animate-pulse text-red-400" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">
                  CycloNet local exercise templates
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  Local multi-channel exercise drafts
                </h3>
                <p className="text-xs text-muted-foreground max-w-3xl">
                  Creates local draft templates for training. No message is transmitted, no agency is represented, and no hardware is activated.
                </p>
              </div>
            </div>

            <button
              onClick={handleExecuteDispatch}
              disabled={dispatchLoading || !surgeCalcData}
              className={`px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition-all flex items-center gap-2.5 shrink-0 cursor-pointer shadow-xl ${
                dispatchLoading
                  ? "bg-secondary text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-600/30 active:scale-95"
              }`}
            >
              {dispatchLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating exercise draft...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Generate exercise draft</span>
                </>
              )}
            </button>
          </div>

          {/* Dispatch Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-card p-5 border-border space-y-4">
              <h4 className="text-sm font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Target Zone & Parameters
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground block mb-1">Target Coastal Region:</label>
                  <input
                    type="text"
                    aria-label="Target coastal region"
                    value={dispatchRegion}
                    onChange={(e) => setDispatchRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">Alert Severity Level:</label>
                  <select
                    aria-label="Exercise alert severity"
                    value={dispatchRiskLevel}
                    onChange={(e) => setDispatchRiskLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/80 border border-border rounded-lg text-foreground font-semibold"
                  >
                    <option value="CRITICAL">🔴 CRITICAL (Exercise category)</option>
                    <option value="HIGH">🟠 HIGH (Alert & Staging)</option>
                    <option value="MODERATE">🟡 MODERATE (Watch & Caution)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Peak Surge:</span>
                    <strong className="text-foreground">{surgeM ?? "Unavailable"}m</strong>
                  </div>
                  <div className="p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Sustained Wind:</span>
                    <strong className="text-foreground">{simWindKts} kt</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Broadcast Channels Selector */}
            <div className="glass-card p-5 border-border space-y-4 md:col-span-2">
              <h4 className="text-sm font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" /> Dispatched Broadcast Channels
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { id: "CAP", name: "OASIS CAP-CP v1.2 XML", desc: "Standardized National Disaster XML alert registry" },
                  { id: "SMS", name: "Cell Broadcast & SMS Gateway", desc: "Trilingual SMS alerts (English, Hindi, Regional)" },
                  { id: "SACHET", name: "Exercise notification JSON", desc: "Local JSON exercise template; no delivery adapter" },
                  { id: "SIREN", name: "Siren exercise template", desc: "No hardware connection or verified tower inventory" },
                  { id: "VHF", name: "Marine NAVTEX / VHF Ch 16", desc: "Local radio exercise template; no transmitter connected" },
                ].map((ch) => {
                  const isSelected = dispatchChannels.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      onClick={() => {
                        if (isSelected) {
                          setDispatchChannels(dispatchChannels.filter(c => c !== ch.id));
                        } else {
                          setDispatchChannels([...dispatchChannels, ch.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? "bg-red-500/10 border-red-500/40 text-foreground"
                          : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center text-xs font-bold ${
                        isSelected ? "bg-red-500 text-white" : "border border-muted-foreground"
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{ch.name}</p>
                        <p className="text-[11px] text-muted-foreground">{ch.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {dispatchLoading && <div role="status" className="glass-card p-6">Generating local exercise drafts. No transmission or hardware activation occurs.</div>}

          {/* Generated Artifacts Viewer */}
          {dispatchResult && (
            <div className="glass-card p-6 border-border space-y-5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      EXERCISE DRAFT CREATED — NOT TRANSMITTED
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">ID: {dispatchResult.dispatch_id}</span>
                  </div>
                  <h4 className="text-base font-bold text-foreground mt-1">
                    Local exercise templates and audit record
                  </h4>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
                  {[
                    { id: "cap", label: "CAP XML" },
                    { id: "sms", label: "SMS Alerts" },
                    { id: "sachet", label: "SACHET" },
                    { id: "siren", label: "Sirens" },
                    { id: "vhf", label: "VHF Marine" },
                    { id: "directives", label: "Directives" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDispatchViewerTab(t.id as typeof dispatchViewerTab)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                        dispatchViewerTab === t.id ? "bg-primary text-primary-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Viewer Tab Contents */}
              {dispatchViewerTab === "cap" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>OASIS CAP-CP v1.2 Standard Emergency XML Document:</span>
                    <button
                      onClick={() => void copyText(dispatchResult.cap_xml)}
                      className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-mono flex items-center gap-1 text-xs cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy XML
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-950 border border-border font-mono text-xs text-emerald-400 overflow-x-auto max-h-80 leading-relaxed scrollbar-thin">
                    {dispatchResult.cap_xml}
                  </pre>
                </div>
              )}

              {dispatchViewerTab === "sms" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(dispatchResult.sms_payload || {}).map(([lang, txt]) => (
                    <div key={lang} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">{lang} Broadcast</span>
                        <button aria-label={`Copy ${lang} exercise text`} onClick={() => void copyText(txt ?? "Translation unavailable")} className="text-xs text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed font-sans">{txt ?? "Translation unavailable"}</p>
                    </div>
                  ))}
                </div>
              )}

              {dispatchViewerTab === "sachet" && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Exercise notification JSON:</span>
                  <pre className="p-4 rounded-xl bg-zinc-950 border border-border font-mono text-xs text-cyan-400 overflow-x-auto max-h-80 leading-relaxed">
                    {JSON.stringify(dispatchResult.sachet_payload, null, 2)}
                  </pre>
                </div>
              )}

              {dispatchViewerTab === "siren" && (
                <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3 text-xs font-mono">
                  <p className="font-bold text-amber-400">Coastal Acoustic Warning Array Activation Protocol:</p>
                  <pre className="text-foreground leading-relaxed">{JSON.stringify(dispatchResult.siren_payload, null, 2)}</pre>
                </div>
              )}

              {dispatchViewerTab === "vhf" && (
                <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">Radio exercise draft (not transmitted):</span>
                  <p className="font-mono text-xs text-foreground leading-relaxed p-3 rounded bg-zinc-950 border border-border">{dispatchResult.vhf_payload}</p>
                </div>
              )}

              {dispatchViewerTab === "directives" && (
                <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">Municipal & Disaster Magistrate Directives:</span>
                  <ul className="space-y-2 text-xs text-foreground">
                    {dispatchResult.municipal_briefing?.map((dir: string, dIdx: number) => (
                      <li key={dIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{dir}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 6: PARAMETRIC INSURANCE & DISASTER RISK FINANCING
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "insurance" && scenarioMode && (
        <div className="space-y-6 animate-in fade-in duration-300">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PARAMETRIC_INSURANCE_TRIGGERS.map((trigger, i) => (
              <button
                type="button"
                aria-label={`Select ${trigger.tier}`}
                aria-pressed={insuranceSimulationTier === i}
                key={i}
                onClick={() => { setInsuranceSimulationTier(i); setThresholdResult(null); }}
                className={`glass-card text-left p-5 border cursor-pointer transition-all space-y-3 ${
                  insuranceSimulationTier === i
                    ? "border-primary ring-1 ring-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 font-mono">
                    {trigger.tier}
                  </span>
                  <span className="text-xs font-black text-emerald-400 font-mono">
                    {trigger.payoutPercentage}% illustrative share
                  </span>
                </div>

                <p className="text-xl font-mono font-black text-foreground">{trigger.hypotheticalPool}</p>

                <div className="space-y-1.5 text-xs text-muted-foreground font-mono pt-1 border-t border-border/40">
                  <p>Wind Trigger: <strong className="text-foreground">&ge; {trigger.windThresholdKnots} kt</strong></p>
                  <p>Surge Trigger: <strong className="text-foreground">&ge; {trigger.surgeThresholdMeters}m</strong></p>
                  <p>Assumed example window: <strong className="text-primary">{trigger.disbursementWindow}</strong></p>
                </div>
              </button>
            ))}
          </div>

          <div className="glass-card p-6 border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-foreground">Illustrative threshold comparison</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">SANDBOX DRILL</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">This educational rule requires both the wind and surge thresholds. No policy eligibility, payout or transfer is established. All pools and timing windows are hypothetical.</p>
              <p role="status" aria-live="polite" className="mt-2 text-sm">
                {!surgeCalcData ? "Evaluation unavailable: a complete current scenario calculation is required."
                  : currentThresholdResult === "MET" ? "Illustrative thresholds met."
                  : currentThresholdResult === "NOT_MET" ? "Illustrative thresholds not met."
                  : currentThresholdResult === "UNAVAILABLE" ? "Evaluation unavailable: invalid inputs."
                  : "Not evaluated for the current inputs."}
              </p>
            </div>
            <button
              onClick={() => {
                if (!surgeCalcData) return;
                setThresholdResult({key:thresholdKey, value:evaluateIllustrativeTrigger(SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS[insuranceSimulationTier], simWindKts, surgeCalcData.peak_surge_height_m)});
              }}
              disabled={!surgeCalcData}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-600/20 whitespace-nowrap"
            >
              Evaluate illustrative thresholds
            </button>
          </div>
        </div>
      )}

      {/* ── Source and scenario briefing modal ─────────────────── */}
      {briefingModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div ref={briefingDialog} role="dialog" aria-modal="true" aria-labelledby="scenario-summary-title" className="glass-card w-full max-w-3xl border-primary/40 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <h3 id="scenario-summary-title" className="text-lg font-bold text-foreground">
                  Deterministic scenario summary
                </h3>
              </div>
              <button aria-label="Close scenario summary" onClick={closeBriefing} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {briefingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-muted-foreground font-mono">Preparing a summary of the selected scenario inputs. No satellite observations are being analyzed.</p>
              </div>
            ) : briefingData ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                  <h4 className="font-bold text-primary text-sm uppercase tracking-wider">Executive Summary</h4>
                  <p className="text-foreground leading-relaxed">{briefingData.executive_summary}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-xs">Scenario review checklist</h4>
                  <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                    {briefingData.action_checklist?.map((act: string, idx: number) => (
                      <li key={idx} className="text-foreground">{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div role="status" className="text-xs text-muted-foreground">
                <p>{briefingError ? "Scenario summary unavailable. No complete result was received." : "No scenario summary has been generated."}</p>
                <button onClick={() => handleGenerateBriefing()} className="mt-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground">Retry scenario summary</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
