"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ConnectingPill({ layoutId = "activePill", className }: { layoutId?: string, className?: string }) {
  return (
    <motion.div
      layoutId={layoutId}
      className={cn(
        "absolute inset-0 rounded-full bg-surface-border/50 -z-10",
        className
      )}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    />
  );
}
