"use client";
import React, { useState, useEffect } from "react";
import { Settings, Moon, Sun, Bell, Database, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { NeonThemeToggle } from "@/components/NeonThemeToggle";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [dataSource, setDataSource] = useState("IMD");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    showToast("Settings saved successfully.");
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <div className="glass-card p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            System Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure application preferences and data sources.
          </p>
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          Save Changes
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Appearance Settings */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-emerald-400" /> : <Sun className="w-5 h-5 text-amber-500" />} 
            Appearance & Radar Lighting
          </h3>
          <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border gap-4">
            <div>
              <p className="font-medium text-foreground">Cyberpunk Radar Theme</p>
              <p className="text-sm text-muted-foreground">
                {theme === "dark" ? "Neon Green Dark Mode (Power ON)" : "Standard Light Mode (Power OFF)"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NeonThemeToggle size="md" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Notifications
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border">
              <div>
                <p className="font-medium text-foreground">Email Bulletins</p>
                <p className="text-sm text-muted-foreground">Receive daily forecast summaries.</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-primary' : 'bg-secondary'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${notifications ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border">
              <div>
                <p className="font-medium text-foreground">Emergency SMS Alerts</p>
                <p className="text-sm text-muted-foreground">Get instant alerts for Red level threats.</p>
              </div>
              <button 
                onClick={() => setSmsAlerts(!smsAlerts)}
                className={`w-12 h-6 rounded-full transition-colors relative ${smsAlerts ? 'bg-destructive' : 'bg-secondary'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${smsAlerts ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Source Settings */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Meteorological Data Source
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Select the primary satellite and forecast data provider.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["IMD", "JTWC", "Custom API"].map((src) => (
              <div 
                key={src}
                onClick={() => setDataSource(src)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${dataSource === src ? 'border-primary bg-primary/5' : 'border-border bg-secondary/20 hover:border-primary/50'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold">{src}</p>
                  {dataSource === src && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {src === "IMD" && "Indian Meteorological Department (Default)"}
                  {src === "JTWC" && "Joint Typhoon Warning Center (Pacific/Indian)"}
                  {src === "Custom API" && "Local or experimental forecasting endpoints"}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg shadow-primary/20 animate-in slide-in-from-bottom-2 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}