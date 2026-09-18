"use client";

import React from 'react';
import { GlassPanel } from './GlassPanel';
import { MicroLabel } from './MicroLabel';
import { PillButton } from './PillButton';
import { ArrowRight, SlidersHorizontal, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export function FeatureSpotlight1() {
  return (
    <section className="py-24 bg-[#060a20] relative overflow-hidden border-t border-white/5">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Text Content (Left) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <MicroLabel className="mb-4 inline-block px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full border border-sky-500/20">
              Digital Twin Simulator
            </MicroLabel>
            <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-white mb-6">
              Test evacuation protocols safely. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300">Before landfall occurs.</span>
            </h2>
            <p className="text-sm md:text-base text-slate-400 leading-relaxed mb-8">
              Model tidal surge heights, astronomical tide overlaps, and coastal barrier breaches before the storm eye hits shore. CycloNet&apos;s digital twin engine lets emergency responders test evacuation timelines and resource shifts across coastal districts in real-time.
            </p>
            <PillButton 
              variant="ghost" 
              icon={ArrowRight}
              onClick={() => window.location.href = '/forecast'}
              className="border-white/15 bg-slate-900/80 text-white hover:bg-slate-800"
            >
              Explore the Simulator
            </PillButton>
          </motion.div>

          {/* Visual (Right) */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl p-2 bg-[#0d1430]/80 border border-sky-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex flex-col justify-between p-6">
                
                {/* Simulated Radar Wave Graph */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">Coastal Inundation Model</span>
                  </div>
                  <span className="text-[11px] font-mono text-sky-400 bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20">
                    Resolution: 250m
                  </span>
                </div>

                {/* Hydrodynamic surge chart */}
                <div className="z-10 my-auto">
                  <div className="flex justify-between text-xs text-slate-400 font-mono mb-2">
                    <span>Peak Surge Height: 4.8m</span>
                    <span className="text-rose-400 font-bold">Overtopping Risk: 92%</span>
                  </div>
                  <div className="h-28 w-full bg-slate-900/90 rounded-lg p-3 border border-white/5 flex items-end gap-1.5 justify-between">
                    {[20, 32, 45, 68, 89, 95, 84, 62, 41, 28, 15, 8].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${val}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.05 + 0.3, duration: 0.6 }}
                          className={`w-full rounded-t-sm ${val > 80 ? 'bg-rose-500' : val > 50 ? 'bg-amber-500' : 'bg-sky-500'}`}
                        />
                        <span className="text-[8px] font-mono text-slate-500">T+{idx * 3}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center z-10 pt-2 border-t border-white/10 text-[11px] text-slate-400">
                  <span>Target Zone: Bay of Bengal East Coast</span>
                  <span className="text-emerald-400 font-mono font-bold">142k Citizens Protected</span>
                </div>
              </div>

              {/* Callout 1 */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="absolute top-[20%] -left-6 md:-left-10"
              >
                <GlassPanel className="flex items-center gap-2 p-2 pr-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] border-sky-500/30 bg-slate-900/95">
                  <div className="bg-sky-500/10 p-1.5 rounded-lg text-sky-400">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Surge Modifiers</span>
                </GlassPanel>
              </motion.div>

              {/* Callout 2 */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
                className="absolute bottom-[20%] -right-6 md:-right-10"
              >
                <GlassPanel className="flex items-center gap-2 p-2 pr-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] border-sky-500/30 bg-slate-900/95">
                  <div className="bg-sky-500/10 p-1.5 rounded-lg text-sky-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Evacuation Corridors</span>
                </GlassPanel>
              </motion.div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
