"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UploadCloud, History, FileText, Settings, Wind } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Live Monitoring", href: "/", icon: Activity },
  { name: "Classification", href: "/classification", icon: UploadCloud },
  { name: "Historical Archive", href: "/archive", icon: History },
  { name: "Track Forecast", href: "/forecast", icon: Wind },
  { name: "Alerts & Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 hidden lg:flex flex-col h-screen fixed left-0 top-0 sidebar-mesh border-r border-border">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Wind className="w-5 h-5 text-primary" />
        </div>
        <span className="font-heading font-bold text-xl gradient-text tracking-tight">
          CycloNet
        </span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                isActive
                  ? "text-primary shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-secondary/50"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-lg -z-10" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
              )}
              <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="glass-card p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">MoES Prototype</p>
          <p className="text-xs text-muted-foreground">Version 1.0 - SIH26070</p>
        </div>
      </div>
    </aside>
  );
}
