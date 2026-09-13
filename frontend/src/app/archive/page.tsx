"use client";
import React, { useState, useEffect } from "react";
import { History, Search, ShieldAlert, Scan, Calendar, MapPin, Activity } from "lucide-react";

interface CycloneHistory {
  id: string;
  name: string;
  year: string;
  maxCategory: string;
  basin: string;
}

interface AIClassification {
  id: number;
  filename: string;
  predicted_category: string;
  confidence: number;
  timestamp: string | null;
}

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<"cyclones" | "ai">("cyclones");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [cyclones, setCyclones] = useState<CycloneHistory[]>([]);
  const [classifications, setClassifications] = useState<AIClassification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "cyclones") {
          const res = await fetch(`http://localhost:8000/api/history/search?query=${searchQuery}`);
          if (res.ok) {
            const data = await res.json();
            setCyclones(data);
          }
        } else {
          const res = await fetch(`http://localhost:8000/api/history/classifications`);
          if (res.ok) {
            const data = await res.json();
            setClassifications(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    // Add a small debounce for search
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Historical Archive</h2>
          <p className="text-sm text-muted-foreground mt-1">Browse past cyclone data and AI classification history.</p>
        </div>
        
        {/* Tab Toggle */}
        <div className="flex p-1 bg-secondary/50 rounded-lg border border-border backdrop-blur-sm">
          <button
            onClick={() => setActiveTab("cyclones")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "cyclones" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            Past Cyclones
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "ai" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scan className="w-4 h-4" />
            AI Classifications
          </button>
        </div>
      </div>

      <div className="glass-card flex-1 overflow-hidden flex flex-col min-h-[600px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-black/20">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === "cyclones" ? "Search cyclones by name..." : "Search classifications..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {activeTab === "cyclones" ? cyclones.length : classifications.length} results
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : activeTab === "cyclones" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cyclones.map((cyclone) => (
                <div key={cyclone.id} className="bg-secondary/20 hover:bg-secondary/40 border border-border rounded-xl p-5 transition-all group cursor-pointer hover:border-primary/30">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {cyclone.name || "Unnamed System"}
                    </h3>
                    <span className="text-xs font-mono px-2 py-1 bg-black/30 rounded text-muted-foreground border border-white/5">
                      {cyclone.id}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Peak Intensity</p>
                        <p className="font-medium text-foreground">{cyclone.maxCategory || "Unknown"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Basin</p>
                        <p className="font-medium text-foreground">{cyclone.basin || "Unknown"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Year</p>
                        <p className="font-medium text-foreground">{cyclone.year}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {cyclones.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  No historical cyclones found matching "{searchQuery}"
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium border-b border-border">ID</th>
                    <th className="px-6 py-4 font-medium border-b border-border">Image File</th>
                    <th className="px-6 py-4 font-medium border-b border-border">AI Prediction</th>
                    <th className="px-6 py-4 font-medium border-b border-border">Confidence</th>
                    <th className="px-6 py-4 font-medium border-b border-border">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {classifications.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">#{item.id}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{item.filename || "Clipboard Image"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                          {item.predicted_category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${item.confidence}%` }}
                            />
                          </div>
                          <span className="font-medium">{item.confidence.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {classifications.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No AI classifications found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
