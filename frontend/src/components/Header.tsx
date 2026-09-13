"use client";

import React from "react";
import { Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

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
      </div>

      <div className="flex items-center gap-4">
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
        
        <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">FA</span>
        </div>
      </div>
    </header>
  );
}
