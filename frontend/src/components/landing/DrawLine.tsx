"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionTokens } from '@/lib/motion-tokens';

interface DrawLineProps {
  d: string;
  delay?: number;
  pulse?: boolean;
  className?: string;
}

export function DrawLine({ d, delay = 0, pulse = false, className }: DrawLineProps) {
  const { shouldReduceMotion } = useMotionTokens();

  return (
    <g className="overflow-visible">
      {/* Background static / faint line */}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        className="text-slate-200 stroke-[2px]"
      />

      {/* Animated Path Drawing */}
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        className={cn("text-blue-500 stroke-[2px]", className)}
        initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 1.2,
          delay,
          ease: "easeInOut"
        }}
      />

      {/* Pulsing signal flowing along line */}
      {pulse && !shouldReduceMotion && (
        <motion.path
          d={d}
          fill="none"
          stroke="#2563EB"
          strokeWidth="4"
          strokeDasharray="8 120"
          strokeLinecap="round"
          initial={{ strokeDashoffset: 128 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: delay + 0.5,
            ease: "linear"
          }}
          className="filter drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]"
        />
      )}
    </g>
  );
}
