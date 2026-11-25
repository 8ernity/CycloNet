"use client";

import React from "react";
import { Clock } from "lucide-react";
import type { TrackPoint, WeatherSystem } from "@/types/api";

interface ForecastTimelineProps {
  system: WeatherSystem;
  futurePoints: TrackPoint[];
  currentPoint: Pick<TrackPoint, "lat" | "lon" | "category" | "intensity_knots">;
  pastPoints: TrackPoint[];
}

export function ForecastTimeline({ system, futurePoints, currentPoint, pastPoints }: ForecastTimelineProps) {
  return (
    <div className="glass-card p-6 border border-border">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
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
                    {pt.provenance ?? "UNKNOWN"}
                  </span>
                </div>
                <p className="font-medium text-foreground text-sm">{pt.category}</p>
              </div>
              <div className="flex gap-6 items-center">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase">Fix Coordinates</p>
                  <p className="font-mono text-sm">
                    {pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E
                  </p>
                </div>
                <div className="text-right min-w-[70px]">
                  <p className="text-[10px] text-muted-foreground uppercase">Intensity</p>
                  <p className="font-bold text-foreground font-mono">
                    {pt.intensity_knots ?? "Not available"}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">kt</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="relative">
          <div className="absolute -left-[35px] top-2 w-5 h-5 rounded-full border-[4px] border-red-500 bg-background ring-4 ring-background animate-pulse" />
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center bg-red-500/10 p-4 rounded-xl border border-red-500/30">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-red-500">{system.provenance ?? "UNKNOWN"}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  {system.provenance ?? "UNKNOWN"}
                </span>
              </div>
              <p className="font-bold text-foreground">{currentPoint.category}</p>
            </div>
            <div className="flex gap-6 items-center">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase">Fix Coordinates</p>
                <p className="font-mono text-sm font-bold">
                  {currentPoint.lat.toFixed(1)}&deg;N, {currentPoint.lon.toFixed(1)}&deg;E
                </p>
              </div>
              <div className="text-right min-w-[70px]">
                <p className="text-[10px] text-muted-foreground uppercase">Intensity</p>
                <p className="font-bold text-red-500 font-mono text-base">
                  {currentPoint.intensity_knots ?? "Not available"}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">kt</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {pastPoints.map((pt, idx) => (
          <div key={`past-${idx}`} className="relative opacity-60 hover:opacity-100 transition-opacity">
            <div className="absolute -left-[29px] top-2 w-2 h-2 rounded-full bg-muted-foreground ring-4 ring-background" />
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center py-2 px-3.5 rounded-xl hover:bg-secondary/20 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{pt.time_offset_hours} Hours</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                    {system.provenance ?? "UNKNOWN"}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground/80">{pt.category}</p>
              </div>
              <div className="flex gap-6 items-center">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground/70">Coordinates</p>
                  <p className="font-mono text-xs text-foreground/80">
                    {pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E
                  </p>
                </div>
                <div className="text-right min-w-[70px]">
                  <p className="text-[10px] text-muted-foreground/70">Intensity</p>
                  <p className="font-medium text-foreground/80 font-mono text-xs">
                    {pt.intensity_knots ?? "Not available"}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground/70">kt</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
