import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Popup, 
  Polyline, 
  Polygon, 
  Tooltip, 
  useMap,
  ZoomControl 
} from 'react-leaflet';
import { Layers, Tag, ShieldAlert, Compass, Eye } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
  label?: string;
}

interface ActiveSystem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  basin?: string;
  track_forecast?: TrackPoint[];
}

interface MapProps {
  activeSystem: ActiveSystem | null;
}

const MAP_STYLES = {
  street: {
    name: 'IMD Chart (Street/Geo)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; IMD Best-Track'
  },
  satellite: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye'
  },
  dark: {
    name: 'Dark Tactical',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;

const getIntensityColor = (knots: number) => {
  if (knots < 34) return "#a855f7"; // Purple (Depression)
  if (knots < 48) return "#3b82f6"; // Blue (Cyclonic Storm)
  if (knots < 64) return "#10b981"; // Green (Severe)
  if (knots < 90) return "#f59e0b"; // Orange (Very Severe)
  if (knots < 120) return "#ef4444"; // Red (Extremely Severe)
  return "#7f1d1d"; // Dark Red (Super Cyclone)
};

const getCategoryAbbr = (cat: string, knots: number): string => {
  const c = cat.toLowerCase();
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

// Generates smooth IMD Cone of Uncertainty polygon enclosing future forecast track
function generateConeOfUncertainty(
  forecastPts: { lat: number; lon: number }[]
): [number, number][] {
  if (forecastPts.length < 2) return [];

  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];

  for (let i = 0; i < forecastPts.length; i++) {
    const pt = forecastPts[i];
    const prev = forecastPts[Math.max(0, i - 1)];
    const next = forecastPts[Math.min(forecastPts.length - 1, i + 1)];

    let dLat = next.lat - prev.lat;
    let dLon = next.lon - prev.lon;
    if (dLat === 0 && dLon === 0) {
      dLat = 0.1;
      dLon = 0.1;
    }

    const len = Math.hypot(dLat, dLon);
    const nLat = -dLon / len;
    const nLon = dLat / len;

    // Radius expands as forecast lead time increases (from ~30km up to ~180km)
    const radius = 0.28 + i * 0.32;
    leftSide.push([pt.lat + nLat * radius, pt.lon + nLon * radius]);
    rightSide.push([pt.lat - nLat * radius, pt.lon - nLon * radius]);
  }

  // Rounded cap around the final forecast fix
  const lastPt = forecastPts[forecastPts.length - 1];
  const prevPt = forecastPts[Math.max(0, forecastPts.length - 2)];
  const tipRadius = 0.28 + (forecastPts.length - 1) * 0.32;
  const baseAngle = Math.atan2(lastPt.lat - prevPt.lat, lastPt.lon - prevPt.lon);
  const capPoints: [number, number][] = [];

  for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 8) {
    const angle = baseAngle + a;
    capPoints.push([
      lastPt.lat + Math.sin(angle) * tipRadius,
      lastPt.lon + Math.cos(angle) * tipRadius,
    ]);
  }

  return [...leftSide, ...capPoints, ...rightSide.reverse()];
}

