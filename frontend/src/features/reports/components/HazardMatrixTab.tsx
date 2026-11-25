"use client";

import React from "react";
import { Anchor, CloudRain, Layers, MapPin, Waves, Wind } from "lucide-react";
import type { AffectedDistrict, PortSignal } from "../types";

interface HazardMatrixTabProps {
  knots: number | null;
  kmh: number | null;
  gusts: number | null;
  portSignals: PortSignal[];
  affectedDistricts: AffectedDistrict[];
}

export function HazardMatrixTab({ knots, kmh, gusts, portSignals, affectedDistricts }: HazardMatrixTabProps) {
  const surgeM = null;
  const waveM = null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-card p-6">
        <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
          IMD 4-Stage Tropical Cyclone Early Warning Protocol
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            className={`p-4 rounded-xl border ${
              knots != null && knots >= 34
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : "bg-secondary/30 border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold">STAGE 1 (72h Prior)</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">YELLOW</span>
            </div>
            <p className="font-bold text-sm text-foreground">Pre-Cyclone Watch</p>
            <p className="text-xs text-muted-foreground mt-1">
              Deep depression detection in oceanic basin. Marine warnings issued to off-shore vessels.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              knots != null && knots >= 48
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                : "bg-secondary/30 border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold">STAGE 2 (48h Prior)</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">ORANGE</span>
            </div>
            <p className="font-bold text-sm text-foreground">Cyclone Alert</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gale wind warning and coastal district mobilization. Fishing operations suspended.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              knots != null && knots >= 64
                ? "bg-red-500/10 border-red-500/40 text-red-400 ring-1 ring-red-500/30"
                : "bg-secondary/30 border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold">STAGE 3 (24h Prior)</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">RED</span>
            </div>
            <p className="font-bold text-sm text-foreground">Cyclone Warning</p>
            <p className="text-xs text-muted-foreground mt-1">
              Landfall sector identified. Consult local disaster management authorities for evacuation directives.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              knots != null && knots >= 64
                ? "bg-red-500/5 border-red-500/20 text-foreground"
                : "bg-secondary/30 border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold">STAGE 4 (12h Prior)</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">OUTLOOK</span>
            </div>
            <p className="font-bold text-sm text-foreground">Post-Landfall Outlook</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inland severe gale path, flash flooding, and heavy debris clearance operations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wind className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Gale Force</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Sustained Wind & Gusts</p>
            <p className="text-2xl font-mono font-black text-foreground">
              {kmh ?? "Not available"} <span className="text-xs font-normal text-muted-foreground">km/h</span>
            </p>
            <p className="text-xs text-orange-400 font-semibold mt-0.5">Peak Gusts: {gusts ?? "Not available"} km/h</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
            Uprooting of large trees, extensive damage to kutcha houses, and disruption of power lines.
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Waves className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Inundation</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Observed Storm Surge</p>
            <p className="text-2xl font-mono font-black text-foreground">
              {surgeM ?? "Not available"} <span className="text-xs font-normal text-muted-foreground">meters</span>
            </p>
            <p className="text-xs text-cyan-400 font-semibold mt-0.5">Wave Height: {waveM ?? "Not available"}m</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
            Flood extent cannot be inferred from wind alone. No observed inundation data is supplied.
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CloudRain className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Red Alert</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">24h Rainfall Forecast</p>
            <p className="text-2xl font-mono font-black text-foreground">
              Not available <span className="text-xs font-normal text-muted-foreground">mm</span>
            </p>
            <p className="text-xs text-indigo-400 font-semibold mt-0.5">Rainfall observation not available</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
            No verified rainfall or flood forecast is supplied.
          </p>
        </div>

        <div className="glass-card p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Anchor className="w-5 h-5" aria-hidden="true" />
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

      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
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
                <th scope="col" className="pb-3 pl-2">District / Jurisdiction</th>
                <th scope="col" className="pb-3">State</th>
                <th scope="col" className="pb-3">Threat Rating</th>
                <th scope="col" className="pb-3">Cyclone Shelters</th>
                <th scope="col" className="pb-3 text-right pr-2">Evacuation Order</th>
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
                    <span
                      className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                        d.risk.includes("Extremely")
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : d.risk.includes("High")
                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                            : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                      }`}
                    >
                      {d.risk}
                    </span>
                  </td>
                  <td className="py-3.5 text-foreground">{d.shelters}</td>
                  <td className="py-3.5 text-right pr-2">
                    <span
                      className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                        d.evacuation.includes("Hazard")
                          ? "bg-red-500/20 text-red-400 border border-red-500/30 font-sans"
                          : "bg-secondary text-foreground font-sans"
                      }`}
                    >
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
  );
}
