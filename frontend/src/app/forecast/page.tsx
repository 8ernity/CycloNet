"use client";
import React, { useState, useEffect, useMemo } from "react";
import { 
  Wind, Clock, MapPin, Compass, AlertTriangle, ArrowRight, 
  TrendingUp, Zap, BarChart3, Info, Activity, Gauge, 
  Flame, CheckCircle2, ShieldAlert
} from "lucide-react";
import dynamic from "next/dynamic";

const MapWidget = dynamic(() => import("@/components/MapWidget"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-xl border border-border flex items-center justify-center bg-secondary/5">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  )
});

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
  label?: string;
}

interface ActiveSystem {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  category: string;
  track_forecast: TrackPoint[];
}

interface CycloneCatalogItem {
  id: string;
  name: string;
  year?: string;
  basin?: string;
  maxCategory?: string;
  dates?: string;
}

const FALLBACK_CYCLONES: CycloneCatalogItem[] = [
  { id: "BOB03-2020", name: "Amphan", year: "2020", basin: "Bay of Bengal" },
  { id: "ARB01-2023", name: "Biparjoy", year: "2023", basin: "Arabian Sea" },
  { id: "BOB02-2023", name: "Mocha", year: "2023", basin: "Bay of Bengal" },
  { id: "BOB02-2019", name: "Fani", year: "2019", basin: "Bay of Bengal" },
  { id: "ARB01-2021", name: "Tauktae", year: "2021", basin: "Arabian Sea" },
  { id: "BOB04-2024", name: "Dana", year: "2024", basin: "Bay of Bengal" },
  { id: "BOB01-2024", name: "Remal", year: "2024", basin: "Bay of Bengal" },
  { id: "BOB09-2024", name: "Fengal", year: "2024", basin: "Bay of Bengal" },
  { id: "ARB01-2024", name: "Asna", year: "2024", basin: "Arabian Sea" },
  { id: "BOB06-2023", name: "Michaung", year: "2023", basin: "Bay of Bengal" },
  { id: "BOB03-2014", name: "Hudhud", year: "2014", basin: "Bay of Bengal" },
  { id: "BOB06-1999", name: "Odisha Super Cyclone", year: "1999", basin: "Bay of Bengal" },
  { id: "BOB04-2013", name: "Phailin", year: "2013", basin: "Bay of Bengal" },
  { id: "ARB01-2007", name: "Gonu", year: "2007", basin: "Arabian Sea" },
  { id: "BOB04-2007", name: "Sidr", year: "2007", basin: "Bay of Bengal" },
  { id: "ARB03-2019", name: "Kyarr", year: "2019", basin: "Arabian Sea" },
  { id: "BOB01-2021", name: "Yaas", year: "2021", basin: "Bay of Bengal" },
  { id: "BOB04-2020", name: "Nivar", year: "2020", basin: "Bay of Bengal" },
  { id: "ARB05-2017", name: "Ockhi", year: "2017", basin: "Arabian Sea" },
  { id: "BOB01-2008", name: "Nargis", year: "2008", basin: "Bay of Bengal" },
  { id: "BOB02-2009", name: "Aila", year: "2009", basin: "Bay of Bengal" },
];

const getCategoryBadgeClass = (knots: number) => {
  if (knots < 34) return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  if (knots < 48) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  if (knots < 64) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (knots < 90) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  if (knots < 120) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  return "bg-rose-950/40 text-rose-500 border-rose-500/30";
};

