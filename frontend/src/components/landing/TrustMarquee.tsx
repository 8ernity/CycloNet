import React from 'react';
import { MicroLabel } from './MicroLabel';

const AGENCIES = [
  { name: 'India Meteorological Dept (IMD)' },
  { name: 'National Disaster Management Authority (NDMA)' },
  { name: 'ISRO MOSDAC Satellite Telemetry' },
  { name: 'INCOIS Ocean Information Services' },
  { name: 'National Disaster Response Force (NDRF)' },
  { name: 'Indian Coast Guard (ICG)' },
  { name: 'WMO RSMC New Delhi' },
  { name: 'Ministry of Earth Sciences (MoES)' },
];

export function TrustMarquee() {
  const marqueeItems = [...AGENCIES, ...AGENCIES, ...AGENCIES, ...AGENCIES];

  return (
    <section className="py-12 md:py-16 border-y border-surface-border bg-bg-elevated transition-colors duration-300 overflow-hidden">
      <div className="container mx-auto px-4 text-center mb-8">
        <MicroLabel>Integrated with Leading Meteorological & Disaster Authorities</MicroLabel>
      </div>
      
      <div className="relative flex overflow-hidden group">
        <div className="animate-marquee flex gap-16 md:gap-24 items-center pl-16 md:pl-24 group-hover:[animation-play-state:paused]">
          {marqueeItems.map((agency, index) => (
            <div 
              key={`${agency.name}-${index}`} 
              className="flex-shrink-0 flex items-center justify-center opacity-70 hover:opacity-100 transition-all duration-300 group/logo cursor-pointer"
            >
              <span className="text-base md:text-lg font-bold font-heading text-text-muted tracking-tight whitespace-nowrap transition-all duration-300 group-hover/logo:text-sky-500 dark:group-hover/logo:text-sky-400 group-hover/logo:drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                {agency.name}
              </span>
            </div>
          ))}
        </div>
        
        <div className="absolute inset-y-0 left-0 w-24 md:w-48 bg-gradient-to-r from-bg-elevated to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 md:w-48 bg-gradient-to-l from-bg-elevated to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  );
}
