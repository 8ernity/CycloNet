import React from 'react';
import { cn } from '@/lib/utils';

export function MicroLabel({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn(
      "text-[11px] font-bold uppercase tracking-widest text-accent px-3 py-1 rounded-full bg-accent/10 border border-accent/20 inline-block",
      className
    )}>
      {children}
    </span>
  );
}
