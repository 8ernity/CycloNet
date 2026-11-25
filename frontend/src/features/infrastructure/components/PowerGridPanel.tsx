"use client";

import React from "react";
import { Search, ShieldAlert } from "lucide-react";
import type { AnalyzedSubstation } from "../types";

interface PowerGridPanelProps {
  totalSubstationsCount: number;
  filteredSubstations: AnalyzedSubstation[];
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  infraFilter: "all" | "critical" | "high";
  onInfraFilterChange: (value: "all" | "critical" | "high") => void;
}

export function PowerGridPanel({
  totalSubstationsCount,
  filteredSubstations,
  searchFilter,
  onSearchFilterChange,
  infraFilter,
  onInfraFilterChange,
}: PowerGridPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="p-4 rounded-xl bg-secondary/40 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
            Infrastructure Vulnerability Index (IVF) Mathematical Framework
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            Risk Score = (0.30 &times; Flood Depth) + (0.25 &times; Wind Exposure) + (0.15 &times; Elevation Deficit) +
            (0.10 &times; Coastal Proximity) + (0.20 &times; Criticality)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono shrink-0 flex-wrap">
          <span className="px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30">75–100 CRITICAL</span>
          <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">50–74 HIGH</span>
          <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">25–49 MODERATE</span>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              aria-label="Filter by substation name or type"
              placeholder="Filter by substation name or type..."
              value={searchFilter}
              onChange={(e) => onSearchFilterChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
            />
          </div>

          <div className="flex gap-1">
            {(["all", "critical", "high"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                aria-pressed={infraFilter === lvl}
                onClick={() => onInfraFilterChange(lvl)}
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
          <span>
            Showing {filteredSubstations.length} of {totalSubstationsCount} Grid Nodes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubstations.map((sub) => {
          const ivf = sub.ivf;
          if (!ivf) {
            return (
              <div key={sub.id} className="glass-card p-5 border-border space-y-2">
                <h4 className="text-sm font-bold">{sub.name}</h4>
                <p className="text-xs text-muted-foreground">
                  Grid exposure unavailable: a complete current scenario calculation is required.
                </p>
              </div>
            );
          }

          return (
            <div key={sub.id} className="glass-card p-5 border-border space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {sub.id} • {sub.type}
                    </span>
                    <h4 className="text-sm font-bold text-foreground leading-snug">{sub.name}</h4>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-black shrink-0 ${
                      ivf.riskCategory === "CRITICAL"
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : ivf.riskCategory === "HIGH"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                    }`}
                  >
                    {ivf.riskScore}/100 illustrative {ivf.riskCategory}
                  </span>
                </div>

                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      ivf.riskCategory === "CRITICAL"
                        ? "bg-red-500"
                        : ivf.riskCategory === "HIGH"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${ivf.riskScore}%` }}
                  />
                </div>

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

              <div className="pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Recommended Action:</p>
                <p className="line-clamp-2 leading-relaxed">{ivf.recommendedAction}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