export default function MapComponent({ activeSystem }: MapProps) {
  // Default to Satellite View on application startup
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('satellite');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showCone, setShowCone] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  
  const center: [number, number] = activeSystem ? [activeSystem.lat, activeSystem.lon] : [17.0, 78.0];
  const zoomLevel = activeSystem ? 6 : 5;

  const points = activeSystem?.track_forecast || [];

  // Split points into observed past points and future forecast points
  const { observedPoints, forecastPoints, currentPoint } = useMemo(() => {
    if (!points || points.length === 0) {
      return { observedPoints: [], forecastPoints: [], currentPoint: null };
    }

    const past = points.filter(p => !p.is_forecast);
    const future = points.filter(p => p.is_forecast);
    
    // The current fix is either the last past point or the activeSystem point
    const curr = past.length > 0 
      ? past[past.length - 1] 
      : { 
          lat: activeSystem!.lat, 
          lon: activeSystem!.lon, 
          intensity_knots: activeSystem!.intensity_knots, 
          category: activeSystem!.category, 
          time_offset_hours: 0, 
          is_forecast: false,
          label: `${activeSystem!.intensity_knots}KT,${getCategoryAbbr(activeSystem!.category, activeSystem!.intensity_knots)}`
        };

    return {
      observedPoints: past,
      forecastPoints: future,
      currentPoint: curr
    };
  }, [points, activeSystem]);

  // Cone of Uncertainty polygon coordinates
  const conePolygon: [number, number][] = useMemo(() => {
    if (!currentPoint || forecastPoints.length === 0) return [];
    return generateConeOfUncertainty([currentPoint, ...forecastPoints]);
  }, [currentPoint, forecastPoints]);

  // Helper to get formatted IMD Label
  const getPointLabel = (pt: TrackPoint, defaultDay: number = 15) => {
    if (pt.label) return pt.label;
    const offsetH = pt.time_offset_hours || 0;
    const day = Math.max(1, defaultDay + Math.floor(offsetH / 24));
    const hr = ((6 + offsetH) % 24 + 24) % 24;
    const abbr = getCategoryAbbr(pt.category, pt.intensity_knots);
    return `${String(day).padStart(2, '0')}/${String(hr).padStart(2, '0')},${pt.intensity_knots}KT,${abbr}`;
  };

  return (
    <div className={`relative w-full h-full select-none ${!showLabels ? "hide-imd-labels" : ""}`}>
      {/* IMD Top Toolbar Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        {/* Toggle IMD Labels Button */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showLabels 
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' 
              : 'bg-background/90 text-foreground/70 border-border hover:bg-secondary'
          }`}
          title="Toggle IMD Bullet Labels (DD/HH, Wind, Category)"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>IMD Labels</span>
        </button>

        {/* Toggle Cone of Uncertainty */}
        <button
          onClick={() => setShowCone(!showCone)}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
            showCone 
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
              : 'bg-background/90 text-foreground/70 border-border hover:bg-secondary'
          }`}
          title="Toggle Cone of Uncertainty (Landfall Probability Envelope)"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Cone</span>
        </button>

        {/* Map Style Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-background/90 backdrop-blur-md p-2 rounded-lg border border-border shadow-md hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
            title="Switch Map Layers"
          >
            <Layers className="w-4 h-4 text-foreground" />
          </button>
          {isLayerMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden flex flex-col w-48 py-1 z-50">
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

      {/* Official IMD Track Legend (Bottom-Left) */}
      {showLegend && activeSystem && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-background/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl max-w-xs text-xs space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
            <span className="font-heading font-bold text-foreground text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-500" />
              IMD Best-Track Chart
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
            
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-foreground/80 inline-block" />
              <span className="text-muted-foreground">Solid Line: Observed Past Track</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0 border-t-2 border-dashed border-foreground/80 inline-block" />
              <span className="text-muted-foreground">Dashed Line: Forecast Track</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-3 rounded-xs bg-emerald-500/40 border border-emerald-600 inline-block" />
              <span className="text-muted-foreground">Cone of Uncertainty (Landfall Zone)</span>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="px-1 py-0.2 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[9px] font-bold rounded border border-blue-500/20">
                DD/HH,KT,CAT
              </span>
              <span className="text-muted-foreground text-[10px]">Date/Hour UTC, Wind, Category</span>
            </div>
          </div>
        </div>
      )}

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
        <TileLayer
          key={currentStyle}
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />
        
        {activeSystem && (
          <>
            {/* 1. Translucent Green Cone of Uncertainty Envelope */}
            {showCone && conePolygon.length > 2 && (
              <Polygon
                positions={conePolygon}
                pathOptions={{
                  fillColor: "#22c55e",
                  fillOpacity: 0.35,
                  color: "#15803d",
                  weight: 1.5,
                  dashArray: "3, 3"
                }}
              />
            )}

            {/* 2. Track Segments Colored by Severity (Solid for Observed, Dashed for Forecast) */}
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
              return (
                <CircleMarker 
                  key={`pt-${idx}-${showLabels}`}
                  center={[pt.lat, pt.lon]} 
                  radius={pt.is_forecast ? 5.5 : 5} 
                  fillColor={color} 
                  color="#ffffff" 
                  weight={1.5} 
                  fillOpacity={1}
                >
                  {showLabels && (
                    <Tooltip 
                      permanent
                      direction="right" 
                      offset={[8, 0]} 
                      className={`imd-track-tooltip ${pt.is_forecast ? "is-forecast" : ""}`}
                    >
                      {label}
                    </Tooltip>
                  )}
                  <Popup>
                    <div className="font-sans text-xs">
                      <strong style={{ color }}>
                        {activeSystem.name} — {pt.is_forecast ? `+${pt.time_offset_hours}h Forecast` : (pt.time_offset_hours === 0 ? "Current Fix" : `${Math.abs(pt.time_offset_hours)}h ago`)}
                      </strong><br />
                      <strong>Category:</strong> {pt.category}<br />
                      <strong>Intensity:</strong> {pt.intensity_knots} knots<br />
                      <strong>Coords:</strong> {pt.lat.toFixed(2)}°N, {pt.lon.toFixed(2)}°E<br />
                      <strong>IMD Code:</strong> {label}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* 4. Current Center Fix Radar Marker */}
            {currentPoint && (
              <>
                <CircleMarker 
                  center={[currentPoint.lat, currentPoint.lon]} 
                  radius={14} 
                  fillColor={getIntensityColor(activeSystem.intensity_knots)} 
                  color="#ffffff" 
                  weight={1.5} 
                  fillOpacity={0.25}
                  className="pointer-events-none"
                />
                <CircleMarker 
                  center={[currentPoint.lat, currentPoint.lon]} 
                  radius={8} 
                  fillColor={getIntensityColor(activeSystem.intensity_knots)} 
                  color="#ffffff" 
                  weight={2.5} 
                  fillOpacity={1}
                >
                  <Popup>
                    <div className="font-sans text-xs">
                      <strong className="text-red-600 text-sm">{activeSystem.name} (Current Center)</strong><br />
                      <span className="font-semibold text-foreground">{activeSystem.category}</span><br />
                      <strong>Wind:</strong> {activeSystem.intensity_knots} knots<br />
                      <strong>Position:</strong> {currentPoint.lat.toFixed(2)}°N, {currentPoint.lon.toFixed(2)}°E
                    </div>
                  </Popup>
                </CircleMarker>
              </>
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
