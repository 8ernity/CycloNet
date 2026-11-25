"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip, ZoomControl } from "react-leaflet";
import { Compass, Tag } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { formatCoordinates } from "@/lib/coordinates";
import { getCategoryAbbr, getIntensityColor, knotsToKmh } from "@/lib/cycloneIntensity";
import type { TrackPoint, WeatherSystem as ActiveSystem } from "@/types/api";
import { ensureLeafletDefaultIcons, getMapStyles, type InfraFilter, type MapStyleKey } from "./map/mapConfig";
import {
  ChangeView,
  InfrastructureFilterBar,
  InfrastructureOverlayLayers,
  MapStyleSwitcher,
} from "./map/MapOverlays";

interface MapProps {
  activeSystem: ActiveSystem | null;
}

function getPointLabel(pt: TrackPoint): string {
  const raw = pt.label || "";
  const isLandfallPt = pt.is_landfall || raw.toLowerCase().includes("landfall");
  if (raw) {
    const codePart = raw.split("(")[0].trim().replace(/,/g, " • ");
    return isLandfallPt ? `${codePart} • Landfall` : codePart;
  }
  const offset = pt.time_offset_hours;
  const timeLabel = offset == null ? "Time unavailable" : `${offset >= 0 ? "+" : ""}${offset}h from source reference`;
  const abbr = getCategoryAbbr(pt.category, pt.intensity_knots);
  const suffix = isLandfallPt ? " • Landfall" : "";
  return `${timeLabel} • ${pt.intensity_knots ?? "Not available"}KT • ${abbr}${suffix}`;
}

