"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, Sparkles, Waves, Satellite, 
  ArrowRight, Zap, CheckCircle2, ShieldAlert,
  Clock, MapPin, Globe2, FileText, Wind, Compass
} from "lucide-react";
import Link from "next/link";
import { MicroLabel } from "./MicroLabel";
import { PillButton } from "./PillButton";
import { IllustrationStage } from "./illustration/IllustrationStage";

const IMPACT_METRICS = [
  {icon:Clock,value:"Not validated",label:"Forecast accuracy",desc:"Independent evaluation pending"},
  {icon:Satellite,value:"Unavailable",label:"Observed flood mapping",desc:"Validated satellite processing required"},
  {icon:Globe2,value:"English",label:"Source summaries",desc:"Deterministic summaries; translations unavailable"},
  {icon:ShieldCheck,value:"Draft only",label:"Exercise communications",desc:"No transmission or funded payout"},
];
const PILLARS = [
  {id:"gee",tabTitle:"Satellite observations",icon:Satellite,badge:"Unavailable",headline:"Observed flood mapping is disabled",description:"No verified satellite flood product is connected. Ellipse-based overlays are illustrative simulations.",metrics:[{label:"Acquisition",val:"Unavailable"},{label:"Validation",val:"Pending"}],route:"/infrastructure",actionLabel:"Inspect scenarios"},
  {id:"gemini",tabTitle:"Image classification",icon:Sparkles,badge:"Experimental",headline:"Independent evaluation remains pending",description:"The classifier exposes its checkpoint status. General AI vision output cannot establish measured wind, pressure or emergency instructions.",metrics:[{label:"Accuracy",val:"Not validated"},{label:"Vision estimates",val:"Disabled"}],route:"/classification",actionLabel:"Inspect classifier"},
  {id:"surge",tabTitle:"Surge scenarios",icon:Waves,badge:"Simulation",headline:"Explore assumptions about wind, pressure and tide",description:"Simplified equations use assumed shelf depth and coastal slope. Results are neither observed water levels nor validated forecasts.",metrics:[{label:"Bathymetry",val:"Assumed"},{label:"Uncertainty",val:"Not validated"}],route:"/infrastructure",actionLabel:"Explore scenarios"},
  {id:"infrastructure",tabTitle:"Infrastructure examples",icon:Zap,badge:"Unverified",headline:"Field observations are required",description:"Example facilities are kept separate from authorized occupancy, road, generator and destination approvals. Insurance amounts are hypothetical and non-contractual.",metrics:[{label:"Readiness",val:"Unavailable"},{label:"Funding",val:"Not verified"}],route:"/infrastructure",actionLabel:"Inspect infrastructure"},
];

