"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Building2, CheckCircle2, Coins, Navigation, Radio, ShieldAlert, Siren, Sparkles, Waves, Zap } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { useClipboard } from "@/hooks/useClipboard";
import {
  EVACUATION_ROUTES as SCENARIO_EVACUATION_ROUTES,
  MEDICAL_SHELTERS as SCENARIO_MEDICAL_SHELTERS,
  PARAMETRIC_INSURANCE_TRIGGERS as SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS,
  POWER_SUBSTATIONS as SCENARIO_POWER_SUBSTATIONS,
  calculateRouteVulnerability,
  calculateShelterSuitability,
  calculateSubstationVulnerability,
  evaluateIllustrativeTrigger,
} from "@/lib/infrastructureData";
import type { InfrastructureTab } from "@/features/infrastructure/types";
import { useInfrastructureData } from "@/features/infrastructure/hooks/useInfrastructureData";
import { useScenarioCalculation } from "@/features/infrastructure/hooks/useScenarioCalculation";
import { useBriefing } from "@/features/infrastructure/hooks/useBriefing";
import { useDispatchExercise } from "@/features/infrastructure/hooks/useDispatchExercise";
import { PowerGridPanel } from "@/features/infrastructure/components/PowerGridPanel";
import { EvacuationRoutesPanel } from "@/features/infrastructure/components/EvacuationRoutesPanel";
import { MedicalFacilitiesPanel } from "@/features/infrastructure/components/MedicalFacilitiesPanel";
import { SurgeSimulationPanel } from "@/features/infrastructure/components/SurgeSimulationPanel";
import { DispatchExercisePanel } from "@/features/infrastructure/components/DispatchExercisePanel";
import { InsuranceScenarioPanel } from "@/features/infrastructure/components/InsuranceScenarioPanel";
import { BriefingModal } from "@/features/infrastructure/components/BriefingModal";

function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

function readTab(): InfrastructureTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "surge") return "surge_rain";
  if (tab === "routes" || tab === "shelters" || tab === "surge_rain" || tab === "dispatch" || tab === "insurance") {
    return tab;
  }
  return "grid";
}

