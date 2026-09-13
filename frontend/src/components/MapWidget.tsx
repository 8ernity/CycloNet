"use client";
import React from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, Marker } from "react-leaflet";
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
}

export default function MapWidget({ points }: MapWidgetProps) {
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
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-border relative z-0">
      <style>{`
        .leaflet-tooltip.custom-tooltip {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #1d4ed8;
          font-weight: 700;
          font-size: 11px;
          text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
          padding: 0;
        }
        .leaflet-tooltip-left.custom-tooltip::before,
        .leaflet-tooltip-right.custom-tooltip::before {
          display: none;
        }
      `}</style>
      
      <MapContainer center={[currentPoint.lat, currentPoint.lon]} zoom={5} className="w-full h-full min-h-[500px]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            <Tooltip permanent direction="right" offset={[8, 0]} className="custom-tooltip">
               {pt.time_offset_hours}h, {pt.intensity_knots}KT, {pt.category}
            </Tooltip>
          </CircleMarker>
        ))}

        {futurePoints.map((pt, idx) => (
          <Marker
            key={"future-" + idx}
            position={[pt.lat, pt.lon]}
            icon={forecastIcon}
          >
            <Tooltip permanent direction="right" offset={[10, 0]} className="custom-tooltip">
               +{pt.time_offset_hours}h, {pt.intensity_knots}KT, {pt.category}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}