"use client";

import React, { useState } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Popup, 
  Polyline, 
  Tooltip, 
  useMap,
  ZoomControl 
} from 'react-leaflet';
import { Layers, Compass, Tag } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
  is_landfall?: boolean;
  label?: string;
}

interface CycloneComparisonSystem {
  id: string;
  name: string;
  basin: string;
  category: string;
  intensity_knots: number;
  track_forecast?: TrackPoint[];
  landfall_info?: any;
}

interface CompareMapProps {
  system1: CycloneComparisonSystem | null;
  system2: CycloneComparisonSystem | null;
}

// Helper to get yesterday's UTC date formatted for NASA GIBS daily WMTS tiles
const getGibsDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

const MAP_STYLES = {
  satellite: {
    name: '🗺️ Esri High-Res Multispectral Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, USGS, NOAA'
  },
  nasa_viirs: {
    name: '🛰️ NASA VIIRS True-Color (EOSDIS)',
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${getGibsDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: 'Imagery &copy; NASA EOSDIS GIBS / NOAA VIIRS'
  },
  dark: {
    name: '🌑 Tactical Disaster Command (Dark)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors'
  },
  street: {
    name: '🧭 IMD Operational Geo Chart',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;

export default function CompareMapComponent({ system1, system2 }: CompareMapProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('satellite');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const pts1 = system1?.track_forecast || [];
  const pts2 = system2?.track_forecast || [];

  // Find max intensity indices for milestone labeling
  const maxIdx1 = React.useMemo(() => {
    if (pts1.length === 0) return -1;
    let maxK = -1;
    let idx = -1;
    pts1.forEach((p, i) => {
      if (p.intensity_knots > maxK) {
        maxK = p.intensity_knots;
        idx = i;
      }
    });
    return idx;
  }, [pts1]);

  const maxIdx2 = React.useMemo(() => {
    if (pts2.length === 0) return -1;
    let maxK = -1;
    let idx = -1;
    pts2.forEach((p, i) => {
      if (p.intensity_knots > maxK) {
        maxK = p.intensity_knots;
        idx = i;
      }
    });
    return idx;
  }, [pts2]);

  // Calculate center of all points
  const allPts = [...pts1, ...pts2];
  const center: [number, number] = allPts.length > 0 
    ? [
        allPts.reduce((acc, p) => acc + p.lat, 0) / allPts.length,
        allPts.reduce((acc, p) => acc + p.lon, 0) / allPts.length
      ]
    : [18.0, 84.0];

  return (
    <div className={`relative w-full h-full select-none ${!showLabels ? "hide-imd-labels" : ""}`}>
      {/* ── Top Left Header Badge ────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-[1000] bg-card/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border shadow-lg flex items-center gap-2.5 pointer-events-auto">
        <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
        <div>
          <h4 className="font-heading font-semibold text-xs text-foreground">
            Dual-Track Comparative GIS Analysis
          </h4>
          <p className="text-[10.5px] text-muted-foreground">
            Overlaying historical best-tracks & landfall fixes
          </p>
        </div>
      </div>

      {/* ── Top Right Toolbar Controls ───────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showLabels 
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' 
              : 'bg-background/90 text-foreground/70 border-border hover:bg-secondary'
          }`}
          title="Toggle Track Milestone Labels"
        >
          <Tag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Milestones</span>
        </button>

        {/* Map Style Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-background/90 backdrop-blur-md p-2 rounded-lg border border-border shadow-md hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
            title="Switch Map Layers (NASA VIIRS, MODIS, Satellite, Tactical Dark, IMD Geo)"
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

      {/* ── Bottom Left Dual Legend ──────────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-background/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl max-w-xs text-xs space-y-2 pointer-events-auto">
        <span className="font-heading font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5 border-b border-border pb-1">
          <Compass className="w-3.5 h-3.5 text-blue-500" />
          Comparison Legend
        </span>
        <div className="space-y-1.5 text-[11px]">
          {system1 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#06b6d4] border border-white shadow-xs inline-block" />
              <span className="font-bold text-cyan-400">{system1.name} ({system1.category.split(" ")[0]})</span>
            </div>
          )}
          {system2 && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white shadow-xs inline-block" />
              <span className="font-bold text-amber-400">{system2.name} ({system2.category.split(" ")[0]})</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-border text-[10px] text-muted-foreground">
            <span>🎯 Red Ring Marker: Landfall Coastal Crossing</span>
          </div>
        </div>
      </div>

      {/* Global CSS overrides for Leaflet map styling */}
      <style jsx global>{`
        .hide-imd-labels .compare-milestone-label {
          display: none !important;
        }
        .compare-milestone-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
      `}</style>

      <MapContainer 
        center={center} 
        zoom={5} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <ZoomControl position="topright" />
        <ChangeView center={center} zoom={5} />
        <TileLayer
          key={currentStyle}
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />

        {/* ── System 1 Track (Cyan) ───────────────────────────────────────── */}
        {system1 && pts1.length > 0 && (
          <>
            {pts1.map((pt, idx) => {
              if (idx === 0) return null;
              const prev = pts1[idx - 1];
              return (
                <Polyline 
                  key={`sys1-seg-${idx}`} 
                  positions={[[prev.lat, prev.lon], [pt.lat, pt.lon]]} 
                  pathOptions={{
                    color: "#06b6d4",
                    weight: 3.5,
                    opacity: 0.95
                  }}
                />
              );
            })}

            {pts1.map((pt, idx) => {
              const isLandfall = pt.is_landfall || (pt.label && pt.label.toLowerCase().includes("landfall"));
              const isPeak = idx === maxIdx1;
              const isGenesis = idx === 0;
              const isMilestone = isLandfall || isPeak || isGenesis;

              return (
                <CircleMarker 
                  key={`sys1-pt-${idx}`}
                  center={[pt.lat, pt.lon]} 
                  radius={isLandfall ? 8 : (isPeak ? 7 : 5)} 
                  fillColor={isLandfall ? "#dc2626" : (isPeak ? "#06b6d4" : "#0891b2")} 
                  color="#ffffff" 
                  weight={isLandfall ? 3 : (isPeak ? 2.5 : 1.5)} 
                  fillOpacity={1}
                >
                  {showLabels && isMilestone ? (
                    <Tooltip permanent direction="right" offset={[10, 0]} className="compare-milestone-label">
                      <div className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1 ${
                        isLandfall
                          ? "bg-red-950/95 text-red-200 border border-red-500/70"
                          : isPeak
                            ? "bg-cyan-950/95 text-cyan-200 border border-cyan-400 font-extrabold ring-1 ring-cyan-400/40"
                            : "bg-zinc-950/90 text-cyan-300 border border-cyan-500/40"
                      }`}>
                        {isLandfall && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                        {isPeak && <span>⭐ PEAK:</span>}
                        <span>{system1.name}: {pt.intensity_knots}KT {isLandfall ? "(Landfall)" : ""}</span>
                      </div>
                    </Tooltip>
                  ) : (
                    <Tooltip direction="top" offset={[0, -6]}>
                      <span className="font-mono text-[10px] font-bold">
                        {system1.name}: {pt.intensity_knots} KT • {pt.category}
                      </span>
                    </Tooltip>
                  )}
                  <Popup>
                    <div className="p-1.5 space-y-1 text-xs">
                      <p className="font-bold text-cyan-400">{system1.name} — {pt.category}</p>
                      <p className="text-muted-foreground">Wind: <strong className="text-white">{pt.intensity_knots} KT ({Math.round(pt.intensity_knots * 1.852)} km/h)</strong></p>
                      <p className="text-muted-foreground">Fix: {pt.lat.toFixed(1)}°N, {pt.lon.toFixed(1)}°E</p>
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
        )}

        {/* ── System 2 Track (Amber) ──────────────────────────────────────── */}
        {system2 && pts2.length > 0 && (
          <>
            {pts2.map((pt, idx) => {
              if (idx === 0) return null;
              const prev = pts2[idx - 1];
              return (
                <Polyline 
                  key={`sys2-seg-${idx}`} 
                  positions={[[prev.lat, prev.lon], [pt.lat, pt.lon]]} 
                  pathOptions={{
                    color: "#f59e0b",
                    weight: 3.5,
                    dashArray: "6, 4",
                    opacity: 0.95
                  }}
                />
              );
            })}

            {pts2.map((pt, idx) => {
              const isLandfall = pt.is_landfall || (pt.label && pt.label.toLowerCase().includes("landfall"));
              const isPeak = idx === maxIdx2;
              const isGenesis = idx === 0;
              const isMilestone = isLandfall || isPeak || isGenesis;

              return (
                <CircleMarker 
                  key={`sys2-pt-${idx}`}
                  center={[pt.lat, pt.lon]} 
                  radius={isLandfall ? 8 : (isPeak ? 7 : 5)} 
                  fillColor={isLandfall ? "#dc2626" : (isPeak ? "#f59e0b" : "#d97706")} 
                  color="#ffffff" 
                  weight={isLandfall ? 3 : (isPeak ? 2.5 : 1.5)} 
                  fillOpacity={1}
                >
                  {showLabels && isMilestone ? (
                    <Tooltip permanent direction="left" offset={[-10, 0]} className="compare-milestone-label">
                      <div className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-lg backdrop-blur-md flex items-center gap-1 ${
                        isLandfall
                          ? "bg-red-950/95 text-red-200 border border-red-500/70"
                          : isPeak
                            ? "bg-amber-950/95 text-amber-200 border border-amber-400 font-extrabold ring-1 ring-amber-400/40"
                            : "bg-zinc-950/90 text-amber-300 border border-amber-500/40"
                      }`}>
                        {isLandfall && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                        {isPeak && <span>⭐ PEAK:</span>}
                        <span>{system2.name}: {pt.intensity_knots}KT {isLandfall ? "(Landfall)" : ""}</span>
                      </div>
                    </Tooltip>
                  ) : (
                    <Tooltip direction="top" offset={[0, -6]}>
                      <span className="font-mono text-[10px] font-bold">
                        {system2.name}: {pt.intensity_knots} KT • {pt.category}
                      </span>
                    </Tooltip>
                  )}
                  <Popup>
                    <div className="p-1.5 space-y-1 text-xs">
                      <p className="font-bold text-amber-400">{system2.name} — {pt.category}</p>
                      <p className="text-muted-foreground">Wind: <strong className="text-white">{pt.intensity_knots} KT ({Math.round(pt.intensity_knots * 1.852)} km/h)</strong></p>
                      <p className="text-muted-foreground">Fix: {pt.lat.toFixed(1)}°N, {pt.lon.toFixed(1)}°E</p>
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
        )}
      </MapContainer>
    </div>
  );
}
