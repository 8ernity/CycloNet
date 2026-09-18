import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassPanel({ children, className, hoverEffect = false, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-surface-glass border border-surface-border text-text-primary backdrop-blur-xl transition-all duration-300 shadow-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        hoverEffect && "hover:border-sky-400/40 hover:shadow-lg dark:hover:shadow-[0_12px_40px_rgba(0,144,255,0.20)] hover:-translate-y-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
