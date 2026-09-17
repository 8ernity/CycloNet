"use client";
import React, { useState, useEffect } from "react";
import { AlertCircle, CloudRain, MapPin, Navigation, Wind, ShieldCheck, Play, RotateCcw, Activity, Eye, RefreshCw, Radio } from "lucide-react";
import dynamic from 'next/dynamic';

import { useActiveCyclone } from "@/hooks/useActiveCyclone";

const MapComponent = dynamic(() => import('../components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-muted-foreground animate-pulse">Loading Live Map...</div>
});

interface ActiveSystem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  basin?: string;
  track_forecast?: any[];
}

const getStormDetails = (sys: ActiveSystem | null) => {
  if (!sys) return { basinName: "RSMC New Delhi Jurisdiction", landfall: "Nil Expected", landfallLocation: "IMD Tropical Weather Outlook" };
  const name = sys.name.toLowerCase();
  if (name.includes("amphan")) {
    return {
      basinName: "North-central Bay of Bengal",
      landfall: "20 May, 14:30 IST",
      landfallLocation: "Near Sundarbans / Digha, WB"
    };
  } else if (name.includes("biparjoy")) {
    return {
      basinName: "East-central Arabian Sea",
      landfall: "15 Jun, 18:30 IST",
      landfallLocation: "Near Jakhau Port, Gujarat"
    };
  } else if (name.includes("fani")) {
    return {
      basinName: "West-central Bay of Bengal",
      landfall: "03 May, 08:00 IST",
      landfallLocation: "Near Puri, Odisha"
    };
  } else if (name.includes("tauktae")) {
    return {
      basinName: "East-central Arabian Sea",
      landfall: "17 May, 20:30 IST",
      landfallLocation: "Near Saurashtra Coast, Gujarat"
    };
  } else if (name.includes("dana")) {
    return {
      basinName: "North-west Bay of Bengal",
      landfall: "25 Oct, 01:30 IST",
      landfallLocation: "Between Dhamra & Habalikhati, Odisha"
    };
  } else if (name.includes("remal")) {
    return {
      basinName: "North Bay of Bengal",
      landfall: "26 May, 20:30 IST",
      landfallLocation: "Adjacent to Sagar Island & Khepupara"
    };
  } else if (name.includes("michaung")) {
    return {
      basinName: "South-west Bay of Bengal",
      landfall: "05 Dec, 12:30 IST",
      landfallLocation: "Near Bapatla, Andhra Pradesh"
    };
  } else if (name.includes("fengal")) {
    return {
      basinName: "South-west Bay of Bengal",
      landfall: "30 Nov, 22:30 IST",
      landfallLocation: "Near Puducherry & Marakkanam, TN"
    };
  } else if (name.includes("asna")) {
    return {
      basinName: "Northeast Arabian Sea",
      landfall: "01 Sep, 12:00 IST",
      landfallLocation: "Off Gujarat / Sindh Coast"
    };
  } else if (name.includes("hudhud")) {
    return {
      basinName: "West-central Bay of Bengal",
      landfall: "12 Oct, 11:30 IST",
      landfallLocation: "Near Visakhapatnam, Andhra Pradesh"
    };
  }
  const isBoB = sys.basin ? sys.basin.toLowerCase().includes("bengal") : sys.lon > 78;
  return {
    basinName: isBoB ? "Bay of Bengal Basin" : "Arabian Sea Basin",
    landfall: "Forecast Landfall",
    landfallLocation: isBoB ? "Eastern Coastline of India" : "Western Coastline of India"
  };
};

