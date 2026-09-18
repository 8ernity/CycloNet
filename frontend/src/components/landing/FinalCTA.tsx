"use client";

import React from 'react';
import { PillButton } from './PillButton';
import { ArrowRight, Radar } from 'lucide-react';
import { motion } from 'framer-motion';

export function FinalCTA() {
  return (
    <section className="py-32 bg-bg-base relative overflow-hidden" id="final-cta">
      
      {/* Radial Glow with slow drift */}
      <motion.div 
        animate={{ 
          x: ["-50%", "-40%", "-60%", "-50%"],
          y: ["-50%", "-60%", "-40%", "-50%"],
          rotate: [0, 90, 180, 360] 
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 w-full max-w-2xl aspect-square rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" 
      />
      
      <div className="container max-w-[800px] mx-auto px-4 relative z-10 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 font-bold text-xs uppercase tracking-wider mb-6">
            <Radar className="w-4 h-4 animate-spin-slow" />
            Empowering Disaster Management
          </div>

          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-text-primary mb-6">
            Ready to protect vulnerable coastlines?
          </h2>
          <p className="text-lg md:text-xl text-text-muted mb-10 max-w-2xl mx-auto">
            Join emergency responders, state disaster authorities, and maritime commands using CycloNet to forecast, track, and protect lives with unmatched precision.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <PillButton className="w-full sm:w-auto cursor-pointer" icon={ArrowRight} onClick={() => window.location.href = '/'}>
              Launch CycloNet Dashboard
            </PillButton>
            <PillButton variant="ghost" className="w-full sm:w-auto cursor-pointer" onClick={() => window.location.href = '/forecast'}>
              View Live Storm Radar
            </PillButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
