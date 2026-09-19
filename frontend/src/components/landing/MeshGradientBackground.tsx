"use client";

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsDesktop(window.innerWidth >= 1024);
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDesktop]);

  const springConfig = { stiffness: 50, damping: 20 };
  const smoothX = useSpring(mousePosition.x, springConfig);
  const smoothY = useSpring(mousePosition.y, springConfig);

  const x1 = useTransform(smoothX, [-1, 1], [-30, 30]);
  const y1 = useTransform(smoothY, [-1, 1], [-30, 30]);
  
  const x2 = useTransform(smoothX, [-1, 1], [30, -30]);
  const y2 = useTransform(smoothY, [-1, 1], [30, -30]);
  
  const x3 = useTransform(smoothX, [-1, 1], [-15, 15]);
  const y3 = useTransform(smoothY, [-1, 1], [15, -15]);

  return (
    <div className={cn("relative min-h-screen bg-bg-base text-text-primary overflow-hidden selection:bg-cyan-500/30 selection:text-white transition-colors duration-300", className)}>
      {videoSrc && (
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-40 mix-blend-screen"
        />
      )}
      <motion.div 
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Top Ambient Glow bridging the Hero Parallax */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-44 bg-gradient-to-b from-sky-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none z-0" />

        {/* Luminous Cosmic Plasma Blobs */}
        <motion.div 
          className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-blue-600/15 blur-[140px]"
          style={isDesktop ? { x: x1, y: y1 } : undefined}
        />
        
        <motion.div 
          className="absolute top-[-5%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/12 blur-[150px]"
          style={isDesktop ? { x: x2, y: y2 } : undefined}
        />
        
        <motion.div 
          className="absolute top-[25%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/12 blur-[130px]"
          style={isDesktop ? { x: x3, y: y3 } : undefined}
        />

        <motion.div 
          className="absolute bottom-[-15%] left-[-5%] w-[60vw] h-[50vw] rounded-full bg-blue-500/15 blur-[160px]"
          style={isDesktop ? { x: x3, y: y1 } : undefined}
        />
        
        <motion.div 
          className="absolute bottom-[-10%] right-[10%] w-[55vw] h-[45vw] rounded-full bg-violet-600/12 blur-[160px]"
          style={isDesktop ? { x: x1, y: y2 } : undefined}
        />

        {/* Subtle Cosmic Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjA0Ii8+Cjwvc3ZnPg==')] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_85%)]" />

        {/* Floating Stardust Particles */}
        {isMounted && (
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-cyan-400/50"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
                  y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 900),
                  scale: Math.random() * 0.6 + 0.4,
                  opacity: Math.random() * 0.6 + 0.2
                }}
                animate={{
                  y: [null, Math.random() * -120 - 40],
                  opacity: [null, 0],
                }}
                transition={{
                  duration: Math.random() * 12 + 8,
                  repeat: Infinity,
                  ease: "linear",
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
