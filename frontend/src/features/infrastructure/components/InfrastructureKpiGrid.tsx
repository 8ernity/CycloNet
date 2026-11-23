"use client";

import React from "react";
import { Building2, Radio, Waves, Zap } from "lucide-react";

interface InfrastructureKpiGridProps {
  scenarioMode: boolean;
  criticalSubstationsCount: number | null;
  totalGridCapacity: number;
  surgeM: number | null;
  inlandPenetrationKm: number | null | undefined;
  medicalSheltersCount: number;
  totalShelterCapacity: number;
  totalMedicalBeds: number;
}

export function InfrastructureKpiGrid({
  scenarioMode,
  criticalSubstationsCount,
  totalGridCapacity,
  surgeM,
  inlandPenetrationKm,
  medicalSheltersCount,
  totalShelterCapacity,
  totalMedicalBeds,
}: InfrastructureKpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card p-5 border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
            {scenarioMode
              ? criticalSubstationsCount === null
                ? "Exposure unavailable"
                : `${criticalSubstationsCount} critical scenario nodes`
              : "Unverified inventory"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Power Transmission Grid IVF</p>
        <p className="text-2xl font-mono font-black text-foreground">
          {scenarioMode ? `${(totalGridCapacity / 1000).toFixed(1)}k (assumed)` : "Unavailable"}{" "}
          <span className="text-xs font-normal text-muted-foreground">MVA Capacity</span>
        </p>
        <p className="text-[11px] text-amber-400 font-semibold">Multi-factor: Flood (30%) + Wind (25%) + Elev (15%)</p>
      </div>

      <div className="glass-card p-5 border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Waves className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Hydrodynamic</span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Peak Storm Surge Height</p>
        <p className="text-2xl font-mono font-black text-foreground">
          {surgeM ?? "Unavailable"} <span className="text-xs font-normal text-muted-foreground">meters AMSL</span>
        </p>
        <p className="text-[11px] text-cyan-400 font-semibold">
          Inland Penetration: {inlandPenetrationKm ?? "Unavailable"} km
        </p>
      </div>

      <div className="glass-card p-5 border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {scenarioMode ? `${medicalSheltersCount} illustrative shelters` : "Unverified inventory"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Cyclone Shelters Capacity</p>
        <p className="text-2xl font-mono font-black text-foreground">
          {scenarioMode ? `${totalShelterCapacity.toLocaleString()} (assumed)` : "Unavailable"}{" "}
          <span className="text-xs font-normal text-muted-foreground">persons</span>
        </p>
        <p className="text-[11px] text-emerald-400 font-semibold">
          {scenarioMode ? `${totalMedicalBeds} assumed beds` : "Medical beds unavailable"}
        </p>
      </div>

      <div className="glass-card p-5 border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <Radio className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            OASIS CAP-CP
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Early Warning Broadcast</p>
        <p className="text-2xl font-mono font-black text-foreground">5 Channels</p>
        <p className="text-[11px] text-red-400 font-semibold">CAP XML • SMS • SACHET • Siren • VHF</p>
      </div>
    </div>
  );
}
