"use client";

import React, { useRef, useState, useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { Cpu, Compass, Waves, Satellite, BarChart3, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionTokens } from '@/lib/motion-tokens';
import { MicroLabel } from './MicroLabel';

const features = [
  { 
    icon: Cpu, 
    title: "Deep Dvorak AI Classifier", 
    description: "Multi-branch ConvNeXt and DenseNet models estimate vortex intensity and T-numbers directly from INSAT-3DR TIR-1 bands.",
    tint: "text-sky-400 bg-sky-500/10 border-sky-500/25"
  },
  { 
    icon: Compass, 
    title: "48h Cone of Uncertainty", 
    description: "Deep ensemble neural trajectory forecaster projecting probabilistic cyclone paths with dynamic quadrant wind radii.",
    tint: "text-blue-400 bg-blue-500/10 border-blue-500/25"
  },
  { 
    icon: Waves, 
    title: "Storm Surge & Tide Simulator", 
    description: "Coupled shallow-water hydrodynamic simulation projecting coastal inundation, barrier breaches, and tidal surge heights.",
    tint: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25"
  },
  { 
    icon: Satellite, 
    title: "Real-Time Satellite Ingestion", 
    description: "Automated ETL streaming raw HDF5 imagery from ISRO MOSDAC and IMD RSMC New Delhi with zero data loss.",
    tint: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
  },
  { 
    icon: BarChart3, 
    title: "Ocean Heat & Pressure Analytics", 
    description: "Continuous diagnostic tracking of Sea Surface Temperatures (SST), Ocean Heat Content (OHC), and central barometric minimums.",
    tint: "text-rose-400 bg-rose-500/10 border-rose-500/25"
  },
  { 
    icon: Bot, 
    title: "CycloNet AI Copilot", 
    description: "Ask complex meteorological questions in plain natural language with complete SHAP explainability and immediate citations.",
    tint: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25"
  },
];

function SpotlightCard({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 1024 && window.matchMedia("(hover: hover)").matches);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.setProperty('--x', `${x}px`);
        cardRef.current.style.setProperty('--y', `${y}px`);
      }
    });
  };

  return (
    <div 
      ref={cardRef} 
      className="h-full relative group" 
      onMouseMove={handleMouseMove}
    >
      <GlassPanel hoverEffect className="p-7 h-full flex flex-col relative overflow-hidden bg-surface-glass border-surface-border">
        {/* Spotlight Effect overlay */}
        {isDesktop && (
          <div 
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(56,189,248,0.14), transparent 60%)'
            }}
          />
        )}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {children}
        </div>
      </GlassPanel>
    </div>
  );
}

export function FeaturesGrid() {
  const { tier1 } = useMotionTokens();

  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: tier1.stagger }
    }
  };

  const itemVariants = {
    hidden: tier1.initial,
    show: { ...tier1.animate, transition: tier1.transition }
  };

  return (
    <section className="py-24 bg-bg-base text-text-primary relative overflow-hidden transition-colors duration-300" id="features">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <MicroLabel className="mb-4 inline-block">Cyclone Intelligence Suite</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-4">
            Everything you need to track and protect.
          </h2>
          <p className="text-text-muted text-sm md:text-base leading-relaxed">
            A comprehensive suite of deep-learning meteorological tools designed specifically for tropical cyclone early warning operations.
          </p>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div key={feature.title} variants={itemVariants}>
                <SpotlightCard>
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center mb-6 border transition-transform duration-300",
                    feature.tint,
                    "group-hover:scale-110 group-hover:rotate-6 shadow-md"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-2 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                    {feature.description}
                  </p>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </section>
  );
}