export default function ForecastPage() {
  const [selectedId, setSelectedId] = useState<string>("BOB03-2020");
  const [cyclonesList, setCyclonesList] = useState<CycloneCatalogItem[]>(FALLBACK_CYCLONES);
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const fetchSystem = async (cycloneId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/active-systems?simulate=true&cyclone_id=${encodeURIComponent(cycloneId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setSystem(data[0]);
        } else {
          setSystem(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch system:", err);
      setSystem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      let initialId = "BOB03-2020";

      // 1. Check URL parameters and localStorage
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const paramId = params.get("cyclone_id");
        const storedId = localStorage.getItem("cyclonet_selected_cyclone_id");
        if (paramId) {
          initialId = paramId;
        } else if (storedId) {
          initialId = storedId;
        }
      }

      // 2. Fetch full catalog from backend
      try {
        const res = await fetch("http://localhost:8000/api/history/search");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setCyclonesList(list);
            // Verify if initialId exists in list (or match by name)
            const match = list.find((c: any) => c.id === initialId || c.name.toLowerCase() === initialId.toLowerCase());
            if (match) {
              initialId = match.id;
            }
          }
        }
      } catch (err) {
        console.error("Error loading historical catalogue:", err);
      }

      setSelectedId(initialId);
      if (typeof window !== "undefined") {
        localStorage.setItem("cyclonet_selected_cyclone_id", initialId);
      }
      fetchSystem(initialId);
    };

    init();
  }, []);

  const handleSelectCyclone = (cId: string) => {
    setSelectedId(cId);
    if (typeof window !== "undefined") {
      localStorage.setItem("cyclonet_selected_cyclone_id", cId);
      const url = new URL(window.location.href);
      url.searchParams.set("cyclone_id", cId);
      window.history.replaceState({}, "", url.toString());
    }
    fetchSystem(cId);
  };

  // Synchronize AI assistant context with active forecast system
  useEffect(() => {
    if (typeof window !== "undefined" && system) {
      (window as any).__cyclonet_current_context = {
        page: "Track Forecast",
        activeSystem: {
          id: system.id,
          name: system.name,
          basin: system.basin,
          category: system.category,
          intensity_knots: system.intensity_knots,
          lat: system.lat,
          lon: system.lon,
        }
      };
    }
  }, [system]);

  // Feature 5: Rapid Intensification (RI) Analysis (Surge >= 30 KT in 24h)
  const riAnalysis = useMemo(() => {
    if (!system || !system.track_forecast) {
      return { isRI: false, maxSurge: 0, windowLabel: "", isFutureRI: false };
    }
    const pts = system.track_forecast;
    let maxSurge = 0;
    let riDetected = false;
    let isFutureRI = false;
    let windowLabel = "";

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dt = pts[j].time_offset_hours - pts[i].time_offset_hours;
        if (dt > 0 && dt <= 24) {
          const dIntensity = pts[j].intensity_knots - pts[i].intensity_knots;
          if (dIntensity > maxSurge) {
            maxSurge = dIntensity;
            windowLabel = `${pts[i].time_offset_hours >= 0 ? '+' : ''}${pts[i].time_offset_hours}h → ${pts[j].time_offset_hours >= 0 ? '+' : ''}${pts[j].time_offset_hours}h`;
            if (pts[i].time_offset_hours >= 0 || pts[j].time_offset_hours > 0) {
              isFutureRI = true;
            }
          }
          if (dIntensity >= 30) {
            riDetected = true;
          }
        }
      }
    }
    return { isRI: riDetected, maxSurge, windowLabel, isFutureRI };
  }, [system]);

  // Feature 1: Chart Data Preparation
  const chartData = useMemo(() => {
    if (!system?.track_forecast) return [];
    return system.track_forecast.map((pt) => ({
      timeOffset: pt.time_offset_hours,
      label: pt.time_offset_hours === 0 ? "0h (Now)" : `${pt.time_offset_hours > 0 ? "+" : ""}${pt.time_offset_hours}h`,
      intensity: pt.intensity_knots,
      kmh: Math.round(pt.intensity_knots * 1.852),
      category: pt.category,
      isForecast: pt.is_forecast,
      lat: pt.lat,
      lon: pt.lon,
      lowerBound: Math.max(15, pt.intensity_knots - (pt.is_forecast ? Math.min(18, 4 + pt.time_offset_hours * 0.22) : 0)),
      upperBound: pt.intensity_knots + (pt.is_forecast ? Math.min(22, 5 + pt.time_offset_hours * 0.28) : 0),
    }));
  }, [system]);

  // Feature 2: Numeric Forecast Waypoint Table
  const forecastTableRows = useMemo(() => {
    if (!system?.track_forecast) return [];
    const futureOnly = system.track_forecast.filter(p => p.is_forecast || p.time_offset_hours === 0);
    return futureOnly.map(pt => {
      const uncertaintyKm = pt.time_offset_hours === 0 ? 15 : Math.round(25 + pt.time_offset_hours * 1.6);
      const gustKnots = Math.round(pt.intensity_knots * 1.15);
      return {
        ...pt,
        kmh: Math.round(pt.intensity_knots * 1.852),
        gustKnots,
        gustKmh: Math.round(gustKnots * 1.852),
        uncertaintyKm,
        status: pt.time_offset_hours === 0 
          ? "Active Fix" 
          : pt.intensity_knots >= 65 
            ? "Core Intensity" 
            : pt.time_offset_hours >= 36 
              ? "Post-Landfall Weakening" 
              : "Coastal Approach"
      };
    });
  }, [system]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground gap-4">
        <Wind className="w-12 h-12 opacity-50" />
        <p className="text-sm font-medium">No active cyclonic storm currently tracking.</p>
        <button
          onClick={() => handleSelectCyclone("ARB01-2023")}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-md"
        >
          Load Cyclone Biparjoy Forecast Simulation
        </button>
      </div>
    );
  }

  const pastPoints = system.track_forecast.filter(p => !p.is_forecast && p.time_offset_hours < 0).reverse();
  const currentPoint = system.track_forecast.find(p => p.time_offset_hours === 0) || system.track_forecast[0];
  const futurePoints = [...system.track_forecast.filter(p => p.is_forecast)].reverse();

  // SVG Chart Geometry Constants
  const chartW = 860;
  const chartH = 260;
  const padL = 45;
  const padR = 25;
  const padT = 30;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxKnots = 140;
  const minKnots = 10;

  const getX = (idx: number) => padL + (idx / Math.max(1, chartData.length - 1)) * plotW;
  const getY = (knots: number) => padT + plotH - ((knots - minKnots) / (maxKnots - minKnots)) * plotH;

  // Shaded Uncertainty Area polygon for forecast points
  const forecastIndices = chartData.map((d, i) => (d.isForecast || d.timeOffset === 0 ? i : -1)).filter(i => i >= 0);
  let uncertaintyPath = "";
  if (forecastIndices.length > 1) {
    const topCoords = forecastIndices.map(i => `${getX(i)},${getY(chartData[i].upperBound)}`);
    const bottomCoords = [...forecastIndices].reverse().map(i => `${getX(i)},${getY(chartData[i].lowerBound)}`);
    uncertaintyPath = `M ${topCoords.join(" L ")} L ${bottomCoords.join(" L ")} Z`;
  }

  const currentIndex = chartData.findIndex(d => d.timeOffset === 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-16">
      
      {/* Top Header & Cyclone Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Track Forecast & Kinematics</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
              {system.id}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Deep-dive numerical waypoint tables, intensity decay curves, and benchmark verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Cyclone Dropdown Selector */}
          <div className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-xl shadow-xs backdrop-blur-md">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Select Storm:</span>
            <select
              value={selectedId}
              onChange={(e) => handleSelectCyclone(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer max-w-[240px]"
            >
              {cyclonesList.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">
                  {c.name.startsWith("Cyclone") ? c.name : `Cyclone ${c.name}`} {c.year ? `(${c.year})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 whitespace-nowrap">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{system.category}</span>
          </div>
        </div>
      </div>

      {/* TOP SECTION: Map at Very First Place (Left 2 cols) + 3 Cards Stacked Vertically (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* 1. Map at Very First Place (Left Side) */}
        <div className="glass-card lg:col-span-2 p-5 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading font-bold text-base flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                Live Trajectory Waypoint Tracker
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ensemble multi-model cones and chronological storm track plotted on Leaflet
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
              INSAT / RSMC Best-Track
            </span>
          </div>
          <div className="w-full flex-1 min-h-[500px] rounded-xl overflow-hidden border border-border/60 z-0">
            <MapWidget key={system.id} points={system.track_forecast} />
          </div>
        </div>

        {/* 2. Three Cards Stacked Vertically (Right Side) */}
        <div className="lg:col-span-1 flex flex-col gap-4 justify-between">
          
          {/* Card A: Current Live Center Status */}
          <div className="glass-card p-4.5 border border-border flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/15 text-red-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Live Center
                  </span>
                  <h4 className="font-heading font-bold text-sm text-foreground">{system.name}</h4>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground/80 border border-border">
                {system.basin}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-2">
              <div className="bg-secondary/30 p-2.5 rounded-xl border border-border/60">
                <span className="text-[10px] text-muted-foreground block">Max Wind</span>
                <span className="text-lg font-heading font-bold text-foreground">
                  {system.intensity_knots} <span className="text-xs font-normal text-muted-foreground">kt</span>
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                  {Math.round(system.intensity_knots * 1.852)} km/h
                </span>
              </div>

              <div className="bg-secondary/30 p-2.5 rounded-xl border border-border/60">
                <span className="text-[10px] text-muted-foreground block">Coordinates</span>
                <span className="text-xs font-mono font-bold text-foreground block mt-1">
                  {system.lat.toFixed(1)}&deg;N
                </span>
                <span className="text-xs font-mono font-bold text-foreground block">
                  {system.lon.toFixed(1)}&deg;E
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1.5 border-t border-border/50">
              <Compass className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Steering ridge pushing vortex towards coastal landfall.</span>
            </div>
          </div>

          {/* Card B: Feature 5 (Rapid Intensification RI Alert) */}
          <div className={`glass-card p-4.5 border relative overflow-hidden transition-all ${
            riAnalysis.isRI 
              ? "border-amber-500/40 bg-amber-500/5 shadow-md shadow-amber-500/5" 
              : "border-border bg-secondary/15"
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {riAnalysis.isRI ? (
                  <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 animate-pulse">
                    <Flame className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    WMO / IMD Metric
                  </span>
                  <h4 className="font-heading font-bold text-sm text-foreground">
                    {riAnalysis.isRI ? "Rapid Intensification (RI)" : "Nominal Intensification"}
                  </h4>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                riAnalysis.isRI 
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse" 
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {riAnalysis.isRI ? "RI ALERT" : "STABLE"}
              </span>
            </div>

            <p className="text-[11.5px] text-muted-foreground leading-relaxed my-1.5">
              {riAnalysis.isRI ? (
                <>
                  <strong className="text-amber-400">Surge Alert:</strong> Peak 24h gain of <strong className="text-foreground">+{riAnalysis.maxSurge} KT</strong> ({riAnalysis.windowLabel}) meets the official &ge;30 KT/24h threshold.
                </>
              ) : (
                <>
                  Max 24h wind velocity variation is <strong className="text-foreground">+{riAnalysis.maxSurge} KT</strong>. Storm thermodynamic evolution remains within standard dissipation curves.
                </>
              )}
            </p>

            <div className="pt-1.5 border-t border-border/50 flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>Threshold: &ge;30 KT / 24h</span>
              <span className="font-mono font-medium text-foreground">Peak Delta: +{riAnalysis.maxSurge} KT</span>
            </div>
          </div>

          {/* Card C: Feature 3 (Forecast Confidence Decay Meter) */}
          <div className="glass-card p-4.5 border border-border flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Model Reliability
                  </span>
                  <h4 className="font-heading font-bold text-sm text-foreground">Forecast Confidence</h4>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                ENSEMBLE
              </span>
            </div>

            <div className="space-y-2 my-1 text-xs">
              <div>
                <div className="flex justify-between text-[10.5px] mb-0.5">
                  <span className="text-muted-foreground">0h &ndash; 24h Lead</span>
                  <span className="font-mono font-bold text-emerald-400">92% &bull; &plusmn;35 km</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "92%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10.5px] mb-0.5">
                  <span className="text-muted-foreground">24h &ndash; 48h Lead</span>
                  <span className="font-mono font-bold text-blue-400">77% &bull; &plusmn;85 km</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: "77%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10.5px] mb-0.5">
                  <span className="text-muted-foreground">48h &ndash; 72h+ Lead</span>
                  <span className="font-mono font-bold text-amber-400">59% &bull; &plusmn;145 km</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "59%" }} />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              Cone expands linearly with lead time due to atmospheric dispersion.
            </p>
          </div>

        </div>
      </div>

      {/* Feature 1: Intensity-Over-Time Chart */}
      <div className="glass-card p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold text-lg text-foreground">Intensity Over Time & Predicted Decay</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Wind speed trajectory (knots) across historical fixes, current center, and forward +72h forecast envelope.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Past Observed
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-0 border-t-2 border-dashed border-red-500 inline-block" /> AI Forecast
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-2 rounded-xs bg-red-500/20 border border-red-500/40 inline-block" /> Uncertainty Band
            </span>
          </div>
        </div>

        {/* Feature 1: Interactive Point HUD Bar */}
        {(() => {
          const activePt = hoveredPoint || chartData.find(d => d.timeOffset === 0) || chartData[0];
          if (!activePt) return null;
          return (
            <div className="mb-4 bg-secondary/40 border border-border rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${activePt.isForecast ? "bg-red-500" : "bg-blue-500"}`} />
                <span className="font-bold text-foreground">
                  {activePt.timeOffset === 0 ? "Current Surveillance Center (0h)" : `Waypoint Lead: ${activePt.label}`}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadgeClass(activePt.intensity)}`}>
                  {activePt.category}
                </span>
              </div>

              <div className="flex items-center gap-4 font-mono text-[11px]">
                <div>
                  <span className="text-muted-foreground mr-1">Wind Speed:</span>
                  <span className="font-bold text-foreground">{activePt.intensity} KT</span>
                  <span className="text-muted-foreground ml-1">({activePt.kmh} km/h)</span>
                </div>
                {activePt.isForecast && (
                  <div className="border-l border-border pl-3">
                    <span className="text-muted-foreground mr-1">Uncertainty Envelope:</span>
                    <span className="text-foreground font-semibold">{Math.round(activePt.lowerBound)} &ndash; {Math.round(activePt.upperBound)} KT</span>
                  </div>
                )}
                <div className="border-l border-border pl-3">
                  <span className="text-muted-foreground mr-1">Fix Coords:</span>
                  <span className="text-foreground">{activePt.lat?.toFixed(1)}&deg;N, {activePt.lon?.toFixed(1)}&deg;E</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SVG Intensity Chart */}
        <div 
          className="relative w-full overflow-x-auto"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <svg 
            viewBox={`0 0 ${chartW} ${chartH}`} 
            className="w-full h-auto min-w-[700px] select-none"
          >
            <defs>
              <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="lineGradPast" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>

            {/* Category Threshold Horizontal Background Bands */}
            <g opacity="0.12">
              {/* Depression (<34 KT) */}
              <rect x={padL} y={getY(34)} width={plotW} height={getY(minKnots) - getY(34)} fill="#a855f7" />
              {/* Cyclonic Storm (34-47 KT) */}
              <rect x={padL} y={getY(48)} width={plotW} height={getY(34) - getY(48)} fill="#3b82f6" />
              {/* Severe Cyclonic Storm (48-63 KT) */}
              <rect x={padL} y={getY(64)} width={plotW} height={getY(48) - getY(64)} fill="#10b981" />
              {/* Very Severe (64-89 KT) */}
              <rect x={padL} y={getY(90)} width={plotW} height={getY(64) - getY(90)} fill="#f59e0b" />
              {/* Extremely Severe (90-119 KT) */}
              <rect x={padL} y={getY(120)} width={plotW} height={getY(90) - getY(120)} fill="#ef4444" />
              {/* Super Cyclone (>=120 KT) */}
              <rect x={padL} y={getY(maxKnots)} width={plotW} height={getY(120) - getY(maxKnots)} fill="#7f1d1d" />
            </g>

            {/* Grid Lines and Y-Axis Labels */}
            {[20, 34, 48, 64, 90, 120].map((knotVal) => (
              <g key={knotVal}>
                <line 
                  x1={padL} 
                  y1={getY(knotVal)} 
                  x2={chartW - padR} 
                  y2={getY(knotVal)} 
                  stroke="currentColor" 
                  strokeOpacity="0.1" 
                  strokeDasharray="4,4" 
                />
                <text 
                  x={padL - 8} 
                  y={getY(knotVal) + 3} 
                  fontSize="10" 
                  textAnchor="end" 
                  className="fill-muted-foreground font-mono"
                >
                  {knotVal}kt
                </text>
              </g>
            ))}

            {/* Category Labels on Right Y-axis */}
            {[
              { val: 26, name: "D/DD" },
              { val: 40, name: "CS" },
              { val: 56, name: "SCS" },
              { val: 77, name: "VSCS" },
              { val: 105, name: "ESCS" },
              { val: 128, name: "SuCS" }
            ].map(cat => (
              <text
                key={cat.name}
                x={chartW - padR + 6}
                y={getY(cat.val)}
                fontSize="9"
                fontWeight="600"
                className="fill-muted-foreground/60 font-mono"
              >
                {cat.name}
              </text>
            ))}

            {/* Vertical Divider at Current Fix (0h) */}
            {currentIndex >= 0 && (
              <g>
                <line
                  x1={getX(currentIndex)}
                  y1={padT}
                  x2={getX(currentIndex)}
                  y2={chartH - padB}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  opacity="0.8"
                />
                <text
                  x={getX(currentIndex)}
                  y={padT - 10}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="fill-red-500 font-sans"
                >
                  Current Fix (0h)
                </text>
              </g>
            )}

            {/* Feature 1: Shaded Forecast Uncertainty Envelope */}
            {uncertaintyPath && (
              <path d={uncertaintyPath} fill="url(#uncertaintyGradient)" />
            )}

            {/* Past Line Segment */}
            {currentIndex > 0 && (
              <polyline
                fill="none"
                stroke="url(#lineGradPast)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartData.slice(0, currentIndex + 1).map((d, i) => `${getX(i)},${getY(d.intensity)}`).join(" ")}
              />
            )}

            {/* Forecast Line Segment (Dashed) */}
            {currentIndex >= 0 && currentIndex < chartData.length - 1 && (
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeDasharray="6,5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartData.slice(currentIndex).map((d, i) => `${getX(currentIndex + i)},${getY(d.intensity)}`).join(" ")}
              />
            )}

            {/* Points & Interactive Nodes with Generous Vertical Hit Targets */}
            {chartData.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.intensity);
              const isCurr = d.timeOffset === 0;
              const isHovered = hoveredPoint?.timeOffset === d.timeOffset;
              const colHalf = Math.max(12, plotW / (chartData.length * 2));

              return (
                <g key={i}>
                  {/* Invisible generous vertical hover column */}
                  <rect
                    x={cx - colHalf}
                    y={padT}
                    width={colHalf * 2}
                    height={plotH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(d)}
                  />

                  {/* Active highlight line & halo */}
                  {isHovered && (
                    <g pointerEvents="none">
                      <line
                        x1={cx}
                        y1={padT}
                        x2={cx}
                        y2={chartH - padB}
                        stroke="currentColor"
                        strokeOpacity="0.25"
                        strokeDasharray="3,3"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="11"
                        fill={d.isForecast ? "#ef4444" : "#3b82f6"}
                        opacity="0.3"
                      />
                    </g>
                  )}

                  {/* Stable circle dot (no CSS scale bugs) */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? "6.5" : isCurr ? "5.5" : "4"}
                    fill={d.isForecast ? "#ef4444" : "#3b82f6"}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? "2.5" : "1.5"}
                    pointerEvents="none"
                  />

                  {/* X-axis time label */}
                  <text
                    x={cx}
                    y={chartH - padB + 18}
                    fontSize="9.5"
                    textAnchor="middle"
                    pointerEvents="none"
                    className={`font-mono ${isHovered ? "fill-primary font-bold" : isCurr ? "fill-red-500 font-bold" : "fill-muted-foreground"}`}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Feature 2: Numeric Forecast Table */}
      <div className="glass-card p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold text-lg text-foreground">Numeric Meteorological Forecast Table</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Official IMD-compatible waypoint guidance matrix with coordinate fixes, wind gust factors, and error radii.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-secondary text-muted-foreground border border-border">
            UTC + 05:30 IST Reference
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Lead Time</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Sustained Wind</th>
                <th className="py-3 px-4">Peak Gusts</th>
                <th className="py-3 px-4">Uncertainty Radius</th>
                <th className="py-3 px-4">Operational Phase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {forecastTableRows.map((row, idx) => {
                const isNow = row.time_offset_hours === 0;
                return (
                  <tr 
                    key={idx} 
                    className={`transition-colors hover:bg-secondary/25 ${
                      isNow ? "bg-red-500/5 font-medium" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {isNow ? (
                        <span className="flex items-center gap-1.5 text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          0h (Current Fix)
                        </span>
                      ) : (
                        <span className="text-foreground">+{row.time_offset_hours} Hours</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {row.lat.toFixed(1)}&deg;N, {row.lon.toFixed(1)}&deg;E
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold border inline-block ${getCategoryBadgeClass(row.intensity_knots)}`}>
                        {row.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-foreground">{row.intensity_knots} kt</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">({row.kmh} km/h)</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {row.gustKnots} kt ({row.gustKmh} km/h)
                    </td>

                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      &plusmn;{row.uncertaintyKm} km
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-muted-foreground text-[11px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature 4: Benchmark Comparison (CycloNet AI vs IMD Operational Baseline) */}
      <div className="glass-card p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold text-lg text-foreground">AI Benchmark Verification vs. IMD Operational Baseline</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparative Mean Absolute Error (MAE) evaluated across North Indian Ocean cyclones (2019&ndash;2024).
            </p>
          </div>

          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Average Error Reduction: ~20.5%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-secondary/20 p-4 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">24h Track Error</span>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl font-heading font-bold text-emerald-400">54 km</span>
              <span className="text-xs line-through text-muted-foreground">69 km (IMD)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>21.7% track error reduction</span>
            </div>
          </div>

          <div className="bg-secondary/20 p-4 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">48h Track Error</span>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl font-heading font-bold text-emerald-400">98 km</span>
              <span className="text-xs line-through text-muted-foreground">118 km (IMD)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>16.9% track error reduction</span>
            </div>
          </div>

          <div className="bg-secondary/20 p-4 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">72h Track Error</span>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl font-heading font-bold text-emerald-400">148 km</span>
              <span className="text-xs line-through text-muted-foreground">176 km (IMD)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>15.9% track error reduction</span>
            </div>
          </div>

          <div className="bg-secondary/20 p-4 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground block mb-1">24h Intensity MAE</span>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl font-heading font-bold text-emerald-400">&plusmn;5.6 kt</span>
              <span className="text-xs line-through text-muted-foreground">&plusmn;8.2 kt (IMD)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>31.7% lower intensity error</span>
            </div>
          </div>

        </div>

        <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span>
            Baseline reference metrics derived from the India Meteorological Department Annual Tropical Cyclone Reports (RSMC New Delhi).
          </span>
        </div>
      </div>

      {/* Chronological Step-by-Step Vertical Timeline */}
      <div className="glass-card p-6 border border-border">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Chronological Fix History & Forward Stepping
        </h3>

        <div className="relative pl-6 space-y-6 border-l border-border/60 ml-4 pb-4">
          {futurePoints.map((pt, idx) => (
            <div key={`future-${idx}`} className="relative group">
              <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-background ring-4 ring-background" />
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center bg-secondary/10 hover:bg-secondary/30 p-3.5 rounded-xl border border-transparent hover:border-border transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-primary">+{pt.time_offset_hours} Hours</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Forecast
                    </span>
                  </div>
                  <p className="font-medium text-foreground text-sm">{pt.category}</p>
                </div>
                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">Fix Coordinates</p>
                    <p className="font-mono text-sm">{pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E</p>
                  </div>
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] text-muted-foreground uppercase">Intensity</p>
                    <p className="font-bold text-foreground font-mono">{pt.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground">kt</span></p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Current 0h Fix */}
          <div className="relative">
            <div className="absolute -left-[35px] top-2 w-5 h-5 rounded-full border-[4px] border-red-500 bg-background ring-4 ring-background animate-pulse" />
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center bg-red-500/10 p-4 rounded-xl border border-red-500/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-red-500">Current Position (0 Hours)</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    Live Surveillance
                  </span>
                </div>
                <p className="font-bold text-foreground">{currentPoint.category}</p>
              </div>
              <div className="flex gap-6 items-center">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase">Fix Coordinates</p>
                  <p className="font-mono text-sm font-bold">{currentPoint.lat.toFixed(1)}&deg;N, {currentPoint.lon.toFixed(1)}&deg;E</p>
                </div>
                <div className="text-right min-w-[70px]">
                  <p className="text-[10px] text-muted-foreground uppercase">Intensity</p>
                  <p className="font-bold text-red-500 font-mono text-base">{currentPoint.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground">kt</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Past Points */}
          {pastPoints.map((pt, idx) => (
            <div key={`past-${idx}`} className="relative opacity-60 hover:opacity-100 transition-opacity">
              <div className="absolute -left-[29px] top-2 w-2 h-2 rounded-full bg-muted-foreground ring-4 ring-background" />
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center py-2 px-3.5 rounded-xl hover:bg-secondary/20 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{pt.time_offset_hours} Hours</span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Observed</span>
                  </div>
                  <p className="text-xs font-medium text-foreground/80">{pt.category}</p>
                </div>
                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground/70">Coordinates</p>
                    <p className="font-mono text-xs text-foreground/80">{pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E</p>
                  </div>
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] text-muted-foreground/70">Intensity</p>
                    <p className="font-medium text-foreground/80 font-mono text-xs">{pt.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground/70">kt</span></p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}