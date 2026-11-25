"use client";

import React from "react";
import { Compass } from "lucide-react";
import type { WeatherSystem } from "@/types/api";

interface LandfallBannerProps {
  system: WeatherSystem;
}

export function LandfallBanner({ system }: LandfallBannerProps) {
  if (!system.landfall_info) return null;
  const info = system.landfall_info;

  return (
    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-start gap-3.5">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            system.is_landfall_completed ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500 animate-pulse"
          }`}
        >
          <Compass className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                system.is_landfall_completed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {info.status || (system.is_landfall_completed ? "Landfall Completed" : "Coastal Crossing")}
            </span>
            <span className="font-heading font-bold text-sm text-foreground">
              {info.landfall_location || "Coastal Sector"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">• {info.landfall_time_utc}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
            <span>
              <strong className="text-foreground">Intensity:</strong> {info.landfall_intensity_knots ?? "Unavailable"} KT (
              {info.landfall_intensity_kmph ?? "Unavailable"} km/h, Gusts: {info.landfall_gusts_kmph ?? "Unavailable"} km/h)
            </span>
            <span>•</span>
            <span>
              <strong className="text-foreground">Pressure:</strong> {info.central_pressure_hpa ?? "Unavailable"} hPa
            </span>
            <span>•</span>
            <span>
              <strong className="text-foreground">Storm Surge:</strong> {info.storm_surge_m ?? "Unavailable"}
            </span>
          </div>
          {info.inland_decay && (
            <p className="text-[11.5px] text-muted-foreground/80 mt-1">
              <span className="text-foreground font-medium">Inland Decay:</span> {info.inland_decay}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <a
          href={`/infrastructure?tab=grid&cyclone_id=${encodeURIComponent(system.id)}`}
          className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>Infrastructure Grid</span>
        </a>
        <a
          href={`/infrastructure?tab=insurance&cyclone_id=${encodeURIComponent(system.id)}`}
          className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>Parametric Liquidity</span>
        </a>
      </div>
    </div>
  );
}
