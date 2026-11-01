"use client";

import React from 'react';
import { StatTile } from './StatTile';
import { Satellite, ShieldCheck, Zap, Activity } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { motion } from 'framer-motion';
import { useMotionTokens } from '@/lib/motion-tokens';

function AnimatedStat({ 
  value, 
  suffix, 
  decimals = 0, 
  ...props 
}: Omit<React.ComponentProps<typeof StatTile>, 'value'> & { value: number, suffix: string, decimals?: number }) {
  const { count, ref } = useCountUp(value, decimals);
  const { tier1Variants } = useMotionTokens();
  
  return (
    <motion.div ref={ref} variants={tier1Variants}>
      <StatTile 
        {...props} 
        value={<><motion.span>{count}</motion.span>{suffix}</>} 
      />
    </motion.div>
  );
}

export function StatsTicker() {
  const { tier1 } = useMotionTokens();

  return (
    <section className="py-20 relative overflow-hidden bg-bg-base transition-colors duration-300">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ staggerChildren: tier1.stagger }}
        >
          <AnimatedStat
            icon={Satellite}
            value={99.9}
            decimals={1}
            suffix="%"
            label="Target Service Availability"
            tint="emerald"
          />
          <AnimatedStat
            icon={Activity}
            value={48}
            suffix="+"
            label="Sourced Historical Storms"
            tint="sky"
          />
          <AnimatedStat
            icon={ShieldCheck}
            value={48}
            suffix="h"
            label="Multi-Model Forecast Window"
            tint="accent"
          />
          <AnimatedStat
            icon={Zap}
            value={12}
            suffix="ms"
            label="ResNet Benchmark Latency"
            tint="amber"
          />
        </motion.div>
        <p className="text-[11px] text-center text-muted-foreground/70 mt-6 font-mono">
          * Benchmark metrics measured on CPU inference test harness; availability reflects target architectural design SLA.
        </p>
      </div>
    </section>
  );
}
