"use client";
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, Marker, useMap, ZoomControl } from "react-leaflet";
import { Layers } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface TrackPoint {
  lat: number;
  lon: number;
  time_offset_hours: number;
  category: string;
  intensity_knots: number;
  is_forecast: boolean;
}

interface MapWidgetProps {
  points: TrackPoint[];
  systemName?: string;
}

const MAP_STYLES = {
  satellite: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye'
  },
  street: {
    name: 'IMD Chart (Street/Geo)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; IMD Best-Track'
  },
  dark: {
    name: 'Dark Tactical',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  }
};

type MapStyleKey = keyof typeof MAP_STYLES;

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

  // Red custom icon for forecast points
  const forecastIcon = L.divIcon({
    className: 'bg-transparent border-none',
    html: `<div style="color: #dc2626; display: flex; align-items: center; justify-content: center;">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
               <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
             </svg>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return (
    <div className="w-full h-full min-h-[520px] relative z-0">
      <style>{`
        /* Position Leaflet top-right controls directly below the Map Change (Layers) button */
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
        .leaflet-tooltip.custom-tooltip {
          background: rgba(9, 9, 11, 0.92) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.22) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.65) !important;
          color: #ffffff !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
          font-size: 10.5px !important;
          line-height: 1.25 !important;
          padding: 3px 7px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip-left.custom-tooltip::before,
        .leaflet-tooltip-right.custom-tooltip::before,
        .leaflet-tooltip-top.custom-tooltip::before,
        .leaflet-tooltip-bottom.custom-tooltip::before {
          display: none !important;
        }
      `}</style>

      {/* 1st Heading: INSAT-3DR Surveillance Badge (Top-Left) */}
      <div className="absolute top-4 left-4 z-[1000] bg-zinc-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shadow-lg flex items-center gap-3 pointer-events-auto">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <div>
          <h4 className="font-heading font-semibold text-xs text-zinc-100">
            INSAT-3DR Satellite Live Surveillance
          </h4>
          <p className="text-[10.5px] text-zinc-400">
            {systemName ? `Tracking Active Vortex: ${systemName}` : "North Indian Ocean Basin • Real-Time Nominal"}
          </p>
        </div>
      </div>

      {/* 4th Button: Base Map Theme Switcher (Top-Right) */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto" ref={layerMenuRef}>
        <div className="relative">
          <button 
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-zinc-950/85 backdrop-blur-md p-2.5 rounded-xl border border-white/15 shadow-lg hover:bg-zinc-900 transition-colors flex items-center justify-center cursor-pointer text-zinc-200 hover:text-white"
            title="Switch Map Layers"
          >
            <Layers className="w-4 h-4" />
          </button>
          {isLayerMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col w-48 py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/10">
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
                      ? 'bg-primary/20 text-primary font-bold' 
                      : 'text-zinc-300 hover:bg-white/10'
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
      
      <MapContainer center={[currentPoint.lat, currentPoint.lon]} zoom={5} zoomControl={false} className="w-full h-full min-h-[520px]">
        <ZoomControl position="topright" />
        <MapReCenter center={[currentPoint.lat, currentPoint.lon]} />
        <TileLayer
          key={currentStyle}
          attribution={MAP_STYLES[currentStyle].attribution}
          url={MAP_STYLES[currentStyle].url}
        />

        <Polyline positions={positions} color="black" weight={3} opacity={0.8} />

        {futurePoints.map((pt, idx) => {
          const baseRadiusMeters = 50000;
          const expansionMeters = pt.time_offset_hours * 2000;
          const totalOuterRadius = baseRadiusMeters + expansionMeters;
          const totalInnerRadius = totalOuterRadius * 0.55; 

          return (
            <React.Fragment key={"cone-" + idx}>
              <Circle 
                center={[pt.lat, pt.lon]} 
                radius={totalOuterRadius} 
                pathOptions={{ fillColor: '#3b82f6', color: '#3b82f6', weight: 1, fillOpacity: 0.15 }} 
              />
              <Circle 
                center={[pt.lat, pt.lon]} 
                radius={totalInnerRadius} 
                pathOptions={{ fillColor: '#22c55e', color: '#22c55e', weight: 1, fillOpacity: 0.3 }} 
              />
            </React.Fragment>
          );
        })}

        {pastPoints.map((pt, idx) => (
          <CircleMarker
            key={"past-" + idx}
            center={[pt.lat, pt.lon]}
            radius={5}
            pathOptions={{ color: 'black', fillColor: 'black', fillOpacity: 1 }}
          >
            <Tooltip permanent direction="right" offset={[10, 0]} className="custom-tooltip">
              <span className="font-mono text-[10.5px] flex items-center gap-1.5">
                <strong className={pt.time_offset_hours === 0 ? "text-emerald-400 font-bold" : "text-zinc-300 font-bold"}>
                  {pt.time_offset_hours === 0 ? "0h (Fix)" : `${pt.time_offset_hours}h`}
                </strong>
                <span className="text-zinc-500">•</span>
                <span className="text-amber-400 font-bold">{pt.intensity_knots} KT</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-200">{pt.category}</span>
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

        {futurePoints.map((pt, idx) => (
          <Marker
            key={"future-" + idx}
            position={[pt.lat, pt.lon]}
            icon={forecastIcon}
          >
            <Tooltip permanent direction="right" offset={[12, 0]} className="custom-tooltip">
              <span className="font-mono text-[10.5px] flex items-center gap-1.5">
                <strong className="text-red-400 font-bold">+{pt.time_offset_hours}h</strong>
                <span className="text-zinc-500">•</span>
                <span className="text-amber-400 font-bold">{pt.intensity_knots} KT</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-200">{pt.category}</span>
              </span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}