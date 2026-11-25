"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Wind } from "lucide-react";
import dynamic from "next/dynamic";
import { useDataSource } from "@/hooks/useDataSource";
import { useForecastData } from "@/features/forecast/hooks/useForecastData";
import { buildForecastChartData, buildForecastTableRows } from "@/features/forecast/utils/forecastTransforms";
import { LandfallBanner } from "@/features/forecast/components/LandfallBanner";
import { CenterStatusCards } from "@/features/forecast/components/CenterStatusCards";
import { IntensityChart } from "@/features/forecast/components/IntensityChart";
import { ForecastTable } from "@/features/forecast/components/ForecastTable";
import { ForecastTimeline } from "@/features/forecast/components/ForecastTimeline";

const MapWidget = dynamic(() => import("@/components/MapWidget"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-xl border border-border flex items-center justify-center bg-secondary/5">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  ),
});

export default function ForecastPage() {
  const { getConvertedKnots, getConvertedKmh, getConvertedCategory, getSourceBadge } = useDataSource();
  const { selectedId, cyclonesList, system, loading, sourceError, fetchSystem, handleSelectCyclone } =
    useForecastData();
  const sourceBadge = getSourceBadge();

  const chartData = useMemo(
    () => buildForecastChartData(system?.track_forecast, { getConvertedKnots, getConvertedKmh, getConvertedCategory }),
    [system, getConvertedKnots, getConvertedKmh, getConvertedCategory]
  );

  const forecastTableRows = useMemo(
    () => buildForecastTableRows(system?.track_forecast, { getConvertedKnots, getConvertedKmh, getConvertedCategory }),
    [system, getConvertedKnots, getConvertedKmh, getConvertedCategory]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground gap-4">
        <Wind className="w-12 h-12 opacity-50" aria-hidden="true" />
        <p className="text-sm font-medium">
          {sourceError
            ? "Forecast source unavailable. Retry the request."
            : "No current track is available; this does not establish calm."}
        </p>
        <button
          type="button"
          onClick={() => void fetchSystem(selectedId)}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-md"
        >
          Retry track source
        </button>
      </div>
    );
  }

  const pastPoints = system.track_forecast.filter((p) => !p.is_forecast && p.time_offset_hours < 0).reverse();
  const currentPoint = system.track_forecast.find((p) => p.time_offset_hours === 0) ??
    system.track_forecast[0] ?? {
      lat: system.lat,
      lon: system.lon,
      category: system.category,
      intensity_knots: system.intensity_knots,
    };
  const futurePoints = [...system.track_forecast.filter((p) => p.is_forecast)].reverse();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">Track Forecast & Kinematics</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
              {system.id}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Source waypoints, wind values and explicit validation status.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-xl shadow-xs backdrop-blur-md">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Select Storm:</span>
            <select
              aria-label="Select storm"
              value={selectedId}
              onChange={(e) => handleSelectCyclone(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer max-w-[240px]"
            >
              <option value="">Current source observations</option>
              {selectedId && !cyclonesList.some((c) => c.id === selectedId) && (
                <option value={selectedId}>{selectedId}</option>
              )}
              {cyclonesList.map((c) => (
                <option key={c.id} value={c.id} className="bg-card text-foreground">
                  {"Archive: "}
                  {c.name.startsWith("Cyclone") || c.name.startsWith("Deep") ? c.name : `Cyclone ${c.name}`}{" "}
                  {c.year ? `(${c.year})` : ""}
                </option>
              ))}
            </select>
          </div>

          <span
            className={`px-2.5 py-1.5 rounded-full text-xs font-bold border ${sourceBadge.badgeClass} whitespace-nowrap`}
            title={sourceBadge.desc}
          >
            {sourceBadge.shortLabel}
          </span>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 whitespace-nowrap">
            <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
              {getConvertedCategory(system.intensity_knots)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3.5 px-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-secondary/30 border-border">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-2 py-0.5 rounded font-mono font-bold">{system.provenance ?? "UNKNOWN"}</span>
          <span>
            {system.is_stale
              ? "STALE — current conditions not verified"
              : "Check source observation time before use"}
          </span>
          <span>
            Source: {system.source ?? "Unavailable"} · Observation: {system.observation_time_utc ?? "Unavailable"}
          </span>
        </div>
        <span className="text-[10.5px] text-muted-foreground italic sm:text-right">
          Civil Defense: Statutory warnings follow IMD (RSMC New Delhi) bulletins.
        </span>
      </div>

      <LandfallBanner system={system} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="glass-card lg:col-span-2 p-0 overflow-hidden border border-border flex flex-col min-h-[520px] relative z-0">
          <div className="w-full h-full min-h-[520px] flex-1">
            <MapWidget key={system.id} points={system.track_forecast} systemName={system.name} />
          </div>
        </div>

        <CenterStatusCards
          system={system}
          sourceShortLabel={sourceBadge.shortLabel}
          convertedKnots={getConvertedKnots(system.intensity_knots)}
          convertedKmh={getConvertedKmh(system.intensity_knots)}
        />
      </div>

      <IntensityChart chartData={chartData} />
      <ForecastTable rows={forecastTableRows} />

      <div className="glass-card p-6 border border-border">
        <h3 className="font-heading font-bold text-lg">Model performance</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Not validated. No independently evaluated track error, intensity error or calibrated uncertainty is available.
        </p>
      </div>

      <ForecastTimeline
        system={system}
        futurePoints={futurePoints}
        currentPoint={currentPoint}
        pastPoints={pastPoints}
      />
    </div>
  );
}
