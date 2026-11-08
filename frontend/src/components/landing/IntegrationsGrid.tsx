"use client";

import React from "react";
import { GlassPanel } from "./GlassPanel";
import { Satellite, Sparkles, Waves, BellRing, Database, Radio, ShieldCheck, MapPin } from "lucide-react";
import { MicroLabel } from "./MicroLabel";

const integrations = [
  {icon:Satellite,name:"Satellite flood observations",sub:"Disabled pending validation"},
  {icon:Sparkles,name:"Meteorological image analysis",sub:"Disabled pending validation"},
  {icon:Waves,name:"Surge scenarios",sub:"Assumed bathymetry; not validated"},
  {icon:BellRing,name:"CAP exercise templates",sub:"Local drafts; no delivery adapter"},
  {icon:Radio,name:"Agency bulletin adapters",sub:"Freshness and coverage checked per response"},
  {icon:Database,name:"Terrain scenarios",sub:"Illustrative slopes; no DEM sampled"},
  {icon:ShieldCheck,name:"Infrastructure examples",sub:"Unverified scenario inventory"},
  {icon:MapPin,name:"Shelter observations",sub:"Unavailable until authorized sources connect"},
];

export function IntegrationsGrid() {
  return (
    <section id="ecosystem" className="py-24 border-y border-surface-border bg-bg-base text-text-primary transition-colors duration-300 overflow-hidden">
      <div className="container max-w-[1200px] mx-auto px-4 text-center">
        <MicroLabel className="mb-4 inline-block">Research capabilities and limitations</MicroLabel>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight mb-12">
          What is available and what remains unverified
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
