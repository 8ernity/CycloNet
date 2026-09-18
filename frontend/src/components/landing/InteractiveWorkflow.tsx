"use client";

import React, { useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Satellite, Cpu, Waves, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MicroLabel } from './MicroLabel';

const steps = [
  { icon: Satellite, title: "Ingest Data", desc: "INSAT-3DR & Doppler Radars" },
  { icon: Cpu, title: "Neural Forecast", desc: "Dvorak & 48h Cone Models" },
  { icon: Waves, title: "Predict Surge", desc: "Inundation & Wind Radii" },
  { icon: BellRing, title: "Dispatch Alerts", desc: "NDMA CAP-CP Early Warning" },
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
    <section ref={containerRef} id="workflow" className="py-32 bg-[#060a20] relative border-t border-white/5">
      <div className="container max-w-[1000px] mx-auto px-4">
        
        <div className="text-center mb-16 md:mb-24">
          <MicroLabel className="mb-4 inline-block">The Operational Loop</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-white">
            From raw satellite telemetry to <span className="text-sky-400">early warning</span>.
          </h2>
        </div>

        <div className="relative">
          
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-12 right-12 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
              style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
            />
          </div>
          
          {/* Connecting Line (Mobile) */}
          <div className="md:hidden absolute top-12 bottom-12 left-8 w-1 bg-white/10 rounded-full overflow-hidden">
             <motion.div 
              className="w-full bg-gradient-to-b from-sky-400 to-blue-500"
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
                      backgroundColor: isActive ? "#0c1536" : "#080d22",
                      borderColor: isActive ? "#38bdf8" : "rgba(255,255,255,0.1)"
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center border-2 transition-colors relative shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
                      isActive ? "text-sky-400" : "text-slate-500"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 bg-sky-400/20 blur-xl rounded-2xl" />
                    )}
                    <Icon className="w-8 h-8 md:w-10 md:h-10 relative z-10" />
                  </motion.div>

                  <div className="text-left md:text-center">
                    <h3 className={cn(
                      "text-base md:text-lg font-bold tracking-tight transition-colors mb-1",
                      isActive ? "text-white" : "text-slate-400"
                    )}>
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500">{step.desc}</p>
                  </div>
                  
                </div>
              );
            })}
          </div>

        </div>
        
        {/* Scroll affordance */}
        <div className="mt-20 text-center text-slate-500 hidden md:block">
          <p className="text-xs tracking-widest uppercase font-semibold">Scroll to progress operational loop</p>
          <div className="w-px h-16 bg-gradient-to-b from-slate-500 to-transparent mx-auto mt-4" />
        </div>

      </div>
    </section>
  );
}
