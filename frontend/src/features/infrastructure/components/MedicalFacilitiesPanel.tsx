"use client";

import React from "react";
import { Search } from "lucide-react";
import { ObservationValue } from "@/components/ObservationValue";
import type { AnalyzedShelter } from "../types";

interface MedicalFacilitiesPanelProps {
  shelters: AnalyzedShelter[];
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  regionFilter: string;
  onRegionFilterChange: (value: string) => void;
}

export function MedicalFacilitiesPanel({
  shelters,
  searchFilter,
  onSearchFilterChange,
  regionFilter,
  onRegionFilterChange,
}: MedicalFacilitiesPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search facilities by name or location"
              placeholder="Search by facility name or location..."
              value={searchFilter}
              onChange={(e) => onSearchFilterChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
            />
          </div>

          <select
            aria-label="Filter facilities by state"
            value={regionFilter}
            onChange={(e) => onRegionFilterChange(e.target.value)}
            className="px-3 py-1.5 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground"
          >
            <option value="ALL">All States (Odisha, AP, WB, TN, Gujarat)</option>
            <option value="Odisha">Odisha Coastal Belt</option>
            <option value="Andhra">Andhra Pradesh</option>
            <option value="West Bengal">West Bengal / Sundarbans</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="Gujarat">Gujarat / Kutch</option>
          </select>
        </div>

        <span className="text-xs font-mono text-muted-foreground">Showing {shelters.length} Facilities</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shelters.map((shl) => {
          const suit = shl.suitability;
          const occupancyWidth =
            suit.occupancyPercentage != null && Number.isFinite(suit.occupancyPercentage)
              ? Math.max(0, Math.min(100, suit.occupancyPercentage))
              : 0;

          return (
            <div key={shl.id} className="glass-card p-5 border-border space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {shl.id} • {shl.region}
                    </span>
                    <h4 className="text-sm font-bold text-foreground leading-snug">{shl.name}</h4>
                  </div>
                  {suit.isRecommendedDestination && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      AUTHORIZED DESTINATION APPROVAL
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-muted-foreground">
                      Occupancy ({suit.occupancyPercentage ?? "Unavailable"}%):
                    </span>
                    <span className="font-bold text-foreground">
                      <ObservationValue attribute={suit.observations?.occupancy} /> / {suit.capacity ?? "Unavailable"}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (suit.occupancyPercentage ?? 0) >= 80 ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${occupancyWidth}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Medical Beds:</span>
                    <span className="font-bold text-emerald-400">{suit.medicalBeds ?? "Unavailable"}</span>
                  </div>
                  <div className="p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Road Access:</span>
                    <span className="font-bold text-sky-400">{suit.roadAccessStatus ?? "Unavailable"}</span>
                  </div>
                  <div className="p-2 rounded bg-secondary/30 border border-border/40 col-span-2">
                    <span className="text-[10px] text-muted-foreground block">Power Backup:</span>
                    <span className="font-bold text-emerald-400">{suit.powerBackupStatus ?? "Unavailable"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                <p>{suit.decisionNote}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