export default function MapComponent({ activeSystem }: MapProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("satellite");
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [infraFilter, setInfraFilter] = useState<InfraFilter>("all");
  const [showInfra, setShowInfra] = useState(false);

  useEffect(() => {
    ensureLeafletDefaultIcons();
  }, []);

  const mapStyles = getMapStyles();
  const activeTile = mapStyles[currentStyle];
  const center: [number, number] = activeSystem ? [activeSystem.lat, activeSystem.lon] : [17.5, 83.5];
  const zoomLevel = activeSystem ? 6 : 5;
  const points = activeSystem?.track_forecast || [];

  return (
    <div className={`relative w-full h-full select-none ${!showLabels ? "hide-imd-labels" : ""}`}>
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-card/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <div>
            <h4 className="font-heading font-semibold text-xs text-foreground">{activeTile.name}</h4>
            <p className="text-[10.5px] text-muted-foreground">
              {activeSystem
                ? `${activeSystem.name} • ${activeSystem.provenance || "Source unverified"}${activeSystem.is_stale ? " • Stale" : ""}`
                : "North Indian Ocean Basin • Current status unverified"}
            </p>
          </div>
        </div>

        <InfrastructureFilterBar
          showInfra={showInfra}
          onToggleInfra={() => setShowInfra((prev) => !prev)}
          infraFilter={infraFilter}
          onSelectFilter={setInfraFilter}
        />
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-1.5 flex-wrap justify-end">
        <button
          type="button"
          onClick={() => setShowLabels((prev) => !prev)}
          aria-pressed={showLabels}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showLabels
              ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/20"
              : "bg-background/90 text-foreground/70 border-border hover:bg-secondary"
          }`}
          title="Toggle IMD Bullet Labels (DD/HH, Wind, Category)"
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Labels</span>
        </button>

        <span className="text-xs bg-background/90 p-2 rounded">Uncertainty: Not validated</span>

        <MapStyleSwitcher
          currentStyle={currentStyle}
          onSelectStyle={setCurrentStyle}
          styles={mapStyles}
          isOpen={isLayerMenuOpen}
          setIsOpen={setIsLayerMenuOpen}
          title="Switch Map Layers (NASA VIIRS, base imagery, Dark Tactical)"
        />
      </div>

      {showLegend && activeSystem && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-background/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl max-w-xs text-xs space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
            <span className="font-heading font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              IMD & Geospatial Legend
            </span>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
            >
              Hide
            </button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="grid grid-cols-3 gap-1 pb-1.5 border-b border-border text-[10px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#a855f7] inline-block" /> D/DD
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block" /> CS
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" /> SCS
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" /> VSCS
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" /> ESCS
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#7f1d1d] inline-block" /> SuCS
              </span>
            </div>

            <div className="space-y-1 text-[10.5px] border-b border-border pb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500 inline-block" />
                <span className="text-muted-foreground">⚡ 400kV/220kV Power Grid Substation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500 inline-block" />
                <span className="text-muted-foreground">🏥 Cyclone Shelter & Trauma Hospital</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 rounded bg-blue-500 inline-block" />
                <span className="text-muted-foreground">🛣️ NH Arterial Evacuation Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-2 rounded-xs bg-cyan-500/40 border border-cyan-400 inline-block" />
                <span className="text-muted-foreground">🌊 Parametric Surge Inundation Zone</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-foreground/80 inline-block" />
              <span className="text-muted-foreground">
                {activeSystem?.telemetry_type === "HISTORICAL_BEST_TRACK" || activeSystem?.is_simulation
                  ? "Solid Line: Historical Best-Track"
                  : "Solid Line: Observed Track / 0h Fix"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0 border-t-2 border-dashed border-foreground/80 inline-block" />
              <span className="text-muted-foreground">
                {activeSystem?.telemetry_type === "HISTORICAL_BEST_TRACK" || activeSystem?.is_simulation
                  ? "Dashed Line: Post-Peak Best-Track Decay"
                  : "Dashed Line: BAM Dynamic Numerical Track"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-2 rounded-xs bg-[#22c55e]/35 border border-[#15803d] inline-block" />
              <span className="text-muted-foreground text-[10px]">Green Cone: IMD 5-Yr Verification Error Envelope</span>
            </div>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={zoomLevel}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        className={`z-0 ${!showLabels ? "hide-imd-labels" : ""}`}
      >
        <ZoomControl position="topright" />
        <ChangeView center={center} zoom={zoomLevel} />

        <TileLayer key={activeTile.url} attribution={activeTile.attribution} url={activeTile.url} />

        {showInfra && <InfrastructureOverlayLayers infraFilter={infraFilter} markerRadius={7} />}

        {activeSystem && (
          <>
            {points.map((pt, idx) => {
              if (idx === 0) return null;
              const prevPt = points[idx - 1];
              const color = getIntensityColor(pt.intensity_knots);
              return (
                <Polyline
                  key={`seg-${idx}`}
                  positions={[[prevPt.lat, prevPt.lon], [pt.lat, pt.lon]]}
                  pathOptions={{
                    color,
                    weight: 3.5,
                    dashArray: pt.is_forecast ? "6, 6" : undefined,
                    opacity: 0.95,
                  }}
                />
              );
            })}

            {points.map((pt, idx) => {
              const label = getPointLabel(pt);
              const color = getIntensityColor(pt.intensity_knots);
              const isLandfallPt = pt.is_landfall || (pt.label && pt.label.toLowerCase().includes("landfall"));
              const windKmh = knotsToKmh(pt.intensity_knots);
              return (
                <React.Fragment key={`pt-group-${idx}`}>
                  <CircleMarker
                    center={[pt.lat, pt.lon]}
                    radius={isLandfallPt ? 8 : pt.is_forecast ? 5.5 : 5}
                    fillColor={isLandfallPt ? "#dc2626" : color}
                    color="#ffffff"
                    weight={isLandfallPt ? 3 : 1.5}
                    fillOpacity={1}
                  >
                    {showLabels && (
                      <Tooltip permanent direction="right" offset={[10, 0]} className="imd-bullet-label">
                        <div
                          className={`font-mono text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md backdrop-blur-md transition-all shadow-md ${
                            isLandfallPt
                              ? "bg-red-950/95 text-red-100 border border-red-500/80 shadow-red-950/40 flex items-center gap-1"
                              : pt.is_forecast
                                ? "bg-zinc-950/90 text-red-300 border border-red-500/35"
                                : "bg-zinc-950/90 text-zinc-200 border border-zinc-700/60"
                          }`}
                        >
                          {isLandfallPt && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
                          <span>{isLandfallPt ? `🎯 ${label}` : label}</span>
                        </div>
                      </Tooltip>
                    )}
                    <Popup>
                      <div className="p-1 space-y-1 text-xs">
                        <p className="font-bold text-foreground">{pt.category}</p>
                        <p className="text-muted-foreground">
                          Wind:{" "}
                          <strong className="text-foreground">
                            {pt.intensity_knots ?? "Not available"} KT ({windKmh ?? "Not available"} km/h)
                          </strong>
                        </p>
                        <p className="text-muted-foreground">Fix: {formatCoordinates(pt.lat, pt.lon)}</p>
                        {isLandfallPt && (
                          <p className="font-bold text-red-500 bg-red-500/10 p-1 rounded border border-red-500/20">
                            🎯 Landfall Coastal Crossing Fix
                          </p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              );
            })}
          </>
        )}
      </MapContainer>
    </div>
  );
}
