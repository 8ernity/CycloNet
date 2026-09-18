"use client";

import React, { useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { Menu, X, ArrowRight, Sparkles, Activity } from 'lucide-react';
import Link from 'next/link';
import { useMotionTokens } from '@/lib/motion-tokens';
import { ConnectingPill } from './ConnectingPill';

const NAV_ITEMS = [
  { name: 'Features', href: '#features' },
  { name: '5-Stage Pipeline', href: '#pipeline' },
  { name: 'Operational Loop', href: '#workflow' },
  { name: 'Ecosystem', href: '#ecosystem' },
  { name: 'Deployment', href: '#deployment' },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolledPast, setIsScrolledPast] = useState(false);
  
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolledPast(latest > 40);
  });

  const { exit, shouldReduceMotion } = useMotionTokens();

  const backgroundColor = useTransform(
    scrollY,
    [0, 50],
    ['rgba(4, 7, 20, 0.25)', 'rgba(4, 7, 20, 0.85)']
  );
  
  const borderColor = useTransform(
    scrollY,
    [0, 50],
    ['rgba(255, 255, 255, 0.06)', 'rgba(56, 189, 248, 0.18)']
  );

  return (
    <>
      <motion.header 
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="fixed top-0 left-0 right-0 h-20 z-50 transition-all duration-300"
        style={{ 
          backgroundColor, 
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 h-full flex items-center justify-between">
          
          {/* Logo & Planetary Wordmark */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative flex items-center justify-center w-9 h-9">
              {/* Planetary Rings Icon */}
              <svg className="w-8 h-8 text-sky-400 group-hover:scale-105 transition-transform" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.9" />
                <ellipse cx="16" cy="16" rx="14" ry="4" stroke="currentColor" strokeWidth="1.8" transform="rotate(-28 16 16)" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-xl text-white tracking-tight leading-none group-hover:text-sky-300 transition-colors">
                CycloNet
              </span>
              <span className="text-[10px] font-medium tracking-wide text-slate-400 leading-tight mt-0.5">
                Planetary Intelligence
              </span>
            </div>
          </Link>

          {/* Center Nav Links */}
          <nav className="hidden lg:flex items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <Link 
                key={item.name}
                href={item.href}
                onMouseEnter={() => setActiveItem(item.name)}
                onMouseLeave={() => setActiveItem(null)}
                className="relative px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors rounded-full"
              >
                {activeItem === item.name && (
                  <ConnectingPill layoutId="navPill" className="bg-white/10" />
                )}
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3.5">
            {/* Ask AI Pill Button */}
            <motion.button 
              whileHover={{ scale: 1.04, backgroundColor: "rgba(255, 255, 255, 0.10)" }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                const trigger = document.querySelector('[data-chat-trigger]') as HTMLElement;
                if (trigger) trigger.click();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-slate-900/60 text-slate-200 text-xs font-semibold shadow-sm hover:border-white/30 backdrop-blur-md transition-all cursor-pointer"
            >
              <div className="w-4 h-4 rounded-sm border border-slate-400/60 flex items-center justify-center text-[10px]">
                ⊡
              </div>
              <span>Ask AI</span>
            </motion.button>

            {/* Launch Dashboard Primary Button */}
            <motion.button 
              whileHover={{ scale: 1.04, filter: "brightness(1.1)" }} 
              whileTap={{ scale: 0.96 }}
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#0090FF] to-[#0070F3] text-white text-xs font-bold shadow-[0_0_25px_rgba(0,144,255,0.45)] hover:shadow-[0_0_35px_rgba(0,144,255,0.65)] transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </motion.button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </motion.header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={exit.exit}
            transition={exit.transition}
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-2xl lg:hidden p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-sky-400" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2" />
                  <ellipse cx="16" cy="16" rx="14" ry="4" stroke="currentColor" strokeWidth="1.8" transform="rotate(-28 16 16)" />
                </svg>
                <span className="font-heading font-bold text-xl text-white">CycloNet</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white bg-white/10 rounded-full">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-semibold text-slate-200 hover:text-sky-400 py-2 border-b border-white/5"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = '/';
                }}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#0090FF] to-[#0070F3] text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2"
              >
                <span>Launch Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
