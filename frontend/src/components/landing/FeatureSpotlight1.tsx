"use client";

import React from "react";
import { GlassPanel } from "./GlassPanel";
import { MicroLabel } from "./MicroLabel";
import { PillButton } from "./PillButton";
import { ArrowRight, Waves, ShieldAlert, CheckCircle2, Cpu } from "lucide-react";
import { motion } from "framer-motion";

export function FeatureSpotlight1() {
  return (
    <section className="py-24 bg-bg-elevated text-text-primary relative overflow-hidden border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1250px] mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Text Content (Left) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <MicroLabel className="mb-4 inline-block px-3 py-1 bg-sky-500/10 text-sky-500 dark:text-sky-400 rounded-full border border-sky-500/20">
              Parametric Hydrodynamic Engine
            </MicroLabel>
            <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-6">
              Simulate compound coastal storm surge. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">
                Before the storm eye reaches shore.
              </span>
            </h2>
            <p className="text-sm md:text-base text-text-muted leading-relaxed mb-6">
              CycloNet&apos;s parametric surge estimator (Jelesnianski formulation) models oceanic water pileup by coupling central barometric pressure deficits with bathymetric wind stress on shallow continental shelves and astronomical spring tide stages.
            </p>

            <div className="p-4 rounded-xl bg-card/70 border border-border mb-8 space-y-2">
              <div className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>Parametric Surge Formulation (Jelesnianski)</span>
              </div>
              <p className="text-xs font-mono text-text-primary font-semibold">
                S_peak = α · ΔP + β · V_max² · cos(θ_coast) + H_tide
              </p>
              <p className="text-[11px] text-text-muted leading-normal">
                Includes inverted barometer rise (1cm per 1hPa drop) and SRTM 30m DEM slope calculations to estimate inland flood penetration distance.
              </p>
            </div>

            <PillButton 
              variant="ghost" 
              icon={ArrowRight}
              onClick={() => window.location.href = "/infrastructure"}
              className="border-surface-border bg-card text-text-primary hover:bg-card/80 cursor-pointer"
            >
              Open Hydrodynamic Forecaster
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
            <div className="relative rounded-2xl p-2 bg-surface-glass border border-surface-border shadow-xl backdrop-blur-xl">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-card border border-border flex flex-col justify-between p-6">
                
                {/* Simulated Radar Wave Graph */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-text-primary font-mono uppercase tracking-wider">Coastal Surge & Inundation Simulation</span>
                  </div>
                  <span className="text-[11px] font-mono text-sky-500 dark:text-sky-400 bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20">
                    Resolution: 30m DEM
                  </span>
                </div>

                {/* Hydrodynamic surge chart */}
                <div className="z-10 my-auto">
                  <div className="flex justify-between text-xs text-text-muted font-mono mb-2">
                    <span>Peak Surge Height: 3.85m</span>
                    <span className="text-rose-500 font-bold">Inland Penetration: 4.2 km</span>
                  </div>
                  <div className="h-28 w-full bg-secondary/60 rounded-lg p-3 border border-border flex items-end gap-1.5 justify-between">
                    {[22, 35, 48, 70, 92, 98, 86, 64, 43, 30, 16, 9].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${val}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.05 + 0.3, duration: 0.6 }}
                          className={`w-full rounded-t-sm ${val > 80 ? "bg-rose-500" : val > 50 ? "bg-amber-500" : "bg-sky-500"}`}
                        />
                        <span className="text-[8px] font-mono text-text-muted">T+{idx * 3}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center z-10 pt-2 border-t border-border text-[11px] text-text-muted">
                  <span>Target Basin: Bay of Bengal East Coast</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Automated Flood Warnings Armed
                  </span>
                </div>
              </div>

              {/* Callout 1 */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="absolute -top-4 -right-4 md:-right-6 px-4 py-2 bg-rose-500/90 text-white rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 backdrop-blur-md"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Parametric Peak Inundation Alert</span>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
