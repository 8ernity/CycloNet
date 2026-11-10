"use client";
import { formatCoordinates } from "@/lib/coordinates";
import type { WeatherSystem as ActiveSystem } from "@/types/api";
import { type IngestStatus, type CatalogItem } from "@/types/api";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertCircle, CloudRain, MapPin, Navigation, Wind, ShieldCheck, Play, Activity, RefreshCw, Radio } from "lucide-react";
import dynamic from 'next/dynamic';

import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { useCycloneWebSocket } from "@/hooks/useCycloneWebSocket";

import { apiFetch, ApiClientError } from "@/lib/api";

const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-muted-foreground animate-pulse">Loading Live Map...</div>
});



const getStormDetails = (sys: ActiveSystem | null) => {
  const info = sys?.landfall_info;
  const landfallPoint = sys?.track_forecast?.find(point => point.is_landfall);
  // Forecast waypoints alone do not establish landfall or coastal impact.
  return {
    basinName: sys?.basin || "Not available",
    landfall: info?.landfall_time_utc || landfallPoint?.label || "Not available",
    landfallLocation: info?.landfall_location || "Not available",
    landfallStatus: info?.status || (sys?.is_landfall_completed ? "Landfall Completed" : "Unknown"),
    isCompleted: !!sys?.is_landfall_completed,
    surge: info?.storm_surge_m ?? "Not available",
    decay: info?.inland_decay || "Not available",
    impactSector: info?.impact_sector || info?.landfall_location || "Not available",
  };
};

function telemetryMode(system: ActiveSystem | null) {
  if (!system) return "UNAVAILABLE";
  if (system.is_simulation || system.source_type === "DEMO" || system.origin_type === "OPERATIONAL_DRILL") return "SIMULATION";
  if (system.telemetry_type === "HISTORICAL_BEST_TRACK") return "HISTORICAL";
  if (system.is_stale || system.reconciliation_status === "ACTIVE_STALE") return "STALE";
  if (system.reconciliation_status === "ACTIVE_VERIFIED") return "LIVE";
  return "UNVERIFIED";
}

