"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { 
  GitCompare, 
  Wind, 
  Gauge, 
  MapPin, 
  Waves, 
  ShieldAlert, 
  ArrowLeftRight,
  TrendingUp,
  Activity,
  Calendar,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid
} from "recharts";

const CompareMapComponent = dynamic(
  () => import("@/components/CompareMapComponent"),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-card/60 rounded-2xl border border-border">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">Initializing GIS Comparative Engine...</span>
      </div>
    </div>
  )}
);

interface CycloneArchiveItem {
  id: string;
  name: string;
  year: string;
  maxCategory: string;
  basin: string;
  dates: string;
}

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
  is_landfall?: boolean;
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
  landfall_info?: any;
}

const PRESETS = [
  {
    title: "Category 5 Beasts",
    desc: "Amphan (2020) vs Odisha Super Cyclone (1999)",
    icon: "🌪️",
    id1: "BOB03-2020",
    id2: "BOB06-1999",
  },
  {
    title: "Bay of Bengal Giants",
    desc: "Fani (2019) vs Phailin (2013)",
    icon: "⚡",
    id1: "BOB02-2019",
    id2: "BOB04-2013",
  },
  {
    title: "Arabian Sea Superstorms",
    desc: "Biparjoy (2023) vs Tauktae (2021)",
    icon: "🧭",
    id1: "ARB01-2023",
    id2: "ARB01-2021",
  },
  {
    title: "2024 Recent Impacts",
    desc: "Remal (2024) vs Dana (2024)",
    icon: "🌊",
    id1: "BOB01-2024",
    id2: "BOB06-2024",
  },
];

