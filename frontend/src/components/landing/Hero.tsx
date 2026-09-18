"use client";

import React, { MouseEvent } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { ArrowRight, Satellite, Radio, ShieldCheck, Compass, Wind } from 'lucide-react';
import { PillButton } from './PillButton';
import { useMotionTokens } from '@/lib/motion-tokens';
import { IllustrationStage } from './illustration/IllustrationStage';

export function Hero() {
  const { shouldReduceMotion } = useMotionTokens();
  const { scrollY } = useScroll();
  
  // Parallax offsets
  const textY = useTransform(scrollY, [0, 600], [0, -40]);
  const illustrationY = useTransform(scrollY, [0, 600], [0, -10]);
  const floatingY1 = useTransform(scrollY, [0, 600], [0, -60]);
  const floatingY2 = useTransform(scrollY, [0, 600], [0, -30]);

  // Spotlight Cursor Glow
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 100 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.25,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    initial: { opacity: 0, y: 30 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    },
  };

  const scrollToIllustration = () => {
    const stage = document.getElementById('hero-illustration-stage');
    if (stage) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <section 
      className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden flex flex-col items-center min-h-screen group justify-center bg-[#040714]"
      onMouseMove={handleMouseMove}
    >
      {/* Interactive Spotlight Glow */}
      <motion.div
        className="pointer-events-none absolute w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[160px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out hidden xl:block z-0"
        style={{
          x: smoothMouseX,
          y: smoothMouseY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="container max-w-[1400px] mx-auto px-4 sm:px-6 relative z-10 w-full flex flex-col items-center"
      >
        
        {/* ─── Top Section: Centered Typography & CTAs ─── */}
        <motion.div
          style={!shouldReduceMotion ? { y: textY } : undefined}
          className="flex flex-col items-center text-center max-w-4xl mx-auto z-10 w-full mb-12 lg:mb-16"
        >
          <motion.h1 
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4.25rem] tracking-tight leading-[1.05] hero-headline mb-6 text-white font-extrabold"
          >
            Predict the next cyclone.
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300 drop-shadow-[0_0_25px_rgba(56,189,248,0.4)]">
              Before it makes landfall.
            </span>
          </motion.h1>

          <motion.div 
            variants={itemVariants}
            className="flex items-center justify-center gap-4 text-xs sm:text-sm text-slate-400 mb-8 flex-wrap font-medium"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-sky-300">
              <Satellite className="h-4 w-4 text-sky-400" />
              <span>IMD RSMC Integrated</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              <Radio className="h-4 w-4 text-indigo-400" />
              <span>INSAT-3DR Stream</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Data Sovereign (India)</span>
            </div>
          </motion.div>

          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-5"
          >
            {/* Primary Button with continuous animated glow */}
            <motion.div
              className="relative group/btn cursor-pointer"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
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
              <button
                onClick={() => window.location.href = '/'}
                className="relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0090FF] to-[#0066FF] px-8 py-4 text-sm font-bold text-white shadow-xl hover:shadow-[0_0_30px_rgba(0,144,255,0.6)] transition-all border border-sky-400/40 cursor-pointer"
              >
                Launch CycloNet Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>

            {/* Secondary Button */}
            <PillButton
              variant="ghost"
              onClick={scrollToIllustration}
              className="px-8 py-4 bg-slate-900/80 hover:bg-slate-800 border-white/15 text-slate-200 hover:text-white shadow-lg font-semibold cursor-pointer backdrop-blur-md"
            >
              Explore Telemetry
            </PillButton>
          </motion.div>
        </motion.div>

        {/* ─── Bottom Section: Wide Boxed Illustration ─── */}
        <motion.div
          id="hero-illustration-stage"
          variants={itemVariants}
          style={!shouldReduceMotion ? { y: illustrationY } : undefined}
          className="w-full relative z-10 flex flex-col items-center"
        >
           <div className="relative w-full max-w-[850px] flex items-center justify-center mx-auto">
             <IllustrationStage />
             
             {/* Floating Badge 1: Vortex Anomaly */}
             <motion.div 
               style={!shouldReduceMotion ? { y: floatingY1 } : undefined}
               whileHover={{ scale: 1.05, y: -5 }}
               className="hidden lg:flex absolute left-0 lg:-left-4 xl:-left-8 top-16 z-20 items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl cursor-pointer group/float hover:shadow-[0_20px_40px_rgba(239,68,68,0.25)] hover:border-rose-400/60 transition-all duration-300"
             >
               <div className="bg-rose-500/20 p-2 rounded-xl group-hover/float:bg-rose-500 transition-colors duration-300 shadow-sm border border-rose-500/30">
                 <Wind className="h-4 w-4 text-rose-400 group-hover/float:text-white transition-colors duration-300" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[13px] font-bold text-white leading-tight mb-0.5">Vortex Intensifying</span>
                 <span className="text-[11px] font-medium text-slate-400">85 KT (157 km/h) • Cat 2</span>
               </div>
             </motion.div>

             {/* Floating Badge 2: 48h Cone */}
             <motion.div 
               style={!shouldReduceMotion ? { y: floatingY2 } : undefined}
               whileHover={{ scale: 1.05, y: -5 }}
               className="hidden lg:flex absolute right-0 lg:-right-4 xl:-right-8 bottom-16 z-20 items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/90 border border-sky-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl cursor-pointer group/float hover:shadow-[0_20px_40px_rgba(56,189,248,0.25)] hover:border-sky-400/60 transition-all duration-300"
             >
               <div className="bg-sky-500/20 p-2 rounded-xl group-hover/float:bg-sky-500 transition-colors duration-300 shadow-sm border border-sky-500/30">
                 <Compass className="h-4 w-4 text-sky-400 group-hover/float:text-white transition-colors duration-300" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[13px] font-bold text-white leading-tight mb-0.5">Cone Forecast Locked</span>
                 <span className="text-[11px] font-medium text-slate-400">Landfall ETA: 28 hrs</span>
               </div>
             </motion.div>
           </div>
        </motion.div>
        
      </motion.div>
    </section>
  );
}
