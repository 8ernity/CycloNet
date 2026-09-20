"use client";
import React, { useState, useEffect } from "react";
import { FileText, Bell, AlertOctagon, AlertTriangle, Info, Download, Filter } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { API_BASE_URL } from "@/lib/api";

interface ActiveSystem {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  category: string;
}

export default function ReportsPage() {
  const { selectedCycloneId } = useActiveCyclone();
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchSystem = async () => {
      setLoading(true);
      try {
        let url = `${API_BASE_URL}/api/active-systems`;
        if (selectedCycloneId) {
          url += `?simulate=true&cyclone_id=${encodeURIComponent(selectedCycloneId)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setSystem(data[0]);
          } else {
            setSystem(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch system:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSystem();
  }, [selectedCycloneId]);

  const getAlertLevel = (knots: number) => {
    if (knots >= 120) return { level: "RED", title: "Take Action", desc: "Super Cyclonic Storm - High risk of severe damage. Immediate evacuation required in coastal areas.", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", icon: <AlertOctagon className="w-8 h-8 text-red-500" /> };
    if (knots >= 90) return { level: "ORANGE", title: "Be Prepared", desc: "Extremely Severe Cyclonic Storm - Expected to cause extensive damage. Prepare for power outages and heed local authorities.", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <AlertTriangle className="w-8 h-8 text-orange-500" /> };
    if (knots >= 34) return { level: "YELLOW", title: "Be Updated", desc: "Severe Cyclonic Storm - Watch out for worsening weather conditions. Sea conditions will be rough.", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: <AlertTriangle className="w-8 h-8 text-yellow-500" /> };
    return { level: "GREEN", title: "No Warning", desc: "Normal conditions or mild depression. No immediate threat.", color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", icon: <Info className="w-8 h-8 text-green-500" /> };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground">
        <Bell className="w-12 h-12 mb-4 opacity-50" />
        <p>No active alerts. Weather is clear.</p>
      </div>
    );
  }

  const alert = getAlertLevel(system.intensity_knots);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Alerts & Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Automated warning bulletins based on intensity thresholds.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => showToast("Filter options coming soon")} className="flex items-center gap-2 px-4 py-2 bg-secondary/50 hover:bg-secondary border border-border rounded-lg text-sm font-medium transition-colors">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button onClick={() => showToast("Report Exported Successfully")} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg shadow-primary/20 animate-in slide-in-from-bottom-2 z-50">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Alert Box */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`glass-card p-8 border-2 ${alert.border} ${alert.bg}`}>
            <div className="flex items-start gap-6">
              <div className={`p-4 rounded-full bg-background border ${alert.border}`}>
                {alert.icon}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={`text-2xl font-black tracking-wider ${alert.color}`}>{alert.level} WARNING</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-background text-foreground uppercase border border-border">
                    {system.category}
                  </span>
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">{alert.title}</h4>
                <p className="text-muted-foreground leading-relaxed">
                  {alert.desc} Current system <strong>{system.name}</strong> is packing sustained winds of <strong>{system.intensity_knots} knots</strong> at {system.lat.toFixed(1)}Â°N, {system.lon.toFixed(1)}Â°E.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
             <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
               <FileText className="w-5 h-5 text-primary" />
               Recent Bulletins
             </h3>
             <div className="space-y-4">
               {[1, 2, 3].map((i) => (
                 <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary/10 rounded-xl border border-border hover:border-primary/30 transition-colors">
                   <div>
                     <p className="font-medium text-foreground">National Weather Bulletin #{10 - i}</p>
                     <p className="text-sm text-muted-foreground mt-1">Issued for {system.name} - {system.basin} Basin</p>
                   </div>
                   <div className="mt-4 sm:mt-0 flex items-center gap-4">
                     <span className="text-xs text-muted-foreground">{i * 3} hours ago</span>
                     <button className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded border border-primary/20 transition-colors">
                       View PDF
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Advisory Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-semibold text-lg mb-4">Advisory Notes</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Fishermen are advised not to venture into the deep sea areas.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Those out at sea should return to the coast immediately.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Keep emergency kits, battery-operated radios, and flashlights ready.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">Stay tuned to local weather updates for further information.</p>
              </li>
            </ul>
          </div>
          
          <div className="glass-card p-6 bg-gradient-to-br from-secondary/50 to-background border-border">
            <h3 className="font-medium text-foreground mb-2">Automated Notifications</h3>
            <p className="text-sm text-muted-foreground mb-4">
              SMS and Email alerts have been dispatched to registered users in the projected path of {system.name}.
            </p>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-primary h-2 rounded-full w-[85%] animate-pulse" />
            </div>
            <p className="text-xs text-right text-muted-foreground mt-2">85% delivered</p>
          </div>
        </div>
      </div>
    </div>
  );
}
