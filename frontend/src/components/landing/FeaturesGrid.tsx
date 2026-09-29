"use client";

import React, { useRef, useState, useEffect } from "react";
import { GlassPanel } from "./GlassPanel";
import { 
  Satellite, Sparkles, Waves, CloudRain, 
  Zap, BellRing, ArrowRight 
} from "lucide-react";
import { motion } from "framer-motion";
import { useMotionTokens } from "@/lib/motion-tokens";
import { MicroLabel } from "./MicroLabel";
import Link from "next/link";

const features = [
  { 
    icon: Satellite, 
    title: "GEE SAR Flood Inundation", 
    description: "Sentinel-1 SAR dual-polarization (VV/VH) radar backscatter and Sentinel-2 MNDWI mapping surface water extent through thick cyclone cloud cover.",
    tint: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    link: "/infrastructure"
  },
  { 
    icon: Sparkles, 
    title: "Gemini 3.7 Flash Multimodal Vision", 
    description: "Dual-inference satellite inspection quantifying Dvorak T-numbers, eye diameters, and cloud-top temperatures (< -80°C) with 7-language executive briefings.",
    tint: "text-sky-400 bg-sky-500/10 border-sky-500/25",
    link: "/classification"
  },
  { 
    icon: Waves, 
    title: "SLOSH Hydrodynamic Surge Forecaster", 
    description: "Parameterized hydrodynamic simulation factoring in inverted barometer effect, forward motion, and astronomical spring tide superposition.",
    tint: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    link: "/infrastructure"
  },
  { 
    icon: CloudRain, 
    title: "Catchment Runoff & Delta Pathways", 
    description: "High-resolution SRTM 30m DEM terrain slope analysis pinpointing flash flood choke points across vulnerable river deltas and estuaries.",
    tint: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
    link: "/infrastructure"
  },
  { 
    icon: Zap, 
    title: "Critical Grid & Asset Exposure", 
    description: "Vulnerability overlays for 400kV/220kV power substations, national evacuation highway corridors, medical shelters, and parametric liquidity triggers.",
    tint: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    link: "/reports"
  },
  { 
    icon: BellRing, 
    title: "Multi-Channel Alert Dispatches", 
    description: "Automates disaster advisory distribution across OASIS CAP-CP v1.2 XML emergency feeds, SMS broadcasts, coastal sirens, VHF radio, and SACHET.",
    tint: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    link: "/reports"
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
        cardRef.current.style.setProperty("--x", `${x}px`);
        cardRef.current.style.setProperty("--y", `${y}px`);
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
              background: "radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(56,189,248,0.14), transparent 60%)"
            }}
          />
        )}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full justify-between">
          {children}
        </div>
      </GlassPanel>
    </div>
  );
}

export function FeaturesGrid() {
  const { tier1 } = useMotionTokens();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    }
  };

  return (
    <section id="features" className="py-24 bg-bg-base text-text-primary relative overflow-hidden border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1300px] mx-auto px-4 sm:px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <MicroLabel className="mb-4 inline-block">Predictive Vulnerability Architecture</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-4">
            Six interconnected modules for <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">
              zero-casualty anticipatory disaster response
            </span>
          </h2>
          <p className="text-sm md:text-base text-text-muted leading-relaxed max-w-2xl mx-auto">
            From raw satellite backscatter to localized power grid shut-off protocols, CycloNet bridges meteorological observation with municipal disaster action.
          </p>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div key={i} variants={item} className="h-full">
                <SpotlightCard>
                  <div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border ${feature.tint}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary tracking-tight mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-4 border-t border-border/50">
                    <Link
                      href={feature.link}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors group"
                    >
                      <span>Launch Module</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </section>
  );
}
