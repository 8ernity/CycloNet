import React from 'react';
import { GlassPanel } from './GlassPanel';
import { Satellite, Radio, Waves, BellRing } from 'lucide-react';
import { MicroLabel } from './MicroLabel';

const integrations = [
  { icon: Satellite, name: "INSAT-3DR MOSDAC Stream" },
  { icon: Radio, name: "IMD RSMC Feed API" },
  { icon: Waves, name: "INCOIS Ocean Buoy Mesh" },
  { icon: BellRing, name: "NDMA CAP-CP Early Warning" },
];

export function IntegrationsGrid() {
  return (
    <section id="ecosystem" className="py-24 border-y border-white/5 bg-[#040714] overflow-hidden">
      <div className="container max-w-[1000px] mx-auto px-4 text-center">
        <MicroLabel className="mb-12 inline-block">Planetary Meteorological Ecosystem</MicroLabel>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {integrations.map((item) => {
            const Icon = item.icon;
            return (
              <GlassPanel key={item.name} hoverEffect className="p-6 flex flex-col items-center justify-center gap-4 border-white/10 bg-[#0a1029]/80">
                <Icon className="w-8 h-8 text-sky-400" />
                <span className="text-xs sm:text-sm font-semibold text-slate-200">{item.name}</span>
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </section>
  );
}
