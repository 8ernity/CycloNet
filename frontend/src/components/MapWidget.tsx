"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  MapContainer, 
  TileLayer, 
  Polyline, 
  CircleMarker, 
  Polygon,
  Tooltip, 
  Popup,
  useMap, 
  ZoomControl 
} from "react-leaflet";
import { Layers, Zap, Navigation, Building2, ShieldAlert, ShieldCheck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  POWER_SUBSTATIONS, 
  EVACUATION_ROUTES, 
  MEDICAL_SHELTERS, 
  COASTAL_INUNDATION_ZONES 
} from '@/lib/infrastructureData';

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
  is_landfall?: boolean;
}

interface MapWidgetProps {
  points: TrackPoint[];
  systemName?: string;
}

const MAP_STYLES = {
  satellite: {
    name: 'Satellite View (GEE / Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; GEE Multispectral'
  },
  street: {
    name: 'IMD Chart (Street/Geo)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; IMD Best-Track'
  },
  dark: {
    name: 'Dark Tactical',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;
type InfraFilter = 'all' | 'power' | 'roads' | 'shelters' | 'parametric';

function MapReCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, 5);
  }, [center, map]);
  return null;
}

export default function MapWidget({ points, systemName }: MapWidgetProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('satellite');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showInfra, setShowInfra] = useState(true);
  const [infraFilter, setInfraFilter] = useState<InfraFilter>('all');
  const layerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(event.target as Node)) {
        setIsLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!points || points.length === 0) return null;

  const currentPoint = points.find((p) => p.time_offset_hours === 0) || points[points.length - 1] || points[0];

  const positions = points.map(p => [p.lat, p.lon] as [number, number]);
  const pastPoints = points.filter(p => !p.is_forecast);
  const futurePoints = points.filter(p => p.is_forecast);

  return (
    <div className="w-full h-full min-h-[520px] relative z-0">
      <style>{`
        .leaflet-top.leaflet-right {
          top: 60px !important;
          right: 16px !important;
        }
        .leaflet-control-zoom {
          margin: 0 !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          background: rgba(9, 9, 11, 0.88) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
        }
        .leaflet-control-zoom a {
          background: transparent !important;
          color: #f4f4f5 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
          width: 38px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.15s ease !important;
        }
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(255, 255, 255, 0.18) !important;
          color: #ffffff !important;
        }
        .leaflet-tooltip,
        .leaflet-tooltip.custom-tooltip {
          background: rgba(9, 9, 11, 0.94) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7) !important;
          color: #ffffff !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
          padding: 2px 6px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip::before,
        .leaflet-tooltip::after,
        .leaflet-tooltip.custom-tooltip::before,
        .leaflet-tooltip.custom-tooltip::after {
          display: none !important;
          border: none !important;
        }
      `}</style>

      {/* Top Left Badge & Infrastructure Filter Pills */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <h4 className="font-heading font-semibold text-xs text-foreground">
              INSAT-3DR & GEE Live Surveillance
            </h4>
            <p className="text-[10.5px] text-muted-foreground">
              {systemName ? `Tracking: ${systemName}` : "North Indian Ocean Basin"}
            </p>
          </div>
        </div>

        {/* Infrastructure Layer Toggle */}
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md p-1 rounded-lg border border-border shadow-md text-xs">
          <button
            onClick={() => setShowInfra(!showInfra)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
              showInfra ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-3 h-3" /> Infra
          </button>
          {showInfra && (
            <>
              <button
                onClick={() => setInfraFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] ${infraFilter === 'all' ? 'bg-secondary font-bold text-foreground' : 'text-muted-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => setInfraFilter('power')}
                className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${infraFilter === 'power' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-muted-foreground'}`}
              >
                <Zap className="w-2.5 h-2.5 text-amber-400" /> Grids
              </button>
              <button
                onClick={() => setInfraFilter('roads')}
                className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${infraFilter === 'roads' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-muted-foreground'}`}
              >
                <Navigation className="w-2.5 h-2.5 text-blue-400" /> Roads
              </button>
              <button
                onClick={() => setInfraFilter('shelters')}
                className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${infraFilter === 'shelters' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-muted-foreground'}`}
              >
                <Building2 className="w-2.5 h-2.5 text-emerald-400" /> Shelters
              </button>
            </>
          )}
        </div>
      </div>

      {/* Base Map Theme Switcher (Top-Right) */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto" ref={layerMenuRef}>
        <div className="relative">
          <button 
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-card/90 backdrop-blur-md p-2.5 rounded-xl border border-border shadow-lg hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer text-foreground"
            title="Switch Map Layers"
          >
            <Layers className="w-4 h-4" />
          </button>
          {isLayerMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col w-52 py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                Base Map Theme
              </div>
              {Object.entries(MAP_STYLES).map(([key, style]) => (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentStyle(key as MapStyleKey);
                    setIsLayerMenuOpen(false);
                  }}
                  className={`text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    currentStyle === key 
                      ? 'bg-primary/15 text-primary font-bold' 
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <span>{style.name}</span>
                  {currentStyle === key && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <MapContainer
        center={[currentPoint.lat, currentPoint.lon]}
        zoom={5}
        zoomControl={false}
        className="w-full h-full min-h-[520px] rounded-xl"
      >
        <ZoomControl position="topright" />
        <MapReCenter center={[currentPoint.lat, currentPoint.lon]} />

        <TileLayer
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />

        {/* ── Critical Infrastructure Layers ─────────────────────────────────── */}
        {showInfra && (
          <>
            {/* Parametric Coastal Inundation Buffer Zones */}
            {(infraFilter === 'all' || infraFilter === 'parametric') && (
              COASTAL_INUNDATION_ZONES.map((zone, i) => (
                <Polygon
                  key={`inundation-${i}`}
                  positions={zone.polygon}
                  pathOptions={{
                    fillColor: "#06b6d4",
                    fillOpacity: 0.25,
                    color: "#0891b2",
                    weight: 2,
                    dashArray: "4, 4"
                  }}
                >
                  <Popup>
                    <div className="p-1 space-y-1 text-xs text-white">
                      <p className="font-bold text-cyan-400 flex items-center gap-1.5 text-sm">
                        <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{zone.name}</span>
                      </p>
                      <p className="text-zinc-300 text-[11px]">Surge Depth: <strong className="text-white">{zone.depthM}</strong></p>
                      <p className="text-zinc-400 text-[10.5px]">Parametric Trigger: <span className="text-cyan-300 font-medium">100% Liquidity at &ge;64 KT</span></p>
                    </div>
                  </Popup>
                  <Tooltip direction="center">
                    <span className="text-[10px] font-bold font-mono text-cyan-300 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      🌊 {zone.riskLevel}
                    </span>
                  </Tooltip>
                </Polygon>
              ))
            )}

            {/* Arterial Evacuation Routes */}
            {(infraFilter === 'all' || infraFilter === 'roads') && (
              EVACUATION_ROUTES.map((route, i) => (
                <Polyline
                  key={`route-${i}`}
                  positions={route.path}
                  pathOptions={{
                    color: route.floodRiskLevel.includes("Severe") ? "#ef4444" : "#3b82f6",
                    weight: 3.5,
                    opacity: 0.85
                  }}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <p className="font-bold text-white text-sm">{route.name}</p>
                      <p className="text-[11px] text-zinc-300">Priority: <strong className="text-white">{route.evacuationPriority}</strong></p>
                      <p className={`text-[11px] font-semibold ${route.floodRiskLevel.includes("Severe") ? "text-red-400" : "text-blue-400"}`}>
                        Risk: {route.floodRiskLevel}
                      </p>
                    </div>
                  </Popup>
                  <Tooltip direction="top">
                    <span className="text-[10px] font-bold font-mono text-white bg-blue-900/90 px-1.5 py-0.5 rounded border border-blue-400/40">
                      🛣️ {route.highwayCode} (Evac Corridor)
                    </span>
                  </Tooltip>
                </Polyline>
              ))
            )}

            {/* Power Grid Substations */}
            {(infraFilter === 'all' || infraFilter === 'power') && (
              POWER_SUBSTATIONS.map((sub, i) => (
                <CircleMarker
                  key={`sub-${i}`}
                  center={[sub.lat, sub.lon]}
                  radius={6}
                  fillColor="#f59e0b"
                  color="#ffffff"
                  weight={1.5}
                  fillOpacity={0.95}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                        <Zap className="w-4 h-4 shrink-0" />
                        <span>{sub.name}</span>
                      </div>
                      <p className="text-zinc-300 text-[11px]">Type: <strong className="text-white">{sub.type}</strong></p>
                      <p className="text-zinc-300 text-[11px]">Capacity: <strong className="text-white">{sub.capacityMVA} MVA</strong></p>
                      <p className="text-zinc-300 text-[11px]">Coastal Distance: <strong className="text-white">{sub.coastalDistanceKm} km</strong> (Elev: {sub.elevationMeters}m)</p>
                      <span className="inline-block px-2.5 py-1 mt-1 rounded-md text-[10.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Criticality: {sub.criticality}
                      </span>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -5]}>
                    <span className="text-[9.5px] font-bold font-mono text-amber-200 bg-zinc-950/90 px-1 py-0.5 rounded border border-amber-500/30">
                      ⚡ {sub.name.split(" ")[0]} ({sub.capacityMVA}MVA)
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))
            )}

            {/* Medical Cyclone Shelters */}
            {(infraFilter === 'all' || infraFilter === 'shelters') && (
              MEDICAL_SHELTERS.map((shl, i) => (
                <CircleMarker
                  key={`shl-${i}`}
                  center={[shl.lat, shl.lon]}
                  radius={6}
                  fillColor="#10b981"
                  color="#ffffff"
                  weight={1.5}
                  fillOpacity={0.95}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span>{shl.name}</span>
                      </div>
                      <p className="text-zinc-300 text-[11px]">Type: <strong className="text-white">{shl.type}</strong></p>
                      <p className="text-zinc-300 text-[11px]">Capacity: <strong className="text-white">{shl.capacityPersons.toLocaleString()} persons</strong></p>
                      <p className="text-zinc-300 text-[11px]">Medical Beds: <strong className="text-white">{shl.medicalBeds} Beds</strong></p>
                      <p className="text-zinc-300 text-[10.5px]">Backup Power: <strong className="text-white">{shl.generatorBackup ? "✅ Diesel GenSet" : "❌ Grid Dependent"}</strong></p>
                      <span className="inline-block px-2.5 py-1 mt-1 rounded-md text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Status: {shl.status}
                      </span>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -5]}>
                    <span className="text-[9.5px] font-bold font-mono text-emerald-200 bg-zinc-950/90 px-1 py-0.5 rounded border border-emerald-500/30">
                      🏥 {shl.name.split(" ")[0]} ({shl.capacityPersons}p)
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))
            )}
          </>
        )}

        {/* ── Cyclone Trajectory Segments ─────────────────────────────────── */}
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }}
          />
        )}

        {/* Past points */}
        {pastPoints.map((pt, idx) => (
          <CircleMarker
            key={`past-${idx}`}
            center={[pt.lat, pt.lon]}
            radius={4.5}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#3b82f6",
              fillOpacity: 1,
              weight: 1.5,
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 8]} className="custom-tooltip">
              <span>{pt.time_offset_hours === 0 ? "Now" : `${pt.time_offset_hours}h`}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Current point */}
        <CircleMarker
          center={[currentPoint.lat, currentPoint.lon]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#ef4444",
            fillOpacity: 1,
            weight: 2.5,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} className="custom-tooltip">
            <span className="text-red-400 font-bold">{currentPoint.intensity_knots} KT (Observed Fix)</span>
          </Tooltip>
        </CircleMarker>

        {/* Future points */}
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