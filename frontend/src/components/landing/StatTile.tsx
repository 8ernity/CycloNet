import React from 'react';
import { GlassPanel } from './GlassPanel';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  tint?: "emerald" | "sky" | "accent" | "amber" | "rose" | "purple";
  className?: string;
}

export function StatTile({ icon: Icon, value, label, tint = "accent", className }: StatTileProps) {
  const tintMap = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/25",
    accent: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  };

  return (
    <GlassPanel hoverEffect className={cn("p-6 flex flex-col justify-between h-full bg-surface-glass border-surface-border", className)}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
          {label}
        </span>
        <div className={cn("p-2 rounded-xl border flex items-center justify-center", tintMap[tint])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="text-3xl lg:text-4xl font-black font-heading tracking-tight text-text-primary drop-shadow-sm dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        {value}
      </div>
    </GlassPanel>
  );
}
