"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

export function MeshGradientBackground({ 
  children, 
  className,
  videoSrc
}: { 
  children?: React.ReactNode, 
  className?: string,
  videoSrc?: string
}) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    setIsMounted(true);
    setIsDesktop(window.innerWidth >= 1024);
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        mouseX.set((e.clientX / window.innerWidth - 0.5) * 2);
        mouseY.set((e.clientY / window.innerHeight - 0.5) * 2);
        rafId = null;
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDesktop, mouseX, mouseY]);

  const springConfig = { stiffness: 45, damping: 25, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const x1 = useTransform(smoothX, [-1, 1], [-25, 25]);
  const y1 = useTransform(smoothY, [-1, 1], [-25, 25]);
  
  const x2 = useTransform(smoothX, [-1, 1], [25, -25]);
  const y2 = useTransform(smoothY, [-1, 1], [25, -25]);
  
  const x3 = useTransform(smoothX, [-1, 1], [-15, 15]);
  const y3 = useTransform(smoothY, [-1, 1], [15, -15]);

  // Stable pre-computed particles
  const particles = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: `${(i * 6.25 + 3) % 100}%`,
      top: `${(i * 13.7 + 5) % 100}%`,
      scale: (i % 3) * 0.2 + 0.5,
      duration: (i % 5) * 2 + 10,
    }));
  }, []);

  return (
    <div className={cn("relative min-h-screen bg-bg-base text-text-primary overflow-hidden selection:bg-cyan-500/30 selection:text-white transition-colors duration-300", className)}>
      {videoSrc && (
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-40 mix-blend-screen will-change-transform"
          style={{ transform: "translate3d(0,0,0)" }}
        />
      )}
      <motion.div 
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden will-change-transform"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ transform: "translate3d(0,0,0)", contain: "paint layout" }}
      >
        {/* Top Ambient Glow bridging the Hero Parallax */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-44 bg-gradient-to-b from-sky-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none z-0" />

        {/* Luminous Cosmic Plasma Blobs with GPU Isolation */}
        <motion.div 
          className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-blue-600/15 blur-[120px] will-change-transform"
          style={isDesktop ? { x: x1, y: y1, transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" } : { transform: "translate3d(0,0,0)" }}
        />
        
        <motion.div 
          className="absolute top-[-5%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/12 blur-[130px] will-change-transform"
          style={isDesktop ? { x: x2, y: y2, transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" } : { transform: "translate3d(0,0,0)" }}
        />
        
        <motion.div 
          className="absolute top-[25%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/12 blur-[120px] will-change-transform"
          style={isDesktop ? { x: x3, y: y3, transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" } : { transform: "translate3d(0,0,0)" }}
        />

        <motion.div 
          className="absolute bottom-[-15%] left-[-5%] w-[60vw] h-[50vw] rounded-full bg-blue-500/15 blur-[140px] will-change-transform"
          style={isDesktop ? { x: x3, y: y1, transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" } : { transform: "translate3d(0,0,0)" }}
        />
        
        <motion.div 
          className="absolute bottom-[-10%] right-[10%] w-[55vw] h-[45vw] rounded-full bg-violet-600/12 blur-[140px] will-change-transform"
          style={isDesktop ? { x: x1, y: y2, transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" } : { transform: "translate3d(0,0,0)" }}
        />

        {/* Subtle Cosmic Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjA0Ii8+Cjwvc3ZnPg==')] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_85%)]" />

        {/* Floating Stardust Particles */}
        {isMounted && (
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute w-1 h-1 rounded-full bg-cyan-400/45 will-change-transform"
                style={{
                  left: p.left,
                  top: p.top,
                  scale: p.scale,
                  transform: "translate3d(0,0,0)",
                }}
                animate={{
                  y: [0, -80, 0],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
