import React, { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import { Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default leaflet markers
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
}

interface ActiveSystem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  track_forecast?: TrackPoint[];
}

interface MapProps {
  activeSystem: ActiveSystem | null;
}

const MAP_STYLES = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  dark: {
    name: 'Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  street: {
    name: 'Street View',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;

const getIntensityColor = (knots: number) => {
  if (knots < 34) return "#a855f7"; // Purple (Depression)
  if (knots < 48) return "#3b82f6"; // Blue (Cyclonic Storm)
  if (knots < 64) return "#10b981"; // Green (Severe)
  if (knots < 90) return "#f59e0b"; // Orange (Very Severe)
  if (knots < 120) return "#ef4444"; // Red (Extremely Severe)
  return "#7f1d1d"; // Dark Red (Super)
};

export default function MapComponent({ activeSystem }: MapProps) {
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('satellite');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  
  const center: [number, number] = activeSystem ? [activeSystem.lat, activeSystem.lon] : [20.0, 65.0];

  const trackPositions: [number, number][] = activeSystem?.track_forecast 
    ? activeSystem.track_forecast.map(pt => [pt.lat, pt.lon])
    : [];

  return (
    <div className="relative w-full h-full">
      {/* Map Switcher UI overlay */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button 
          onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
          className="bg-background/90 backdrop-blur p-2.5 rounded-lg border border-border shadow-md hover:bg-secondary transition-colors flex items-center justify-center"
        >
          <Layers className="w-5 h-5 text-foreground" />
        </button>
        {isLayerMenuOpen && (
          <div className="absolute top-full right-0 mt-2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg overflow-hidden flex flex-col w-36 py-1">
            {Object.entries(MAP_STYLES).map(([key, style]) => (
              <button
                key={key}
                onClick={() => {
                  setCurrentStyle(key as MapStyleKey);
                  setIsLayerMenuOpen(false);
                }}
                className={`text-left px-4 py-2 text-sm transition-colors ${
                  currentStyle === key 
                    ? 'bg-primary/20 text-primary font-semibold' 
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                {style.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer 
        center={center} 
        zoom={5} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          key={currentStyle} // Force re-render when changing styles
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />
        
        {activeSystem && (
          <>
            <CircleMarker 
              center={[activeSystem.lat, activeSystem.lon]} 
              radius={12} 
              fillColor={getIntensityColor(activeSystem.intensity_knots)} 
              color="#ffffff" 
              weight={2} 
              fillOpacity={0.9}
              className="animate-pulse z-[400]"
            >
              <Popup>
                <div className="font-sans">
                  <strong>{activeSystem.name} (Current)</strong><br />
                  {activeSystem.category}<br />
                  {activeSystem.intensity_knots} knots<br />
                  ({activeSystem.lat.toFixed(2)}°N, {activeSystem.lon.toFixed(2)}°E)
                </div>
              </Popup>
            </CircleMarker>
            
            {activeSystem.track_forecast?.map((pt, idx, arr) => {
              if (idx === 0) return null;
              const prevPt = arr[idx - 1];
              const color = getIntensityColor(pt.intensity_knots);
              return (
                <React.Fragment key={idx}>
                  <Polyline 
                    positions={[[prevPt.lat, prevPt.lon], [pt.lat, pt.lon]]} 
                    color={color}
                    weight={3}
                    dashArray={pt.is_forecast ? "8, 8" : undefined}
                  />
                  <CircleMarker 
                    center={[pt.lat, pt.lon]} 
                    radius={pt.is_forecast ? 6 : 4} 
                    fillColor={color}
                    color={pt.is_forecast ? "#ffffff" : "#000000"} 
                    weight={1} 
                    fillOpacity={1}
                  >
                    <Popup>
                      <div className="font-sans text-xs">
                        <strong>{pt.is_forecast ? `+${pt.time_offset_hours} Hours (Forecast)` : `Past (-${Math.abs(pt.time_offset_hours)} Hours)`}</strong><br />
                        {pt.category}<br />
                        {pt.intensity_knots} knots<br />
                        ({pt.lat.toFixed(2)}°N, {pt.lon.toFixed(2)}°E)
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
