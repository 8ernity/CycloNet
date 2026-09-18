"use client";

import React from 'react';
import { GlassPanel } from './GlassPanel';
import { PillButton } from './PillButton';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { MicroLabel } from './MicroLabel';

const tiers = [
  {
    name: "Coastal District EOC",
    scope: "Single District Command",
    desc: "Core monitoring & track visualization for local emergency operations.",
    features: [
      "Real-time cyclone tracking & radar feed",
      "Interactive storm cone map",
      "Automated IMD bulletin generator",
      "Up to 10 emergency operator seats",
      "Standard telemetry support"
    ],
    elevated: false
  },
  {
    name: "Regional Met Centre (RMC)",
    scope: "Multi-District State HQ",
    desc: "Deep AI forecasting & storm surge simulation for state authorities.",
    features: [
      "Everything in Coastal District EOC",
      "48h Ensemble Track & Cone Forecast",
      "Deep Dvorak AI Intensity Classifier",
      "Storm Surge & Inundation Simulator",
      "CycloNet AI Copilot Access",
      "Priority 24/7 emergency hotline"
    ],
    elevated: true
  },
  {
    name: "National Disaster Command",
    scope: "National Basin Command",
    desc: "Enterprise computational suite for NDMA, INCOIS & MoES.",
    features: [
      "Everything in Regional Met Centre",
      "Full INSAT-3DR Raw Ingestion Hub",
      "Automated CAP-CP Early Warning Broadcast",
      "On-Premise / Sovereign Cloud Deployment",
      "Dedicated Meteorological AI Science SLA"
    ],
    elevated: false
  }
];

export function DeploymentTiers() {
  return (
    <section className="py-24 bg-[#060a20] relative overflow-hidden border-t border-white/5" id="deployment">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
          <MicroLabel className="mb-4 inline-block">Jurisdiction Deployment</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-white mb-4">
            Scaled for your operational jurisdiction.
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            From district emergency operation centers to national disaster headquarters, deploy the meteorological tools that match your operational scope.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-center max-w-5xl mx-auto">
          {tiers.map((tier, i) => (
            <motion.div 
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn("h-full", tier.elevated && "md:-mt-8 md:-mb-8 relative z-10")}
            >
              <GlassPanel 
                className={cn(
                  "p-8 h-full flex flex-col relative",
                  tier.elevated 
                    ? "border-sky-400/50 shadow-[0_0_50px_rgba(0,144,255,0.30)] bg-[#0e163b]/95" 
                    : "border-white/10 bg-[#090f28]/80"
                )}
              >
                {/* Ambient glow on middle tier */}
                {tier.elevated && (
                  <motion.div 
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-sky-500/10 blur-2xl rounded-2xl pointer-events-none"
                  />
                )}
                {tier.elevated && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3.5 py-1 rounded-full shadow-lg">
                      Most Deployed
                    </span>
                  </div>
                )}
                
                <h3 className="text-xl font-bold font-heading text-white mb-1">{tier.name}</h3>
                <p className="text-xs font-semibold text-sky-400 mb-4">{tier.scope}</p>
                <p className="text-xs sm:text-sm text-slate-400 mb-8 leading-relaxed">{tier.desc}</p>
                
                <ul className="flex flex-col gap-3.5 mb-8 flex-grow">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-sky-400" />
                      </div>
                      <span className="text-xs sm:text-sm text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <PillButton 
                  variant={tier.elevated ? "primary" : "ghost"} 
                  className={cn(
                    "w-full cursor-pointer text-xs font-bold",
                    !tier.elevated && "bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                  )}
                  onClick={() => window.location.href = '/'}
                >
                  Request Operational Briefing
                </PillButton>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
