import { formatCoordinates } from "@/lib/coordinates";
import type { TrackPoint, WeatherSystem as ActiveSystem } from "@/types/api";
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import { Layers, Tag, ShieldAlert, Compass, Zap, Navigation, Building2, ShieldCheck } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { POWER_SUBSTATIONS, EVACUATION_ROUTES, MEDICAL_SHELTERS, COASTAL_INUNDATION_ZONES } from '@/lib/infrastructureData';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});





interface MapProps {
  activeSystem: ActiveSystem | null;
}

// Helper to get yesterday's UTC date formatted for NASA GIBS daily WMTS tiles
const getGibsDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

const MAP_STYLES = {
  satellite: {
    name: '🗺️ Esri World Imagery basemap',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  nasa_viirs: {
    name: '🛰️ NASA VIIRS daily imagery (prior date)',
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${getGibsDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: 'Imagery &copy; NASA EOSDIS GIBS / NOAA VIIRS'
  },
  dark: {
    name: '🌑 Tactical Disaster Command (Dark)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors'
  },
  street: {
    name: '🧭 OpenStreetMap streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;
type InfraFilter = 'all' | 'power' | 'roads' | 'shelters' | 'parametric';

const getIntensityColor = (knots: number | null) => {
  if (knots == null) return "#94a3b8";
  if (knots < 34) return "#a855f7"; // Purple (Depression)
  if (knots < 48) return "#3b82f6"; // Blue (Cyclonic Storm)
  if (knots < 64) return "#10b981"; // Green (Severe)
  if (knots < 90) return "#f59e0b"; // Orange (Very Severe)
  if (knots < 120) return "#ef4444"; // Red (Extremely Severe)
  return "#7f1d1d"; // Dark Red (Super Cyclone)
};

const getCategoryAbbr = (cat: string, knots: number | null): string => {
  if (knots == null) return "Not available";
  const c = (cat || "").toLowerCase();
  if (c.includes("super")) return "SuCS";
  if (c.includes("extremely")) return "ESCS";
  if (c.includes("very severe")) return "VSCS";
  if (c.includes("severe")) return "SCS";
  if (c.includes("cyclonic")) return "CS";
  if (c.includes("deep depression")) return "DD";
  if (c.includes("depression")) return "D";
  if (knots >= 120) return "SuCS";
  if (knots >= 90) return "ESCS";
  if (knots >= 65) return "VSCS";
  if (knots >= 48) return "SCS";
  if (knots >= 34) return "CS";
  if (knots >= 28) return "DD";
  return "D";
};

export default function MapComponent({ activeSystem }: MapProps) {
  // Default to Satellite View on application startup
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('satellite');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const [showLegend, setShowLegend] = useState(true);
  const [infraFilter, setInfraFilter] = useState<InfraFilter>('all');
  const [showInfra, setShowInfra] = useState(false);
  
  const center: [number, number] = activeSystem ? [activeSystem.lat, activeSystem.lon] : [17.5, 83.5];
  const zoomLevel = activeSystem ? 6 : 5;

  const points = activeSystem?.track_forecast || [];

  // Split points into observed past points and future forecast points
  const getPointLabel = (pt: TrackPoint) => {
    const raw = pt.label || "";
    const isLandfallPt = pt.is_landfall || (raw && raw.toLowerCase().includes("landfall"));
    if (raw) {
      // Compact badge string e.g. "25/06,35KT,DD (Landfall: Near Kalingapatnam)" -> "25/06 • 35KT • DD (Landfall)"
      const parts = raw.split("(");
      const codePart = parts[0].trim().replace(/,/g, " • ");
      if (isLandfallPt) {
        return `${codePart} • Landfall`;
      }
      return codePart;
    }
    const offset = pt.time_offset_hours;
    const timeLabel = offset == null ? "Time unavailable" : `${offset >= 0 ? "+" : ""}${offset}h from source reference`;
    const abbr = getCategoryAbbr(pt.category, pt.intensity_knots);
    const suffix = isLandfallPt ? " • Landfall" : "";
    return `${timeLabel} • ${pt.intensity_knots ?? "Not available"}KT • ${abbr}${suffix}`;
  };

  return (
    <div className={`relative w-full h-full select-none ${!showLabels ? "hide-imd-labels" : ""}`}>
      
      {/* ── Top Left Live Surveillance Badge & Infrastructure Layer Filter ─────── */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-card/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <div>
            <h4 className="font-heading font-semibold text-xs text-foreground">
              {MAP_STYLES[currentStyle].name}
            </h4>
            <p className="text-[10.5px] text-muted-foreground">
              {activeSystem ? `${activeSystem.name} • ${activeSystem.provenance || "Source unverified"}${activeSystem.is_stale ? " • Stale" : ""}` : "North Indian Ocean Basin • Current status unverified"}
            </p>
          </div>
        </div>

        {/* Infrastructure Layer Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-background/95 backdrop-blur-xl p-1.5 rounded-xl border border-border shadow-xl">
          <button
            onClick={() => setShowInfra(!showInfra)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              showInfra 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle illustrative scenario assets — unverified"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Scenario assets (unverified)</span>
          </button>

          {showInfra && (
            <div className="flex items-center gap-1 border-l border-border pl-1.5 flex-wrap">
              <button
                onClick={() => setInfraFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  infraFilter === 'all' ? 'bg-secondary text-foreground font-bold border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setInfraFilter('power')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  infraFilter === 'power' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="w-3 h-3 text-amber-400" /> Grids
              </button>
              <button
                onClick={() => setInfraFilter('roads')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  infraFilter === 'roads' ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Navigation className="w-3 h-3 text-blue-400" /> Roads
              </button>
              <button
                onClick={() => setInfraFilter('shelters')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  infraFilter === 'shelters' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-3 h-3 text-emerald-400" /> Shelters
              </button>
              <button
                onClick={() => setInfraFilter('parametric')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  infraFilter === 'parametric' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-cyan-400" /> Surge
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── IMD Top Right Toolbar Controls ─────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-1.5 flex-wrap justify-end">
        {/* Toggle IMD Labels Button */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showLabels 
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' 
              : 'bg-background/90 text-foreground/70 border-border hover:bg-secondary'
          }`}
          title="Toggle IMD Bullet Labels (DD/HH, Wind, Category)"
        >
          <Tag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Labels</span>
        </button>

        <span className="text-xs bg-background/90 p-2 rounded">Uncertainty: Not validated</span>

        {/* Map Style Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-background/90 backdrop-blur-md p-2 rounded-lg border border-border shadow-md hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
            title="Switch Map Layers (NASA VIIRS, MODIS, base imagery, Dark Tactical, IMD Chart)"
          >
            <Layers className="w-4 h-4 text-foreground" />
          </button>
          {isLayerMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden flex flex-col w-64 py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                Base Satellite & GIS Imagery Feed
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

      {/* Official IMD Track & Layer Legend (Bottom-Left) */}
      {showLegend && activeSystem && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-background/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl max-w-xs text-xs space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
            <span className="font-heading font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-500" />
              IMD & Geospatial Legend
            </span>
            <button 
              onClick={() => setShowLegend(false)}
              className="text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
            >
              Hide
            </button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            {/* Intensity Scale Badges */}
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
            
            {/* Infrastructure Symbols */}
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

      {/* Global CSS overrides for Leaflet map styling */}
      <style jsx global>{`
        .hide-imd-labels .imd-bullet-label {
          display: none !important;
        }
        .imd-bullet-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip-left:before, 
        .leaflet-tooltip-right:before,
        .leaflet-tooltip-top:before,
        .leaflet-tooltip-bottom:before {
          display: none !important;
        }
        .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          color: #f8fafc !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
        }
        .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
        }
        .leaflet-control-zoom {
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 0.5rem !important;
          overflow: hidden !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
          margin-top: 5rem !important;
          margin-right: 1rem !important;
        }
        .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.85) !important;
          backdrop-filter: blur(8px) !important;
          color: #94a3b8 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          transition: all 0.2s ease !important;
        }
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(255, 255, 255, 0.18) !important;
          color: #ffffff !important;
        }
      `}</style>

      <MapContainer 
        center={center} 
        zoom={zoomLevel} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        className={`z-0 ${!showLabels ? "hide-imd-labels" : ""}`}
      >
        <ZoomControl position="topright" />
        <ChangeView center={center} zoom={zoomLevel} />
        
        {/* Base Satellite / Map Tile Feed */}
        <TileLayer
          key={currentStyle}
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />

        {/* ── Critical Infrastructure Layers ─────────────────────────────────── */}
        {showInfra && (
          <>
            <div className="absolute bottom-2 left-2 z-[1000] bg-background p-2 text-xs">ILLUSTRATIVE ASSETS — all coordinates and capacities unverified; road status unknown.</div>
            {/* 1. Parametric Inundation Zones (Surge Buffer Polygons) */}
            {(infraFilter === 'all' || infraFilter === 'parametric') && (
              COASTAL_INUNDATION_ZONES.map((zone, i) => (
                <Polygon
                  key={`inundation-${i}`}
                  positions={zone.polygon}
                  pathOptions={{
                    fillColor: "#06b6d4",
                    fillOpacity: 0.28,
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
                      <p className="text-zinc-300 text-[11px]">Scenario depth: <strong className="text-white">{zone.depthM}</strong></p>
                      <p className="text-zinc-400 text-[10.5px]">Parametric Trigger: <span className="text-cyan-300 font-medium">No verified funding or insurance contract</span></p>
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

            {/* 2. Arterial Evacuation Routes & Cutoffs */}
            {(infraFilter === 'all' || infraFilter === 'roads') && (
              EVACUATION_ROUTES.map((route, i) => (
                <Polyline
                  key={`route-${i}`}
                  positions={route.path}
                  pathOptions={{
                    color: route.floodRiskLevel.includes("Severe") ? "#ef4444" : "#3b82f6",
                    weight: 4,
                    opacity: 0.85,
                    dashArray: route.floodRiskLevel.includes("Severe") ? "8, 4" : undefined
                  }}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <p className="font-bold text-white text-sm">{route.name}</p>
                      <p className="text-[11px] text-zinc-300">Scenario category: <strong className="text-white">{route.evacuationPriority}</strong></p>
                      <p className={`text-[11px] font-semibold ${route.floodRiskLevel.includes("Severe") ? "text-red-400" : "text-blue-400"}`}>
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
              ))
            )}

            {/* 3. Power Grid Substations */}
            {(infraFilter === 'all' || infraFilter === 'power') && (
              POWER_SUBSTATIONS.map((sub, i) => (
                <CircleMarker
                  key={`sub-${i}`}
                  center={[sub.lat, sub.lon]}
                  radius={7}
                  fillColor="#f59e0b"
                  color="#ffffff"
                  weight={2}
                  fillOpacity={0.95}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                        <Zap className="w-4 h-4 shrink-0" />
                        <span>{sub.name}</span>
                      </div>
                      <p className="text-zinc-300 text-[11px]">Type: <strong className="text-white">{sub.type}</strong></p>
                      <p className="text-zinc-300 text-[11px]">Assumed capacity: <strong className="text-white">{sub.capacityMVA} MVA</strong></p>
                      <p className="text-zinc-300 text-[11px]">Coastal Distance: <strong className="text-white">{sub.coastalDistanceKm} km</strong> (Elev: {sub.elevationMeters}m)</p>
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
              ))
            )}

            {/* 4. Cyclone Shelters & Trauma Hospitals */}
            {(infraFilter === 'all' || infraFilter === 'shelters') && (
              MEDICAL_SHELTERS.map((shl, i) => (
                <CircleMarker
                  key={`shl-${i}`}
                  center={[shl.lat, shl.lon]}
                  radius={7}
                  fillColor="#10b981"
                  color="#ffffff"
                  weight={2}
                  fillOpacity={0.95}
                >
                  <Popup>
                    <div className="p-1.5 space-y-1.5 text-xs text-white">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span>{shl.name}</span>
                      </div>
                      <p className="text-zinc-300 text-[11px]">Type: <strong className="text-white">{shl.type}</strong></p>
                      <p className="text-zinc-300 text-[11px]">Assumed capacity: <strong className="text-white">{shl.capacityPersons.toLocaleString()} persons</strong></p>
                      <p className="text-zinc-300 text-[11px]">Assumed beds: <strong className="text-white">{shl.medicalBeds} Beds</strong></p>
                      <p className="text-zinc-300 text-[10.5px]">Backup Power: <strong className="text-white">{"Unavailable"}</strong></p>
                      <span className="inline-block px-2.5 py-1 mt-1 rounded-md text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Status: {"Operational status not verified"}
                      </span>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -6]}>
                    <span className="text-[9.5px] font-bold font-mono text-emerald-200 bg-zinc-950/90 px-1 py-0.5 rounded border border-emerald-500/30">
                      🏥 {shl.name.split(" ")[0]} ({shl.capacityPersons}p)
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))
            )}
          </>
        )}

        {/* ── Tropical Cyclone Best-Track Geometry ─────────────────────────── */}
        {activeSystem && (
          <>
            {/* 2. Track Segments Colored by Severity */}
            {points.map((pt, idx) => {
              if (idx === 0) return null;
              const prevPt = points[idx - 1];
              const color = getIntensityColor(pt.intensity_knots);
              
              return (
                <Polyline 
                  key={`seg-${idx}`} 
                  positions={[[prevPt.lat, prevPt.lon], [pt.lat, pt.lon]]} 
                  pathOptions={{
                    color: color,
                    weight: 3.5,
                    dashArray: pt.is_forecast ? "6, 6" : undefined,
                    opacity: 0.95
                  }}
                />
              );
            })}

            {/* 3. Track Point Markers Colored by Actual Severity */}
            {points.map((pt, idx) => {
              const label = getPointLabel(pt);
              const color = getIntensityColor(pt.intensity_knots);
              const isLandfallPt = pt.is_landfall || (pt.label && pt.label.toLowerCase().includes("landfall"));

              return (
                <React.Fragment key={`pt-group-${idx}`}>
                  <CircleMarker 
                    center={[pt.lat, pt.lon]} 
                    radius={isLandfallPt ? 8 : (pt.is_forecast ? 5.5 : 5)} 
                    fillColor={isLandfallPt ? "#dc2626" : color} 
                    color="#ffffff" 
                    weight={isLandfallPt ? 3 : 1.5} 
                    fillOpacity={1}
                  >
                    {showLabels && (
                      <Tooltip 
                        permanent
                        direction="right" 
                        offset={[10, 0]} 
                        className="imd-bullet-label"
                      >
                        <div className={`font-mono text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md backdrop-blur-md transition-all shadow-md ${
                          isLandfallPt 
                            ? "bg-red-950/95 text-red-100 border border-red-500/80 shadow-red-950/40 flex items-center gap-1"
                            : pt.is_forecast 
                              ? "bg-zinc-950/90 text-red-300 border border-red-500/35" 
                              : "bg-zinc-950/90 text-zinc-200 border border-zinc-700/60"
                        }`}>
                          {isLandfallPt && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
                          <span>{isLandfallPt ? `🎯 ${label}` : label}</span>
                        </div>
                      </Tooltip>
                    )}
                    <Popup>
                      <div className="p-1 space-y-1 text-xs">
                        <p className="font-bold text-foreground">{pt.category}</p>
                        <p className="text-muted-foreground">Wind: <strong className="text-foreground">{pt.intensity_knots ?? "Not available"} KT ({(pt.intensity_knots == null ? null : Math.round(pt.intensity_knots * 1.852))} km/h)</strong></p>
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
