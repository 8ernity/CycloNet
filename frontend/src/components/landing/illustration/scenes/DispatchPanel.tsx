"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, ShieldCheck, MapPin, Radio, BellRing, Users } from 'lucide-react';
import type { CyclePhase } from '@/hooks/useHeroCycle';
import { useMotionTokens } from '@/lib/motion-tokens';

interface PanelProps {
  phase: CyclePhase;
}

export function DispatchPanel({ phase }: PanelProps) {
  const isVisible = phase === 'enter' || phase === 'idle';
  const { shouldReduceMotion } = useMotionTokens();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6"
        >
          {/* Main Tactical Map Card */}
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative">
            
            {/* Dark Map Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2IzYjRiIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjMiLz4KPC9zdmc+')] mix-blend-overlay" />
              
              {/* Fake Coastline & Evacuation Vectors */}
              <svg className="absolute inset-0 w-full h-full stroke-blue-500/30 stroke-[1.5] fill-none" style={{ zIndex: 0 }}>
                <path d="M 50 0 Q 180 80, 220 180 T 380 300" />
                <path d="M 120 0 L 170 120 L 140 300" />
                <path d="M 400 60 L 270 140 L 220 300" />
              </svg>

              {/* Pulsing Inundation Warning Nodes */}
              {!shouldReduceMotion && (
                <>
                  <motion.div className="absolute left-[220px] top-[180px] w-14 h-14 rounded-full border border-rose-500/30 bg-rose-500/10 -translate-x-1/2 -translate-y-1/2" animate={{ scale: [1, 1.6], opacity: [0.8, 0] }} transition={{ duration: 2, repeat: Infinity }} />
                  <div className="absolute left-[220px] top-[180px] w-2.5 h-2.5 rounded-full bg-rose-500 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
                  
                  {/* Evacuation Convoy */}
                  <motion.div 
                    className="absolute w-3 h-3 rounded-full bg-emerald-400 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(52,211,153,0.8)] z-10"
                    animate={{ left: ['120px', '220px'], top: ['40px', '180px'] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                  />
                </>
              )}
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md z-10 relative">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-500/20 rounded-md">
                  <Navigation className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Coastal Early Warning Dispatch</h3>
                  <p className="text-[10px] font-medium text-slate-400">NDMA CAP-CP Automated Broadcast</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Landfall ETA</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">18:40 HRS</div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-5 flex flex-col md:flex-row gap-4 relative z-10">
              
              {/* Left: Telemetry Card */}
              <div className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sector 3 Evacuation</div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    DISPATCHED
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
                      <span>Evacuation Progress</span>
                      <span className="text-white font-mono">78% Complete</span>
                    </div>
                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: ['75%', '78%', '76%'] }} transition={{ duration: 2, repeat: Infinity }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
                      <span>Shelter Capacity</span>
                      <span className="text-white font-mono">142k / 180k</span>
                    </div>
                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-emerald-400 rounded-full" animate={{ width: ['80%', '82%', '80%'] }} transition={{ duration: 3, repeat: Infinity }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Timeline */}
              <div className="flex-1 p-2">
                <div className="space-y-4 relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-slate-700">
                  
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex items-start gap-3 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0">
                      <Radio className="h-3 w-3 text-slate-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-bold text-white">CAP-CP Alert Pushed</p>
                      <p className="text-[9px] text-slate-500">2.4M SMS broadcasted</p>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex items-start gap-3 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.3)]">
                      <Users className="h-3 w-3 text-blue-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-bold text-white">NDRF Battalions Positioned</p>
                      <p className="text-[9px] text-blue-300">18 Teams on standby</p>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex items-start gap-3 relative z-10">
                    <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[11px] font-medium text-slate-400">Zero casualty protocol</p>
                    </div>
                  </motion.div>
                  
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
