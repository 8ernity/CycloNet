"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackPoint } from "@/types/api";
import { ensureLeafletDefaultIcons, getMapStyles, type InfraFilter, type MapStyleKey } from "./map/mapConfig";
import {
  ChangeView,
  InfrastructureFilterBar,
  InfrastructureOverlayLayers,
  MapStyleSwitcher,
} from "./map/MapOverlays";

interface MapWidgetProps {
  points: TrackPoint[];
  systemName?: string;
}

export default function MapWidget({ points, systemName }: MapWidgetProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("satellite");
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showInfra, setShowInfra] = useState(false);
  const [infraFilter, setInfraFilter] = useState<InfraFilter>("all");

  useEffect(() => {
    ensureLeafletDefaultIcons();
  }, []);

  if (!points || points.length === 0) return null;

  const mapStyles = getMapStyles(new Date(), {
    satelliteName: "Esri base imagery (not live telemetry)",
  });
  const activeTile = mapStyles[currentStyle];
  const currentPoint = points.find((p) => p.time_offset_hours === 0) || points[points.length - 1] || points[0];
  const positions = points.map((p) => [p.lat, p.lon] as [number, number]);
  const pastPoints = points.filter((p) => !p.is_forecast);
  const futurePoints = points.filter((p) => p.is_forecast);

  return (
    <div className="w-full h-full min-h-[520px] relative z-0">
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <div>
            <h4 className="font-heading font-semibold text-xs text-foreground">{activeTile.name}</h4>
            <p className="text-[10.5px] text-muted-foreground">
              {systemName ? `Tracking: ${systemName}` : "North Indian Ocean Basin"}
            </p>
          </div>
        </div>

        <InfrastructureFilterBar
          showInfra={showInfra}
          onToggleInfra={() => setShowInfra((prev) => !prev)}
          infraFilter={infraFilter}
          onSelectFilter={setInfraFilter}
          includeSurgeFilter={false}
        />
      </div>

      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto">
        <MapStyleSwitcher
          currentStyle={currentStyle}
          onSelectStyle={setCurrentStyle}
          styles={mapStyles}
          isOpen={isLayerMenuOpen}
          setIsOpen={setIsLayerMenuOpen}
        />
      </div>

      <MapContainer
        center={[currentPoint.lat, currentPoint.lon]}
        zoom={5}
        zoomControl={false}
        className="w-full h-full min-h-[520px] rounded-xl"
      >
        <ZoomControl position="topright" />
        <ChangeView center={[currentPoint.lat, currentPoint.lon]} zoom={5} animate={false} />

        <TileLayer key={activeTile.url} attribution={activeTile.attribution} url={activeTile.url} />

        {showInfra && <InfrastructureOverlayLayers infraFilter={infraFilter} markerRadius={6} />}

        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }} />
        )}

        {pastPoints.map((pt, idx) => (
          <CircleMarker
            key={`past-${idx}`}
            center={[pt.lat, pt.lon]}
            radius={4.5}
            pathOptions={{ color: "#ffffff", fillColor: "#3b82f6", fillOpacity: 1, weight: 1.5 }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 8]} className="custom-tooltip">
              <span>{pt.time_offset_hours === 0 ? "Now" : `${pt.time_offset_hours}h`}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        <CircleMarker
          center={[currentPoint.lat, currentPoint.lon]}
          radius={8}
          pathOptions={{ color: "#ffffff", fillColor: "#ef4444", fillOpacity: 1, weight: 2.5 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} className="custom-tooltip">
            <span className="text-red-400 font-bold">
              {currentPoint.intensity_knots ?? "Not available"} KT ({currentPoint.provenance ?? "UNKNOWN"})
            </span>
          </Tooltip>
        </CircleMarker>

        {futurePoints.map((pt, idx) => (
          <CircleMarker
            key={`future-${idx}`}
            center={[pt.lat, pt.lon]}
            radius={5.5}
            pathOptions={{
              color: "#ffffff",
              fillColor: pt.is_landfall ? "#dc2626" : "#ef4444",
              fillOpacity: 1,
              weight: pt.is_landfall ? 3 : 1.5,
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 8]} className="custom-tooltip">
              <span>{pt.is_landfall ? `🎯 Landfall (+${pt.time_offset_hours}h)` : `+${pt.time_offset_hours}h (Kinematic)`}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
