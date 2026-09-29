"use client";
import React, { useState, useEffect } from "react";
import { 
  Building2, Zap, Navigation, Coins, Landmark, ShieldCheck, 
  Waves, RefreshCw, CheckCircle2, Download, Filter, MapPin, 
  AlertTriangle, Radio, Activity, ExternalLink, Siren, PhoneCall,
  Search, ShieldAlert, Sparkles, CloudRain, Layers, Cpu, Compass,
  FileText, CheckCircle, Clock, X, Globe
} from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { API_BASE_URL } from "@/lib/api";
import { 
  POWER_SUBSTATIONS, 
  EVACUATION_ROUTES, 
  MEDICAL_SHELTERS, 
  PARAMETRIC_INSURANCE_TRIGGERS, 
  COASTAL_INUNDATION_ZONES,
  PowerSubstation,
  MedicalCycloneShelter,
  EvacuationRoute
} from "@/lib/infrastructureData";

interface ActiveSystem {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  category: string;
}

const PRESET_STORMS = [
  { id: "BOB05-2026", name: "Deep Depression (BOB-05)", basin: "Bay of Bengal", category: "Deep Depression", knots: 35 },
  { id: "ARB01-2023", name: "Cyclone Biparjoy", basin: "Arabian Sea", category: "Extremely Severe Cyclonic Storm", knots: 90 },
  { id: "BOB01-2023", name: "Cyclone Mocha", basin: "Bay of Bengal", category: "Super Cyclonic Storm", knots: 130 },
  { id: "BOB02-2020", name: "Cyclone Amphan", basin: "Bay of Bengal", category: "Super Cyclonic Storm", knots: 140 },
  { id: "BOB02-2019", name: "Cyclone Fani", basin: "Bay of Bengal", category: "Extremely Severe Cyclonic Storm", knots: 115 },
  { id: "ARB01-2021", name: "Cyclone Tauktae", basin: "Arabian Sea", category: "Extremely Severe Cyclonic Storm", knots: 100 },
];

