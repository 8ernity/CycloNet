"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UploadCloud, History, FileText, Settings, Wind, LogOut, GitCompare, Building2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CycloneLogo } from "@/components/CycloneLogo";

import { useUser, useClerk } from "@clerk/nextjs";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useLanguage } from "@/context/LanguageContext";

const navItems = [
  { key: "live_monitoring", name: "Live Monitoring", href: "/dashboard", icon: Activity },
  { key: "classification", name: "Classification", href: "/classification", icon: UploadCloud },
  { key: "historical_archive", name: "Historical Archive", href: "/archive", icon: History },
  { key: "storm_comparison", name: "Storm Comparison", href: "/compare", icon: GitCompare },
  { key: "track_forecast", name: "Track Forecast", href: "/forecast", icon: Wind },
  { key: "alerts_reports", name: "Alerts & Reports", href: "/reports", icon: FileText },
  { key: "infrastructure_relief", name: "Infrastructure & Relief", href: "/infrastructure", icon: Building2 },
  { key: "settings", name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { t } = useLanguage();

  const [localUser, setLocalUser] = React.useState({
    name: "Officer",
    roleTitle: "INVESTIGATOR",
    initials: "OF",
    imageUrl: "",
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("cyclonet_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) {
          setLocalUser({
            name: parsed.name,
            roleTitle: parsed.roleTitle || "INVESTIGATOR",
            initials: parsed.initials || parsed.name.slice(0, 2).toUpperCase(),
            imageUrl: "",
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const displayName = isLoaded && clerkUser ? (clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] || "Officer") : localUser.name;
  const displayRole = "OFFICER";
  const displayInitials = isLoaded && clerkUser ? (displayName.slice(0, 2).toUpperCase()) : localUser.initials;
  const avatarUrl = isLoaded && clerkUser ? clerkUser.imageUrl : null;

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cyclonet_user");
      localStorage.removeItem("cyclonet_auth_token");
      if (clerkUser) {
        await signOut({ redirectUrl: "/" });
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <aside className="w-64 hidden lg:flex flex-col h-screen fixed left-0 top-0 sidebar-mesh border-r border-border">
      <div className="p-6 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform">
            <CycloneLogo size={32} />
          </div>
          <span className="font-heading font-extrabold text-xl bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent tracking-tight">
            CycloNet
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const translatedName = t(item.key) || item.name;
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
              <span>{translatedName}</span>
            </Link>
          );
        })}
      </nav>

      {/* Officer Profile & Logout Bottom Bar (directs to auth/login) */}
      <div className="p-3 border-t border-border mt-auto">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/[0.03] dark:bg-white/[0.03] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover shadow-xs shrink-0 ring-2 ring-indigo-500/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-indigo-500/20">
                {displayInitials}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider truncate mt-0.5">
                {displayRole}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Link
              href="/settings"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-900/10 dark:hover:bg-white/10 transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Sign Out to Landing Page"
              aria-label="Sign Out to Landing Page"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
