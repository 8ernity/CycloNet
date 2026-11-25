"use client";

import React from "react";
import { Activity, Compass } from "lucide-react";
import type { WeatherSystem } from "@/types/api";

interface CenterStatusCardsProps {
  system: WeatherSystem;
  sourceShortLabel: string;
  convertedKnots: number | null;
  convertedKmh: number | null;
}

export function CenterStatusCards({
  system,
  sourceShortLabel,
  convertedKnots,
  convertedKmh,
}: CenterStatusCardsProps) {
  return (
    <div className="lg:col-span-1 flex flex-col gap-4 justify-between">
      <div className="glass-card p-4.5 border border-border flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/15 text-red-400">
              <Activity className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                {system.provenance ?? "UNKNOWN"}
              </span>
              <h3 className="font-heading font-bold text-sm text-foreground">{system.name}</h3>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground/80 border border-border">
            {system.basin ?? "Unavailable"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 my-2">
          <div className="bg-secondary/30 p-2.5 rounded-xl border border-border/60">
            <span className="text-[10px] text-muted-foreground block">Max Wind ({sourceShortLabel})</span>
            <span className="text-lg font-heading font-bold text-foreground">
              {convertedKnots ?? "Unavailable"} <span className="text-xs font-normal text-muted-foreground">kt</span>
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
              {convertedKmh ?? "Unavailable"} km/h
            </span>
          </div>

          <div className="bg-secondary/30 p-2.5 rounded-xl border border-border/60">
            <span className="text-[10px] text-muted-foreground block">Coordinates (0h Fix)</span>
            <span className="text-xs font-mono font-bold text-foreground block mt-1">{system.lat.toFixed(1)}&deg;N</span>
            <span className="text-xs font-mono font-bold text-foreground block">{system.lon.toFixed(1)}&deg;E</span>
          </div>
        </div>

        <div className="bg-secondary/20 p-2 rounded-lg border border-border/50 my-1 text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10.5px]">Dvorak Intensity:</span>
            <span className="font-mono font-bold text-primary text-xs">
              {system.dvorak_t || "Not available"}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                ({system.provenance ?? "UNKNOWN"})
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/40">
            <span>
              Fix Type: <strong className="text-emerald-500 font-medium">{system.provenance ?? "UNKNOWN"}</strong>
            </span>
            <span>•</span>
            <span>
              Trajectory: <strong className="text-foreground font-medium">{system.provenance ?? "UNKNOWN"}</strong>
            </span>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1.5 border-t border-border/50">
          <Compass className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Steering and landfall evolution are not independently validated.</span>
        </div>
      </div>

      <div className="glass-card p-4.5 border border-border">
        <h3 className="font-heading font-bold text-sm">Intensity trend assessment</h3>
        <p className="text-sm text-muted-foreground">
          Unavailable. An operational intensification assessment requires a reviewed series with consistent source, timing
          and wind averaging. Experimental tracks do not establish an alert or stable conditions.
        </p>
      </div>

      <div className="glass-card p-4.5 border border-border">
        <h3 className="font-heading font-bold text-sm">Forecast calibration</h3>
        <p className="text-sm text-muted-foreground">
          Not validated. No independently measured CycloNet confidence interval is available.
        </p>
      </div>
    </div>
  );
}
