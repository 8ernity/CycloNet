"use client";

import React from "react";
import { Menu, Sun, Moon, Wind } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { CycloneLogo } from "@/components/CycloneLogo";

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { selectedCycloneId, selectedCycloneName } = useActiveCyclone();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const getPageTitle = () => {
    switch (pathname) {
      case "/": return "Live Monitoring";
      case "/classification": return "Classification";
      case "/archive": return "Historical Archive";
      case "/forecast": return "Track Forecast";
      case "/reports": return "Alerts & Reports";
      case "/settings": return "Settings";
      default: return "Dashboard";
    }
  };

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-heading font-semibold text-lg">{getPageTitle()}</h1>
        {selectedCycloneId && mounted && (
          <a
            href={`/forecast?cyclone_id=${encodeURIComponent(selectedCycloneId)}`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all shadow-xs"
            title="Active Cyclone Synchronized Across All Tabs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active: {selectedCycloneName ? (selectedCycloneName.startsWith("Cyclone") ? selectedCycloneName : `Cyclone ${selectedCycloneName}`) : selectedCycloneId}</span>
          </a>
        )}
      </div>

      <div className="flex items-center gap-3">
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
            <CycloneLogo size={20} className="group-hover:rotate-45 transition-transform duration-500" />
          </div>
          <span>Ask CycloNet AI</span>
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Toggle theme"
        >
          {mounted ? (
            theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
          ) : (
            <div className="w-5 h-5" />
          )}
        </button>
        
        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 flex items-center justify-center">
          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">FA</span>
        </div>
      </div>
    </header>
  );
}
