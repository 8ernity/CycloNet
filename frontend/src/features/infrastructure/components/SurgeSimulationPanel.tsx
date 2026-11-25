"use client";

import React from "react";
import { AlertOctagon, CheckCircle, CloudRain, Cpu, Layers, ShieldAlert, Sparkles, Waves } from "lucide-react";
import type { RainfallPathway, SurgeCalculation, SurgeSector } from "@/types/api";
import { knotsToKmh } from "@/lib/cycloneIntensity";

interface SurgeSimulationPanelProps {
  basin?: string | null;
  surgeCalcData: SurgeCalculation | null;
  surgeSectors: SurgeSector[];
  rainfallPathways: RainfallPathway[];
  simWindKts: number;
  onSimWindKtsChange: (val: number) => void;
  simPressureHpa: number;
  onSimPressureHpaChange: (val: number) => void;
  simTideM: number;
  onSimTideMChange: (val: number) => void;
  simAngleDeg: number;
  onSimAngleDegChange: (val: number) => void;
  simRainMm: number;
  briefingLoading: boolean;
  onGenerateBriefing: () => void;
}

export function SurgeSimulationPanel({
  basin,
  surgeCalcData,
  surgeSectors,
  rainfallPathways,
  simWindKts,
  onSimWindKtsChange,
  simPressureHpa,
  onSimPressureHpaChange,
  simTideM,
  onSimTideMChange,
  simAngleDeg,
  onSimAngleDegChange,
  simRainMm,
  briefingLoading,
  onGenerateBriefing,
}: SurgeSimulationPanelProps) {
  const surgeM = surgeCalcData?.peak_surge_height_m ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-card p-5 border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/20 via-background to-cyan-950/20">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
            <Waves className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Parametric Hydrodynamic Surge Simulator (Jelesnianski Formulation)
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                <Layers className="w-3 h-3" aria-hidden="true" /> Satellite observations unavailable
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Compound Coastal Storm Surge & Catchment Runoff Forecaster
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
              Simulates inverted barometer ocean rise, shallow continental shelf wind stress, astronomical tide phase
              superposition, and digital elevation catchment drainage choke points.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateBriefing}
          disabled={!surgeCalcData || briefingLoading}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 animate-pulse" aria-hidden="true" />
          <span>Generate scenario summary</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">
            Peak Storm Surge (S-peak)
          </span>
          <p className="text-3xl font-mono font-black text-foreground">
            {surgeM ?? "Unavailable"} <span className="text-sm font-normal text-muted-foreground">meters</span>
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            {surgeCalcData?.severity_level ?? "Severity unavailable"}
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            Inverted Barometer Effect
          </span>
          <p className="text-3xl font-mono font-black text-foreground">
            {surgeCalcData?.inverted_barometer_m ?? "Unavailable"}{" "}
            <span className="text-sm font-normal text-muted-foreground">m rise</span>
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            ΔP = {1013 - simPressureHpa} hPa below standard
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
            Wind Stress On Shelf
          </span>
          <p className="text-3xl font-mono font-black text-foreground">
            {surgeCalcData?.wind_setup_m ?? "Unavailable"}{" "}
            <span className="text-sm font-normal text-muted-foreground">m setup</span>
          </p>
          <p className="text-[11px] text-amber-400 font-semibold font-mono">
            {basin?.includes("Bengal") ? "Assumed Bay of Bengal shelf" : "Assumed Arabian Sea shelf"}
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">
            Inland Flood Penetration
          </span>
          <p className="text-3xl font-mono font-black text-foreground">
            {surgeCalcData?.inland_penetration_km ?? "Unavailable"}{" "}
            <span className="text-sm font-normal text-muted-foreground">km inland</span>
          </p>
          <p className="text-[11px] text-purple-400 font-semibold">
            Based on an assumed slope; no terrain raster is connected
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 border-border space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
            <Cpu className="w-4 h-4 text-primary" aria-hidden="true" />
            Parametric Simulation Controls
          </h4>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <label htmlFor="sim-wind-slider">Sustained Wind Speed:</label>
                <span className="font-mono text-primary font-bold">
                  {simWindKts} Knots ({knotsToKmh(simWindKts)} km/h)
                </span>
              </div>
              <input
                id="sim-wind-slider"
                type="range"
                aria-label="Scenario sustained wind in knots"
                min="35"
                max="155"
                step="5"
                value={simWindKts}
                onChange={(e) => onSimWindKtsChange(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <label htmlFor="sim-pressure-slider">Central Barometric Pressure:</label>
                <span className="font-mono text-cyan-400">{simPressureHpa} hPa</span>
              </div>
              <input
                id="sim-pressure-slider"
                type="range"
                aria-label="Scenario central pressure in hectopascals"
                min="900"
                max="1000"
                step="1"
                value={simPressureHpa}
                onChange={(e) => onSimPressureHpaChange(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <label htmlFor="sim-tide-slider">Astronomical Tide Stage:</label>
                <span className="font-mono text-blue-400">+{simTideM.toFixed(1)} m (High Spring Tide)</span>
              </div>
              <input
                id="sim-tide-slider"
                type="range"
                aria-label="Scenario tide height in meters"
                min="0.2"
                max="3.0"
                step="0.1"
                value={simTideM}
                onChange={(e) => onSimTideMChange(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <label htmlFor="sim-angle-slider">Landfall Approach Angle:</label>
                <span className="font-mono text-amber-400">{simAngleDeg}° Normal</span>
              </div>
              <input
                id="sim-angle-slider"
                type="range"
                aria-label="Scenario approach angle in degrees"
                min="30"
                max="90"
                step="5"
                value={simAngleDeg}
                onChange={(e) => onSimAngleDegChange(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-5 border-border space-y-4 lg:col-span-2">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
            Quadrant Coastal Surge Transect Hazard Footprint
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {surgeSectors.map((sec, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] font-bold text-foreground line-clamp-1">{sec.sector_name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      sec.risk_rating === "EXTREME"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : sec.risk_rating === "CRITICAL"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {sec.risk_rating}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-mono text-primary font-bold text-sm">{sec.estimated_surge_m}m Peak Surge</p>
                  <p className="text-[11px] text-muted-foreground">
                    Inundation: <strong>{sec.inundation_depth_m}</strong>
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">Sector: {sec.offset_km}</p>
                </div>

                <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                  <p className="font-semibold text-foreground mb-0.5">Critical Assets:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {sec.critical_assets.map((ast: string, aIdx: number) => (
                      <li key={aIdx} className="line-clamp-1">
                        {ast}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 border-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-blue-400" aria-hidden="true" />
              Assumed-Terrain Catchment Runoff & Drainage Choke Points
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assumed-terrain catchment runoff pathway simulation and compound estuarine backwater bottleneck analysis.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20">
              Simulated Rainfall: <strong>{simRainMm} mm</strong> (24h Window)
            </span>
            <span className="text-xs font-mono bg-red-500/10 text-red-400 px-3 py-1 rounded-lg border border-red-500/20 font-bold">
              Runoff Risk: CRITICAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono flex-wrap bg-secondary/30 p-2.5 rounded-lg border border-border/60">
          <span className="text-muted-foreground">Channel Classification:</span>
          <span className="flex items-center gap-1 text-sky-400 font-semibold">Main River Basin</span>
          <span className="flex items-center gap-1 text-amber-400 font-semibold">Runoff Pathway</span>
          <span className="flex items-center gap-1 text-orange-400 font-semibold">Terrain Gravity Vector</span>
          <span className="flex items-center gap-1 text-red-400 font-semibold animate-pulse">Simulated Flood Choke Point</span>
        </div>

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
                Catchment: <strong className="text-foreground">{path.basin}</strong> • Assumed slope:{" "}
                <strong className="text-primary">{path.assumed_slope_deg}°</strong>
              </p>

              <div className="space-y-2 text-xs pt-1 border-t border-border/40">
                <p className="font-bold text-red-400 flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />
                  Critical Choke Points (ETA & Inundation Depth):
                </p>
                <div className="space-y-1.5 font-mono">
                  {path.critical_choke_points?.map((chk, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-2 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-between"
                    >
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
  );
}