export default function DashboardLiveMonitoringPage() {
  const { selectedCycloneId, selectCyclone, clearSelectedCyclone } = useActiveCyclone();
  const { getConvertedKnots, getConvertedKmh, getConvertedGusts, getConvertedCategory, getSourceBadge } = useDataSource();
  const [activeSystem, setActiveSystem] = useState<ActiveSystem | null>(null);
  const [isSimulation, setIsSimulation] = useState(false);
  const activeRequest = useRef(0);
  const [, setLoading] = useState(true);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus | null>(null);
  const [isSyncingIngest, setIsSyncingIngest] = useState(false);
  const [cyclonesList, setCyclonesList] = useState<CatalogItem[]>([]);

  const { isConnected: isWsConnected, radarAngle } = useCycloneWebSocket();

  const sourceBadge = getSourceBadge();
  const displayKnots = activeSystem ? getConvertedKnots(activeSystem.intensity_knots) : 0;
  const displayKmh = activeSystem ? getConvertedKmh(activeSystem.intensity_knots) : 0;
  const displayGusts = activeSystem ? getConvertedGusts() : null;
  const displayCategory = activeSystem ? getConvertedCategory(activeSystem.intensity_knots) : "Not available";

  useEffect(() => {
    apiFetch<ActiveSystem[]>("/api/cyclones")
      .then(data => {
        if (Array.isArray(data)) setCyclonesList(data);
      })
      .catch(() => {});
  }, []);

  const fetchIngestStatus = () => {
    apiFetch<IngestStatus>("/api/ingest/status")
      .then(data => setIngestStatus(data))
      .catch(() => setIngestStatus(null));
  };

  const [ingestError, setIngestError] = useState<string | null>(null);

  const handleSyncFeeds = async () => {
    setIsSyncingIngest(true);
    setIngestError(null);
    try {
      const data = await apiFetch<IngestStatus>("/api/ingest/status");
      setIngestStatus(data);
      clearSelectedCyclone();
      await fetchActiveSystems(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 429) {
        setIngestError("Too many refreshes. Please wait a moment and try again.");
      } else {
        setIngestError("Live data could not be refreshed. The feed may be unavailable; try again shortly.");
      }
    } finally {
      setIsSyncingIngest(false);
    }
  };

  const fetchActiveSystems = useCallback(async (simulate: boolean = false, cycloneId?: string | null) => {
    const requestId = ++activeRequest.current;
    setLoading(true);
    let path = "/api/active-systems";
    const targetId = cycloneId || (simulate ? selectedCycloneId : null);
    if (simulate || targetId) {
      path += `?simulate=true${targetId ? `&cyclone_id=${encodeURIComponent(targetId)}` : ""}`;
    }
    try {
      const data = await apiFetch<ActiveSystem[]>(path);
      if (requestId !== activeRequest.current) return;
      if (data && data.length > 0) {
        setActiveSystem(data[0]);
        setIsSimulation(telemetryMode(data[0]) === "SIMULATION");
      } else {
        setActiveSystem(null);
        setIsSimulation(false);
      }
    } catch (err) {
      if (requestId !== activeRequest.current) return;
      setActiveSystem(null);
      setIsSimulation(false);
      console.warn("Notice: Active systems feed temporarily unavailable or initializing:", err);
    } finally {
      if (requestId === activeRequest.current) setLoading(false);
    }
  }, [selectedCycloneId]);

  const invalidateActiveRequest = useCallback(() => { activeRequest.current++; }, []);
  useEffect(() => {
    fetchIngestStatus();
    const interval = setInterval(() => {
      fetchIngestStatus();
      fetchActiveSystems(Boolean(selectedCycloneId), selectedCycloneId);
    }, 30000);
    return () => { clearInterval(interval); invalidateActiveRequest(); };
  }, [selectedCycloneId, fetchActiveSystems, invalidateActiveRequest]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const simParam = params.get("simulate");
      if (simParam && simParam !== "true") {
        selectCyclone(simParam);
      }
    }
  }, [selectCyclone]);

  useEffect(() => {
    if (selectedCycloneId) {
      fetchActiveSystems(true, selectedCycloneId);
    } else {
      fetchActiveSystems(false);
    }
  }, [selectedCycloneId, fetchActiveSystems]);

  const stormMeta = getStormDetails(activeSystem);
  const mode = telemetryMode(activeSystem);
  const modeLabel = {UNAVAILABLE: "BASIN STATUS UNCERTAIN", SIMULATION: "SYNTHETIC EXERCISE DRILL",
    HISTORICAL: "HISTORICAL ARCHIVE REPLAY", STALE: "STALE SOURCE OBSERVATION",
    LIVE: "CURRENT SOURCE OBSERVATION", UNVERIFIED: "SOURCE STATUS UNVERIFIED"}[mode];
  const modeDescription = {UNAVAILABLE: "No current source observations are available.",
    SIMULATION: "Synthetic scenario for demonstration; not a measured storm.",
    HISTORICAL: "Historical best-track replay. Not a current storm.",
    STALE: "Retained source observation; current conditions are unverified.",
    LIVE: "Current source observation for experimental decision support.",
    UNVERIFIED: "Source provenance or freshness could not be verified."}[mode];
  const modeClass = mode === "SIMULATION" ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
    : mode === "LIVE" ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
    : mode === "HISTORICAL" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
    : "bg-amber-500/15 text-amber-500 border-amber-500/30";

  // Expose live UI screen telemetry to window context for CycloNet AI assistant
  useEffect(() => {
    if (typeof window !== "undefined") {
      const meta = getStormDetails(activeSystem);
      window.__cyclonet_current_context = {
        page: "Live Monitoring",
        isSimulation,
        activeSystem: activeSystem ? {
          id: activeSystem.id,
          name: activeSystem.name,
          category: activeSystem.category,
          basin: meta.basinName,
          lat: activeSystem.lat,
          lon: activeSystem.lon,
          coordinates: formatCoordinates(activeSystem.lat, activeSystem.lon),
          intensity_knots: activeSystem.intensity_knots,
          wind_kmh: (activeSystem.intensity_knots == null ? null : Math.round(activeSystem.intensity_knots * 1.852)),
          gusting_kmh: activeSystem.gusts_kmh ?? null,
          track_points_count: activeSystem.track_forecast?.length || 0,
          current_position_label: formatCoordinates(activeSystem.lat, activeSystem.lon),
          landfall: meta.landfall,
          landfallLocation: meta.landfallLocation,
          simulation_active: isSimulation,
        } : null,
        basin_status: ingestStatus?.basin_status ?? "STATUS_UNCERTAIN",
        observation_status: mode
      };
    }
  }, [activeSystem, isSimulation, ingestStatus, mode]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {ingestError && (
        <div className="p-3 px-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between shadow-xs">
          <span className="font-medium">⚠️ {ingestError}</span>
          <button onClick={() => setIngestError(null)} className="text-xs font-semibold hover:underline cursor-pointer ml-4">Dismiss</button>
        </div>
      )}

      {/* Live Ingestion Feed Bar */}
      <div className="p-3 px-4 rounded-xl bg-surface-glass border border-border backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            <span className="font-semibold text-foreground">Live Ingestion:</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {isWsConnected ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[11px] text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                WS Live ({Math.round(radarAngle)}° Sweep Sim)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700 font-mono text-[11px] text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                HTTP Polling
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-secondary border border-border font-mono text-[11px] text-muted-foreground font-medium">
              IMD RSMC: {ingestStatus?.sources_status?.IMD_RSMC ?? "UNAVAILABLE"}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-secondary border border-border font-mono text-[11px] text-muted-foreground font-medium">
              JTWC/NOAA: {ingestStatus?.sources_status?.JTWC_NOAA ?? "UNAVAILABLE"}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              Satellite observations unavailable
            </span>
          </div>
          {ingestStatus?.last_sync && (
            <span className="hidden sm:inline text-muted-foreground text-[11px]">
              • Last Sync: {new Date(ingestStatus.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Storm or live source selection"
            value={
              !activeSystem
                ? "LIVE_SCAN"
                : (selectedCycloneId || activeSystem.id)
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === "LIVE_SCAN") {
                clearSelectedCyclone();
                fetchActiveSystems(false);
              } else {
                selectCyclone(val);
                fetchActiveSystems(true, val);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
          >
            <option value="LIVE_SCAN">
              {mode === "LIVE" ? `Current source: ${activeSystem?.name}` : "Live ingestion: check source status"}
            </option>
            {cyclonesList.map((c) => {
              const displayName = c.name.startsWith("Cyclone") || c.name.startsWith("Deep") || c.name.startsWith("Super") 
                ? c.name 
                : `Cyclone ${c.name}`;
              const isDrill = c.is_simulation;
              return (
                <option key={c.id} value={c.id}>
                  {isDrill ? "🧪 Drill: " : "🏛️ Historical: "}{displayName} ({c.year})
                </option>
              );
            })}
          </select>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${modeClass}`} title={modeDescription}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {modeLabel}
          </span>

          <button
            onClick={handleSyncFeeds}
            disabled={isSyncingIngest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95 shadow-xs"
            title="Reload the latest backend observations. Starting a new ingestion job requires administrator access."
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingIngest ? "animate-spin" : ""}`} />
            <span>{isSyncingIngest ? "Refreshing..." : "Refresh live data"}</span>
          </button>
        </div>
      </div>

      {/* Explicit Mode & Civil Defense Advisory Banner (#34 & #36) */}
      <div className="p-3 px-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-secondary/30 border-border">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] uppercase tracking-wider border ${modeClass}`}>
            {modeLabel}
          </span>
          <span className="text-muted-foreground">{modeDescription}</span>
        </div>
        <div className="text-[10.5px] text-muted-foreground md:text-right shrink-0">
          <span className="font-semibold text-foreground/80">Civil Defense Advisory:</span> Statutory evacuation directives follow IMD (RSMC New Delhi) and NDMA orders.
        </div>
      </div>

      {/* Unavailable source status with explicit historical replay selection */}
      {!activeSystem && (
        <div className="glass-card p-4 sm:p-5 border-emerald-500/30 bg-emerald-950/10 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  NO VERIFIED CURRENT OBSERVATIONS
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Source coverage or freshness unverified
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current basin conditions could not be verified. Retry live sources or explicitly choose a historical simulation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => {
                selectCyclone("BOB03-2020");
                fetchActiveSystems(true, "BOB03-2020");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Play className="w-3 h-3 fill-current" />
              Load Super Cyclone Amphan
            </button>
            <button
              onClick={() => {
                selectCyclone("ARB01-2023");
                fetchActiveSystems(true, "ARB01-2023");
              }}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-all cursor-pointer"
            >
              Cyclone Biparjoy
            </button>
          </div>
        </div>
      )}

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat Card 1: System Status */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                {activeSystem ? "Active System" : "Basin Status"}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem ? activeSystem.name : "Current status unavailable"}
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${activeSystem ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"}`}>
              {activeSystem ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-2 text-sm">
            {activeSystem ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/20 font-semibold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                {displayCategory}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Basin conditions uncertain
              </span>
            )}
          </div>
        </div>

        {/* Stat Card 2: Surface / Sustained Winds */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                {activeSystem ? `Max Sustained Wind (${sourceBadge.shortLabel})` : "Prevailing Basin Winds"}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem
                  ? `${displayKmh ?? "Not available"} km/h (${displayKnots ?? "Not available"} kts)`
                  : "Not available"}
              </h3>
            </div>
            <div className="p-2 bg-secondary rounded-lg border border-border">
              <Wind className="w-5 h-5 text-foreground" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {activeSystem ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Gusting to {displayGusts ?? "Not available"} km/h
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">No measured wind available</span>
            )}
            <span>• {sourceBadge.avgWindow}</span>
          </div>
        </div>

        {/* Stat Card 3: Location / Basins */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                {activeSystem ? "Current Center Fix" : "Monitored Basins"}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem
                  ? formatCoordinates(activeSystem.lat, activeSystem.lon)
                  : "Arabian Sea & BoB"}
              </h3>
            </div>
            <div className="p-2 bg-secondary rounded-lg border border-border">
              <MapPin className="w-5 h-5 text-foreground" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{stormMeta.basinName}</span>
          </div>
        </div>

        {/* Stat Card 4: Outlook */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                {activeSystem ? "Est. Landfall" : "5-Day Cyclogenesis"}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {stormMeta.landfall}
              </h3>
            </div>
            <div className="p-2 bg-secondary rounded-lg border border-border">
              <Navigation className="w-5 h-5 text-foreground" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{stormMeta.landfallLocation}</span>
          </div>
        </div>
      </div>

      {/* Main Map & Sidebar Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map Container */}
        <div className="glass-card lg:col-span-2 min-h-[520px] flex flex-col p-1 relative overflow-hidden">
          {/* Interactive Leaflet Map */}
          <div className="w-full h-full rounded-xl relative overflow-hidden border border-border/50 z-0">
            <MapComponent activeSystem={activeSystem} />
          </div>

          {/* Bottom Simulation Prompt when no storm is active */}
          {!activeSystem && (
            <div className="absolute bottom-4 left-4 right-4 z-10 p-3 px-4 rounded-xl bg-card/95 backdrop-blur-md border border-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Activity className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>Current storm status is unavailable. Historical visualization remains available.</span>
              </div>
              <button
                onClick={() => fetchActiveSystems(true)}
                className="px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-xs hover:scale-[1.02]"
              >
                <Play className="w-3.5 h-3.5 fill-current text-amber-500 dark:text-amber-400" />
                Load Biparjoy (2023) Simulation
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar Details */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-lg border-b border-border pb-3 mb-4">
              {activeSystem ? "Latest Storm Bulletins" : "Source Availability"}
            </h3>
            <div className="space-y-4">
              {activeSystem ? (
                (() => {


                  const dynamicBulletins = [
                    { time: activeSystem.observation_time_utc ?? "Issue time not available",
                      text: `${activeSystem.name}: ${activeSystem.intensity_knots ?? "Not available"} kt. Source: ${activeSystem.source ?? "Not available"}.`, type: "info" },
                    { time: "Experimental analysis", text: "Landfall, rainfall, surge and protective actions require current official advisories.", type: "info" },
                  ];

                  return dynamicBulletins.map((bulletin, i) => (
                    <div key={i} className="flex gap-3 relative">
                      <div className="mt-1">
                        {bulletin.type === 'alert' ? 
                          <AlertCircle className="w-4 h-4 text-destructive" /> : 
                          <CloudRain className="w-4 h-4 text-blue-500" />
                        }
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">{bulletin.time}</span>
                        <p className="text-sm text-foreground/90 mt-0.5">{bulletin.text}</p>
                      </div>
                    </div>
                  ));
                })()
              ) : (
                [
                  { time: "Source unavailable", text: "No verified current observations are available. Basin conditions are uncertain; consult official agencies.", type: "info" },
                ].map((bulletin, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className="mt-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">{bulletin.time}</span>
                      <p className="text-sm text-foreground/90 mt-0.5">{bulletin.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <a 
              href={activeSystem ? `/forecast?cyclone_id=${encodeURIComponent(activeSystem.id)}` : "/forecast"} 
              className="w-full mt-6 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-sm font-semibold transition-all text-foreground flex items-center justify-center gap-2 text-center cursor-pointer shadow-xs hover:scale-[1.005]"
            >
              <span>View complete analytics & forecast</span>
            </a>
          </div>

          <div className="glass-card p-5 flex-1">
             <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
               <h3 className="font-heading font-semibold text-lg">
                {activeSystem ? "Telemetry & Model Attribution" : "System Diagnostics"}
               </h3>
               {activeSystem && (
                 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
                   {activeSystem.telemetry_type || modeLabel}
                 </span>
               )}
             </div>

             {activeSystem ? (
               <div className="space-y-4">
                 <div className="bg-secondary/30 p-3 rounded-xl border border-border/60 text-xs space-y-2">
                   <div className="flex justify-between items-center text-[11px]">
                     <span className="text-muted-foreground">0h Center Eye Fix:</span>
                     <span className="font-semibold text-foreground flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                       {mode === "SIMULATION" ? "Simulated" : "Source fix"} ({formatCoordinates(activeSystem.lat, activeSystem.lon)})
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-[11px]">
                     <span className="text-muted-foreground">Sustained Core Wind:</span>
                     <span className="font-semibold text-foreground">
                       {mode === "SIMULATION" ? "Simulated" : "Source value"} ({activeSystem.intensity_knots ?? "Not available"} KT)
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-[11px]">
                     <span className="text-muted-foreground">Dvorak Intensity:</span>
                     <span className="font-mono font-bold text-primary">
                       {activeSystem.dvorak_t || "Not available"} <span className="font-normal text-[10px] text-muted-foreground">(Parametric Wind Scale)</span>
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-[11px]">
                     <span className="text-muted-foreground">Forward Trajectory:</span>
                     <span className="font-semibold text-foreground text-[10.5px]">
                       {activeSystem.track_generation_method ?? "Forecast unavailable"}
                     </span>
                   </div>
                 </div>

                 <p className="text-[11px] text-muted-foreground leading-relaxed">
                   ℹ️ <strong className="text-foreground">Transparency Note:</strong> Live center fixes and core wind speeds are ingested from external feeds. Forward tracks and the Dvorak T-number are CycloNet-derived parametric estimates. Experimental image classification is available in the <a href="/classification" className="text-primary underline font-medium">Classification</a> tab.
                 </p>

                 <div className="space-y-3 pt-2 border-t border-border/50">
                   <div>
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-muted-foreground">Telemetry Provenance</span>
                       <span className="font-semibold text-emerald-600 dark:text-emerald-400">Accuracy not independently verified</span>
                     </div>
                     <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                       <div className="h-full bg-emerald-500 w-0 rounded-full" />
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between text-xs mb-1.5">
                       <span className="text-muted-foreground">Trajectory Kinematic Fit</span>
                       <span className="font-semibold text-foreground">Not independently validated</span>
                     </div>
                     <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                       <div className="h-full bg-primary/70 w-0 rounded-full" />
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Satellite Ingestion Status</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Unavailable</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-emerald-500 w-0 rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Organized Vortex Anomaly</span>
                      <span className="font-semibold text-foreground">Not available</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary/40 w-[0%] rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">5-Day Cyclogenesis Risk (IMD TWO)</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Not available</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      No current agency-issued outlook was retrieved. Missing data does not establish calm.
                    </p>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[0%] rounded-full" />
                    </div>
                  </div>
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
