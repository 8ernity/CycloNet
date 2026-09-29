"use client";

import React, { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Satellite, Sparkles, Waves, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { MicroLabel } from "./MicroLabel";

const steps = [
  { icon: Satellite, title: "1. Ingest GEE SAR & Feeds", desc: "Sentinel-1 SAR, 30m DEM & NOAA GFS" },
  { icon: Sparkles, title: "2. Gemini 3.7 Dual-Inference", desc: "ResNet-50 + Multimodal Dvorak Vision" },
  { icon: Waves, title: "3. SLOSH Surge & Catchment", desc: "Compound Hydrodynamic Inundation" },
  { icon: BellRing, title: "4. Multi-Channel Dispatches", desc: "CAP-CP v1.2, Sirens & SACHET Alerts" },
];

export function InteractiveWorkflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const index = Math.min(3, Math.max(0, Math.floor(latest * 4)));
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  });

  return (
    <section ref={containerRef} id="workflow" className="py-32 bg-bg-elevated text-text-primary relative border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1100px] mx-auto px-4">
        
        <div className="text-center mb-16 md:mb-24">
          <MicroLabel className="mb-4 inline-block">The Operational Anticipatory Loop</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary">
            From raw satellite backscatter to <span className="text-sky-500 dark:text-sky-400">zero-casualty warning</span>.
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-3 max-w-xl mx-auto">
            A continuous four-stage pipeline driving rapid pre-landfall evacuation planning, power grid hardening, and automated parametric insurance relief.
          </p>
        </div>

        <div className="relative">
          
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-12 right-12 h-1 bg-surface-border rounded-full overflow-hidden z-0 pointer-events-none">
            <motion.div 
              className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500"
              style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
            />
          </div>
          
          {/* Connecting Line (Mobile) */}
          <div className="md:hidden absolute top-12 bottom-12 left-8 w-1 bg-surface-border rounded-full overflow-hidden z-0 pointer-events-none">
             <motion.div 
              className="w-full bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-500"
              style={{ scaleY: scrollYProgress, transformOrigin: "top" }}
            />
          </div>

          <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-4 relative z-10">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = i <= activeIndex;
              const isCurrent = i === activeIndex;

              return (
                <div key={step.title} className="flex md:flex-col items-center gap-6 md:gap-4 flex-1">
                  
                  <motion.div 
                    animate={{ 
                      scale: isCurrent ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center border-2 transition-all relative z-10 shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
                      isActive 
                        ? "bg-card border-sky-400 text-sky-500 dark:text-sky-400 ring-2 ring-sky-400/30" 
                        : "bg-card border-surface-border text-text-muted"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 bg-sky-400/20 blur-xl rounded-2xl -z-10" />
                    )}
                    <Icon className="w-8 h-8 md:w-10 md:h-10 relative z-10" />
                  </motion.div>

                  <div className="text-left md:text-center">
                    <h3 className={cn(
                      "text-base md:text-lg font-bold tracking-tight transition-colors mb-1",
                      isActive ? "text-text-primary" : "text-text-muted"
                    )}>
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted">{step.desc}</p>
                  </div>
                  
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
