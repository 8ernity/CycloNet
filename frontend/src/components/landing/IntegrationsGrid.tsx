"use client";

import React from "react";
import { GlassPanel } from "./GlassPanel";
import { Satellite, Sparkles, Waves, BellRing, Database, Radio, ShieldCheck, MapPin } from "lucide-react";
import { MicroLabel } from "./MicroLabel";

const integrations = [
  { icon: Satellite, name: "Google Earth Engine (GEE)", sub: "Sentinel-1 SAR / Sentinel-2" },
  { icon: Sparkles, name: "Gemini 3.7 Flash Multimodal", sub: "Vision & 7-Language Briefings" },
  { icon: Waves, name: "Parametric Surge Estimator", sub: "Jelesnianski Formulation" },
  { icon: BellRing, name: "OASIS CAP-CP v1.2 Feeds", sub: "NDMA / SDMA Dispatches" },
  { icon: Radio, name: "IMD RSMC & MOSDAC Feeds", sub: "INSAT-3DR Real-Time Streams" },
  { icon: Database, name: "SRTM 30m DEM Elevation", sub: "Catchment Slope & Choke Points" },
  { icon: ShieldCheck, name: "400kV Grid Protection", sub: "State Transmission Line Safety" },
  { icon: MapPin, name: "SACHET Emergency Broadcast", sub: "Geo-Targeted Coastal SMS" },
];

export function IntegrationsGrid() {
  return (
    <section id="ecosystem" className="py-24 border-y border-surface-border bg-bg-base text-text-primary transition-colors duration-300 overflow-hidden">
      <div className="container max-w-[1200px] mx-auto px-4 text-center">
        <MicroLabel className="mb-4 inline-block">Integrated Meteorological & Disaster Tech Stack</MicroLabel>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight mb-12">
          Unified Standards, Satellite Feeds & Early-Warning Protocols
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {integrations.map((item) => {
            const Icon = item.icon;
            return (
              <GlassPanel key={item.name} hoverEffect className="p-5 flex flex-col items-center justify-center gap-2.5 border-surface-border bg-surface-glass text-center">
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-text-primary">{item.name}</span>
                <span className="text-[11px] font-mono text-text-muted">{item.sub}</span>
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </section>
  );
}
