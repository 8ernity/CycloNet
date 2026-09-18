"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeroCycle } from '@/hooks/useHeroCycle';
import { useMotionTokens } from '@/lib/motion-tokens';
import { Satellite, Compass, BellRing, Loader2, Check, Search, Filter, Activity } from 'lucide-react';
import { IngestPanel } from './scenes/IngestPanel';
import { PredictPanel } from './scenes/PredictPanel';
import { DispatchPanel } from './scenes/DispatchPanel';

const TABS = [
  { label: 'Satellite Ingest', icon: Satellite, index: 0 as const },
  { label: 'AI Forecast', icon: Compass, index: 1 as const },
  { label: 'Warning Dispatch', icon: BellRing, index: 2 as const },
] as const;

/**
 * IllustrationStage — Product preview panel.
 * A sleek glass container that looks like a real cyclone dashboard window,
 * with top window dots, tabs, search, and scene cycling.
 */
export function IllustrationStage() {
  const { sceneIndex, phase } = useHeroCycle();
  const { shouldReduceMotion } = useMotionTokens();

  return (
    <div
      role="img"
      aria-label="Animated product preview showing CycloNet's satellite data ingestion, predictive landfall modeling, and coastal warning dispatch features."
      className="w-full"
    >
      {/* ═══ PRODUCT PREVIEW CONTAINER ═══ */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-surface-border bg-bg-elevated/90 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        
        {/* ─── Top Bar: Advanced Dashboard Header ─── */}
        <div className="flex flex-col border-b border-surface-border bg-bg-base/70">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3">
            {/* Window dots & Search */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-glass border border-surface-border shadow-xs w-52">
                <Search className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-[10px] text-text-muted font-medium">Search cyclone archives...</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5 border border-surface-border">
              {TABS.map((tab) => {
                const isActive = tab.index === sceneIndex;
                const isDone = tab.index < sceneIndex;
                const Icon = tab.icon;
                return (
                  <motion.div
                    key={tab.label}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-default ${
                      isActive
                        ? 'text-primary bg-bg-elevated shadow-xs border border-surface-border'
                        : isDone
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-text-muted'
                    }`}
                    layout
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    {isActive && !shouldReduceMotion ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isDone ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Status & Filters */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-surface-glass rounded-md border border-surface-border shadow-xs text-[10px] font-medium text-text-muted">
                <Activity className="h-3 w-3 text-primary" />
                28.4 MB/s stream
              </div>
              <div className="hidden sm:flex p-1.5 rounded-md text-text-muted hover:bg-secondary/60 cursor-pointer transition-colors">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1.5 pl-2 border-l border-surface-border">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-text-muted hidden sm:inline">RSMC Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Main Content Area ─── */}
        <div className="relative min-h-[320px] sm:min-h-[380px] overflow-hidden group/stage">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: 'radial-gradient(circle, var(--color-accent-theme) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          
          {/* Glowing Inner Border */}
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,144,255,0.05)] pointer-events-none" />

          {/* Scene content */}
          <AnimatePresence mode="wait">
            {sceneIndex === 0 && <IngestPanel key="ingest" phase={phase} />}
            {sceneIndex === 1 && <PredictPanel key="predict" phase={phase} />}
            {sceneIndex === 2 && <DispatchPanel key="dispatch" phase={phase} />}
          </AnimatePresence>
        </div>

        {/* ─── Bottom Status Bar ─── */}
        <BottomBar sceneIndex={sceneIndex} />
      </div>
    </div>
  );
}

/** Bottom status bar inside the container */
function BottomBar({ sceneIndex }: { sceneIndex: number }) {
  const metrics = [
    ['18 Satellite Passes', '4 Doppler Stations', '99.9% Nominal'],
    ['1 Active Cyclone', '94.2% Confidence', '12ms Latency'],
    ['CAP-CP Broadcast', 'ETA 18h', 'Odisha / WB Sector'],
  ];
  const current = metrics[sceneIndex] ?? metrics[0];

  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-surface-border bg-bg-base/70">
      <div className="flex items-center gap-4 sm:gap-6">
        {current.map((text, i) => (
          <AnimatePresence key={`${sceneIndex}-${i}`} mode="wait">
            <motion.span
              key={`${sceneIndex}-${text}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              className="text-[10px] sm:text-xs font-medium text-text-muted"
            >
              {text}
            </motion.span>
          </AnimatePresence>
        ))}
      </div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === sceneIndex ? 'bg-primary' : i < sceneIndex ? 'bg-emerald-400' : 'bg-secondary'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
