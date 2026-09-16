"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  History, 
  Search, 
  ShieldAlert, 
  Scan, 
  Calendar, 
  MapPin, 
  Activity, 
  Play,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
  RotateCcw
} from "lucide-react";

interface CycloneHistory {
  id: string;
  name: string;
  year: string;
  maxCategory: string;
  basin: string;
  dates?: string;
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
  
  // Advanced Filter & Sort states
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [basinFilter, setBasinFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCyclone, setSelectedCyclone] = useState<CycloneHistory | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  
  const [cyclones, setCyclones] = useState<CycloneHistory[]>([]);
  const [classifications, setClassifications] = useState<AIClassification[]>([]);
  const [loading, setLoading] = useState(true);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetFilters = () => {
    setSortOrder("newest");
    setCategoryFilter("all");
    setBasinFilter("all");
  };

  const activeFilterCount = 
    (basinFilter !== "all" ? 1 : 0) + 
    (categoryFilter !== "all" ? 1 : 0) + 
    (sortOrder !== "newest" ? 1 : 0);

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

  // Synchronize archive context with CycloNet AI assistant
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__cyclonet_current_context = {
        page: "Historical Archive",
        activeTab,
        totalCyclones: cyclones.length,
        searchQuery,
        basinFilter,
        categoryFilter,
        sortOrder,
        activeSystem: null
      };
    }
  }, [activeTab, cyclones.length, searchQuery, basinFilter, categoryFilter, sortOrder]);

  // Helper to extract timestamp from cyclone dates for precise chronological ordering
  const getCycloneTimestamp = (c: CycloneHistory): number => {
    if (c.dates) {
      const parts = c.dates.split("-");
      const startStr = parts[0]?.trim();
      if (startStr) {
        const hasYear = /\b\d{4}\b/.test(startStr);
        const strToParse = hasYear ? startStr : `${startStr} ${c.year || "2000"}`;
        const ts = Date.parse(strToParse);
        if (!isNaN(ts)) return ts;
      }
    }
    const yr = parseInt(c.year, 10);
    return !isNaN(yr) ? new Date(yr, 0, 1).getTime() : 0;
  };

  // Multi-dimensional filtering and sorting
  const displayedCyclones = cyclones
    .filter(c => {
      // Basin filter
      if (basinFilter !== "all" && !c.basin?.toLowerCase().includes(basinFilter.toLowerCase())) {
        return false;
      }
      // Category filter
      if (categoryFilter !== "all") {
        const cat = c.maxCategory?.toLowerCase() || "";
        const target = categoryFilter.toLowerCase();
        if (!cat.includes(target)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = getCycloneTimestamp(a);
      const timeB = getCycloneTimestamp(b);
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

  const handleSelectCyclone = (cyclone: CycloneHistory) => {
    if (selectedCyclone?.id === cyclone.id) {
      setSelectedCyclone(null);
    } else {
      setSelectedCyclone(cyclone);
      if (typeof window !== "undefined") {
        localStorage.setItem("cyclonet_selected_cyclone_id", cyclone.id);
        localStorage.setItem("cyclonet_selected_cyclone_name", cyclone.name);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Historical Archive</h2>
          <p className="text-sm text-muted-foreground mt-1">Browse past cyclone best-track records from 1999–2024 and AI classification history.</p>
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
            Past Cyclones ({cyclones.length})
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
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-black/20 relative z-20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={activeTab === "cyclones" ? "Search by name, year, or basin..." : "Search classifications..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Filter Button & Popover */}
            {activeTab === "cyclones" && (
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all border shadow-sm cursor-pointer whitespace-nowrap select-none ${
                    activeFilterCount > 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10 hover:bg-amber-500/25"
                      : "bg-white/10 hover:bg-white/15 text-zinc-200 border-white/15"
                  }`}
                  aria-expanded={isFilterOpen}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Filter Popover Panel */}
                {isFilterOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 p-4 rounded-2xl bg-zinc-950/95 border border-white/15 backdrop-blur-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-4 text-xs">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-heading font-semibold text-zinc-100 text-xs tracking-wide uppercase">
                          Filter Cyclones
                        </span>
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={resetFilters}
                          className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors font-medium cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset all
                        </button>
                      )}
                    </div>

                    {/* Section 1: Timeline Recency */}
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Chronology / Timeline
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setSortOrder("newest")}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            sortOrder === "newest"
                              ? "bg-white/15 text-white border-white/30 font-semibold shadow-inner"
                              : "bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08] hover:text-zinc-200"
                          }`}
                        >
                          {sortOrder === "newest" && <Check className="w-3 h-3 text-amber-400" />}
                          <span>Most Recent</span>
                        </button>
                        <button
                          onClick={() => setSortOrder("oldest")}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            sortOrder === "oldest"
                              ? "bg-white/15 text-white border-white/30 font-semibold shadow-inner"
                              : "bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08] hover:text-zinc-200"
                          }`}
                        >
                          {sortOrder === "oldest" && <Check className="w-3 h-3 text-amber-400" />}
                          <span>Least Recent</span>
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Oceanic Basin */}
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Oceanic Basin
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "all", label: "All" },
                          { id: "Bay of Bengal", label: "Bay of Bengal" },
                          { id: "Arabian Sea", label: "Arabian Sea" },
                        ].map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setBasinFilter(b.id)}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all text-center cursor-pointer truncate ${
                              basinFilter === b.id
                                ? b.id === "Bay of Bengal"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold"
                                  : b.id === "Arabian Sea"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                                  : "bg-white/15 text-white border-white/30 font-semibold"
                                : "bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08] hover:text-zinc-200"
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Intensity Category */}
                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        IMD Intensity Category
                      </label>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: "all", label: "All Categories", color: "text-zinc-300" },
                          { id: "Super Cyclonic", label: "Super Cyclonic Storm", color: "text-red-400" },
                          { id: "Extremely Severe", label: "Extremely Severe", color: "text-orange-400" },
                          { id: "Very Severe", label: "Very Severe", color: "text-amber-400" },
                          { id: "Severe", label: "Severe Cyclonic Storm", color: "text-yellow-400" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(cat.id)}
                            className={`flex items-center justify-between py-1.5 px-3 rounded-lg border text-xs transition-all text-left cursor-pointer ${
                              categoryFilter === cat.id
                                ? "bg-white/15 text-white border-white/30 font-semibold shadow-inner"
                                : "bg-white/[0.03] text-zinc-400 border-white/10 hover:bg-white/[0.07] hover:text-zinc-200"
                            }`}
                          >
                            <span className={categoryFilter === cat.id ? "text-white" : cat.color}>
                              {cat.label}
                            </span>
                            {categoryFilter === cat.id && (
                              <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Footer Close */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {displayedCyclones.length} matched
                      </span>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Apply Filters
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground self-start lg:self-auto font-medium">
            Showing <strong className="text-foreground">{activeTab === "cyclones" ? displayedCyclones.length : classifications.length}</strong> results
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeTab === "cyclones" && activeFilterCount > 0 && (
          <div className="px-4 py-2 bg-white/[0.03] border-b border-white/10 flex flex-wrap items-center gap-2 text-xs animate-in fade-in duration-200">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              Active filters:
            </span>
            {sortOrder !== "newest" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[11px]">
                Timeline: Least Recent
                <button 
                  onClick={() => setSortOrder("newest")} 
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {basinFilter !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[11px]">
                Basin: {basinFilter}
                <button 
                  onClick={() => setBasinFilter("all")} 
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/25 text-[11px]">
                Category: {categoryFilter}
                <button 
                  onClick={() => setCategoryFilter("all")} 
                  className="hover:text-white cursor-pointer ml-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-[11px] text-zinc-400 hover:text-white underline ml-1 cursor-pointer transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : activeTab === "cyclones" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedCyclones.map((cyclone) => {
                const isSelected = selectedCyclone?.id === cyclone.id;
                return (
                  <div
                    key={cyclone.id}
                    onClick={() => handleSelectCyclone(cyclone)}
                    onDoubleClick={() => {
                      window.location.href = `/forecast?cyclone_id=${encodeURIComponent(cyclone.id)}`;
                    }}
                    className={`border rounded-xl p-5 transition-all group cursor-pointer relative select-none ${
                      isSelected
                        ? "bg-emerald-500/[0.08] border-emerald-500/60 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10 scale-[1.01]"
                        : "bg-secondary/20 hover:bg-secondary/40 border-border hover:border-primary/30 hover:scale-[1.005]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`text-lg font-bold transition-colors ${isSelected ? "text-emerald-400" : "text-foreground group-hover:text-primary"}`}>
                          {cyclone.name || "Unnamed System"}
                        </h3>
                      </div>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          Selected
                        </span>
                      ) : (
                        <span className="text-xs font-mono px-2 py-1 bg-black/30 rounded text-muted-foreground border border-white/5">
                          {cyclone.id}
                        </span>
                      )}
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
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground mb-0.5">Lifespan / Dates</p>
                          <p className="font-medium text-foreground truncate">{cyclone.dates || cyclone.year}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card action buttons footer */}
                    <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] gap-2">
                      <span className="font-mono text-zinc-400 text-[11px] truncate">
                        {cyclone.id}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              localStorage.setItem("cyclonet_selected_cyclone_id", cyclone.id);
                              localStorage.setItem("cyclonet_selected_cyclone_name", cyclone.name);
                            }
                            window.location.href = `/forecast?cyclone_id=${encodeURIComponent(cyclone.id)}`;
                          }}
                          className="px-2.5 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-semibold border border-primary/20 transition-colors cursor-pointer flex items-center gap-1"
                          title="Open in Track Forecast"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Track Forecast</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displayedCyclones.length === 0 && (
                <div className="col-span-full py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                  <SlidersHorizontal className="w-8 h-8 opacity-40 text-muted-foreground" />
                  <p className="text-sm">
                    No historical cyclones found matching {searchQuery ? `"${searchQuery}" and ` : ""}the selected filters.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all border border-white/15 cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All Filters
                  </button>
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

      {/* Floating Action Dock when cyclone is selected */}
      {selectedCyclone && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-zinc-950/95 border border-emerald-500/40 backdrop-blur-2xl rounded-2xl shadow-2xl p-3 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <h4 className="font-heading font-bold text-sm text-white truncate">
                  {selectedCyclone.name}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 shrink-0">
                  {selectedCyclone.basin}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                <span className="text-emerald-400 font-medium">{selectedCyclone.dates || selectedCyclone.year}</span> • Peak: <span className="text-zinc-200 font-medium">{selectedCyclone.maxCategory}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.setItem("cyclonet_selected_cyclone_id", selectedCyclone.id);
                  localStorage.setItem("cyclonet_selected_cyclone_name", selectedCyclone.name);
                }
                window.location.href = `/forecast?cyclone_id=${encodeURIComponent(selectedCyclone.id)}`;
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-xs transition-all shadow-md shadow-primary/20 hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Track Forecast</span>
            </button>
            <button
              onClick={() => {
                window.location.href = `/?simulate=${encodeURIComponent(selectedCyclone.id)}`;
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/25 hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Simulate Map</span>
            </button>
            <button
              onClick={() => setSelectedCyclone(null)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/10"
              title="Deselect"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