export default function InfrastructurePage() {
  const { selectedCycloneId, selectCyclone } = useActiveCyclone();
  const { getConvertedKnots, getConvertedKmh, getConvertedGusts, getConvertedCategory, getSourceBadge } = useDataSource();

  const sourceBadge = getSourceBadge();
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [cyclonesList, setCyclonesList] = useState(PRESET_STORMS);
  const [activeTab, setActiveTab] = useState<"grid" | "shelters" | "insurance" | "surge">("grid");
  const [infraFilter, setInfraFilter] = useState<"all" | "extreme" | "high">("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [toast, setToast] = useState<string | null>(null);

  // Hydrodynamic Surge & GEE Simulator State
  const [simPressureHpa, setSimPressureHpa] = useState<number>(955);
  const [simTideM, setSimTideM] = useState<number>(1.2);
  const [simForwardSpeed, setSimForwardSpeed] = useState<number>(18);
  const [surgeCalcData, setSurgeCalcData] = useState<any>(null);
  const [surgeSectors, setSurgeSectors] = useState<any[]>([]);
  const [rainfallPathways, setRainfallPathways] = useState<any[]>([]);
  const [geeLayers, setGeeLayers] = useState<any[]>([]);

  // Gemini 3.7 Flash Pre-Landfall Briefing State
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<any>(null);
  const [briefingLanguage, setBriefingLanguage] = useState<string>("en");

  // Parametric insurance simulation state
  const [insuranceSimulationTier, setInsuranceSimulationTier] = useState<number>(0);
  const [isSimulatingPayout, setIsSimulatingPayout] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchAllCyclones() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/history/search`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCyclonesList(data.map((c: any) => ({
              id: c.id,
              name: c.name.startsWith("Cyclone ") || c.name.startsWith("Deep Depression") || c.name.startsWith("Depression") || c.name.startsWith("Super Cyclone") || c.name.includes("Cyclone") ? c.name : `Cyclone ${c.name}`,
              basin: c.basin || "Bay of Bengal",
              category: c.max_category || "Cyclonic Storm",
              knots: c.knots || (c.max_category?.includes("Super") ? 140 : c.max_category?.includes("Extremely") ? 100 : c.max_category?.includes("Very Severe") ? 80 : c.max_category?.includes("Severe") ? 55 : 35),
            })));
          }
        }
      } catch (err) {
        console.error("Failed to load full cyclone list", err);
      }
    }
    fetchAllCyclones();
  }, []);

  useEffect(() => {
    // Read optional tab param from URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "insurance") setActiveTab("insurance");
      else if (tabParam === "shelters") setActiveTab("shelters");
      else if (tabParam === "grid") setActiveTab("grid");
    }
  }, []);

  useEffect(() => {
    const fetchSystem = async () => {
      setLoading(true);
      try {
        const url = `${API_BASE_URL}/api/active-systems?simulate=true&cyclone_id=${encodeURIComponent(selectedCycloneId || "BOB05-2026")}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setSystem(data[0]);
          }
        }
      } catch {
        const fallback = cyclonesList.find(s => s.id === selectedCycloneId) || PRESET_STORMS[0];
        setSystem({
          id: fallback.id,
          name: fallback.name,
          basin: fallback.basin,
          lat: 18.2,
          lon: 84.8,
          intensity_knots: fallback.knots,
          category: fallback.category
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSystem();
  }, [selectedCycloneId]);

  const rawKnots = system?.intensity_knots || 65;
  const knots = getConvertedKnots(rawKnots);
  const kmh = getConvertedKmh(rawKnots);
  const gusts = getConvertedGusts(rawKnots);
  const displayCategory = getConvertedCategory(rawKnots, system?.category);
  const surgeM = Number((Math.max(0.8, (knots * 0.035) + 0.5)).toFixed(1));

  // Filtered Substations
  const filteredSubstations = POWER_SUBSTATIONS.filter(sub => {
    const matchesCriticality = infraFilter === "all" || 
      (infraFilter === "extreme" && sub.criticality === "Extreme") ||
      (infraFilter === "high" && (sub.criticality === "Extreme" || sub.criticality === "High"));
    const matchesRegion = regionFilter === "ALL" || sub.region.toLowerCase().includes(regionFilter.toLowerCase());
    const matchesSearch = !searchFilter || sub.name.toLowerCase().includes(searchFilter.toLowerCase()) || sub.type.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCriticality && matchesRegion && matchesSearch;
  });

  // Filtered Shelters
  const filteredShelters = MEDICAL_SHELTERS.filter(shl => {
    const matchesRegion = regionFilter === "ALL" || shl.region.toLowerCase().includes(regionFilter.toLowerCase());
    const matchesSearch = !searchFilter || shl.name.toLowerCase().includes(searchFilter.toLowerCase()) || shl.type.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  const totalShelterCapacity = MEDICAL_SHELTERS.reduce((acc, s) => acc + s.capacityPersons, 0);
  const totalMedicalBeds = MEDICAL_SHELTERS.reduce((acc, s) => acc + s.medicalBeds, 0);
  const totalGridCapacity = POWER_SUBSTATIONS.reduce((acc, s) => acc + s.capacityMVA, 0);

  const handleSimulateParametricPayout = () => {
    setIsSimulatingPayout(true);
    setPayoutSuccess(false);
    setTimeout(() => {
      setIsSimulatingPayout(false);
      setPayoutSuccess(true);
      showToast(`Parametric Liquidity Trigger Verified: Digital disbursement of ${PARAMETRIC_INSURANCE_TRIGGERS[insuranceSimulationTier].totalPoolFunded} simulated!`);
    }, 1800);
  };

  useEffect(() => {
    async function fetchSurgeAndGee() {
      try {
        const k = system?.intensity_knots || 85;
        const lat = system?.lat || 18.2;
        const lon = system?.lon || 84.8;
        const basin = system?.basin || "Bay of Bengal";

        const [surgeRes, secRes, pathRes, layerRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/surge/calculate?knots=${k}&pressure_hpa=${simPressureHpa}&forward_speed=${simForwardSpeed}&tide_m=${simTideM}&basin=${encodeURIComponent(basin)}`),
          fetch(`${API_BASE_URL}/api/surge/profile?name=${encodeURIComponent(system?.name || "Cyclone")}&lat=${lat}&lon=${lon}&knots=${k}`),
          fetch(`${API_BASE_URL}/api/gee/rainfall-pathways?lat=${lat}&lon=${lon}&rain_mm=280`),
          fetch(`${API_BASE_URL}/api/gee/layers`)
        ]);

        if (surgeRes.ok) setSurgeCalcData(await surgeRes.json());
        if (secRes.ok) {
          const d = await secRes.json();
          setSurgeSectors(d.sectors || []);
        }
        if (pathRes.ok) {
          const d = await pathRes.json();
          setRainfallPathways(d.pathways || []);
        }
        if (layerRes.ok) {
          const d = await layerRes.json();
          setGeeLayers(d.layers || []);
        }
      } catch (err) {
        console.error("Error fetching surge & GEE telemetry", err);
      }
    }
    fetchSurgeAndGee();
  }, [system, simPressureHpa, simTideM, simForwardSpeed]);

  const handleGenerateBriefing = async (lang = briefingLanguage) => {
    setBriefingModalOpen(true);
    setBriefingLoading(true);
    try {
      const stormPayload = {
        name: system?.name || "Cyclone System",
        category: displayCategory,
        intensity_knots: knots,
        wind_kmh: kmh,
        surge_m: surgeCalcData?.peak_surge_height_m || surgeM,
        basin: system?.basin || "Bay of Bengal"
      };
      const res = await fetch(`${API_BASE_URL}/api/ai/pre-landfall-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storm_data: stormPayload, language: lang })
      });
      if (res.ok) {
        const data = await res.json();
        setBriefingData(data.briefing);
      }
    } catch (err) {
      console.error("Failed to generate briefing", err);
    } finally {
      setBriefingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading coastal infrastructure and resilience telemetry...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Building2 className="w-3.5 h-3.5" />
              Critical Infrastructure & Resilience
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${sourceBadge.badgeClass}`}>
              {sourceBadge.shortLabel}
            </span>
            {system && (
              <span className="text-xs text-muted-foreground font-mono">
                Threat Baseline: {system.name} ({displayCategory} • {knots} KT)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Infrastructure Exposure & Parametric Insurance
          </h1>
          <p className="text-sm text-muted-foreground max-w-4xl">
            Pre-landfall vulnerability assessment for 400kV/220kV power grids, arterial coastal highways, 20+ multipurpose cyclone shelters, and anticipatory parametric disaster risk financing.
          </p>
        </div>

        {/* Storm Selector & AI Briefing Actions */}
        <div className="flex items-center gap-2.5 z-10 shrink-0 flex-wrap">
          <select
            value={selectedCycloneId || system?.id}
            onChange={(e) => {
              const storm = cyclonesList.find(s => s.id === e.target.value);
              selectCyclone(e.target.value, storm?.name);
            }}
            className="px-3 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors shadow-xs"
          >
            {cyclonesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.category ? `(${s.category})` : ""}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleGenerateBriefing(briefingLanguage)}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Gemini 3.7 Briefing</span>
          </button>

          <a
            href="/dashboard"
            className="px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>🗺️ GIS Map View</span>
          </a>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Metric Summary Tiles ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">9 Substations</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Power Transmission Grid</p>
          <p className="text-2xl font-mono font-black text-foreground">{(totalGridCapacity / 1000).toFixed(1)}k <span className="text-xs font-normal text-muted-foreground">MVA</span></p>
          <p className="text-[11px] text-amber-400 font-semibold">6 Substations within 4km of coastline</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">20+ Facilities</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Shelter Capacity (5 States)</p>
          <p className="text-2xl font-mono font-black text-foreground">{totalShelterCapacity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">persons</span></p>
          <p className="text-[11px] text-emerald-400 font-semibold">{totalMedicalBeds} Dedicated Trauma & ICU Beds</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Navigation className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">3 Corridors</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Arterial Evacuation Arteries</p>
          <p className="text-2xl font-mono font-black text-foreground">NH-16, 51, 116B</p>
          <p className="text-[11px] text-blue-400 font-semibold">Mandatory Corridor 1 priority</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Coins className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Parametric</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Pre-Landfall Liquidity Pool</p>
          <p className="text-2xl font-mono font-black text-emerald-400">₹455 Cr</p>
          <p className="text-[11px] text-emerald-400 font-semibold">T-24h to T-12h digital transfer</p>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "grid"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" /> Power Grid & Evacuation Corridors
        </button>

        <button
          onClick={() => setActiveTab("shelters")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "shelters"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-400" /> Cyclone Shelters & Hospitals ({MEDICAL_SHELTERS.length})
        </button>

        <button
          onClick={() => setActiveTab("insurance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "insurance"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Coins className="w-4 h-4 text-cyan-400" /> Parametric Insurance & Liquidity Pool
        </button>

        <button
          onClick={() => setActiveTab("surge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "surge"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Waves className="w-4 h-4 text-blue-400" /> Hydrodynamic Surge & GEE Flood Risk
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: POWER GRID TRANSMISSION & EVACUATION CORRIDORS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "grid" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls Bar */}
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by substation name or type..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
                />
              </div>

              <div className="flex gap-1">
                {(["all", "extreme", "high"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setInfraFilter(lvl)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                      infraFilter === lvl
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl} Risk
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Showing {filteredSubstations.length} of {POWER_SUBSTATIONS.length} Grid Nodes</span>
            </div>
          </div>

          {/* 1. Power Grid Transmission Substations Table */}
          <div className="glass-card p-6 border-border">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              400kV & 220kV Power Grid Substations (Wind & Coastal Inundation Exposure)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground uppercase font-semibold text-[11px]">
                    <th className="pb-3 pl-2">Grid Substation</th>
                    <th className="pb-3">Type & Capacity</th>
                    <th className="pb-3">Elevation & Coastal Dist.</th>
                    <th className="pb-3">Region</th>
                    <th className="pb-3 text-right pr-2">Criticality & Hardening Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredSubstations.map((sub, i) => (
                    <tr key={i} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 pl-2 font-sans font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${sub.criticality === "Extreme" ? "bg-red-400 animate-pulse" : "bg-amber-400"}`} />
                          <span>{sub.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className="text-foreground font-semibold">{sub.type}</span>
                        <span className="text-muted-foreground block text-[10px]">Capacity: {sub.capacityMVA} MVA</span>
                      </td>
                      <td className="py-3.5 text-muted-foreground">
                        <span>{sub.coastalDistanceKm} km from coastline</span>
                        <span className="block text-[10px] text-foreground">Elevation: {sub.elevationMeters}m MSL</span>
                      </td>
                      <td className="py-3.5 font-sans text-muted-foreground">{sub.region}</td>
                      <td className="py-3.5 text-right pr-2 font-sans">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold inline-block ${
                          sub.criticality === "Extreme" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                          sub.criticality === "High" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                          "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        }`}>
                          {sub.criticality} Risk • Precautionary Isolation Ready
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Arterial Evacuation Routes & Road Cutoffs */}
          <div className="glass-card p-6 border-border">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <Navigation className="w-4 h-4 text-blue-400" />
              Arterial Coastal Evacuation Highways & Inundation Risk
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {EVACUATION_ROUTES.map((route, i) => (
                <div key={i} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                      {route.highwayCode}
                    </span>
                    <span className={`text-[11px] font-bold ${route.floodRiskLevel.includes("Severe") ? "text-red-400" : "text-emerald-400"}`}>
                      {route.floodRiskLevel}
                    </span>
                  </div>
                  <p className="font-bold text-xs text-foreground leading-snug">{route.name}</p>
                  <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t border-border/40">
                    <span>Priority: <strong className="text-foreground">{route.evacuationPriority.split(" ")[0]}</strong></span>
                    <span>Avg Elevation: <strong className="text-foreground">{route.elevationAvgM}m MSL</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Parametric Inundation Zones */}
          <div className="glass-card p-6 border-border">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Coastal Surge Inundation Zones (Parametric Risk Buffers)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COASTAL_INUNDATION_ZONES.map((zone, i) => (
                <div key={i} className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/30 space-y-2">
                  <span className="text-xs font-bold text-cyan-400 font-mono uppercase">Zone #{i+1}</span>
                  <p className="font-bold text-sm text-foreground">{zone.name}</p>
                  <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/40 font-mono">
                    <p>Risk Level: <strong className="text-cyan-300">{zone.riskLevel}</strong></p>
                    <p>Peak Surge Modeling: <strong className="text-foreground">{zone.depthM}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: CYCLONE SHELTERS & EMERGENCY TRAUMA HOSPITALS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "shelters" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls */}
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by facility name or location..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
                />
              </div>

              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-1.5 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground"
              >
                <option value="ALL">All States (Odisha, AP, WB, TN, Gujarat)</option>
                <option value="Odisha">Odisha Coastal Belt</option>
                <option value="Andhra">Andhra Pradesh</option>
                <option value="West Bengal">West Bengal / Sundarbans</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Gujarat">Gujarat / Kutch</option>
              </select>
            </div>

            <span className="text-xs font-mono text-muted-foreground">
              Showing {filteredShelters.length} Facilities
            </span>
          </div>

          {/* Shelters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShelters.map((shl, i) => (
              <div key={i} className="glass-card p-5 border-border space-y-3 hover:border-emerald-500/40 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono">{shl.region}</span>
                    <h4 className="font-bold text-sm text-foreground leading-snug">{shl.name}</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {shl.status.split(" ")[0]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="bg-background/60 p-2 rounded border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Shelter Capacity</span>
                    <span className="font-bold text-foreground text-sm">{shl.capacityPersons.toLocaleString()} persons</span>
                  </div>
                  <div className="bg-background/60 p-2 rounded border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Medical Beds</span>
                    <span className="font-bold text-emerald-400 text-sm">{shl.medicalBeds} Beds</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between border-t border-border/40 font-mono">
                  <span>Diesel GenSet: <strong className={shl.generatorBackup ? "text-emerald-400" : "text-muted-foreground"}>{shl.generatorBackup ? "✅ Staged" : "❌"}</strong></span>
                  <span>Sat Comms: <strong className={shl.satelliteComms ? "text-emerald-400" : "text-muted-foreground"}>{shl.satelliteComms ? "✅ Active" : "❌"}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: PARAMETRIC DISASTER RISK FINANCING & LIQUIDITY POOL
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "insurance" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Banner */}
          <div className="glass-card p-6 border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-mono">
                  Smart Contract Parametric Trigger
                </span>
                <span className="text-xs font-mono text-muted-foreground">Automated Oracle Execution</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mt-1">
                Anticipatory Action & Parametric Insurance Liquidity Pool
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
                Shifting disaster financing from slow post-disaster claims to <strong>pre-landfall anticipatory liquidity</strong> release (T-24h to T-12h), enabling municipal authorities to finance evacuations, shelter food banks, and grid restoration contractors.
              </p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-right shrink-0">
              <span className="text-xs text-muted-foreground uppercase font-mono block">Total Regional Liquidity Pool</span>
              <span className="text-2xl font-mono font-black text-emerald-400">₹455 Crore ($55M USD)</span>
            </div>
          </div>

          {/* 3 Parametric Trigger Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PARAMETRIC_INSURANCE_TRIGGERS.map((tier, i) => {
              const isTriggered = knots >= tier.windThresholdKnots || surgeM >= tier.surgeThresholdMeters;
              return (
                <div 
                  key={i} 
                  className={`glass-card p-5 border-2 transition-all space-y-4 ${
                    isTriggered 
                      ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30" 
                      : "border-border bg-secondary/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{tier.tier}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isTriggered ? "bg-emerald-500 text-white animate-pulse" : "bg-secondary text-muted-foreground"
                    }`}>
                      {isTriggered ? "TRIGGER MET" : "STANDBY"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Wind Threshold:</span>
                      <strong className="text-foreground">&ge; {tier.windThresholdKnots} KT ({Math.round(tier.windThresholdKnots * 1.852)} km/h)</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Surge Threshold:</span>
                      <strong className="text-foreground">&ge; {tier.surgeThresholdMeters}m Tide</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Payout Rate:</span>
                      <strong className="text-emerald-400">{tier.payoutPercentage}% of Pool</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/60 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-primary" /> {tier.totalPoolFunded}
                    </p>
                    <p className="line-clamp-2">{tier.targetBeneficiaries}</p>
                    <p className="text-primary font-mono text-[10px] pt-1 border-t border-border/40">
                      Disbursement: {tier.disbursementWindow}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Payout Simulator */}
          <div className="glass-card p-6 border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  Parametric Pre-Landfall Liquidity Disbursement Simulator
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Test and execute simulated algorithmic smart-contract liquidity transfers to local disaster relief treasuries.
                </p>
              </div>
              <span className="text-xs font-mono bg-secondary px-2.5 py-1 rounded text-foreground">
                Current Storm Peak: {knots} KT / {surgeM}m Surge
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                  Select Simulation Trigger Tier:
                </label>
                <div className="flex flex-col gap-2">
                  {PARAMETRIC_INSURANCE_TRIGGERS.map((tier, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInsuranceSimulationTier(idx);
                        setPayoutSuccess(false);
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                        insuranceSimulationTier === idx 
                          ? "bg-emerald-500/15 border-emerald-500 text-foreground ring-1 ring-emerald-500/30 font-bold" 
                          : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{tier.tier} (&ge; {tier.windThresholdKnots} KT)</span>
                        <span className="font-mono text-emerald-400 font-bold">{tier.totalPoolFunded}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSimulateParametricPayout}
                  disabled={isSimulatingPayout}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSimulatingPayout ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Satellite Index & Releasing Liquidity...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" /> Trigger Automated Pre-Landfall Payout
                    </>
                  )}
                </button>
              </div>

              {/* Simulation Receipt Terminal */}
              <div className="p-5 rounded-xl bg-zinc-950/90 border border-border text-xs font-mono space-y-3 min-h-[180px] flex flex-col justify-center">
                {payoutSuccess ? (
                  <div className="space-y-2 text-emerald-400 animate-in fade-in">
                    <p className="font-bold flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Parametric Liquidity Successfully Disbursed!
                    </p>
                    <p className="text-zinc-300 text-[11.5px]">
                      Disbursed Amount: <strong>{PARAMETRIC_INSURANCE_TRIGGERS[insuranceSimulationTier].totalPoolFunded}</strong> (100% Digital Release)
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Trigger Index: Satellite Scatterometer &ge; {PARAMETRIC_INSURANCE_TRIGGERS[insuranceSimulationTier].windThresholdKnots} KT confirmed over Bay of Bengal basin.
                    </p>
                    <p className="text-emerald-300 text-[10.5px] border-t border-zinc-800 pt-2">
                      Beneficiary Accounts: SDRF Coastal Evacuation Fund, AP/Odisha Municipal Food Banks & Power Grid Restoration Contractors.
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center space-y-1">
                    <Coins className="w-8 h-8 mx-auto opacity-30 text-emerald-400" />
                    <p>Ready to simulate algorithmic pre-landfall parametric liquidity release.</p>
                    <p className="text-[10.5px]">Click &quot;Trigger Automated Pre-Landfall Payout&quot; to execute.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: HYDRODYNAMIC STORM SURGE & GEE FLOOD RISK SIMULATOR
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "surge" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Banner: GEE & SLOSH Physics Integration */}
          <div className="glass-card p-5 border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/20 via-background to-cyan-950/20">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Waves className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    SLOSH & Jelesnianski Hydrodynamics
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> GEE Sentinel-1 SAR & 30m SRTM DEM
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  Compound Coastal Storm Surge & Catchment Inundation Forecaster
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
                  Simulates oceanic water pileup from inverted barometer effects, bathymetric wind stress on shallow continental shelves, astronomical tidal superposition, and inland runoff pathways.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleGenerateBriefing(briefingLanguage)}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Generate AI Risk Briefing</span>
            </button>
          </div>

          {/* Real-Time SLOSH Surge Calculation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">Peak Storm Surge (S-peak)</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.peak_surge_height_m ?? surgeM} <span className="text-sm font-normal text-muted-foreground">meters</span>
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {surgeCalcData?.severity_level ?? "SEVERE_SURGE"}
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">Inverted Barometer Effect</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.inverted_barometer_m ?? "0.58"} <span className="text-sm font-normal text-muted-foreground">m rise</span>
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                ΔP = {1013 - simPressureHpa} hPa below standard
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">Wind Stress On Shelf</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.wind_setup_m ?? "2.14"} <span className="text-sm font-normal text-muted-foreground">m setup</span>
              </p>
              <p className="text-[11px] text-amber-400 font-semibold font-mono">
                {system?.basin?.includes("Bengal") ? "1.45x Bay of Bengal Bathymetry" : "1.10x Arabian Sea"}
              </p>
            </div>

            <div className="glass-card p-5 border-border space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">Inland Flood Penetration</span>
              <p className="text-3xl font-mono font-black text-foreground">
                {surgeCalcData?.inland_penetration_km ?? "3.85"} <span className="text-sm font-normal text-muted-foreground">km inland</span>
              </p>
              <p className="text-[11px] text-purple-400 font-semibold">
                Based on 30m DEM slope (0.75m/km)
              </p>
            </div>
          </div>

          {/* Interactive Physics Sliders & Sector Risk Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Hydrodynamic Controls */}
            <div className="glass-card p-5 border-border space-y-5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
                <Cpu className="w-4 h-4 text-primary" />
                SLOSH Hydrodynamic Parameter Tuning
              </h4>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Central Barometric Pressure:</span>
                    <span className="font-mono text-cyan-400">{simPressureHpa} hPa</span>
                  </div>
                  <input
                    type="range"
                    min="910"
                    max="1000"
                    step="1"
                    value={simPressureHpa}
                    onChange={(e) => setSimPressureHpa(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Astronomical Tide Stage:</span>
                    <span className="font-mono text-blue-400">+{simTideM.toFixed(1)} m (Spring Tide)</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={simTideM}
                    onChange={(e) => setSimTideM(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Forward Speed of Translation:</span>
                    <span className="font-mono text-purple-400">{simForwardSpeed} km/h</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="35"
                    step="1"
                    value={simForwardSpeed}
                    onChange={(e) => setSimForwardSpeed(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-primary" /> Coastal Approach Vector:
                </p>
                <p>Normal shore-perpendicular approach angle ($75^\circ - 85^\circ$) produces maximum hydrodynamic pileup.</p>
              </div>
            </div>

            {/* Coastal Quadrants Threat Matrix */}
            <div className="glass-card p-5 border-border space-y-4 lg:col-span-2">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Quadrant-by-Quadrant Coastal Surge Hazard Footprint
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {surgeSectors.map((sec, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-foreground line-clamp-1">{sec.sector_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        sec.risk_rating === "EXTREME" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        sec.risk_rating === "CRITICAL" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}>
                        {sec.risk_rating}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-mono text-primary font-bold text-sm">{sec.estimated_surge_m}m Peak Surge</p>
                      <p className="text-[11px] text-muted-foreground">Inundation: <strong>{sec.inundation_depth_m}</strong></p>
                      <p className="text-[10.5px] text-muted-foreground">Sector: {sec.offset_km}</p>
                    </div>

                    <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                      <p className="font-semibold text-foreground mb-0.5">Critical Assets in Zone:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {sec.critical_assets.map((ast: string, aIdx: number) => (
                          <li key={aIdx} className="line-clamp-1">{ast}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Google Earth Engine (GEE) Satellite Feeds & Catchment Inundation Pathways */}
          <div className="glass-card p-6 border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-blue-400" />
                  DEM Catchment Flash Flood Pathways & River Confluence Choke Points
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Precipitation runoff modeling (24h/48h accumulation) combined with SRTM 30m digital terrain elevation.
                </p>
              </div>
              <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded border border-blue-500/20">
                Rainfall Accumulation: 280 mm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rainfallPathways.map((path) => (
                <div key={path.id} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-foreground">{path.name}</h5>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      {path.discharge_rate_cumecs} cumecs
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Basin: <strong className="text-foreground">{path.basin}</strong> • 48h Rain: <strong className="text-primary">{path.rain_accumulation_mm} mm</strong>
                  </p>

                  <div className="space-y-1.5 text-xs">
                    <p className="font-semibold text-foreground text-[11px]">Highway Inundation Cutoff Points:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {path.road_crossings_impacted.map((road: string, rIdx: number) => (
                        <span key={rIdx} className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10.5px]">
                          ⚠️ {road}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-border/40">
                    <p className="font-semibold text-foreground text-[11px]">Substations Exposed to Deluge:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {path.substations_at_risk.map((sub: string, sIdx: number) => (
                        <span key={sIdx} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10.5px]">
                          ⚡ {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GEMINI 3.7 FLASH PRE-LANDFALL BRIEFING MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {briefingModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/30">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Gemini 3.7 Flash • Executive Pre-Landfall Briefing
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                      MULTIMODAL AI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Authoritative meteorological risk assessment & infrastructure protection memo for Municipal Magistrates.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <div className="flex items-center gap-1.5 bg-secondary/80 border border-border rounded-lg px-2 py-1 text-xs">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={briefingLanguage}
                    onChange={(e) => {
                      setBriefingLanguage(e.target.value);
                      handleGenerateBriefing(e.target.value);
                    }}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="en">English (Official)</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                    <option value="or">ଓଡ଼ିଆ (Odia)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                  </select>
                </div>

                <button
                  onClick={() => setBriefingModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-muted-foreground">
              {briefingLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-12 h-12 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-sm font-semibold text-foreground animate-pulse">
                    Synthesizing multimodal GEE satellite feeds, SLOSH surge profile, and grid exposure with Gemini 3.7 Flash...
                  </p>
                </div>
              ) : briefingData ? (
                <div className="space-y-5 animate-in fade-in">
                  
                  {/* Executive Summary Card */}
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-foreground space-y-1.5">
                    <h5 className="font-bold text-sm flex items-center gap-2 text-primary">
                      <FileText className="w-4 h-4" /> Executive Disaster Management Summary
                    </h5>
                    <p className="text-xs leading-relaxed text-zinc-200">
                      {briefingData.executive_summary}
                    </p>
                  </div>

                  {/* 2-Column Risk Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1.5">
                      <h6 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-blue-400">
                        <Waves className="w-3.5 h-3.5" /> Storm Surge Threat Matrix
                      </h6>
                      <p className="text-xs leading-relaxed">
                        {briefingData.surge_inundation_threat}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1.5">
                      <h6 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-amber-400">
                        <Zap className="w-3.5 h-3.5" /> 400kV / 220kV Grid Safeguards
                      </h6>
                      <p className="text-xs leading-relaxed">
                        {briefingData.grid_substation_vulnerabilities}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1.5">
                      <h6 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-emerald-400">
                        <Building2 className="w-3.5 h-3.5" /> Shelter Logistics & Medical Beds
                      </h6>
                      <p className="text-xs leading-relaxed">
                        {briefingData.shelter_readiness}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1.5">
                      <h6 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-cyan-400">
                        <Coins className="w-3.5 h-3.5" /> Parametric Liquidity Protocol
                      </h6>
                      <p className="text-xs leading-relaxed">
                        {briefingData.parametric_payout_recommendation}
                      </p>
                    </div>
                  </div>

                  {/* Immediate Action Checklist */}
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2.5">
                    <h5 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      5-Point Immediate Municipal Action Plan (T-24 Hours)
                    </h5>
                    <div className="space-y-2">
                      {briefingData.action_checklist?.map((action: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 border border-border/50 text-xs">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="text-foreground font-medium">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <p className="text-center py-8">No briefing generated yet.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-secondary/30 flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">
                Engine: {briefingData?.model || "Google Gemini 3.7 Flash"}
              </span>
              <button
                onClick={() => setBriefingModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold cursor-pointer"
              >
                Close Briefing
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
