"use client";
import { useMounted } from "@/hooks/useBrowserState";

import React from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { CycloneLogo } from "@/components/CycloneLogo";
import { NeonThemeToggle } from "@/components/NeonThemeToggle";
import { navItems } from "@/components/Sidebar";

export function Header() {
  const mounted = useMounted();
  const pathname = usePathname();
  const { selectedCycloneId, selectedCycloneName } = useActiveCyclone();



  const getPageTitle = () => {
    switch (pathname) {
      case "/":
      case "/dashboard": return "Live Monitoring";
      case "/classification": return "Classification";
      case "/archive": return "Historical Archive";
      case "/compare": return "Storm Comparison";
      case "/forecast": return "Track Forecast";
      case "/reports": return "Alerts & Reports";
      case "/infrastructure": return "Infrastructure & Relief";
      case "/settings": return "Settings";
      default: return "Dashboard";
    }
  };

  const formatDisplayCycloneName = (name?: string | null) => {
    if (!name) return "";
    const n = name.trim();
    const lower = n.toLowerCase();
    if (
      lower.startsWith("cyclone") ||
      lower.startsWith("super cyclone") ||
      lower.includes("depression") ||
      lower.includes("low")
    ) {
      return n;
    }
    return `Cyclone ${n}`;
  };

  return (
    <header className="min-h-16 shrink-0 border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button aria-label="Open navigation" popoverTarget="mobile-navigation" className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary">
          <Menu className="w-5 h-5" />
        </button>
        <nav id="mobile-navigation" popover="auto" aria-label="Mobile navigation" className="fixed inset-auto top-16 left-4 m-0 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-card p-2 text-foreground shadow-xl">
          {navItems.map(({name,href,icon:Icon})=><a key={href} href={href} aria-current={pathname===href ? 'page' : undefined} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"><Icon className="h-4 w-4" />{name}</a>)}
        </nav>
        <h1 className="font-heading font-semibold text-base sm:text-lg truncate">{getPageTitle()}</h1>
        {selectedCycloneId && mounted && (
          <a
            href={`/forecast?cyclone_id=${encodeURIComponent(selectedCycloneId)}`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all shadow-xs"
            title="Selected record; selection does not establish current storm activity"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>Selected: {selectedCycloneName ? formatDisplayCycloneName(selectedCycloneName) : selectedCycloneId}</span>
          </a>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Ask CycloNet AI Button with Animated Green Gradient Effect */}
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("cyclonet:open-chat"));
            }
          }}
          className="buttonupgrade group"
          title="Open CycloNet AI Meteorological Intelligence"
          aria-label="Ask CycloNet AI"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <CycloneLogo size={20} />
          </div>
          <span className="hidden sm:inline">Ask CycloNet AI</span>
        </button>

        <NeonThemeToggle size="sm" />
        
        <a
          href="/settings"
          className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-1 ring-indigo-500/20 hover:scale-105 transition-transform"
          title="Account settings"
          aria-label="Account settings"
        >
          <span>Me</span>
        </a>
      </div>
    </header>
  );
}