export function Track5MissionSection() {
  const [activePillar, setActivePillar] = useState(PILLARS[0]);

  const scrollToPillars = () => {
    const el = document.getElementById("resilience-pillars");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section id="resilience" className="pt-10 pb-20 lg:pt-14 lg:pb-28 bg-gradient-to-b from-bg-base via-bg-elevated to-bg-base text-text-primary relative overflow-hidden transition-colors duration-300">
      {/* Background Ambient Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-sky-500/10 via-blue-500/5 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="container max-w-[1300px] mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Single Unified Header */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-500/30 text-sky-500 dark:text-sky-400 text-xs font-mono font-bold uppercase tracking-wider mb-5 shadow-sm backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>Anticipatory Action & Infrastructure Resilience</span>
          </div>

          <h2 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] tracking-tight leading-[1.06] mb-6 select-none font-normal"
            style={{ fontFamily: "'Instrument Serif', 'Newsreader', 'Bodoni Moda', 'Playfair Display', Georgia, serif" }}
          >
            <span className="italic text-text-primary block font-normal">
              From Cyclone Prediction
            </span>
            <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 drop-shadow-[0_0_30px_rgba(99,102,241,0.25)] block">
              to Community Protection.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl mx-auto mb-8">
            A research workspace for inspecting source observations, historical records and explicit scenarios. Scientific and operational validation remain separate requirements.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <motion.div
              className="relative group/btn cursor-pointer"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <motion.div 
                className="absolute -inset-1 rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 opacity-70 blur-md group-hover/btn:opacity-100 transition-opacity duration-300"
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.6, 0.9, 0.6],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <Link
                href="/dashboard"
                className="relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0090FF] to-[#0066FF] px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:shadow-[0_0_30px_rgba(0,144,255,0.6)] transition-all border border-sky-400/40 cursor-pointer"
              >
                <span>Launch CycloNet Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <PillButton
              variant="ghost"
              onClick={scrollToPillars}
              className="px-7 py-3.5 bg-card/80 hover:bg-card border-border text-foreground hover:text-foreground shadow-lg font-semibold cursor-pointer backdrop-blur-md text-sm"
            >
              Explore Resilience Modules
            </PillButton>
          </div>

          {/* 4 Key Enterprise Impact KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
            {IMPACT_METRICS.map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div 
                  key={i} 
                  className="glass-card p-5 border-border bg-card/60 hover:bg-card/80 transition-all duration-300 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xl font-mono font-black text-text-primary">{metric.value}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{metric.label}</h4>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{metric.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar & Storm Visualization Stage */}
        <div className="w-full relative z-10 flex flex-col items-center mb-20">
          <div className="relative w-full max-w-[850px] flex items-center justify-center mx-auto">
            <div className="glass-card p-12 text-center"><h3 className="text-2xl font-bold">Research scenarios</h3><p>Current observations, historical records and simulations remain distinct.</p></div>
            
            {/* Floating Badge 1: Vortex Anomaly */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="hidden lg:flex absolute left-0 lg:-left-4 xl:-left-8 top-16 z-20 items-center gap-3 px-5 py-3 rounded-2xl bg-surface-glass border border-rose-500/30 shadow-xl backdrop-blur-xl cursor-pointer group/float hover:border-rose-400/60 transition-all duration-300"
            >
              <div className="bg-rose-500/20 p-2 rounded-xl group-hover/float:bg-rose-500 transition-colors duration-300 shadow-xs border border-rose-500/30">
                <Wind className="h-4 w-4 text-rose-500 dark:text-rose-400 group-hover/float:text-white transition-colors duration-300" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-text-primary leading-tight">Scenario illustration</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">SIMULATED</span>
                </div>
                <span className="text-[11px] font-medium text-text-muted">No current weather asserted</span>
              </div>
            </motion.div>

            {/* Floating Badge 2: 48h Cone */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="hidden lg:flex absolute right-0 lg:-right-4 xl:-right-8 bottom-16 z-20 items-center gap-3 px-5 py-3 rounded-2xl bg-surface-glass border border-sky-500/30 shadow-xl backdrop-blur-xl cursor-pointer group/float hover:border-sky-400/60 transition-all duration-300"
            >
              <div className="bg-sky-500/20 p-2 rounded-xl group-hover/float:bg-sky-500 transition-colors duration-300 shadow-xs border border-sky-500/30">
                <Compass className="h-4 w-4 text-sky-500 dark:text-sky-400 group-hover/float:text-white transition-colors duration-300" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-text-primary leading-tight">Uncertainty not validated</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-bold">SCENARIO</span>
                </div>
                <span className="text-[11px] font-medium text-text-muted">No calibrated landfall estimate</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Interactive 4-Pillar Showcase */}
        <div id="resilience-pillars" className="pt-8">
          <div className="text-center mb-8">
            <MicroLabel className="inline-block">Specialized Intelligence Pillars</MicroLabel>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight mt-2">
              Explore Track 5 Predictive Capabilities
            </h3>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              const isSelected = activePillar.id === pillar.id;
              return (
                <button
                  key={pillar.id}
                  onClick={() => setActivePillar(pillar)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-300 border cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105"
                      : "bg-surface-glass text-text-muted hover:text-text-primary border-surface-border hover:border-border"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? "text-primary-foreground" : "text-sky-400"}`} />
                  <span>{pillar.tabTitle}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Card Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePillar.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="glass-card p-8 lg:p-10 border-surface-border bg-surface-glass relative overflow-hidden"
            >
              <div className="grid lg:grid-cols-12 gap-8 items-center">
                
                {/* Left Column: Description & Metrics */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono font-semibold">
                    <activePillar.icon className="w-3.5 h-3.5" />
                    <span>{activePillar.badge}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight leading-snug">
                    {activePillar.headline}
                  </h3>

                  <p className="text-sm sm:text-base text-text-muted leading-relaxed">
                    {activePillar.description}
                  </p>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {activePillar.metrics.map((m, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-card/60 border border-border">
                        <span className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-wider block">
                          {m.label}
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-bold text-sky-400 mt-1 block truncate">
                          {m.val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Link
                      href={activePillar.route}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/35 transition-all group"
                    >
                      <span>{activePillar.actionLabel}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>

                {/* Right Column: Live Interactive Visual Indicator */}
                <div className="lg:col-span-5">
                  <div className="relative rounded-2xl p-6 bg-card/90 border border-border shadow-2xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="font-bold text-text-primary">Pipeline Status</span>
                      </div>
                      <span className="text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                        {activePillar.id === "gee" ? "Observed product unavailable" : activePillar.id === "gemini" ? "Vision estimates disabled" : "Experimental scenario"}
                      </span>
                    </div>

                    {activePillar.id === "gee" && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Sentinel-1 Dual-Pol VV/VH:</span>
                          <span className="text-emerald-400 font-bold">Unavailable</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Sentinel-2 MNDWI Index:</span>
                          <span className="text-sky-400 font-bold">Not processed</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">SRTM 30m DEM Elevation:</span>
                          <span className="text-purple-400 font-bold">Not sampled</span>
                        </div>
                      </div>
                    )}

                    {activePillar.id === "gemini" && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Multimodal Dvorak Estimate:</span>
                          <span className="text-amber-400 font-bold">Not validated</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Convective Cloud Top Temp:</span>
                          <span className="text-cyan-400 font-bold">Unavailable</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Executive Risk Memo:</span>
                          <span className="text-emerald-400 font-bold">English source summaries</span>
                        </div>
                      </div>
                    )}

                    {activePillar.id === "surge" && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Peak Surge Height (Est.):</span>
                          <span className="text-blue-400 font-bold">Scenario inputs required</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Inverted Barometer Effect:</span>
                          <span className="text-cyan-400 font-bold">Scenario inputs required</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Inland Penetration Distance:</span>
                          <span className="text-rose-400 font-bold">Not validated</span>
                        </div>
                      </div>
                    )}

                    {activePillar.id === "infrastructure" && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">400kV Grid Substations:</span>
                          <span className="text-amber-400 font-bold">Field data unavailable</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Evacuation Corridors:</span>
                          <span className="text-emerald-400 font-bold">Road conditions unverified</span>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex justify-between items-center">
                          <span className="text-text-muted">Parametric Payout Trigger:</span>
                          <span className="text-purple-400 font-bold">No funded policy verified</span>
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-text-primary text-[11px] font-sans flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>Research views keep observations, unavailable data and simulations separate.</span>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
