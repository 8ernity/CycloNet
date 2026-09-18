"use client";

import React, { useRef, useState } from 'react';
import { FlowNode } from './FlowNode';
import { Satellite, Radio, Waves, Cpu, Activity, Wind } from 'lucide-react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { DrawLine } from './DrawLine';
import { useMotionTokens } from '@/lib/motion-tokens';
import { MicroLabel } from './MicroLabel';

export function StoryDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSolved, setIsSolved] = useState(false);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 70%", "end 30%"]
  });
  
  const { shouldReduceMotion } = useMotionTokens();

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest > 0.3 && !isSolved) setIsSolved(true);
    if (latest <= 0.3 && isSolved) setIsSolved(false);
  });

  const NODES = [
    { id: "insat", icon: Satellite, title: "INSAT-3DR TIR-1", 
      prob: { left: "20%", top: "15%" }, 
      sol: { left: "15%", top: "20%" }, 
      delay: 0 },
    { id: "radar", icon: Radio, title: "Doppler Radars", 
      prob: { left: "35%", top: "80%" }, 
      sol: { left: "15%", top: "40%" }, 
      delay: 1 },
    { id: "buoy", icon: Waves, title: "Ocean Buoys (SST)", 
      prob: { left: "10%", top: "65%" }, 
      sol: { left: "15%", top: "60%" }, 
      delay: 0.5 },
    { id: "ecmwf", icon: Wind, title: "NWP & ECMWF Feeds", 
      prob: { left: "40%", top: "25%" }, 
      sol: { left: "15%", top: "80%" }, 
      delay: 1.5 },
  ];

  return (
    <section ref={containerRef} id="pipeline" className="relative bg-bg-base text-text-primary overflow-hidden py-20 lg:py-32 border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1200px] mx-auto px-4">
          
          <div className="text-center mb-6">
            <MicroLabel className="inline-block">5-Stage Neural Architecture</MicroLabel>
          </div>

          {/* Text Content Morphing */}
          <div className="relative h-40 max-w-2xl mx-auto text-center mb-10">
            <AnimatePresence mode="wait">
              {!isSolved ? (
                <motion.div
                  key="problem-text"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                >
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-text-primary mb-4">
                    The danger of <span className="text-rose-500">fragmented</span> ocean intelligence.
                  </h2>
                  <p className="text-sm md:text-base text-text-muted leading-relaxed max-w-xl mx-auto">
                    Siloed satellite feeds. Manual Dvorak estimates. Delayed numerical forecasts. When disaster management relies on disconnected legacy systems, vulnerable coastlines are left exposed.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="solution-text"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                >
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-text-primary mb-4">
                    Centralized meteorological intelligence. <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">Actionable cyclone predictions.</span>
                  </h2>
                  <p className="text-sm md:text-base text-text-muted leading-relaxed max-w-xl mx-auto">
                    CycloNet unifies multi-spectral satellite imagery, Doppler radar networks, and ocean heat sensors into a single neural AI engine, delivering real-time landfall & intensity forecasts.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Diagram Area */}
          <div className="relative h-[400px] md:h-[500px] w-full max-w-5xl mx-auto hidden sm:block">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />

            {/* Connectors (Only visible in solution state) */}
            <AnimatePresence>
              {isSolved && (
                <motion.svg 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full pointer-events-none z-0"
                  viewBox="0 0 1000 500"
                  preserveAspectRatio="none"
                >
                  <DrawLine d="M 150 100 C 300 100, 300 250, 500 250" delay={0.2} pulse />
                  <DrawLine d="M 150 200 C 300 200, 300 250, 500 250" delay={0.4} pulse />
                  <DrawLine d="M 150 300 C 300 300, 300 250, 500 250" delay={0.6} pulse />
                  <DrawLine d="M 150 400 C 300 400, 300 250, 500 250" delay={0.8} pulse />
                  <DrawLine d="M 500 250 L 850 250" delay={1.2} pulse className="stroke-sky-400" />
                </motion.svg>
              )}
            </AnimatePresence>

            {/* Source Nodes */}
            {NODES.map((node, i) => {
              const activePos = isSolved ? node.sol : node.prob;
              const floating = shouldReduceMotion ? {} : {
                y: isSolved ? 0 : [0, (i % 2 === 0 ? -8 : 8), 0],
                rotate: isSolved ? 0 : [0, (i % 2 === 0 ? 3 : -3), 0],
              };
              
              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={false}
                  animate={{
                    left: activePos.left,
                    top: activePos.top,
                    ...floating
                  }}
                  transition={{
                    layout: { type: "spring", stiffness: 60, damping: 15 },
                    y: { repeat: Infinity, duration: 4 + i, ease: "easeInOut" },
                    rotate: { repeat: Infinity, duration: 5 + i, ease: "easeInOut" }
                  }}
                  className="absolute z-10 w-[150px] md:w-[170px] -translate-x-1/2 -translate-y-1/2"
                >
                  <FlowNode icon={node.icon} title={node.title} status={isSolved ? "success" : "warning"} />
                </motion.div>
              );
            })}

            {/* Central AI Engine */}
            <AnimatePresence>
              {isSolved && (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="absolute inset-0 bg-sky-500/25 blur-[45px] rounded-full" />
                  <FlowNode 
                    icon={Cpu} 
                    title="CycloNet Neural Engine" 
                    active
                    className="w-[190px] shadow-[0_0_50px_rgba(0,144,255,0.4)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output Node (Right) */}
            <AnimatePresence>
              {isSolved && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, x: -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -20 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
                  className="absolute left-[85%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[150px] md:w-[170px]"
                >
                  <FlowNode 
                    icon={Activity} 
                    title="48h Landfall Cone" 
                    active 
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
    </section>
  );
}
