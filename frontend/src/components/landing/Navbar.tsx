"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { Menu, X, ArrowRight, Sun, Moon, Activity } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useMotionTokens } from '@/lib/motion-tokens';
import { ConnectingPill } from './ConnectingPill';
import { CycloneLogo } from '@/components/CycloneLogo';

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
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolledPast(latest > 10);
  });

  const { exit, shouldReduceMotion } = useMotionTokens();

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className={`fixed top-0 left-0 right-0 h-20 z-50 transition-all duration-300 ${isScrolledPast
            ? "bg-bg-base/98 dark:bg-[#040714]/98 border-b border-surface-border backdrop-blur-2xl shadow-md"
            : "bg-transparent border-b border-transparent"
          }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 h-full flex items-center justify-between">

          {/* Logo & Meteorological Wordmark */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center">
              <CycloneLogo size={30} className="group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <div className="flex flex-col">
              <span className={`font-heading font-extrabold text-xl tracking-tight leading-none transition-colors ${isScrolledPast
                  ? "text-text-primary group-hover:text-sky-500 dark:group-hover:text-sky-300"
                  : "text-white group-hover:text-sky-300"
                }`}>
                CycloNet
              </span>
              <span className={`text-[10px] font-medium tracking-wide leading-tight mt-0.5 ${isScrolledPast ? "text-text-muted" : "text-slate-400"
                }`}>
                AI Meteorological Intelligence
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
                className={`relative px-4 py-2 text-xs font-semibold transition-colors rounded-full ${isScrolledPast
                    ? "text-text-muted hover:text-text-primary"
                    : "text-slate-300 hover:text-white"
                  }`}
              >
                {activeItem === item.name && (
                  <ConnectingPill layoutId="navPill" className={isScrolledPast ? "bg-secondary" : "bg-white/15"} />
                )}
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* Ask CycloNet AI Lime-Green Button matching Dashboard */}
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("cyclonet:open-chat"));
                }
                const trigger = document.querySelector('[data-chat-trigger]') as HTMLElement;
                if (trigger) trigger.click();
              }}
              className="buttonupgrade group"
              title="Open CycloNet AI Meteorological Intelligence"
              aria-label="Ask CycloNet AI"
            >
              <div className="relative flex items-center justify-center shrink-0">
                <CycloneLogo size={18} className="group-hover:rotate-45 transition-transform duration-500" />
              </div>
              <span>Ask CycloNet AI</span>
            </button>

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${isScrolledPast
                  ? "text-text-muted hover:text-text-primary hover:bg-secondary border-surface-border"
                  : "text-slate-300 hover:text-white hover:bg-white/10 border-white/20"
                }`}
              title={mounted ? (theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode') : undefined}
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted ? (
                theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300 animate-in fade-in duration-300" />
                ) : (
                  <Moon className={`w-4 h-4 animate-in fade-in duration-300 ${isScrolledPast ? "text-sky-600" : "text-sky-300"}`} />
                )
              ) : (
                <Sun className="w-4 h-4 text-slate-400" />
              )}
            </button>

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
            className={`lg:hidden p-2 transition-colors ${isScrolledPast ? "text-text-muted hover:text-text-primary" : "text-slate-300 hover:text-white"
              }`}
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
            className="fixed inset-0 z-[60] bg-card/95 backdrop-blur-2xl lg:hidden p-6 flex flex-col border-b border-border"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <CycloneLogo size={28} />
                <span className="font-heading font-bold text-xl text-text-primary">CycloNet</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-text-muted hover:text-text-primary bg-secondary rounded-full">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-semibold text-text-primary hover:text-primary py-2 border-b border-border"
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
