"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useMotionTokens } from '@/lib/motion-tokens';
import { ConnectingPill } from './ConnectingPill';
import { CycloneLogo } from '@/components/CycloneLogo';
import { NeonThemeToggle } from '@/components/NeonThemeToggle';

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
        <div className="max-w-[1440px] mx-auto px-6 h-full flex items-center justify-between gap-6 xl:gap-10">

          {/* Logo & Meteorological Wordmark */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative flex items-center justify-center">
              <CycloneLogo size={30} />
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

          {/* Center Nav Links - Proportionately balanced between logo and action buttons */}
          <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 flex-1 px-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onMouseEnter={() => setActiveItem(item.name)}
                onMouseLeave={() => setActiveItem(null)}
                className={`relative px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors rounded-full whitespace-nowrap ${isScrolledPast
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
          <div className="hidden md:flex items-center gap-3 shrink-0">
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
                <CycloneLogo size={18} />
              </div>
              <span>Ask CycloNet AI</span>
            </button>

            {/* Dark / Light Theme Toggle */}
            <NeonThemeToggle size="sm" />

            {/* Sign In Portal Link */}
            <Link
              href="/login"
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all border shadow-xs ${
                isScrolledPast
                  ? "text-text-primary hover:bg-secondary border-surface-border"
                  : "text-white hover:bg-white/15 border-white/20 bg-white/5"
              }`}
            >
              Sign In
            </Link>
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
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#0090FF] to-[#0070F3] text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2"
              >
                <span>Sign In to Portal</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
