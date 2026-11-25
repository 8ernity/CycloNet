"use client";

import React, { useEffect, useRef } from "react";
import { CircleMarker, Polygon, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import { Building2, Layers, Navigation, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import {
  COASTAL_INUNDATION_ZONES,
  EVACUATION_ROUTES,
  MEDICAL_SHELTERS,
  POWER_SUBSTATIONS,
} from "@/lib/infrastructureData";
import type { InfraFilter, MapStyleDefinition, MapStyleKey } from "./mapConfig";

export function ChangeView({
  center,
  zoom,
  animate = true,
}: {
  center: [number, number];
  zoom: number;
  animate?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, animate ? { animate: true } : undefined);
  }, [center, zoom, animate, map]);
  return null;
}

interface MapStyleSwitcherProps {
  currentStyle: MapStyleKey;
  onSelectStyle: (style: MapStyleKey) => void;
  styles: Record<MapStyleKey, MapStyleDefinition>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  title?: string;
}

export function MapStyleSwitcher({
  currentStyle,
  onSelectStyle,
  styles,
  isOpen,
  setIsOpen,
  title = "Switch Map Layers",
}: MapStyleSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-card/90 backdrop-blur-md p-2 rounded-lg border border-border shadow-md hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer text-foreground"
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Layers className="w-4 h-4 text-foreground" aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Map tile layers"
          className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden flex flex-col w-64 py-1 z-50"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            Base Satellite & GIS Imagery Feed
          </div>
          {(Object.entries(styles) as [MapStyleKey, MapStyleDefinition][]).map(([key, style]) => (
            <button
              key={key}
              type="button"
              role="menuitemradio"
              aria-checked={currentStyle === key}
              onClick={() => {
                onSelectStyle(key);
                setIsOpen(false);
              }}
              className={`text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                currentStyle === key
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span>{style.name}</span>
              {currentStyle === key && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface InfrastructureFilterBarProps {
  showInfra: boolean;
  onToggleInfra: () => void;
  infraFilter: InfraFilter;
  onSelectFilter: (filter: InfraFilter) => void;
  includeSurgeFilter?: boolean;
}

export function InfrastructureFilterBar({
  showInfra,
  onToggleInfra,
  infraFilter,
  onSelectFilter,
  includeSurgeFilter = true,
}: InfrastructureFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-background/95 backdrop-blur-xl p-1.5 rounded-xl border border-border shadow-xl">
      <button
        type="button"
        onClick={onToggleInfra}
        aria-pressed={showInfra}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
          showInfra
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        }`}
        title="Toggle illustrative scenario assets — unverified"
      >
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Scenario assets (unverified)</span>
      </button>

      {showInfra && (
        <div className="flex items-center gap-1 border-l border-border pl-1.5 flex-wrap" role="group" aria-label="Infrastructure layer filters">
          <button
            type="button"
            onClick={() => onSelectFilter("all")}
            aria-pressed={infraFilter === "all"}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              infraFilter === "all"
                ? "bg-secondary text-foreground font-bold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter("power")}
            aria-pressed={infraFilter === "power"}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              infraFilter === "power"
                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" /> Grids
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter("roads")}
            aria-pressed={infraFilter === "roads"}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              infraFilter === "roads"
                ? "bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Navigation className="w-3 h-3 text-blue-400" aria-hidden="true" /> Roads
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter("shelters")}
            aria-pressed={infraFilter === "shelters"}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              infraFilter === "shelters"
                ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-3 h-3 text-emerald-400" aria-hidden="true" /> Shelters
          </button>
          {includeSurgeFilter && (
            <button
              type="button"
              onClick={() => onSelectFilter("parametric")}
              aria-pressed={infraFilter === "parametric"}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                infraFilter === "parametric"
                  ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-cyan-400" aria-hidden="true" /> Surge
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function InfrastructureOverlayLayers({
  infraFilter,
  markerRadius = 7,
}: {
  infraFilter: InfraFilter;
  markerRadius?: number;
}) {
  return (
    <>
      <div className="absolute bottom-2 left-2 z-[1000] bg-background p-2 text-xs">
        ILLUSTRATIVE ASSETS — all coordinates and capacities unverified; road status unknown.
      </div>

      {(infraFilter === "all" || infraFilter === "parametric") &&
        COASTAL_INUNDATION_ZONES.map((zone, i) => (
          <Polygon
            key={`inundation-${i}`}
            positions={zone.polygon}
            pathOptions={{
              fillColor: "#06b6d4",
              fillOpacity: 0.28,
              color: "#0891b2",
              weight: 2,
              dashArray: "4, 4",
            }}
          >
            <Popup>
              <div className="p-1 space-y-1 text-xs text-white">
                <p className="font-bold text-cyan-400 flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                  <span>{zone.name}</span>
                </p>
                <p className="text-zinc-300 text-[11px]">
                  Scenario depth: <strong className="text-white">{zone.depthM}</strong>
                </p>
                <p className="text-zinc-400 text-[10.5px]">
                  Parametric Trigger:{" "}
                  <span className="text-cyan-300 font-medium">No verified funding or insurance contract</span>
                </p>
              </div>
            </Popup>
            <Tooltip direction="center">
              <span className="text-[10px] font-bold font-mono text-cyan-300 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
                🌊 {zone.riskLevel}
              </span>
            </Tooltip>
          </Polygon>
        ))}

      {(infraFilter === "all" || infraFilter === "roads") &&
        EVACUATION_ROUTES.map((route, i) => (
          <Polyline
            key={`route-${i}`}
            positions={route.path}
            pathOptions={{
              color: route.floodRiskLevel.includes("Severe") ? "#ef4444" : "#3b82f6",
              weight: markerRadius >= 7 ? 4 : 3.5,
              opacity: 0.85,
              dashArray: route.floodRiskLevel.includes("Severe") ? "8, 4" : undefined,
            }}
          >
            <Popup>
              <div className="p-1.5 space-y-1.5 text-xs text-white">
                <p className="font-bold text-white text-sm">{route.name}</p>
                <p className="text-[11px] text-zinc-300">
                  Scenario category: <strong className="text-white">{route.evacuationPriority}</strong>
                </p>
                <p
                  className={`text-[11px] font-semibold ${
                    route.floodRiskLevel.includes("Severe") ? "text-red-400" : "text-blue-400"
                  }`}
                >
                  Scenario risk: {route.floodRiskLevel}
                </p>
              </div>
            </Popup>
            <Tooltip direction="top">
              <span className="text-[10px] font-bold font-mono text-white bg-blue-900/90 px-1.5 py-0.5 rounded border border-blue-400/40">
                🛣️ {route.highwayCode} ({route.evacuationPriority.split(" ")[0]})
              </span>
            </Tooltip>
          </Polyline>
        ))}

      {(infraFilter === "all" || infraFilter === "power") &&
        POWER_SUBSTATIONS.map((sub, i) => (
          <CircleMarker
            key={`sub-${i}`}
            center={[sub.lat, sub.lon]}
            radius={markerRadius}
            fillColor="#f59e0b"
            color="#ffffff"
            weight={markerRadius >= 7 ? 2 : 1.5}
            fillOpacity={0.95}
          >
            <Popup>
              <div className="p-1.5 space-y-1.5 text-xs text-white">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                  <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{sub.name}</span>
                </div>
                <p className="text-zinc-300 text-[11px]">
                  Type: <strong className="text-white">{sub.type}</strong>
                </p>
                <p className="text-zinc-300 text-[11px]">
                  Assumed capacity: <strong className="text-white">{sub.capacityMVA} MVA</strong>
                </p>
                <p className="text-zinc-300 text-[11px]">
                  Coastal Distance: <strong className="text-white">{sub.coastalDistanceKm} km</strong> (Elev:{" "}
                  {sub.elevationMeters}m)
                </p>
                <span className="inline-block px-2.5 py-1 mt-1 rounded-md text-[10.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Criticality: {sub.criticality}
                </span>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-[9.5px] font-bold font-mono text-amber-200 bg-zinc-950/90 px-1 py-0.5 rounded border border-amber-500/30">
                ⚡ {sub.name.split(" ")[0]} ({sub.capacityMVA}MVA)
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

      {(infraFilter === "all" || infraFilter === "shelters") &&
        MEDICAL_SHELTERS.map((shl, i) => (
          <CircleMarker
            key={`shl-${i}`}
            center={[shl.lat, shl.lon]}
            radius={markerRadius}
            fillColor="#10b981"
            color="#ffffff"
            weight={markerRadius >= 7 ? 2 : 1.5}
            fillOpacity={0.95}
          >
            <Popup>
              <div className="p-1.5 space-y-1.5 text-xs text-white">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                  <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{shl.name}</span>
                </div>
                <p className="text-zinc-300 text-[11px]">
                  Type: <strong className="text-white">{shl.type}</strong>
                </p>
                <p className="text-zinc-300 text-[11px]">
                  Assumed capacity: <strong className="text-white">{shl.capacityPersons.toLocaleString()} persons</strong>
                </p>
                <p className="text-zinc-300 text-[11px]">
                  Assumed beds: <strong className="text-white">{shl.medicalBeds} Beds</strong>
                </p>
                <p className="text-zinc-300 text-[10.5px]">
                  Backup Power: <strong className="text-white">Unavailable</strong>
                </p>
                <span className="inline-block px-2.5 py-1 mt-1 rounded-md text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Status: Operational status not verified
                </span>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-[9.5px] font-bold font-mono text-emerald-200 bg-zinc-950/90 px-1 py-0.5 rounded border border-emerald-500/30">
                🏥 {shl.name.split(" ")[0]} ({shl.capacityPersons}p)
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  );
}
