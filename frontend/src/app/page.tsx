"use client";
import React, { useState, useEffect } from "react";
import { AlertCircle, CloudRain, MapPin, Navigation, Wind } from "lucide-react";
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('../components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-800 flex items-center justify-center text-muted-foreground animate-pulse">Loading Live Map...</div>
});
interface ActiveSystem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  intensity_knots: number;
}

export default function LiveMonitoringPage() {
  const [activeSystem, setActiveSystem] = useState<ActiveSystem | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/active-systems")
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setActiveSystem(data[0]);
        }
      })
      .catch(err => console.error("Failed to fetch active systems:", err));
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat Card 1 */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Active System</p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">{activeSystem?.name || "Loading..."}</h3>
            </div>
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/20 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              {activeSystem?.category || "Unknown"}
            </span>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Max Sustained Wind</p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem?.intensity_knots ? `${Math.round(activeSystem.intensity_knots * 1.852)} km/h` : "..."}
              </h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wind className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-emerald-500 font-medium">Gusting to 190 km/h</span>
            <span>in last 3 hrs</span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Current Location</p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                {activeSystem?.lat ? `${activeSystem.lat}Â°N, ${activeSystem.lon}Â°E` : "..."}
              </h3>
            </div>
            <div className="p-2 bg-brand-teal/10 rounded-lg">
              <MapPin className="w-5 h-5 text-brand-teal" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>East-central Arabian Sea</span>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Est. Landfall</p>
              <h3 className="text-2xl font-heading font-bold text-foreground mt-1">15 Jun, 18:00</h3>
            </div>
            <div className="p-2 bg-brand-cyan/10 rounded-lg">
              <Navigation className="w-5 h-5 text-brand-cyan" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Near Jakhau Port, Gujarat</span>
          </div>
        </div>
      </div>

      {/* Main Map & Sidebar Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map Placeholder */}
        <div className="glass-card lg:col-span-2 min-h-[500px] flex flex-col p-1 relative overflow-hidden">
          <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur px-4 py-2 rounded-lg border border-border shadow-sm">
            <h4 className="font-heading font-semibold text-sm">INSAT-3DR IR Map View</h4>
            <p className="text-xs text-muted-foreground">Last updated: 10 mins ago</p>
          </div>
          
          {/* Interactive Leaflet Map */}
          <div className="w-full h-full rounded-xl relative overflow-hidden border border-border/50 z-0">
            <MapComponent activeSystem={activeSystem} />
          </div>
        </div>

        {/* Right Sidebar Details */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-5">
            <h3 className="font-heading font-semibold text-lg border-b border-border pb-3 mb-4">Latest Bulletins</h3>
            <div className="space-y-4">
              {[
                { time: "14:30 IST", text: "System moved north-northeastwards with speed of 8 kmph during past 6 hours.", type: "info" },
                { time: "11:00 IST", text: "Storm intensity upgraded to Extremely Severe. Evacuation recommended for coastal Kutch.", type: "alert" },
                { time: "08:15 IST", text: "INSAT-3D imagery indicates well-defined eye structure.", type: "update" },
              ].map((bulletin, i) => (
                <div key={i} className="flex gap-3 relative">
                  <div className="mt-1">
                    {bulletin.type === 'alert' ? 
                      <AlertCircle className="w-4 h-4 text-destructive" /> : 
                      <CloudRain className="w-4 h-4 text-primary" />
                    }
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">{bulletin.time}</span>
                    <p className="text-sm text-foreground/90 mt-0.5">{bulletin.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="/reports" className="w-full mt-6 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-sm font-medium transition-colors text-foreground block text-center">
              View All Bulletins
            </a>
          </div>

          <div className="glass-card p-5 flex-1">
             <h3 className="font-heading font-semibold text-lg border-b border-border pb-3 mb-4">Model Confidence</h3>
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Intensity Classification</span>
                    <span className="font-semibold text-emerald-500">94.2%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[94.2%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Center Fix (Lat/Lon)</span>
                    <span className="font-semibold text-primary">88.5%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary w-[88.5%] rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Track Forecast (24h)</span>
                    <span className="font-semibold text-amber-500">76.0%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-amber-500 w-[76%] rounded-full" />
                  </div>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
