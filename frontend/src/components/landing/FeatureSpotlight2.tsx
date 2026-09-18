"use client";

import React from 'react';
import { GlassPanel } from './GlassPanel';
import { MicroLabel } from './MicroLabel';
import { PillButton } from './PillButton';
import { ArrowRight, BarChartHorizontal, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const shapData = [
  { name: 'Sea Surface Temp (>29°C)', impact: 48 },
  { name: 'Ocean Heat Content', impact: 35 },
  { name: 'Upper Divergence', impact: 16 },
  { name: 'Vertical Wind Shear', impact: -22 },
];

export function FeatureSpotlight2() {
  return (
    <section className="py-24 bg-bg-base text-text-primary relative overflow-hidden border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Visual (Left) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-2xl p-2 bg-surface-glass border border-surface-border shadow-xl backdrop-blur-xl">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-card border border-border p-6 flex flex-col justify-between">
                
                {/* Background grid */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    <span className="text-xs font-bold text-text-primary font-mono uppercase tracking-wider">Meteorological SHAP Explainer</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Confidence: 94.2%
                  </span>
                </div>

                {/* Satellite Vortex overlay */}
                <div className="z-10 my-auto flex flex-col items-center justify-center text-center p-4 bg-muted/60 rounded-xl border border-border">
                  <div className="text-xs font-bold text-text-primary mb-1">Deep Dvorak Pattern Analysis</div>
                  <p className="text-[11px] text-text-muted max-w-xs leading-relaxed">
                    Rapid intensification is primarily driven by high Ocean Heat Content and elevated Sea Surface Temperature anomalies in the north-central basin.
                  </p>
                </div>

                <div className="flex justify-between items-center z-10 pt-2 border-t border-border text-[11px] text-text-muted">
                  <span>Model: ConvNeXt + Transformer Ensemble</span>
                </div>
              </div>

              {/* Atmospheric Feature Importance Floating Panel */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="absolute -bottom-8 md:-bottom-12 -right-4 md:-right-12 w-72 md:w-84"
              >
                <GlassPanel className="p-4 md:p-5 shadow-xl border-surface-border bg-card/95">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-sky-500/10 p-1.5 rounded text-sky-500 dark:text-sky-400">
                      <BarChartHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Atmospheric Feature Importance</span>
                  </div>
                  
                  {/* Custom animated SHAP bars */}
                  <motion.div 
                    className="flex flex-col gap-3"
                    initial="initial"
                    whileInView="animate"
                    viewport={{ once: true }}
                    transition={{ staggerChildren: 0.15, delayChildren: 0.6 }}
                  >
                    {shapData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-[10px] md:text-xs font-medium text-text-muted w-32 shrink-0 truncate">
                          {entry.name}
                        </span>
                        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden relative flex items-center">
                          {/* Center zero line */}
                          <div className="absolute left-[30%] top-0 bottom-0 w-px bg-border z-10" />
                          
                          {/* The Bar */}
                          <motion.div 
                            variants={{
                              initial: { scaleX: 0 },
                              animate: { scaleX: 1, transition: { type: "spring", stiffness: 100, damping: 20 } }
                            }}
                            style={{ 
                              width: `${Math.abs(entry.impact)}%`, 
                              marginLeft: entry.impact > 0 ? '30%' : `${30 + entry.impact}%`,
                              transformOrigin: entry.impact > 0 ? 'left' : 'right'
                            }}
                            className={cn(
                              "h-full rounded-full relative z-0",
                              entry.impact > 0 ? "bg-gradient-to-r from-sky-500 to-blue-500" : "bg-indigo-400"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </GlassPanel>
              </motion.div>

            </div>
          </motion.div>

          {/* Text Content (Right) */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl order-1 lg:order-2"
          >
            <MicroLabel className="mb-4 inline-block px-3 py-1 bg-sky-500/10 text-sky-500 dark:text-sky-400 rounded-full border border-sky-500/20">
              Explainable AI (XAI)
            </MicroLabel>
            <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-6">
              Every forecast, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">explained.</span>
            </h2>
            <p className="text-sm md:text-base text-text-muted leading-relaxed mb-8">
              Black-box models create hesitation during life-critical decisions. CycloNet provides full meteorological transparency through natural language querying and SHAP-value feature decompositions, so command centers understand exactly <i>why</i> an intensity or trajectory forecast is generated.
            </p>
            <PillButton 
              variant="ghost" 
              icon={ArrowRight}
              onClick={() => window.location.href = '/classification'}
              className="border-surface-border bg-card text-text-primary hover:bg-card/80"
            >
              See Model Transparency
            </PillButton>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
