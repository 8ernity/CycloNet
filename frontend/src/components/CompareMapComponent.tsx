"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip, ZoomControl } from "react-leaflet";
import { Compass, Tag } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { formatCoordinates } from "@/lib/coordinates";
import { knotsToKmh } from "@/lib/cycloneIntensity";
import type { LandfallInfo, TrackPoint } from "@/types/api";
import { ensureLeafletDefaultIcons, getMapStyles, type MapStyleKey } from "./map/mapConfig";
import { ChangeView, MapStyleSwitcher } from "./map/MapOverlays";

interface CycloneComparisonSystem {
  id: string;
  name: string;
  basin: string;
  category: string;
  intensity_knots: number | null;
  track_forecast?: TrackPoint[];
  landfall_info?: LandfallInfo;
}

interface CompareMapProps {
  system1: CycloneComparisonSystem | null;
  system2: CycloneComparisonSystem | null;
}

function getPeakIntensityIndex(points: TrackPoint[]): number {
  let maxKnots = -1;
  let peakIndex = -1;
  points.forEach((pt, idx) => {
    if (pt.intensity_knots != null && pt.intensity_knots > maxKnots) {
      maxKnots = pt.intensity_knots;
      peakIndex = idx;
    }
  });
  return peakIndex;
}

interface TrackOverlayProps {
  system: CycloneComparisonSystem;
  points: TrackPoint[];
  maxIdx: number;
  showLabels: boolean;
  prefix: "sys1" | "sys2";
  lineColor: string;
  peakColor: string;
  baseColor: string;
  dashed?: boolean;
  tooltipDirection: "left" | "right";
  tooltipOffset: [number, number];
  accentClass: string;
  peakClass: string;
  genesisClass: string;
}