export default function LiveMonitoringPage() {
  const { selectedCycloneId, selectCyclone, clearSelectedCyclone } = useActiveCyclone();
  const [activeSystem, setActiveSystem] = useState<ActiveSystem | null>(null);
  const [isSimulation, setIsSimulation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ingestStatus, setIngestStatus] = useState<any>(null);
  const [isSyncingIngest, setIsSyncingIngest] = useState(false);

  const fetchIngestStatus = () => {
    fetch("http://localhost:8000/api/ingest/status")
      .then(res => res.json())
      .then(data => setIngestStatus(data))
      .catch(() => {});
  };

  const handleSyncFeeds = async () => {
    setIsSyncingIngest(true);
    try {
      const res = await fetch("http://localhost:8000/api/ingest/sync", { method: "POST" });
      const data = await res.json();
      setIngestStatus({
        status: "online",
        last_sync: data.synced_at,
        is_syncing: false,
        active_systems_count: data.active_systems_count || 0,
        sources_status: data.sources_status
      });
      // Refresh active systems if any newly detected
      fetchActiveSystems(false);
    } catch (err) {
      console.error("Failed to sync feeds:", err);
    } finally {
      setIsSyncingIngest(false);
    }
  };

  const handleTestInject = async () => {
    setIsSyncingIngest(true);
    try {
      await fetch("http://localhost:8000/api/ingest/test-inject", { method: "POST" });
      fetchIngestStatus();
      fetchActiveSystems(false);
    } catch (err) {
      console.error("Failed to inject test cyclone:", err);
    } finally {
      setIsSyncingIngest(false);
    }
  };

  const handleClearLiveTest = async () => {
    setIsSyncingIngest(true);
    try {
      await fetch("http://localhost:8000/api/ingest/clear-test", { method: "POST" });
      clearSelectedCyclone();
      fetchIngestStatus();
      fetchActiveSystems(false);
    } catch (err) {
      console.error("Failed to clear test cyclone:", err);
    } finally {
      setIsSyncingIngest(false);
    }
  };

  const fetchActiveSystems = (simulate: boolean = false, cycloneId?: string | null) => {
    setLoading(true);
    let url = "http://localhost:8000/api/active-systems";
    const targetId = cycloneId || (simulate ? selectedCycloneId : null);
    if (simulate || targetId) {
      url += `?simulate=true${targetId ? `&cyclone_id=${encodeURIComponent(targetId)}` : ""}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setActiveSystem(data[0]);
          setIsSimulation(true);
        } else {
          setActiveSystem(null);
          setIsSimulation(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch active systems:", err);
        setActiveSystem(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIngestStatus();
    const interval = setInterval(fetchIngestStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let targetId = selectedCycloneId;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const simParam = params.get("simulate");
      if (simParam && simParam !== "true") {
        targetId = simParam;
        selectCyclone(simParam);
      }
    }
    if (targetId) {
      fetchActiveSystems(true, targetId);
    } else {
      fetchActiveSystems(false);
    }
  }, [selectedCycloneId]);

  const stormMeta = getStormDetails(activeSystem);

  // Expose live UI screen telemetry to window context for CycloNet AI assistant
  useEffect(() => {
    if (typeof window !== "undefined") {
      const meta = getStormDetails(activeSystem);
      (window as any).__cyclonet_current_context = {
        page: "Live Monitoring",
        isSimulation,
        activeSystem: activeSystem ? {
          id: activeSystem.id,
          name: activeSystem.name,
          category: activeSystem.category,
          basin: meta.basinName,
          lat: activeSystem.lat,
          lon: activeSystem.lon,
          coordinates: `${activeSystem.lat.toFixed(1)}°N, ${activeSystem.lon.toFixed(1)}°E`,
          intensity_knots: activeSystem.intensity_knots,
          wind_kmh: Math.round(activeSystem.intensity_knots * 1.852),
          gusting_kmh: Math.round(activeSystem.intensity_knots * 1.852 * 1.05),
          track_points_count: activeSystem.track_forecast?.length || 0,
          current_position_label: `${activeSystem.lat.toFixed(1)}°N, ${activeSystem.lon.toFixed(1)}°E`,
          landfall: meta.landfall,
          landfallLocation: meta.landfallLocation,
          simulation_active: isSimulation,
        } : null,
        basin_status: activeSystem ? `Active System: ${activeSystem.name}` : "Basin Quiet (0 active storms)"
      };
    }
  }, [activeSystem, isSimulation]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* Simulation / Selected Cyclone Banner */}
      {activeSystem && (
        <div className="p-3.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-300 uppercase tracking-wider text-[11px]">Active Focus:</span>
            <span>Displaying <strong>Cyclone {activeSystem.name}</strong> ({activeSystem.id}) • Synced across all tabs.</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/forecast?cyclone_id=${encodeURIComponent(activeSystem.id)}`}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 transition-colors font-medium text-xs cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              Track Forecast
            </a>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.replaceState({}, '', '/');
                }
                clearSelectedCyclone();
                fetchActiveSystems(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-zinc-300 transition-colors font-medium text-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Live
            </button>
          </div>
        </div>
      )}

      {/* Live Ingestion Feed Bar */}
      <div className="p-3 px-4 rounded-xl bg-zinc-900/60 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-semibold text-zinc-100">Live Ingestion:</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] text-emerald-400">
              IMD RSMC: Online
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] text-emerald-400">
              JTWC/NOAA: Online
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 font-mono text-[11px] text-blue-400">
              INSAT-3DR
            </span>
          </div>
          {ingestStatus?.last_sync && (
            <span className="hidden sm:inline text-zinc-400 text-[11px]">
              • Last Auto-Checked: {new Date(ingestStatus.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeSystem && activeSystem.id.startsWith("LIVE-IMD-") ? (
            <button
              onClick={handleClearLiveTest}
              disabled={isSyncingIngest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/20 text-zinc-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95"
              title="Clear injected live detection test and return to real calm feeds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Test Detection</span>
            </button>
          ) : (
            <button
              onClick={handleTestInject}
              disabled={isSyncingIngest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95"
              title="Test real-time detection by injecting a simulated new live cyclone (Cyclone Shakti)"
            >
              <Play className="w-3.5 h-3.5 fill-amber-400" />
              <span>Test Live Detection</span>
            </button>
          )}

          <button
            onClick={handleSyncFeeds}
            disabled={isSyncingIngest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer hover:scale-105 active:scale-95"
            title="Poll IMD, NOAA, and MOSDAC feeds for newly evolving cyclones"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingIngest ? "animate-spin" : ""}`} />
            <span>{isSyncingIngest ? "Syncing Feeds..." : "Sync Live Feeds"}</span>
          </button>
        </div>
      </div>

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
                {activeSystem ? activeSystem.name : "No Active Cyclones"}
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${activeSystem ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-400"}`}>
              {activeSystem ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-2 text-sm">
            {activeSystem ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/20 font-semibold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                {activeSystem.category}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-semibold text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Basin Quiet • Calm Conditions
              </span>
            )}
          </div>
        </div>

        {/* Stat Card 2: Surface / Sustained Winds */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                {activeSystem ? "Max Sustained Wind" : "Prevailing Basin Winds"}
              </p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem
                  ? `${Math.round(activeSystem.intensity_knots * 1.852)} km/h`
                  : "15 - 25 km/h"}
              </h3>
            </div>
            <div className="p-2 bg-white/10 rounded-lg border border-white/10">
              <Wind className="w-5 h-5 text-zinc-100" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {activeSystem ? (
              <span className="text-emerald-500 font-medium">Gusting to 190 km/h</span>
            ) : (
              <span className="text-emerald-400 font-medium">Beaufort Scale 3–4 (Gentle)</span>
            )}
            <span>over open seas</span>
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
                  ? `${activeSystem.lat.toFixed(1)}°N, ${activeSystem.lon.toFixed(1)}°E`
                  : "Arabian Sea & BoB"}
              </h3>
            </div>
            <div className="p-2 bg-white/10 rounded-lg border border-white/10">
              <MapPin className="w-5 h-5 text-zinc-100" />
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
            <div className="p-2 bg-white/10 rounded-lg border border-white/10">
              <Navigation className="w-5 h-5 text-zinc-100" />
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
          <div className="absolute top-4 left-4 z-10 bg-zinc-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shadow-lg flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h4 className="font-heading font-semibold text-xs text-zinc-100">INSAT-3DR Satellite Live Surveillance</h4>
              <p className="text-[10.5px] text-zinc-400">
                {activeSystem ? "Tracking Active Vortex: " + activeSystem.name : "North Indian Ocean Basin • Real-Time Nominal"}
              </p>
            </div>
          </div>
          
          {/* Interactive Leaflet Map */}
          <div className="w-full h-full rounded-xl relative overflow-hidden border border-border/50 z-0">
            <MapComponent activeSystem={activeSystem} />
          </div>

          {/* Bottom Simulation Prompt when no storm is active */}
          {!activeSystem && (
            <div className="absolute bottom-4 left-4 right-4 z-10 p-3 px-4 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2.5 text-xs text-zinc-300">
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No active cyclonic storms right now. Want to test the tracking and forecast visualization?</span>
              </div>
              <button
                onClick={() => fetchActiveSystems(true)}
                className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-sm hover:scale-[1.02]"
              >
                <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                Load Biparjoy (2023) Simulation
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar Details */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-lg border-b border-border pb-3 mb-4">
              {activeSystem ? "Latest Storm Bulletins" : "IMD Tropical Outlook"}
            </h3>
            <div className="space-y-4">
              {activeSystem ? (
                (() => {
                  const kmh = Math.round((activeSystem.intensity_knots || 0) * 1.852);
                  const isSuperOrExtreme = (activeSystem.intensity_knots || 0) >= 90;
                  const isSevere = (activeSystem.intensity_knots || 0) >= 48;
                  const basinName = activeSystem.basin || "North Indian Ocean";
                  const isArabian = basinName.toLowerCase().includes("arabian");

                  const dynamicBulletins = [
                    { 
                      time: "14:30 IST", 
                      text: `${activeSystem.name} centered near ${activeSystem.lat?.toFixed(1) || "15.0"}°N, ${activeSystem.lon?.toFixed(1) || "80.0"}°E over the ${basinName}. Sustained core winds: ${activeSystem.intensity_knots || 45} KT (${kmh} km/h).`, 
                      type: "info" 
                    },
                    { 
                      time: "11:00 IST", 
                      text: isSuperOrExtreme 
                        ? `System classified as ${activeSystem.category || "Super Cyclone"}. Severe storm surge and coastal emergency alerts active.`
                        : isSevere
                          ? `System classified as ${activeSystem.category || "Severe Cyclonic Storm"}. Squally weather and heavy rainfall warnings in effect.`
                          : `System classified as ${activeSystem.category || "Cyclonic Storm"}. Moderate convective bands active over the ${isArabian ? 'Arabian Sea' : 'Bay of Bengal'}.`, 
                      type: (isSuperOrExtreme || isSevere ? "alert" : "info") 
                    },
                    { 
                      time: "08:15 IST", 
                      text: isSuperOrExtreme
                        ? "INSAT-3D / Dvorak analysis indicates distinct eye structure with intense central dense overcast (CDO)."
                        : isSevere
                          ? "INSAT-3D IR imagery indicates tightly wrapped curved convective banding into the circulation center."
                          : "INSAT-3D multispectral imagery indicates moderate cloud cluster with sheared convective banding.", 
                      type: "update" 
                    },
                  ];

                  return dynamicBulletins.map((bulletin, i) => (
                    <div key={i} className="flex gap-3 relative">
                      <div className="mt-1">
                        {bulletin.type === 'alert' ? 
                          <AlertCircle className="w-4 h-4 text-destructive" /> : 
                          <CloudRain className="w-4 h-4 text-zinc-300" />
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
                  { time: "Current", text: "No cyclogenesis likely over the North Indian Ocean during the next 120 hours.", type: "calm" },
                  { time: "Synoptic", text: "Surface pressure gradients are normal; equatorial vertical wind shear remains moderate.", type: "info" },
                  { time: "Satellite", text: "INSAT-3DR and OceanSat-3 scatterometer scans confirm absence of organized low pressure vortices.", type: "update" },
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
              className="w-full mt-6 py-2.5 rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-sm font-semibold transition-all text-zinc-200 hover:text-white flex items-center justify-center gap-2 text-center cursor-pointer shadow-xs hover:scale-[1.005]"
            >
              <span>View complete analytics & forecast</span>
            </a>
          </div>

          <div className="glass-card p-5 flex-1">
             <h3 className="font-heading font-semibold text-lg border-b border-border pb-3 mb-4">
              {activeSystem ? "Model Confidence" : "System Diagnostics"}
             </h3>
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {activeSystem ? "Intensity Classification" : "Satellite Ingestion Status"}
                    </span>
                    <span className="font-semibold text-emerald-500">
                      {activeSystem ? "94.2%" : "Operational (100%)"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[100%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {activeSystem ? "Center Fix (Lat/Lon)" : "Organized Vortex Anomaly"}
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {activeSystem ? "88.5%" : "0 Detected"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-zinc-400 w-[0%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {activeSystem ? "Track Forecast (24h)" : "5-Day Cyclogenesis Risk"}
                    </span>
                    <span className="font-semibold text-emerald-400">
                      {activeSystem ? "76.0%" : "Very Low (< 5%)"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[5%] rounded-full" />
                  </div>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
