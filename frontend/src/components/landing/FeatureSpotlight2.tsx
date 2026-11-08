"use client";

import React from "react";
import { GlassPanel } from "./GlassPanel";
import { MicroLabel } from "./MicroLabel";
import { PillButton } from "./PillButton";
import { ArrowRight, Sparkles, Globe2, Eye, ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const languages = [{name:"English",code:"EN",status:"Available"}];

export function FeatureSpotlight2() {
  return (
    <section className="py-24 bg-bg-base text-text-primary relative overflow-hidden border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1250px] mx-auto px-4 relative z-10">
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
                    <span className="text-xs font-bold text-text-primary font-mono uppercase tracking-wider">
                      Meteorological image analysis
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Disabled pending validation
                  </span>
                </div>

                {/* Satellite Vision metrics card */}
                <div className="z-10 my-auto p-4 bg-muted/60 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-primary flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      Dvorak Eye Morphology:
                    </span>
                    <span className="font-mono text-amber-400 font-bold">Unavailable</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">Cloud-Top Temperature:</span>
                    <span className="font-mono text-cyan-400 font-bold">Unavailable</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">Dvorak Intensity (CI/T):</span>
                    <span className="font-mono text-emerald-400 font-bold">Unavailable</span>
                  </div>
                </div>

                <div className="flex justify-between items-center z-10 pt-2.5 border-t border-border text-[11px] text-text-muted">
                  <span>Experimental classifier; independent evaluation pending</span>
                </div>
              </div>

              {/* Multilingual Briefing Floating Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 }}
                className="absolute -bottom-6 -right-2 sm:-right-6 w-72 sm:w-80 z-30"
              >
                <div className="p-4 rounded-2xl shadow-2xl border border-border bg-card/98 backdrop-blur-2xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="bg-sky-500/10 p-1.5 rounded-lg text-sky-500 dark:text-sky-400">
                      <Globe2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      English source summaries
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {languages.map((lang, index) => (
                      <span
                        key={index}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary/80 border border-border/80 text-text-primary font-semibold"
                      >
                        {lang.name} ({lang.code})
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Text Content (Right) */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-xl order-1 lg:order-2"
          >
            <MicroLabel className="mb-4 inline-block px-3 py-1 bg-sky-500/10 text-sky-500 dark:text-sky-400 rounded-full border border-sky-500/20">
              Source integrity
            </MicroLabel>
            <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-6">
              Keep uncertainty visible. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">
                Verified measurements require verified sources.
              </span>
            </h2>
            <p className="text-sm md:text-base text-text-muted leading-relaxed mb-6">
              The experimental classifier reports its provenance and validation status. Meteorological vision estimates are withheld until independently validated.
            </p>
            <p className="text-sm md:text-base text-text-muted leading-relaxed mb-8">
              Briefings summarize explicit user scenarios or current backend observations. Missing values remain unavailable, and translations are not currently produced.
            </p>
            <PillButton 
              variant="ghost" 
              icon={ArrowRight}
              onClick={() => window.location.href = "/classification"}
              className="border-surface-border bg-card text-text-primary hover:bg-card/80 cursor-pointer"
            >
              Inspect experimental classifier
            </PillButton>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