function ComparisonTrackOverlay({
  system,
  points,
  maxIdx,
  showLabels,
  prefix,
  lineColor,
  peakColor,
  baseColor,
  dashed = false,
  tooltipDirection,
  tooltipOffset,
  accentClass,
  peakClass,
  genesisClass,
}: TrackOverlayProps) {
  return (
    <>
      {points.map((pt, idx) => {
        if (idx === 0) return null;
        const prev = points[idx - 1];
        return (
          <Polyline
            key={`${prefix}-seg-${idx}`}
            positions={[[prev.lat, prev.lon], [pt.lat, pt.lon]]}
            pathOptions={{
              color: lineColor,
              weight: 3.5,
              dashArray: dashed ? "6, 4" : undefined,
              opacity: 0.95,
            }}
          />
        );
      })}

      {points.map((pt, idx) => {
        const isLandfall = Boolean(pt.is_landfall || (pt.label && pt.label.toLowerCase().includes("landfall")));
        const isPeak = idx === maxIdx;
        const isMilestone = isLandfall || isPeak || idx === 0;
        const windKmh = knotsToKmh(pt.intensity_knots);

        return (
          <CircleMarker
            key={`${prefix}-pt-${idx}`}
            center={[pt.lat, pt.lon]}
            radius={isLandfall ? 8 : isPeak ? 7 : 5}
            fillColor={isLandfall ? "#dc2626" : isPeak ? peakColor : baseColor}
            color="#ffffff"
            weight={isLandfall ? 3 : isPeak ? 2.5 : 1.5}
            fillOpacity={1}
          >
            {showLabels && isMilestone ? (
              <Tooltip permanent direction={tooltipDirection} offset={tooltipOffset} className="compare-milestone-label">
                <div
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1 ${
                    isLandfall
                      ? "bg-red-950/95 text-red-200 border border-red-500/70"
                      : isPeak
                        ? peakClass
                        : genesisClass
                  }`}
                >
                  {isLandfall && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                  {isPeak && <span>⭐ PEAK:</span>}
                  <span>
                    {system.name}: {pt.intensity_knots ?? "Not available"}KT {isLandfall ? "(Landfall)" : ""}
                  </span>
                </div>
              </Tooltip>
            ) : (
              <Tooltip direction="top" offset={[0, -6]}>
                <span className="font-mono text-[10px] font-bold">
                  {system.name}: {pt.intensity_knots ?? "Not available"} KT • {pt.category}
                </span>
              </Tooltip>
            )}
            <Popup>
              <div className="p-1.5 space-y-1 text-xs">
                <p className={`font-bold ${accentClass}`}>
                  {system.name} — {pt.category}
                </p>
                <p className="text-muted-foreground">
                  Wind:{" "}
                  <strong className="text-white">
                    {pt.intensity_knots ?? "Not available"} KT ({windKmh ?? "Not available"} km/h)
                  </strong>
                </p>
                <p className="text-muted-foreground">Fix: {formatCoordinates(pt.lat, pt.lon)}</p>
                {isLandfall && (
                  <p className="font-bold text-red-400 bg-red-950/50 p-1 rounded border border-red-500/30">
                    🎯 Landfall Coastal Crossing
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function CompareMapComponent({ system1, system2 }: CompareMapProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("satellite");
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    ensureLeafletDefaultIcons();
  }, []);

  const mapStyles = getMapStyles();
  const activeTile = mapStyles[currentStyle];

  const pts1 = useMemo(() => system1?.track_forecast ?? [], [system1?.track_forecast]);
  const pts2 = useMemo(() => system2?.track_forecast ?? [], [system2?.track_forecast]);
  const maxIdx1 = useMemo(() => getPeakIntensityIndex(pts1), [pts1]);
  const maxIdx2 = useMemo(() => getPeakIntensityIndex(pts2), [pts2]);

  const allPts = [...pts1, ...pts2];
  const center: [number, number] =
    allPts.length > 0
      ? [
          allPts.reduce((acc, p) => acc + p.lat, 0) / allPts.length,
          allPts.reduce((acc, p) => acc + p.lon, 0) / allPts.length,
        ]
      : [18.0, 84.0];

  return (
    <div className={`relative w-full h-full select-none ${!showLabels ? "hide-imd-labels" : ""}`}>
      <div className="absolute top-4 left-4 z-[1000] bg-card/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5 pointer-events-auto">
        <Compass className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
        <div>
          <h4 className="font-heading font-semibold text-xs text-foreground">Dual-Track Comparative GIS Analysis</h4>
          <p className="text-[10.5px] text-muted-foreground">Overlaying historical best-tracks & landfall fixes</p>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowLabels((prev) => !prev)}
          aria-pressed={showLabels}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showLabels
              ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/20"
              : "bg-background/90 text-foreground/70 border-border hover:bg-secondary"
          }`}
          title="Toggle Track Milestone Labels"
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Milestones</span>
        </button>

        <MapStyleSwitcher
          currentStyle={currentStyle}
          onSelectStyle={setCurrentStyle}
          styles={mapStyles}
          isOpen={isLayerMenuOpen}
          setIsOpen={setIsLayerMenuOpen}
          title="Switch Map Layers (NASA VIIRS, Satellite, Tactical Dark)"
        />
      </div>

      <div className="absolute bottom-6 left-6 z-[1000] bg-background/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl max-w-xs text-xs space-y-2 pointer-events-auto">
        <span className="font-heading font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5 border-b border-border pb-1">
          <Compass className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
          Comparison Legend
        </span>
        <div className="space-y-1.5 text-[11px]">
          {system1 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#06b6d4] border border-white shadow-xs inline-block" />
              <span className="font-bold text-cyan-400">
                {system1.name} ({system1.category.split(" ")[0]})
              </span>
            </div>
          )}
          {system2 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white shadow-xs inline-block" />
              <span className="font-bold text-amber-400">
                {system2.name} ({system2.category.split(" ")[0]})
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-border text-[10px] text-muted-foreground">
            <span>🎯 Red Ring Marker: Landfall Coastal Crossing</span>
          </div>
        </div>
      </div>

      <MapContainer center={center} zoom={5} zoomControl={false} style={{ height: "100%", width: "100%" }} className="z-0">
        <ZoomControl position="topright" />
        <ChangeView center={center} zoom={5} />
        <TileLayer key={activeTile.url} attribution={activeTile.attribution} url={activeTile.url} />

        {system1 && pts1.length > 0 && (
          <ComparisonTrackOverlay
            system={system1}
            points={pts1}
            maxIdx={maxIdx1}
            showLabels={showLabels}
            prefix="sys1"
            lineColor="#06b6d4"
            peakColor="#06b6d4"
            baseColor="#0891b2"
            tooltipDirection="right"
            tooltipOffset={[10, 0]}
            accentClass="text-cyan-400"
            peakClass="bg-cyan-950/95 text-cyan-200 border border-cyan-400 font-extrabold ring-1 ring-cyan-400/40"
            genesisClass="bg-zinc-950/90 text-cyan-300 border border-cyan-500/40"
          />
        )}

        {system2 && pts2.length > 0 && (
          <ComparisonTrackOverlay
            system={system2}
            points={pts2}
            maxIdx={maxIdx2}
            showLabels={showLabels}
            prefix="sys2"
            lineColor="#f59e0b"
            peakColor="#f59e0b"
            baseColor="#d97706"
            dashed
            tooltipDirection="left"
            tooltipOffset={[-10, 0]}
            accentClass="text-amber-400"
            peakClass="bg-amber-950/95 text-amber-200 border border-amber-400 font-extrabold ring-1 ring-amber-400/40"
            genesisClass="bg-zinc-950/90 text-amber-300 border border-amber-500/40"
          />
        )}
      </MapContainer>
    </div>
  );
}
