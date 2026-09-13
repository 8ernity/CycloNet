"use client";
import React, { useState, useEffect } from "react";
import { Wind, Clock, MapPin, Compass, AlertTriangle, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";

const MapWidget = dynamic(() => import("@/components/MapWidget"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-xl border border-border flex items-center justify-center bg-secondary/5">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  )
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
  basin: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  category: string;
  track_forecast: TrackPoint[];
}

export default function ForecastPage() {
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/active-systems");
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setSystem(data[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch system:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSystem();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground">
        <Wind className="w-12 h-12 mb-4 opacity-50" />
        <p>No active cyclones found.</p>
      </div>
    );
  }

  const pastPoints = system.track_forecast.filter(p => !p.is_forecast && p.time_offset_hours < 0).reverse();
  const currentPoint = system.track_forecast.find(p => p.time_offset_hours === 0) || system.track_forecast[0];
  const futurePoints = system.track_forecast.filter(p => p.is_forecast);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Track Forecast: {system.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">Detailed chronological analysis and kinematic trajectory predictions.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-mono px-2 py-1 bg-black/30 rounded text-muted-foreground border border-white/5 mb-2">
            ID: {system.id}
          </span>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{system.category}</span>
          </div>
        </div>
      </div>

      {/* Interactive Map */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Live Interactive Tracker
        </h3>
        <MapWidget points={system.track_forecast} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              Current Status
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Max Sustained Winds</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-heading font-bold text-foreground">{system.intensity_knots}</span>
                  <span className="text-sm font-medium text-muted-foreground mb-1">knots</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                  <p className="font-mono text-lg font-medium">{system.lat.toFixed(1)}&deg;N</p>
                </div>
                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                  <p className="font-mono text-lg font-medium">{system.lon.toFixed(1)}&deg;E</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Basin</p>
                <p className="font-medium">{system.basin}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-6 border-primary/20 bg-primary/5">
             <h3 className="font-medium text-primary mb-2 flex items-center gap-2">
               <ArrowRight className="w-4 h-4" />
               Trajectory Insight
             </h3>
             <p className="text-sm text-muted-foreground">
               The system is currently tracking North-Northeast. Environmental conditions remain highly favorable for further intensification over the next 24 hours.
             </p>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Chronological Track Data
          </h3>

          <div className="relative pl-6 space-y-8 border-l border-border/50 ml-4 pb-4">
            
            <div className="absolute left-[-5px] top-0 bottom-1/2 w-[10px] bg-gradient-to-b from-primary/30 to-transparent blur-sm -z-10" />
            
            {futurePoints.map((pt, idx) => (
              <div key={`future-${idx}`} className="relative group">
                <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-primary bg-background ring-4 ring-background" />
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center bg-secondary/10 hover:bg-secondary/30 p-4 rounded-xl border border-transparent hover:border-border transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-primary">+{pt.time_offset_hours} Hours</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Forecast</span>
                    </div>
                    <p className="font-medium text-foreground">{pt.category}</p>
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Coordinates</p>
                      <p className="font-mono text-sm">{pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E</p>
                    </div>
                    <div className="text-right w-16">
                      <p className="text-xs text-muted-foreground">Intensity</p>
                      <p className="font-bold text-foreground">{pt.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground">kt</span></p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="relative">
              <div className="absolute -left-[35px] top-2 w-5 h-5 rounded-full border-[4px] border-red-500 bg-background ring-4 ring-background animate-pulse" />
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center bg-red-500/5 p-4 rounded-xl border border-red-500/30">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-red-500">Current Position (0 Hours)</span>
                  </div>
                  <p className="font-bold text-foreground">{currentPoint.category}</p>
                </div>
                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Coordinates</p>
                    <p className="font-mono text-sm">{currentPoint.lat.toFixed(1)}&deg;N, {currentPoint.lon.toFixed(1)}&deg;E</p>
                  </div>
                  <div className="text-right w-16">
                    <p className="text-xs text-muted-foreground">Intensity</p>
                    <p className="font-bold text-red-500">{currentPoint.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground">kt</span></p>
                  </div>
                </div>
              </div>
            </div>

            {pastPoints.map((pt, idx) => (
              <div key={`past-${idx}`} className="relative opacity-60 hover:opacity-100 transition-opacity">
                <div className="absolute -left-[29px] top-2 w-2 h-2 rounded-full bg-muted-foreground ring-4 ring-background" />
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-between items-start sm:items-center py-2 px-4 rounded-xl hover:bg-secondary/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">{pt.time_offset_hours} Hours</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Observed</span>
                    </div>
                    <p className="text-sm font-medium text-foreground/80">{pt.category}</p>
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground/70">Coordinates</p>
                      <p className="font-mono text-sm text-foreground/80">{pt.lat.toFixed(1)}&deg;N, {pt.lon.toFixed(1)}&deg;E</p>
                    </div>
                    <div className="text-right w-16">
                      <p className="text-xs text-muted-foreground/70">Intensity</p>
                      <p className="font-medium text-foreground/80">{pt.intensity_knots} <span className="text-[10px] font-normal text-muted-foreground/70">kt</span></p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}