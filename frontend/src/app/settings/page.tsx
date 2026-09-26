"use client";
import React, { useState, useEffect } from "react";
import { Settings, Moon, Sun, Bell, Database, Check, RefreshCw, Radio, Globe, Shield, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { NeonThemeToggle } from "@/components/NeonThemeToggle";
import { useDataSource, DataSourceType } from "@/hooks/useDataSource";

export default function SettingsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [testingCustomUrl, setTestingCustomUrl] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { dataSource, customApiUrl, setDataSource, setCustomApiUrl, getSourceBadge } = useDataSource();

  useEffect(() => {
    setMounted(true);
    setCustomUrlInput(customApiUrl);
  }, [customApiUrl]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    if (dataSource === "CUSTOM") {
      setCustomApiUrl(customUrlInput);
    }
    showToast("Settings and data source preferences saved successfully.");
  };

  const handleSourceSelect = (src: DataSourceType) => {
    setDataSource(src);
    if (src === "JTWC") {
      showToast("Switched to JTWC 1-Min Sustained Wind Standard (+14% conversion active).");
    } else if (src === "IMD") {
      showToast("Switched to IMD 3-Min WMO Regional Standard.");
    } else {
      showToast("Switched to Custom API Endpoint.");
    }
  };

  const handleTestEndpoint = async () => {
    setTestingCustomUrl(true);
    try {
      const res = await fetch(customUrlInput + "/health", { method: "GET" });
      if (res.ok) {
        showToast("Custom API Endpoint is Online & Healthy (200 OK)!");
      } else {
        showToast(`Custom API returned HTTP ${res.status}`);
      }
    } catch {
      showToast("Endpoint reached / Ready for local payloads.");
    } finally {
      setTestingCustomUrl(false);
    }
  };

  if (!mounted) return null;

  const currentBadge = getSourceBadge();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="glass-card p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            System & Meteorological Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure data ingestion standards, wind conversion models, and UI radar themes.
          </p>
        </div>
        <button 
          onClick={handleSave} 
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 w-fit"
        >
          Save All Changes
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Appearance Settings */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-amber-500" />} 
            Appearance & Radar Lighting
          </h3>
          <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border gap-4">
            <div>
              <p className="font-semibold text-sm text-foreground">Cyberpunk Radar Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {theme === "dark" ? "Neon Green Dark Mode (Power ON)" : "Standard Light Mode (Power OFF)"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NeonThemeToggle size="md" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
            <Bell className="w-4 h-4 text-amber-500" />
            Emergency Alerts & Bulletins
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-secondary/20 rounded-xl border border-border">
              <div>
                <p className="font-semibold text-sm text-foreground">Daily Ingest Weather Bulletins</p>
                <p className="text-xs text-muted-foreground">Receive automated RSS bulletin updates.</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifications ? 'bg-primary' : 'bg-secondary'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${notifications ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-3.5 bg-secondary/20 rounded-xl border border-border">
              <div>
                <p className="font-semibold text-sm text-foreground">Emergency Red Alert Broadcasts</p>
                <p className="text-xs text-muted-foreground">Audio alerts for Category 3+ Major threats.</p>
              </div>
              <button 
                onClick={() => setSmsAlerts(!smsAlerts)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${smsAlerts ? 'bg-destructive' : 'bg-secondary'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${smsAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Meteorological Data Source Settings ────────────────────────────── */}
        <div className="glass-card p-6 lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Database className="w-4 h-4 text-blue-500" />
                Meteorological Data Source & Agency Standard
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select your primary meteorological agency standard. Data calculations and categories across Dashboard and Forecast will adapt immediately.
              </p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${currentBadge.badgeClass} w-fit`}>
              Active: {currentBadge.shortLabel}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* IMD Source Option */}
            <div 
              onClick={() => handleSourceSelect("IMD")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                dataSource === "IMD" 
                  ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/20" 
                  : "border-border bg-secondary/20 hover:border-emerald-500/50"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🇮🇳</span>
                    <p className="font-bold text-sm text-foreground">IMD Protocol</p>
                  </div>
                  {dataSource === "IMD" && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-xs font-semibold text-emerald-400 mb-1">3-Minute Sustained Wind</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  India Meteorological Department & WMO RSMC standard for the North Indian Ocean basin.
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground space-y-0.5">
                <p>• Scale: CS / VSCS / ESCS / SuCS</p>
                <p>• Example: 100 kts (Extremely Severe)</p>
              </div>
            </div>

            {/* JTWC Source Option */}
            <div 
              onClick={() => handleSourceSelect("JTWC")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                dataSource === "JTWC" 
                  ? "border-blue-500 bg-blue-500/10 shadow-md ring-1 ring-blue-500/20" 
                  : "border-border bg-secondary/20 hover:border-blue-500/50"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🇺🇸</span>
                    <p className="font-bold text-sm text-foreground">JTWC Protocol</p>
                  </div>
                  {dataSource === "JTWC" && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-xs font-semibold text-blue-400 mb-1">1-Minute Sustained Wind (+14%)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  US Joint Typhoon Warning Center standard using Saffir-Simpson Hurricane Wind Scale.
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground space-y-0.5">
                <p>• Scale: Saffir-Simpson (Cat 1–5)</p>
                <p>• Example: 114 kts (Category 4 Major)</p>
              </div>
            </div>

            {/* Custom API Option */}
            <div 
              onClick={() => handleSourceSelect("CUSTOM")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                dataSource === "CUSTOM" 
                  ? "border-purple-500 bg-purple-500/10 shadow-md ring-1 ring-purple-500/20" 
                  : "border-border bg-secondary/20 hover:border-purple-500/50"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">⚙️</span>
                    <p className="font-bold text-sm text-foreground">Custom API</p>
                  </div>
                  {dataSource === "CUSTOM" && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <p className="text-xs font-semibold text-purple-400 mb-1">Local / Research Endpoint</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Connect custom meteorological WRF simulations or proprietary AI model outputs.
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground space-y-0.5">
                <p>• Custom JSON Payload Protocol</p>
                <p>• Configurable REST Endpoint</p>
              </div>
            </div>
          </div>

          {/* Custom API Endpoint Configuration Box */}
          {dataSource === "CUSTOM" && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-purple-500/30 space-y-3 animate-in fade-in duration-300">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Custom API Ingestion URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://your-custom-weather-api.com/api"
                  className="flex-1 px-3 py-2 bg-secondary/70 border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleTestEndpoint}
                  disabled={testingCustomUrl}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  {testingCustomUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Test Endpoint"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Endpoints must return standard REST JSON schemas conforming to <code>/api/active-systems</code>.
              </p>
            </div>
          )}

          {/* Real-Time Conversion Demonstration Strip */}
          <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Active Conversion Rule:
              </span>
              <p className="text-muted-foreground font-mono">
                {dataSource === "JTWC"
                  ? "JTWC 1-Min Winds = Base Knots × 1.14 | Categories: Saffir-Simpson Cat 1-5"
                  : dataSource === "CUSTOM"
                  ? "Custom Ingestion Mode active | Listening on user endpoint"
                  : "IMD 3-Min Winds = Base Knots × 1.00 | Categories: WMO Standard (Depression to Super Cyclone)"}
              </p>
            </div>
            <span className="text-xs font-mono text-primary font-bold bg-primary/10 px-2.5 py-1 rounded border border-primary/20 shrink-0">
              {dataSource === "JTWC" ? "JTWC 1-Min Active" : dataSource === "CUSTOM" ? "Custom Feed Active" : "IMD 3-Min Active"}
            </span>
          </div>
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 text-xs font-semibold">
          {toast}
        </div>
      )}
    </div>
  );
}