"use client";

import React from "react";
import { BarChart3 } from "lucide-react";
import { getCategoryBadgeClass } from "@/lib/cycloneIntensity";
import type { ForecastTableRow } from "../utils/forecastTransforms";

interface ForecastTableProps {
  rows: ForecastTableRow[];
}

export function ForecastTable({ rows }: ForecastTableProps) {
  return (
    <div className="glass-card p-6 border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="font-heading font-bold text-lg text-foreground">Numeric Meteorological Forecast Table</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Supplied waypoints retain their source provenance. Experimental extrapolations are not official guidance; a
            zero-hour offset alone does not establish an observation.
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
              <th scope="col" className="py-3 px-4">Lead Time</th>
              <th scope="col" className="py-3 px-4">Coordinates</th>
              <th scope="col" className="py-3 px-4">Category</th>
              <th scope="col" className="py-3 px-4">Sustained Wind</th>
              <th scope="col" className="py-3 px-4">Peak Gusts</th>
              <th scope="col" className="py-3 px-4">Uncertainty Radius</th>
              <th scope="col" className="py-3 px-4">Provenance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, idx) => {
              const isNow = row.time_offset_hours === 0;
              const isLandfall = row.is_landfall;
              return (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-secondary/25 ${
                    isLandfall
                      ? "bg-amber-500/10 dark:bg-amber-500/15 font-semibold border-l-4 border-l-amber-500"
                      : isNow
                        ? "bg-red-500/5 font-medium border-l-4 border-l-red-500"
                        : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono font-bold">
                    {isLandfall ? (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        {row.time_offset_hours >= 0 ? `+${row.time_offset_hours}h` : `${row.time_offset_hours}h`} (Landfall)
                      </span>
                    ) : isNow ? (
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
                    <span className="font-bold text-foreground">{row.intensity_knots ?? "Not available"} kt</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                      ({row.kmh ?? "Unavailable"} km/h)
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-muted-foreground">
                    {row.gustKnots ?? "Unavailable"} kt ({row.gustKmh ?? "Unavailable"} km/h)
                  </td>

                  <td className="py-3.5 px-4 font-mono text-muted-foreground">Not validated</td>

                  <td className="py-3.5 px-4">
                    {isLandfall ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                        Coastal Landfall
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">{row.status}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