export default function ComparePage() {
  const [cyclonesList, setCyclonesList] = useState<CycloneArchiveItem[]>([]);
  const [selectedId1, setSelectedId1] = useState<string>("BOB03-2020"); // Amphan
  const [selectedId2, setSelectedId2] = useState<string>("BOB02-2019"); // Fani
  
  const [system1, setSystem1] = useState<ActiveSystem | null>(null);
  const [system2, setSystem2] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load list of all historical cyclones
  useEffect(() => {
    async function fetchList() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/history/search`);
        if (res.ok) {
          const data = await res.json();
          setCyclonesList(data);
        }
      } catch (err) {
        console.error("Failed to fetch historical cyclone archives", err);
      }
    }
    fetchList();
  }, []);

  // Fetch trajectory data for System 1
  useEffect(() => {
    async function fetchSys1() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/active-systems?simulate=true&cyclone_id=${selectedId1}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) setSystem1(data[0]);
        }
      } catch (err) {
        console.error("Error fetching system 1 trajectory", err);
      }
    }
    fetchSys1();
  }, [selectedId1]);

  // Fetch trajectory data for System 2
  useEffect(() => {
    async function fetchSys2() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/active-systems?simulate=true&cyclone_id=${selectedId2}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) setSystem2(data[0]);
        }
      } catch (err) {
        console.error("Error fetching system 2 trajectory", err);
      }
    }
    fetchSys2();
  }, [selectedId2]);

  useEffect(() => {
    if (system1 && system2) {
      setLoading(false);
    }
  }, [system1, system2]);

  const handleSwapStorms = () => {
    const temp = selectedId1;
    setSelectedId1(selectedId2);
    setSelectedId2(temp);
  };

  // Combine progression data for Recharts Intensity Chart
  const chartData = useMemo(() => {
    if (!system1 || !system2) return [];

    const pts1 = system1.track_forecast || [];
    const pts2 = system2.track_forecast || [];

    const maxLen = Math.max(pts1.length, pts2.length);
    const data = [];

    for (let i = 0; i < maxLen; i++) {
      const p1 = pts1[i];
      const p2 = pts2[i];

      const hour1 = p1 ? (p1.time_offset_hours - (pts1[0]?.time_offset_hours || 0)) : null;
      const hour2 = p2 ? (p2.time_offset_hours - (pts2[0]?.time_offset_hours || 0)) : null;
      const displayHour = hour1 !== null ? `T+${hour1}h` : (hour2 !== null ? `T+${hour2}h` : `Fix ${i + 1}`);

      data.push({
        step: displayHour,
        [system1.name]: p1 ? p1.intensity_knots : null,
        [`${system1.name}_kmph`]: p1 ? Math.round(p1.intensity_knots * 1.852) : null,
        [`${system1.name}_cat`]: p1 ? p1.category : null,
        [system2.name]: p2 ? p2.intensity_knots : null,
        [`${system2.name}_kmph`]: p2 ? Math.round(p2.intensity_knots * 1.852) : null,
        [`${system2.name}_cat`]: p2 ? p2.category : null,
      });
    }

    return data;
  }, [system1, system2]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      {/* ── Top Header & Historical Presets Card ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5" /> Dual-Track Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono text-muted-foreground bg-secondary/80 border border-border">
              22 Historical Records Ready
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Historical Storm Comparison
          </h1>
          <p className="text-sm text-muted-foreground">
            Side-by-side meteorological trajectory, peak intensity evolution, and landfall impact analysis.
          </p>
        </div>

        {/* Quick Comparison Presets */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          {PRESETS.map((p, idx) => {
            const isSelected = (selectedId1 === p.id1 && selectedId2 === p.id2) || (selectedId1 === p.id2 && selectedId2 === p.id1);
            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedId1(p.id1);
                  setSelectedId2(p.id2);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ring-1 ring-cyan-400/30 font-bold"
                    : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
                }`}
                title={p.desc}
              >
                <span>{p.icon}</span>
                <span>{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Storm Selection & Telemetry Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
        {/* Storm 1 Card (Cyan) */}
        <div className="md:col-span-5 p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 backdrop-blur-md shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
              Primary Cyclone (Storm 1)
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
              {system1?.basin || "Bay of Bengal"}
            </span>
          </div>

          <select
            value={selectedId1}
            onChange={(e) => setSelectedId1(e.target.value)}
            className="w-full bg-background/90 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer shadow-inner"
          >
            {cyclonesList.map((c) => (
              <option key={`s1-${c.id}`} value={c.id}>
                {c.name} ({c.year}) — {c.maxCategory}
              </option>
            ))}
          </select>

          {system1 && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-cyan-500/20 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Peak Sustained Wind</span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {system1.intensity_knots} KT <span className="text-[11px] text-muted-foreground font-normal">({Math.round(system1.intensity_knots * 1.852)} km/h)</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Classification</span>
                <span className="font-bold text-cyan-200 truncate block">
                  {system1.category}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Swap / VS Button */}
        <div className="md:col-span-1 flex justify-center">
          <button
            onClick={handleSwapStorms}
            className="w-11 h-11 rounded-2xl bg-secondary hover:bg-secondary/80 border border-border flex items-center justify-center text-foreground hover:text-primary transition-all shadow-lg hover:scale-110 cursor-pointer group"
            title="Swap Storm 1 & Storm 2"
          >
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
          </button>
        </div>

        {/* Storm 2 Card (Amber) */}
        <div className="md:col-span-5 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Comparison Cyclone (Storm 2)
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              {system2?.basin || "Bay of Bengal"}
            </span>
          </div>

          <select
            value={selectedId2}
            onChange={(e) => setSelectedId2(e.target.value)}
            className="w-full bg-background/90 border border-amber-500/40 rounded-xl px-3 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-inner"
          >
            {cyclonesList.map((c) => (
              <option key={`s2-${c.id}`} value={c.id}>
                {c.name} ({c.year}) — {c.maxCategory}
              </option>
            ))}
          </select>

          {system2 && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Peak Sustained Wind</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {system2.intensity_knots} KT <span className="text-[11px] text-muted-foreground font-normal">({Math.round(system2.intensity_knots * 1.852)} km/h)</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Classification</span>
                <span className="font-bold text-amber-200 truncate block">
                  {system2.category}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dual-Track Map & Intensity Curve Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Dual Track Map (7 cols) */}
        <div className="lg:col-span-7 min-h-[500px] h-[520px] rounded-2xl overflow-hidden border border-border shadow-xl bg-card relative">
          <CompareMapComponent system1={system1} system2={system2} />
        </div>

        {/* Intensity Evolution Curve Chart (5 cols) */}
        <div className="lg:col-span-5 min-h-[500px] h-[520px] p-5 rounded-2xl bg-card/90 border border-border backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm text-foreground">
                  Intensity Progression Curve
                </h3>
              </div>
              <span className="text-[10.5px] font-mono text-muted-foreground">Wind Speed (Knots)</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Normalized synoptic lifecycle trajectory comparing rate of rapid intensification (RI) and decay.
            </p>
          </div>

          <div className="w-full flex-1 min-h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="step" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} domain={[20, 150]} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(9, 9, 11, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    backdropFilter: "blur(12px)",
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} KT (${Math.round(Number(value) * 1.852)} km/h)`,
                    name
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {system1 && (
                  <Line
                    type="monotone"
                    dataKey={system1.name}
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#06b6d4", strokeWidth: 1, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                    name={`${system1.name} (${system1.category.split(" ")[0]})`}
                  />
                )}
                {system2 && (
                  <Line
                    type="monotone"
                    dataKey={system2.name}
                    stroke="#f59e0b"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: "#f59e0b", strokeWidth: 1, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                    name={`${system2.name} (${system2.category.split(" ")[0]})`}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Head-to-Head Comparative Metric Matrix Table ───────────────────── */}
      <div className="rounded-2xl bg-card/90 border border-border backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h3 className="font-heading font-bold text-sm text-foreground">
              Head-to-Head Landfall & Impact Comparison Matrix
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Official IMD RSMC Best-Track Archives</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/15 font-heading text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">Meteorological Metric</th>
                <th className="py-3 px-4 w-3/8 text-cyan-400 font-bold">
                  {system1?.name} ({system1?.track_forecast?.[0]?.label?.split(",")[0]?.split(" ")[0] || "Track 1"})
                </th>
                <th className="py-3 px-4 w-3/8 text-amber-400 font-bold">
                  {system2?.name} ({system2?.track_forecast?.[0]?.label?.split(",")[0]?.split(" ")[0] || "Track 2"})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Metric 1: Peak Intensity */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-blue-400" /> Peak Intensity (Knots / km/h)
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                  {system1?.intensity_knots} KT ({Math.round((system1?.intensity_knots || 0) * 1.852)} km/h)
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                  {system2?.intensity_knots} KT ({Math.round((system2?.intensity_knots || 0) * 1.852)} km/h)
                </td>
              </tr>

              {/* Metric 2: IMD Category */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-purple-400" /> IMD Max Classification
                </td>
                <td className="py-3.5 px-4 font-bold text-foreground">
                  <span className="px-2.5 py-1 rounded-md text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {system1?.category}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-bold text-foreground">
                  <span className="px-2.5 py-1 rounded-md text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {system2?.category}
                  </span>
                </td>
              </tr>

              {/* Metric 3: Landfall Location */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" /> Landfall Location
                </td>
                <td className="py-3.5 px-4 text-foreground font-medium">
                  {system1?.landfall_info?.landfall_location || "Offshore Dissipation / No Landfall"}
                </td>
                <td className="py-3.5 px-4 text-foreground font-medium">
                  {system2?.landfall_info?.landfall_location || "Offshore Dissipation / No Landfall"}
                </td>
              </tr>

              {/* Metric 4: Landfall Date & Time */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Landfall Date / Time (UTC)
                </td>
                <td className="py-3.5 px-4 font-mono text-cyan-200">
                  {system1?.landfall_info?.landfall_time_utc || "N/A"}
                </td>
                <td className="py-3.5 px-4 font-mono text-amber-200">
                  {system2?.landfall_info?.landfall_time_utc || "N/A"}
                </td>
              </tr>

              {/* Metric 5: Central Minimum Pressure */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" /> Central Min Pressure (hPa)
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                  {system1?.landfall_info?.central_pressure_hpa ? `${system1.landfall_info.central_pressure_hpa} hPa` : "980 hPa (Est)"}
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                  {system2?.landfall_info?.central_pressure_hpa ? `${system2.landfall_info.central_pressure_hpa} hPa` : "980 hPa (Est)"}
                </td>
              </tr>

              {/* Metric 6: Storm Surge Inundation */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" /> Max Storm Surge Height
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system1?.landfall_info?.storm_surge_m || "1.0 - 2.0m tidal surge"}
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system2?.landfall_info?.storm_surge_m || "1.0 - 2.0m tidal surge"}
                </td>
              </tr>

              {/* Metric 7: Impact Sector */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Affected Impact Sector
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system1?.landfall_info?.impact_sector || "Coastal areas"}
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system2?.landfall_info?.impact_sector || "Coastal areas"}
                </td>
              </tr>

              {/* Metric 8: Inland Decay */}
              <tr className="hover:bg-secondary/10 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Inland Decay Pattern
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system1?.landfall_info?.inland_decay || "Gradually dissipated inland into low pressure"}
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">
                  {system2?.landfall_info?.inland_decay || "Gradually dissipated inland into low pressure"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
