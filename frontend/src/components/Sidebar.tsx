"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UploadCloud, History, FileText, Settings, Wind, Rocket, Layers } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CycloneLogo } from "@/components/CycloneLogo";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Live Monitoring", href: "/", icon: Activity },
  { name: "Landing Page", href: "/landing-parallax", icon: Rocket },
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
      <Link href="/" className="p-6 flex items-center gap-3 group">
        <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform">
          <CycloneLogo size={32} />
        </div>
        <span className="font-heading font-extrabold text-xl bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent tracking-tight">
          CycloNet
        </span>
      </Link>

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
                  ? "text-slate-900 dark:text-white bg-slate-900/10 dark:bg-white/10 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-slate-900/[0.08] dark:bg-white/[0.08] rounded-lg -z-10" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-slate-900 dark:bg-white rounded-r-full" />
              )}
              <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-slate-900 dark:text-white" : "text-slate-500 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-white")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="glass-card p-4 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">MoES Prototype</p>
          <p className="text-xs text-slate-600 dark:text-muted-foreground font-medium">Version 1.0 - SIH26070</p>
        </div>
      </div>
    </aside>
  );
}
