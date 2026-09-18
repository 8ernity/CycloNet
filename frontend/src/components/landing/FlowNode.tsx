import React from 'react';
import { GlassPanel } from './GlassPanel';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlowNodeProps {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  status?: "warning" | "success" | "neutral";
  className?: string;
}

export function FlowNode({ icon: Icon, title, active = false, status = "neutral", className }: FlowNodeProps) {
  const statusColors = {
    warning: "text-amber-500 bg-amber-500/10 border-amber-500/25",
    success: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
    neutral: "text-text-muted bg-card/80 border-surface-border",
  };

  return (
    <GlassPanel
      className={cn(
        "p-3 md:p-4 flex items-center gap-3 transition-all duration-300 relative select-none border-surface-border bg-surface-glass",
        active 
          ? "border-sky-400 bg-card shadow-[0_0_35px_rgba(0,144,255,0.35)] ring-1 ring-sky-400" 
          : "hover:border-surface-border/80",
        className
      )}
    >
      <div className={cn(
        "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors",
        active ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400 shadow-md" : statusColors[status]
      )}>
        <Icon className="w-4 h-4 md:w-5 md:h-5" />
      </div>

      <div className="flex flex-col min-w-0">
        <span className={cn(
          "text-xs md:text-sm font-bold truncate",
          active ? "text-text-primary" : "text-text-primary"
        )}>
          {title}
        </span>
        {status !== "neutral" && (
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider",
            status === "warning" ? "text-amber-500" : "text-emerald-500"
          )}>
            {status === "warning" ? "Siloed Stream" : "AI Ingested"}
          </span>
        )}
      </div>
    </GlassPanel>
  );
}
