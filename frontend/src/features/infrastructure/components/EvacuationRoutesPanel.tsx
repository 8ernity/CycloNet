"use client";

import React from "react";
import { ArrowRight, Navigation } from "lucide-react";
import type { AnalyzedRoute } from "../types";

interface EvacuationRoutesPanelProps {
  routes: AnalyzedRoute[];
}

export function EvacuationRoutesPanel({ routes }: EvacuationRoutesPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-400" aria-hidden="true" />
            Road observations and illustrative scenarios
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Road conditions require current authorized observations. Scenario exposure uses assumed terrain and cannot
            identify a safe evacuation route.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono shrink-0">
          <span className="text-muted-foreground">Illustrative exposure only · Road status unknown</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {routes.map((route) => {
          const v = route.vuln;
          if (!v) {
            return (
              <div key={route.id} className="glass-card p-5 border-border space-y-2">
                <h4 className="text-sm font-bold">{route.name}</h4>
                <p className="text-xs text-muted-foreground">
                  Road exposure unavailable: a complete current scenario calculation is required.
                </p>
              </div>
            );
          }

          return (
            <div key={route.id} className="glass-card p-5 border-border space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {route.highwayCode}
                  </span>
                  <span
                    className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                    style={{ color: v.statusColor, backgroundColor: `${v.statusColor}15` }}
                  >
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

                <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Recommended Alternative Corridor:
                  </span>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
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
  );
}