export default function InfrastructurePage() {
  const { copyText, copyStatus } = useClipboard();
  const [scenarioMode, setScenarioMode] = useState(false);
  const { selectedCycloneId, selectCyclone } = useActiveCyclone();
  const { getConvertedKnots, getConvertedKmh, getConvertedCategory, getSourceBadge } = useDataSource();
  const sourceBadge = getSourceBadge();

  const { system, loading, sourceError, cyclonesList, toast, showToast, retrySource } =
    useInfrastructureData(selectedCycloneId);

  const queryTab = useSyncExternalStore(subscribeLocation, readTab, () => "grid" as InfrastructureTab);
  const [tabOverride, setActiveTab] = useState<InfrastructureTab | null>(null);
  const activeTab = tabOverride ?? queryTab;

  const [infraFilter, setInfraFilter] = useState<"all" | "critical" | "high">("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [insuranceSimulationTier, setInsuranceSimulationTier] = useState<number>(0);
  const [thresholdResult, setThresholdResult] = useState<{
    key: string;
    value: ReturnType<typeof evaluateIllustrativeTrigger>;
  } | null>(null);

  const {
    simPressureHpa,
    setSimPressureHpa,
    simWindKts,
    setSimWindKts,
    simTideM,
    setSimTideM,
    simAngleDeg,
    setSimAngleDeg,
    simRainMm,
    scenarioKey,
    surgeCalcData,
    surgeSectors,
    rainfallPathways,
    scenarioError,
    retryScenario,
  } = useScenarioCalculation(scenarioMode, selectedCycloneId, system);

  const rawKnots = scenarioMode ? simWindKts : system?.intensity_knots ?? null;
  const knots = getConvertedKnots(rawKnots);
  const kmh = getConvertedKmh(rawKnots);
  const displayCategory = getConvertedCategory(rawKnots);
  const surgeM = scenarioMode ? surgeCalcData?.peak_surge_height_m ?? null : null;

  const {
    briefingModalOpen,
    briefingLoading,
    briefingData,
    briefingError,
    briefingDialog,
    generateBriefing,
    closeBriefing,
  } = useBriefing({
    scenarioMode,
    scenarioKey,
    system,
    surgeCalcData,
    displayCategory,
    knots,
    kmh,
  });

  const dispatch = useDispatchExercise({
    scenarioMode,
    scenarioKey,
    system,
    surgeCalcData,
    simWindKts,
    showToast,
  });

  const thresholdKey = JSON.stringify([scenarioKey, insuranceSimulationTier, surgeCalcData?.peak_surge_height_m]);
  const currentThresholdResult =
    scenarioMode && surgeCalcData && thresholdResult?.key === thresholdKey ? thresholdResult.value : null;

  const powerSubstations = useMemo(() => (scenarioMode ? SCENARIO_POWER_SUBSTATIONS : []), [scenarioMode]);
  const medicalShelters = useMemo(() => (scenarioMode ? SCENARIO_MEDICAL_SHELTERS : []), [scenarioMode]);
  const evacuationRoutes = useMemo(() => (scenarioMode ? SCENARIO_EVACUATION_ROUTES : []), [scenarioMode]);
  const parametricTriggers = useMemo(
    () => (scenarioMode ? SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS : []),
    [scenarioMode]
  );

  const analyzedSubstations = useMemo(
    () =>
      powerSubstations.map((sub) => ({
        ...sub,
        ivf: surgeCalcData
          ? calculateSubstationVulnerability(sub, simWindKts, surgeCalcData.peak_surge_height_m, simRainMm)
          : null,
      })),
    [powerSubstations, surgeCalcData, simWindKts, simRainMm]
  );

  const filteredSubstations = useMemo(
    () =>
      analyzedSubstations.filter((sub) => {
        const matchesCriticality =
          infraFilter === "all" ||
          (infraFilter === "critical" && sub.ivf?.riskCategory === "CRITICAL") ||
          (infraFilter === "high" && (sub.ivf?.riskCategory === "CRITICAL" || sub.ivf?.riskCategory === "HIGH"));
        const matchesRegion = regionFilter === "ALL" || sub.region.toLowerCase().includes(regionFilter.toLowerCase());
        const matchesSearch =
          !searchFilter ||
          sub.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
          sub.type.toLowerCase().includes(searchFilter.toLowerCase());
        return matchesCriticality && matchesRegion && matchesSearch;
      }),
    [analyzedSubstations, infraFilter, regionFilter, searchFilter]
  );

  const analyzedRoutes = useMemo(
    () =>
      evacuationRoutes.map((r) => ({
        ...r,
        vuln: surgeCalcData
          ? calculateRouteVulnerability(r, simWindKts, surgeCalcData.peak_surge_height_m, simRainMm)
          : null,
      })),
    [evacuationRoutes, surgeCalcData, simWindKts, simRainMm]
  );

  const filteredShelters = useMemo(
    () =>
      medicalShelters
        .map((s) => ({
          ...s,
          suitability: calculateShelterSuitability(s, simWindKts),
        }))
        .filter((shl) => {
          const matchesRegion = regionFilter === "ALL" || shl.region.toLowerCase().includes(regionFilter.toLowerCase());
          const matchesSearch =
            !searchFilter ||
            shl.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
            shl.type.toLowerCase().includes(searchFilter.toLowerCase());
          return matchesRegion && matchesSearch;
        }),
    [medicalShelters, regionFilter, searchFilter, simWindKts]
  );

  const totalShelterCapacity = useMemo(
    () => medicalShelters.reduce((acc, s) => acc + s.capacityPersons, 0),
    [medicalShelters]
  );
  const totalMedicalBeds = useMemo(
    () => medicalShelters.reduce((acc, s) => acc + s.medicalBeds, 0),
    [medicalShelters]
  );
  const totalGridCapacity = useMemo(
    () => powerSubstations.reduce((acc, s) => acc + s.capacityMVA, 0),
    [powerSubstations]
  );
  const criticalSubstationsCount = surgeCalcData
    ? analyzedSubstations.filter((s) => s.ivf?.riskCategory === "CRITICAL").length
    : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading coastal infrastructure and resilience telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="glass-card p-4 border-border" role="status">
        <p>
          {scenarioMode
            ? "ILLUSTRATIVE SCENARIO — asset names, coordinates, capacities and risk calculations are unverified examples."
            : "Operational status not verified. No authorized infrastructure observations are connected."}
        </p>
        {system && (
          <p>
            Source: {system.source ?? "Unavailable"} · Observation: {system.observation_time_utc ?? "Unavailable"} ·{" "}
            {system.is_stale ? "STALE" : "Check source freshness"}
          </p>
        )}
        <label className="inline-flex items-center gap-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={scenarioMode}
            onChange={(e) => {
              setScenarioMode(e.target.checked);
              setThresholdResult(null);
            }}
          />
          Show illustrative scenario assets
        </label>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
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
            Inspect unavailable field observations or opt into illustrative infrastructure and surge scenarios. Exercise
            communications remain local drafts.
          </p>

          <div className="mt-3 p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wide text-[10px] block mb-0.5">
                Field Operational Verification Advisory
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Example asset names, locations and capacities have no verified source inventory. Current operational
                attributes remain unavailable until authorized field observations are supplied.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 z-10 shrink-0 flex-wrap">
          <select
            aria-label="Selected cyclone"
            value={selectedCycloneId || system?.id}
            onChange={(e) => {
              const storm = cyclonesList.find((s) => s.id === e.target.value);
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
            type="button"
            onClick={() => void generateBriefing("en")}
            disabled={!surgeCalcData || briefingLoading}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
            <span>Scenario summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dispatch")}
            className="px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Siren className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
            <span>Exercise drafts</span>
          </button>
        </div>
      </div>

      {sourceError && (
        <div role="status" className="glass-card p-4 text-sm">
          <p>Source unavailable. Operational conditions are not verified.</p>
          <button type="button" onClick={retrySource} className="mt-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground cursor-pointer">
            Retry source
          </button>
        </div>
      )}
      {scenarioMode && scenarioError && (
        <div role="status" className="glass-card p-4 text-sm">
          <p>Scenario calculation unavailable. No complete result was received.</p>
          <button type="button" onClick={retryScenario} className="mt-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground cursor-pointer">
            Retry scenario
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? "glass-card p-3 text-sm" : "sr-only"}>
        {copyStatus}
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              {scenarioMode
                ? criticalSubstationsCount === null
                  ? "Exposure unavailable"
                  : `${criticalSubstationsCount} critical scenario nodes`
                : "Unverified inventory"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Power Transmission Grid IVF</p>
          <p className="text-2xl font-mono font-black text-foreground">
            {scenarioMode ? `${(totalGridCapacity / 1000).toFixed(1)}k (assumed)` : "Unavailable"}{" "}
            <span className="text-xs font-normal text-muted-foreground">MVA Capacity</span>
          </p>
          <p className="text-[11px] text-amber-400 font-semibold">Multi-factor: Flood (30%) + Wind (25%) + Elev (15%)</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Waves className="w-5 h-5" aria-hidden="true" />
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
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              {scenarioMode ? `${medicalShelters.length} illustrative shelters` : "Unverified inventory"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Cyclone Shelters Capacity</p>
          <p className="text-2xl font-mono font-black text-foreground">
            {scenarioMode ? `${totalShelterCapacity.toLocaleString()} (assumed)` : "Unavailable"}{" "}
            <span className="text-xs font-normal text-muted-foreground">persons</span>
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold">
            {scenarioMode ? `${totalMedicalBeds} assumed beds` : "Medical beds unavailable"}
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Radio className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              OASIS CAP-CP
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Early Warning Broadcast</p>
          <p className="text-2xl font-mono font-black text-foreground">5 Channels</p>
          <p className="text-[11px] text-red-400 font-semibold">CAP XML • SMS • SACHET • Siren • VHF</p>
        </div>
      </div>

      <div role="group" aria-label="Infrastructure analysis sections" className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          aria-pressed={activeTab === "grid"}
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "grid"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" aria-hidden="true" /> Power Grid IVF Scoring ({powerSubstations.length})
        </button>

        <button
          type="button"
          aria-pressed={activeTab === "routes"}
          onClick={() => setActiveTab("routes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "routes"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Navigation className="w-4 h-4 text-blue-400" aria-hidden="true" /> Road scenario exposure ({evacuationRoutes.length})
        </button>

        <button
          type="button"
          aria-pressed={activeTab === "shelters"}
          onClick={() => setActiveTab("shelters")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "shelters"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Cyclone Shelters & Decisions ({medicalShelters.length})
        </button>

        <button
          type="button"
          aria-pressed={activeTab === "surge_rain"}
          onClick={() => setActiveTab("surge_rain")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "surge_rain"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Waves className="w-4 h-4 text-cyan-400" aria-hidden="true" /> Storm Surge & Drainage Choke Points
        </button>

        <button
          type="button"
          aria-pressed={activeTab === "dispatch"}
          onClick={() => setActiveTab("dispatch")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "dispatch"
              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
              : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
          }`}
        >
          <Siren className="w-4 h-4 text-red-300 animate-pulse" aria-hidden="true" /> Multi-Channel Advisory Dispatch
        </button>

        <button
          type="button"
          aria-pressed={activeTab === "insurance"}
          onClick={() => setActiveTab("insurance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "insurance"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Coins className="w-4 h-4 text-cyan-400" aria-hidden="true" /> Parametric Insurance (₹455 Cr)
        </button>
      </div>

      {activeTab === "grid" && (
        <PowerGridPanel
          totalSubstationsCount={powerSubstations.length}
          filteredSubstations={filteredSubstations}
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
          infraFilter={infraFilter}
          onInfraFilterChange={setInfraFilter}
        />
      )}

      {activeTab === "routes" && <EvacuationRoutesPanel routes={analyzedRoutes} />}

      {activeTab === "shelters" && (
        <MedicalFacilitiesPanel
          shelters={filteredShelters}
          searchFilter={searchFilter}
          onSearchFilterChange={setSearchFilter}
          regionFilter={regionFilter}
          onRegionFilterChange={setRegionFilter}
        />
      )}

      {activeTab === "surge_rain" && scenarioMode && (
        <SurgeSimulationPanel
          basin={system?.basin}
          surgeCalcData={surgeCalcData}
          surgeSectors={surgeSectors}
          rainfallPathways={rainfallPathways}
          simWindKts={simWindKts}
          onSimWindKtsChange={setSimWindKts}
          simPressureHpa={simPressureHpa}
          onSimPressureHpaChange={setSimPressureHpa}
          simTideM={simTideM}
          onSimTideMChange={setSimTideM}
          simAngleDeg={simAngleDeg}
          onSimAngleDegChange={setSimAngleDeg}
          simRainMm={simRainMm}
          briefingLoading={briefingLoading}
          onGenerateBriefing={() => void generateBriefing("en")}
        />
      )}

      {activeTab === "dispatch" && scenarioMode && (
        <DispatchExercisePanel
          dispatchRegion={dispatch.dispatchRegion}
          onDispatchRegionChange={dispatch.setDispatchRegion}
          dispatchRiskLevel={dispatch.dispatchRiskLevel}
          onDispatchRiskLevelChange={dispatch.setDispatchRiskLevel}
          dispatchChannels={dispatch.dispatchChannels}
          onToggleChannel={dispatch.toggleChannel}
          dispatchLoading={dispatch.dispatchLoading}
          dispatchResult={dispatch.dispatchResult}
          dispatchViewerTab={dispatch.dispatchViewerTab}
          onDispatchViewerTabChange={dispatch.setDispatchViewerTab}
          onExecuteDispatch={() => void dispatch.executeDispatch()}
          surgeCalcData={surgeCalcData}
          simWindKts={simWindKts}
          onCopyText={(txt) => void copyText(txt)}
        />
      )}

      {activeTab === "insurance" && scenarioMode && (
        <InsuranceScenarioPanel
          triggers={parametricTriggers}
          selectedTierIndex={insuranceSimulationTier}
          onSelectTierIndex={(idx) => {
            setInsuranceSimulationTier(idx);
            setThresholdResult(null);
          }}
          surgeCalcData={surgeCalcData}
          simWindKts={simWindKts}
          currentThresholdResult={currentThresholdResult}
          onEvaluateThresholds={() => {
            if (!surgeCalcData) return;
            setThresholdResult({
              key: thresholdKey,
              value: evaluateIllustrativeTrigger(
                SCENARIO_PARAMETRIC_INSURANCE_TRIGGERS[insuranceSimulationTier],
                simWindKts,
                surgeCalcData.peak_surge_height_m
              ),
            });
          }}
        />
      )}

      <BriefingModal
        open={briefingModalOpen}
        loading={briefingLoading}
        data={briefingData}
        error={briefingError}
        dialogRef={briefingDialog}
        onClose={closeBriefing}
        onRetry={() => void generateBriefing("en")}
      />
    </div>
  );
}
