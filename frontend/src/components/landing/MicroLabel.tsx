import React from 'react';
import { cn } from '@/lib/utils';

export function MicroLabel({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn(
      "text-[11px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 dark:border-sky-400/25 px-3.5 py-1.5 rounded-full inline-block backdrop-blur-md shadow-xs dark:shadow-[0_0_15px_rgba(56,189,248,0.15)]",
      className
    )}>
      {children}
    </span>
  );
}
