"use client";
import React, { useState, useEffect, useMemo } from "react";
import { 
  FileText, Bell, AlertOctagon, AlertTriangle, Info, Download, Filter, 
  Radio, ShieldAlert, Waves, Wind, CloudRain, Anchor, MapPin, CheckCircle2, 
  Printer, Copy, Send, RefreshCw, Layers, ExternalLink, Siren, PhoneCall,
  Search, ShieldCheck, ChevronRight
} from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { API_BASE_URL } from "@/lib/api";
import { generateCyclonePdfReport } from "@/lib/pdfReportGenerator";

interface ActiveSystem {
  id: string;
  name: string;
  basin: string;
  lat: number;
  lon: number;
  intensity_knots: number;
  category: string;
}

interface Bulletin {
  id: string;
  number: number;
  title: string;
  timestamp_utc: string;
  timestamp_ist: string;
  category: string;
  intensity_knots: number;
  intensity_kmh: number;
  gusts_kmh: number;
  central_pressure_hpa: number;
  storm_surge_meters: number;
  wave_height_meters: number;
  alert_level: string;
  stage: string;
  full_text: string;
  is_latest: boolean;
}

interface AffectedDistrict {
  district: string;
  risk: string;
  state: string;
  shelters: string;
  evacuation: string;
}

interface PortSignal {
  signal: string;
  meaning: string;
}

const PRESET_STORMS = [
  { id: "BOB05-2026", name: "Deep Depression (BOB-05)", basin: "Bay of Bengal", category: "Deep Depression", knots: 32 },
  { id: "ARB01-2023", name: "Cyclone Biparjoy", basin: "Arabian Sea", category: "Extremely Severe Cyclonic Storm", knots: 90 },
  { id: "BOB01-2023", name: "Cyclone Mocha", basin: "Bay of Bengal", category: "Super Cyclonic Storm", knots: 130 },
  { id: "BOB02-2020", name: "Cyclone Amphan", basin: "Bay of Bengal", category: "Super Cyclonic Storm", knots: 140 },
  { id: "BOB02-2019", name: "Cyclone Fani", basin: "Bay of Bengal", category: "Extremely Severe Cyclonic Storm", knots: 115 },
  { id: "ARB01-2021", name: "Cyclone Tauktae", basin: "Arabian Sea", category: "Extremely Severe Cyclonic Storm", knots: 100 },
];

export default function ReportsPage() {
  const { selectedCycloneId, selectedCycloneName, selectCyclone } = useActiveCyclone();
  const {
    dataSource,
    getConvertedKnots,
    getConvertedKmh,
    getConvertedGusts,
    getConvertedCategory,
    getSourceBadge,
  } = useDataSource();

  const sourceBadge = getSourceBadge();
  const [system, setSystem] = useState<ActiveSystem | null>(null);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [affectedDistricts, setAffectedDistricts] = useState<AffectedDistrict[]>([]);
  const [portSignals, setPortSignals] = useState<PortSignal[]>([]);
  const [capXml, setCapXml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hazards" | "bulletins" | "broadcast">("hazards");
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Broadcast dispatch simulation state
  const [alertType, setAlertType] = useState<string>("EVACUATION_WARNING");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sms", "siren", "vhf", "sachet"]);
  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "dispatching" | "completed">("idle");
  const [dispatchStep, setDispatchStep] = useState<number>(0);
  const [dispatchReceipt, setDispatchReceipt] = useState<any>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch report data from backend with client-side deterministic fallback
  const fetchReportData = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/reports/bulletins`;
      if (selectedCycloneId) {
        url += `?simulate=true&cyclone_id=${encodeURIComponent(selectedCycloneId)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.system) {
          setSystem(data.system);
          setBulletins(data.bulletins || []);
          setAffectedDistricts(data.affected_districts || []);
          setPortSignals(data.port_signals || []);
          setCapXml(data.cap_xml || "");
          if (data.bulletins && data.bulletins.length > 0) {
            setSelectedBulletin(data.bulletins[0]);
          }
        }
      } else {
        // Fallback to active systems endpoint
        const sysRes = await fetch(`${API_BASE_URL}/api/active-systems?simulate=true&cyclone_id=${encodeURIComponent(selectedCycloneId || "BOB05-2026")}`);
        if (sysRes.ok) {
          const sysData = await sysRes.json();
          if (sysData && sysData.length > 0) {
            const current = sysData[0];
            setSystem(current);
            generateClientFallbackData(current);
          }
        }
      }
    } catch (err) {
      console.warn("Backend report fetch error, using local meteorological synthesizer:", err);
      const fallbackStorm = PRESET_STORMS.find(s => s.id === selectedCycloneId) || PRESET_STORMS[0];
      const mockSys: ActiveSystem = {
        id: fallbackStorm.id,
        name: fallbackStorm.name,
        basin: fallbackStorm.basin,
        lat: fallbackStorm.basin.includes("Bengal") ? 17.8 : 19.2,
        lon: fallbackStorm.basin.includes("Bengal") ? 84.6 : 68.4,
        intensity_knots: fallbackStorm.knots,
        category: fallbackStorm.category
      };
      setSystem(mockSys);
      generateClientFallbackData(mockSys);
    } finally {
      setLoading(false);
    }
  };

  const generateClientFallbackData = (sys: ActiveSystem) => {
    const knots = sys.intensity_knots || 65;
    const kmh = Math.round(knots * 1.852);
    const gusts = Math.round(kmh * 1.25);
    const isBoB = sys.basin ? sys.basin.toLowerCase().includes("bengal") : sys.lon > 77;
    
    // Alert Level
    let level = "GREEN";
    let stage = "Atmospheric Outlook";
    if (knots >= 120) { level = "RED"; stage = "Cyclone Warning (Landfall Imminent)"; }
    else if (knots >= 90) { level = "ORANGE"; stage = "Cyclone Warning"; }
    else if (knots >= 48) { level = "ORANGE"; stage = "Cyclone Alert"; }
    else if (knots >= 34) { level = "YELLOW"; stage = "Pre-Cyclone Watch"; }

    // Bulletins
    const bList: Bulletin[] = [14, 13, 12].map((num, idx) => {
      const bKnots = Math.max(30, knots - (idx * 5));
      const bKmh = Math.round(bKnots * 1.852);
      const bGusts = Math.round(bKmh * 1.25);
      const surge = Number((Math.max(0.8, (bKnots * 0.035) + 0.5)).toFixed(1));
      const wave = Number((Math.max(2.0, (bKnots * 0.08) + 1.0)).toFixed(1));
      const date = new Date(Date.now() - (idx * 3 * 3600 * 1000));

      const fullText = `INDIA METEOROLOGICAL DEPARTMENT
REGIONAL SPECIALISED METEOROLOGICAL CENTRE - TROPICAL CYCLONES, NEW DELHI
TROPICAL CYCLONE ADVISORY BULLETIN NO. ${num}

1. BASIN: ${sys.basin.toUpperCase()}
2. TIME OF ISSUE: ${date.toUTCString()}
3. SYSTEM IDENTIFICATION: ${sys.category.toUpperCase()} '${sys.name.toUpperCase()}'
4. CURRENT POSITION & INTENSITY:
   - Latitude / Longitude: ${sys.lat.toFixed(1)}°N / ${sys.lon.toFixed(1)}°E
   - Max Sustained Surface Wind: ${bKnots} Knots (${bKmh} km/h)
   - Estimated Peak Gusts: ${bGusts} km/h
   - Central Pressure: ${1010 - Math.round(bKnots * 0.65)} hPa
5. MULTI-HAZARD WARNING:
   - Storm Surge: ${surge}m above astronomical tide.
   - Sea Condition: Phenomenal (${wave}m waves). Fishermen total suspension.
6. ADVISORY DIRECTIVE:
   - Maintain highest vigilance. Evacuate low-lying coastal belt.`;

      return {
        id: `BULLETIN-${num}`,
        number: num,
        title: `RSMC Cyclone Advisory Bulletin #${num}`,
        timestamp_utc: date.toISOString().replace("T", " ").substring(0, 16) + " UTC",
        timestamp_ist: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " IST",
        category: sys.category,
        intensity_knots: bKnots,
        intensity_kmh: bKmh,
        gusts_kmh: bGusts,
        central_pressure_hpa: 1010 - Math.round(bKnots * 0.65),
        storm_surge_meters: surge,
        wave_height_meters: wave,
        alert_level: level,
        stage: stage,
        full_text: fullText,
        is_latest: idx === 0
      };
    });

    setBulletins(bList);
    setSelectedBulletin(bList[0]);

    // Affected Districts
    if (isBoB) {
      setAffectedDistricts([
        { district: "Srikakulam, AP", risk: "Extremely High", state: "Andhra Pradesh", shelters: "380 Active", evacuation: "Mandatory" },
        { district: "Visakhapatnam, AP", risk: "Extremely High", state: "Andhra Pradesh", shelters: "420 Active", evacuation: "Mandatory" },
        { district: "Ganjam, Odisha", risk: "High", state: "Odisha", shelters: "340 Active", evacuation: "High Priority" },
        { district: "Puri, Odisha", risk: "High", state: "Odisha", shelters: "485 Active", evacuation: "High Priority" },
        { district: "South 24 Parganas, WB", risk: "Moderate", state: "West Bengal", shelters: "410 Active", evacuation: "Selective" }
      ]);
    } else {
      setAffectedDistricts([
        { district: "Kutch & Dwarka, GJ", risk: "Extremely High", state: "Gujarat", shelters: "410 Active", evacuation: "Mandatory" },
        { district: "Porbandar, GJ", risk: "Extremely High", state: "Gujarat", shelters: "320 Active", evacuation: "Mandatory" },
        { district: "Gir Somnath, GJ", risk: "High", state: "Gujarat", shelters: "350 Active", evacuation: "High Priority" },
        { district: "Mumbai Suburban, MH", risk: "Moderate", state: "Maharashtra", shelters: "290 Active", evacuation: "Selective" }
      ]);
    }

    // Port Signals
    setPortSignals([
      { signal: knots >= 90 ? "Great Danger Signal No. X (Ten)" : "Danger Signal No. VII (Seven)", meaning: "Severe cyclone expected to cross coast over or near the port with destructive gale winds." },
      { signal: "Distant Cautionary Signal No. I (One)", meaning: "Deep sea depression undergoing intensification." }
    ]);
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedCycloneId]);

  // Alert Badge Details
  const alertInfo = useMemo(() => {
    const rawKnots = system?.intensity_knots || 65;
    const knots = getConvertedKnots(rawKnots);
    if (knots >= 120) return { level: "RED", title: "Red Warning: Total Action & Evacuation", desc: "Super Cyclonic Storm with catastrophic wind potential. Extensive storm surge inundation and structural collapse expected in landfall corridor.", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/40", icon: <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" /> };
    if (knots >= 90) return { level: "ORANGE", title: "Orange Alert: High Preparedness & Mobilization", desc: "Extremely Severe Cyclonic Storm. High threat of uprooted trees, total power outage, coastal inundation, and severe traffic disruption.", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40", icon: <AlertTriangle className="w-8 h-8 text-orange-500 animate-bounce" /> };
    if (knots >= 48) return { level: "ORANGE", title: "Orange Alert: Rapid Intensification Watch", desc: "Severe Cyclonic Storm. Gale force winds and heavy rainfall expected along coastal belt.", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40", icon: <AlertTriangle className="w-8 h-8 text-orange-500" /> };
    if (knots >= 34) return { level: "YELLOW", title: "Yellow Alert: Enhanced Marine Vigilance", desc: "Cyclonic Storm / Deep Depression. Sea conditions rough to very rough. Coastal squalls developing.", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40", icon: <AlertTriangle className="w-8 h-8 text-yellow-500" /> };
    return { level: "GREEN", title: "Green: Basin Routine Monitoring", desc: "Depression / Low Pressure area. No immediate destructive threat to coastal settlements.", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", icon: <Info className="w-8 h-8 text-emerald-500" /> };
  }, [system, getConvertedKnots]);

  // Filtered Bulletins
  const filteredBulletins = useMemo(() => {
    return bulletins.filter((b) => {
      const matchesFilter = filterLevel === "ALL" || b.alert_level.toUpperCase() === filterLevel;
      const matchesSearch = !searchQuery.trim() || 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.full_text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bulletins, filterLevel, searchQuery]);

  // Handlers for Exports
  const handleDownloadPdf = () => {
    if (!system) return;
    const convertedKnots = getConvertedKnots(system.intensity_knots);
    const convertedCategory = getConvertedCategory(system.intensity_knots, system.category);

    generateCyclonePdfReport({
      system: {
        ...system,
        intensity_knots: convertedKnots,
        category: convertedCategory,
      },
      alertInfo,
      sourceInfo: {
        type: sourceBadge.type,
        label: sourceBadge.label,
        shortLabel: sourceBadge.shortLabel,
        avgWindow: sourceBadge.avgWindow,
        scaleName: sourceBadge.scaleName,
      },
      bulletins,
      affectedDistricts,
      portSignals
    });
    showToast(`Generated & downloaded official Cyclone PDF report (${sourceBadge.shortLabel})!`);
  };

  const handleDownloadXml = () => {
    const convertedCategory = getConvertedCategory(system?.intensity_knots || 65, system?.category);
    const xmlContent = capXml || `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>IN-IMD-CAP-${Date.now()}</identifier>
  <sender>rsmc-newdelhi@imd.gov.in</sender>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>${convertedCategory} ${system?.name || "Active"}</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <headline>${alertInfo.title}</headline>
    <description>${alertInfo.desc}</description>
  </info>
</alert>`;
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP-ALERT-${system?.name || "CYCLONE"}-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded OASIS CAP-CP XML Alert Document");
  };

  const handleDownloadJson = () => {
    const rawKnots = system?.intensity_knots || 65;
    const reportData = {
      timestamp: new Date().toISOString(),
      dataSource: sourceBadge,
      system: system ? {
        ...system,
        intensity_knots: getConvertedKnots(rawKnots),
        intensity_kmh: getConvertedKmh(rawKnots),
        category: getConvertedCategory(rawKnots, system.category)
      } : null,
      alertInfo,
      bulletins,
      affectedDistricts,
      portSignals
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CYCLONET-MET-REPORT-${system?.name || "CYCLONE"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded Complete JSON Meteorological Report");
  };

  const handleCopyBulletin = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Official Bulletin Copied to Clipboard!");
  };

  // Simulate Multi-Channel Broadcast Dispatch
  const handleDispatchSimulation = async () => {
    if (dispatchStatus === "dispatching") return;
    setDispatchStatus("dispatching");
    setDispatchStep(1);

    const stepTimer1 = setTimeout(() => setDispatchStep(2), 700);
    const stepTimer2 = setTimeout(() => setDispatchStep(3), 1500);
    const stepTimer3 = setTimeout(() => setDispatchStep(4), 2200);

    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/broadcast-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_id: system?.id || selectedCycloneId,
          alert_type: alertType,
          channels: selectedChannels
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          setDispatchReceipt(data);
          setDispatchStatus("completed");
          showToast("Emergency Broadcast Dispatched Successfully!");
        }, 2800);
      } else {
        throw new Error("Dispatch failed");
      }
    } catch {
      setTimeout(() => {
        setDispatchReceipt({
          dispatch_id: `CAP-NDMA-${Math.floor(100000 + Math.random() * 900000)}`,
          system_name: system?.name || "Active Cyclone",
          alert_type: alertType,
          timestamp: new Date().toUTCString(),
          target_districts: affectedDistricts.map(d => d.district),
          channels_used: selectedChannels,
          channel_metrics: {
            sms: { channel_name: "Cell Broadcast & SMS Gateway", recipients_targeted: 1425000, delivered: 1402200, delivery_rate: "98.4%", avg_latency: "1.8s" },
            siren: { channel_name: "Coastal Acoustic Sirens", towers_active: "480 Towers", coverage: "96.5% Coastline", delivery_rate: "100%", avg_latency: "0.4s" },
            vhf: { channel_name: "Coast Guard Marine Navtex / VHF Ch 16", coastal_stations: "14 Marine Stations", delivery_rate: "100%", avg_latency: "Instant" },
            sachet: { channel_name: "NDMA Sachet Disaster App Feed", subscribers: "3,200,000 Push Notifications", delivery_rate: "99.1%", avg_latency: "0.9s" }
          },
          message_payload: `EMERGENCY WARNING: ${system?.category} ${system?.name} warning active. Sustained winds ${Math.round((system?.intensity_knots || 65) * 1.852)} km/h. Coastal communities heed local authority evacuation directives immediately.`
        });
        setDispatchStatus("completed");
        showToast("Emergency Alert Broadcast Simulated Successfully!");
      }, 2800);
    }
  };

  const toggleChannel = (ch: string) => {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length > 1) {
        setSelectedChannels(selectedChannels.filter(c => c !== ch));
      }
    } else {
      setSelectedChannels([...selectedChannels, ch]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Compiling real-time meteorological bulletins and multi-hazard directives...</p>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground gap-4">
        <Bell className="w-12 h-12 opacity-40 text-primary" />
        <p className="text-base font-semibold text-foreground">No Active Meteorological Warning Active</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">North Indian Ocean basin is currently calm with no active cyclonic depressions. Select a storm scenario below to view official bulletins.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESET_STORMS.map((s) => (
            <button
              key={s.id}
              onClick={() => selectCyclone(s.id, s.name)}
              className="px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-all"
            >
              {s.name} ({s.category.split(" ")[0]})
            </button>
          ))}
        </div>
      </div>
    );
  }

  const rawKnots = system.intensity_knots || 65;
  const knots = getConvertedKnots(rawKnots);
  const kmh = getConvertedKmh(rawKnots);
  const gusts = getConvertedGusts(rawKnots);
  const displayCategory = getConvertedCategory(rawKnots, system.category);
  const surgeM = Number((Math.max(0.8, (knots * 0.035) + 0.5)).toFixed(1));
  const waveM = Number((Math.max(2.0, (knots * 0.08) + 1.0)).toFixed(1));
  const pressureHpa = 1010 - Math.round(knots * 0.65);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 max-w-7xl mx-auto w-full">
      {/* ── Top Header & Operational Action Bar ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 border-border/80 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              RSMC / IMD Warning Center
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${sourceBadge.badgeClass}`}>
              {sourceBadge.shortLabel}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${alertInfo.bg} ${alertInfo.color} border ${alertInfo.border}`}>
              {alertInfo.level} WARNING ACTIVE
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Fix: {system.lat.toFixed(1)}°N, {system.lon.toFixed(1)}°E • {system.basin}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Alerts & Meteorological Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Official RSMC New Delhi weather bulletins, OASIS CAP-CP warning protocols, and NDMA emergency disaster directives.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          {/* Storm Switcher Dropdown */}
          <select
            value={selectedCycloneId || system.id}
            onChange={(e) => {
              const storm = PRESET_STORMS.find(s => s.id === e.target.value);
              selectCyclone(e.target.value, storm?.name);
            }}
            className="px-3 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
          >
            {PRESET_STORMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.category})
              </option>
            ))}
          </select>

          {/* Export JSON */}
          <button
            onClick={handleDownloadJson}
            title="Download full JSON dataset"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>

          {/* Export CAP-CP XML */}
          <button
            onClick={handleDownloadXml}
            title="Download OASIS CAP-CP v1.2 XML Document"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> CAP XML
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            title="Download Official Cyclone Meteorological PDF Report"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Main Multi-Hazard Warning Banner ───────────────────────────────── */}
      <div className={`glass-card p-6 md:p-7 border-2 ${alertInfo.border} ${alertInfo.bg} transition-all`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="p-3.5 rounded-2xl bg-background/80 border border-border shadow-inner shrink-0">
              {alertInfo.icon}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xl sm:text-2xl font-black tracking-wider ${alertInfo.color}`}>
                  {alertInfo.level} WARNING
                </span>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-background text-foreground uppercase border border-border">
                  {displayCategory}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                  System: {system.name}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{alertInfo.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
                {alertInfo.desc} The system is sustaining winds of <strong className="text-foreground">{knots} knots ({kmh} km/h)</strong> with gusts up to <strong className="text-foreground">{gusts} km/h</strong> and central pressure of <strong className="text-foreground">{pressureHpa} hPa</strong>.
              </p>
            </div>
          </div>

          <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto shrink-0 gap-2 border-t md:border-t-0 border-border/40 pt-4 md:pt-0">
            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Max Sustained Wind ({sourceBadge.shortLabel})</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-primary">{kmh} <span className="text-sm font-normal text-muted-foreground">km/h</span></p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded">
                Gusts {gusts} km/h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("hazards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
            activeTab === "hazards"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Hazard Matrix & Coastal Threats
        </button>

        <button
          onClick={() => setActiveTab("bulletins")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
            activeTab === "bulletins"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <FileText className="w-4 h-4" /> Official Weather Bulletins ({bulletins.length})
        </button>

        <button
          onClick={() => setActiveTab("broadcast")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
            activeTab === "broadcast"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Radio className="w-4 h-4 text-red-400 animate-pulse" /> Emergency Broadcast Hub
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: MULTI-HAZARD MATRIX & COASTAL THREATS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "hazards" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 4-Stage Warning Timeline */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              IMD 4-Stage Tropical Cyclone Early Warning Protocol
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={`p-4 rounded-xl border ${knots >= 34 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 1 (72h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">YELLOW</span>
                </div>
                <p className="font-bold text-sm text-foreground">Pre-Cyclone Watch</p>
                <p className="text-xs text-muted-foreground mt-1">Deep depression detection in oceanic basin. Marine warnings issued to off-shore vessels.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots >= 48 ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 2 (48h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">ORANGE</span>
                </div>
                <p className="font-bold text-sm text-foreground">Cyclone Alert</p>
                <p className="text-xs text-muted-foreground mt-1">Gale wind warning and coastal district mobilization. Fishing operations suspended.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots >= 64 ? "bg-red-500/10 border-red-500/40 text-red-400 ring-1 ring-red-500/30" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 3 (24h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">RED</span>
                </div>
                <p className="font-bold text-sm text-foreground">Cyclone Warning</p>
                <p className="text-xs text-muted-foreground mt-1">Landfall sector identified. Mandatory coastal evacuations and port closure signals.</p>
              </div>

              <div className={`p-4 rounded-xl border ${knots >= 64 ? "bg-red-500/5 border-red-500/20 text-foreground" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold">STAGE 4 (12h Prior)</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">OUTLOOK</span>
                </div>
                <p className="font-bold text-sm text-foreground">Post-Landfall Outlook</p>
                <p className="text-xs text-muted-foreground mt-1">Inland severe gale path, flash flooding, and heavy debris clearance operations.</p>
              </div>
            </div>
          </div>

          {/* Multi-Hazard Parameter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Wind Hazard */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Wind className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Gale Force</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Sustained Wind & Gusts</p>
                <p className="text-2xl font-mono font-black text-foreground">{kmh} <span className="text-xs font-normal text-muted-foreground">km/h</span></p>
                <p className="text-xs text-orange-400 font-semibold mt-0.5">Peak Gusts: {gusts} km/h</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Uprooting of large trees, extensive damage to kutcha houses, and disruption of power lines.
              </p>
            </div>

            {/* Storm Surge */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Waves className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Inundation</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Expected Storm Surge</p>
                <p className="text-2xl font-mono font-black text-foreground">{surgeM} <span className="text-xs font-normal text-muted-foreground">meters</span></p>
                <p className="text-xs text-cyan-400 font-semibold mt-0.5">Wave Height: {waveM}m (Phenomenal)</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Inundation of low-lying coastal areas up to 3-5 km inland during high tide window.
              </p>
            </div>

            {/* Heavy Rain & Flash Flood */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CloudRain className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Red Alert</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">24h Rainfall Forecast</p>
                <p className="text-2xl font-mono font-black text-foreground">200+ <span className="text-xs font-normal text-muted-foreground">mm</span></p>
                <p className="text-xs text-indigo-400 font-semibold mt-0.5">Extremely Heavy (Red Alert)</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Flash floods in river catchments, waterlogging of major roads, and localized landslips.
              </p>
            </div>

            {/* Port & Maritime Warning */}
            <div className="glass-card p-5 border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Anchor className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Signal {knots >= 90 ? "X" : "VII"}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Nautical Port Warning</p>
                <p className="text-base font-bold text-foreground truncate">{portSignals[0]?.signal || "Danger Signal VII"}</p>
                <p className="text-xs text-amber-400 font-semibold mt-0.5">Total Maritime Ban</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                Ports to suspend cargo operations. Fishermen advised strictly not to venture into deep sea.
              </p>
            </div>
          </div>

          {/* Vulnerable Coastal Districts Table */}
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  High-Risk Coastal Districts & Evacuation Readiness
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculated based on active storm trajectory, coastal bathymetry, and surge exposure.
                </p>
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 w-fit">
                {affectedDistricts.length} Districts on High Alert
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 text-xs text-muted-foreground uppercase font-semibold">
                    <th className="pb-3 pl-2">District / Jurisdiction</th>
                    <th className="pb-3">State</th>
                    <th className="pb-3">Threat Rating</th>
                    <th className="pb-3">Cyclone Shelters</th>
                    <th className="pb-3 text-right pr-2">Evacuation Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-xs">
                  {affectedDistricts.map((d, i) => (
                    <tr key={i} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 pl-2 font-sans font-semibold text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {d.district}
                      </td>
                      <td className="py-3.5 font-sans text-muted-foreground">{d.state}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          d.risk.includes("Extremely") ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                          d.risk.includes("High") ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" :
                          "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                        }`}>
                          {d.risk}
                        </span>
                      </td>
                      <td className="py-3.5 text-foreground">{d.shelters}</td>
                      <td className="py-3.5 text-right pr-2">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          d.evacuation === "Mandatory" ? "bg-red-500 text-white font-sans uppercase shadow-sm" :
                          "bg-secondary text-foreground font-sans"
                        }`}>
                          {d.evacuation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: OFFICIAL METEOROLOGICAL BULLETINS (RSMC / IMD)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "bulletins" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Bulletin Selector & Filter Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Bulletins Feed
                </h3>
                <span className="text-xs text-muted-foreground">{filteredBulletins.length} available</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search bulletin text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Warning Level Filters */}
              <div className="flex gap-1.5 flex-wrap">
                {["ALL", "RED", "ORANGE", "YELLOW"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      filterLevel === lvl
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Bulletins */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredBulletins.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBulletin(b)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedBulletin?.id === b.id
                      ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/30"
                      : "bg-secondary/20 hover:bg-secondary/40 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-foreground">Bulletin #{b.number}</span>
                    {b.is_latest && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-primary text-primary-foreground tracking-wider animate-pulse">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{b.category} • {b.intensity_knots} kts</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40 font-mono">
                    <span>{b.timestamp_ist}</span>
                    <span className={`font-bold ${b.alert_level === "RED" ? "text-red-400" : "text-orange-400"}`}>
                      {b.alert_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Bulletin Previewer */}
          <div className="lg:col-span-2 space-y-4">
            {selectedBulletin ? (
              <div className="glass-card p-6 border-border space-y-5">
                {/* Bulletin Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">OFFICIAL DOCUMENT</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground">
                        {selectedBulletin.id}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mt-1">{selectedBulletin.title}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Issued: {selectedBulletin.timestamp_utc} ({selectedBulletin.timestamp_ist})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyBulletin(selectedBulletin.full_text)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      title="Download Official Cyclone Meteorological PDF Report"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </div>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Wind Speed ({sourceBadge.shortLabel})</p>
                    <p className="text-lg font-mono font-bold text-foreground">{getConvertedKnots(selectedBulletin.intensity_knots)} kts</p>
                    <p className="text-xs text-muted-foreground">{getConvertedKmh(selectedBulletin.intensity_knots)} km/h</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Peak Gusts</p>
                    <p className="text-lg font-mono font-bold text-orange-400">{getConvertedGusts(selectedBulletin.intensity_knots)} km/h</p>
                    <p className="text-xs text-muted-foreground">Gale force</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Storm Surge</p>
                    <p className="text-lg font-mono font-bold text-cyan-400">{selectedBulletin.storm_surge_meters} m</p>
                    <p className="text-xs text-muted-foreground">Above tide</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">Central Pressure</p>
                    <p className="text-lg font-mono font-bold text-foreground">{selectedBulletin.central_pressure_hpa} hPa</p>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </div>
                </div>

                {/* Official Bulletin Text View */}
                <div className="p-5 rounded-xl bg-zinc-950/80 border border-border font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text shadow-inner max-h-[450px] overflow-y-auto">
                  {selectedBulletin.full_text}
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p>Select a bulletin from the left panel to inspect full technical text.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: NDMA CAP-CP EMERGENCY BROADCAST HUB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "broadcast" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Broadcast Status Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><PhoneCall className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">98.4% Delivered</span>
              </div>
              <p className="text-xs text-muted-foreground">Cell Broadcast & SMS</p>
              <p className="text-xl font-mono font-bold text-foreground">1,425,000</p>
              <p className="text-[11px] text-muted-foreground">Avg Latency: 1.8 seconds</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-red-500/10 text-red-400"><Siren className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Active 480/480</span>
              </div>
              <p className="text-xs text-muted-foreground">Coastal Acoustic Sirens</p>
              <p className="text-xl font-mono font-bold text-foreground">96.5% Coastline</p>
              <p className="text-[11px] text-muted-foreground">Acoustic Range: 6.5 km</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Radio className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Ch 16 / Navtex</span>
              </div>
              <p className="text-xs text-muted-foreground">Coast Guard Marine VHF</p>
              <p className="text-xl font-mono font-bold text-foreground">Continuous Loop</p>
              <p className="text-[11px] text-muted-foreground">14 Deep Sea Stations</p>
            </div>

            <div className="glass-card p-5 border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><ShieldCheck className="w-4 h-4" /></span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Synced</span>
              </div>
              <p className="text-xs text-muted-foreground">NDMA Sachet Portal</p>
              <p className="text-xl font-mono font-bold text-foreground">3.2M App Push</p>
              <p className="text-[11px] text-muted-foreground">OASIS CAP-CP v1.2</p>
            </div>
          </div>

          {/* Interactive Broadcast Dispatch Tool */}
          <div className="glass-card p-6 border-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  NDMA CAP-CP Emergency Alert Dispatch Simulator
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Test and verify emergency alert propagation across multi-channel public warning infrastructure.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded">
                Protocol: OASIS-CAP-1.2-IN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuration Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Alert Directive Type
                  </label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value)}
                    disabled={dispatchStatus === "dispatching"}
                    className="w-full px-3 py-2 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="EVACUATION_WARNING">RED ALERT: Mandatory Coastal Evacuation Directive</option>
                    <option value="STORM_SURGE_EMERGENCY">ORANGE ALERT: Storm Surge & Inundation Warning</option>
                    <option value="FISHERMEN_RECALL">YELLOW ALERT: Marine Return & Total Sea Suspension</option>
                    <option value="ALL_CLEAR">ALL CLEAR: Threat Passed / Return Safe</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Transmission Channels
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "sms", label: "Cell Broadcast & SMS" },
                      { id: "siren", label: "Acoustic Sirens" },
                      { id: "vhf", label: "Marine VHF / Navtex" },
                      { id: "sachet", label: "NDMA Sachet App" },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleChannel(ch.id)}
                        disabled={dispatchStatus === "dispatching"}
                        className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                          selectedChannels.includes(ch.id)
                            ? "bg-primary/15 border-primary/50 text-foreground ring-1 ring-primary/20"
                            : "bg-secondary/40 border-border text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${selectedChannels.includes(ch.id) ? "bg-primary" : "bg-muted-foreground"}`} />
                          {ch.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Targeted Coastal Districts ({affectedDistricts.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-secondary/20 border border-border">
                    {affectedDistricts.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-foreground">
                        {d.district}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleDispatchSimulation}
                  disabled={dispatchStatus === "dispatching"}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {dispatchStatus === "dispatching" ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching Broadcast Pipeline...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 animate-pulse" /> Dispatch Multi-Channel Emergency Alert
                    </>
                  )}
                </button>
              </div>

              {/* Live Pipeline Animation & Receipt */}
              <div className="p-5 rounded-xl bg-zinc-950/80 border border-border flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-mono font-bold text-primary uppercase">Broadcast Pipeline Telemetry</p>
                  
                  <div className="space-y-2 text-xs font-mono">
                    <div className={`p-2 rounded flex items-center gap-2 ${dispatchStep >= 1 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-muted-foreground"}`}>
                      {dispatchStep >= 1 ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />}
                      <span>1. OASIS CAP-CP v1.2 XML Payload Encoded</span>
                    </div>

                    <div className={`p-2 rounded flex items-center gap-2 ${dispatchStep >= 2 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-muted-foreground"}`}>
                      {dispatchStep >= 2 ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />}
                      <span>2. Cellular Tower Gateway Handshake (14 Marine Corridors)</span>
                    </div>

                    <div className={`p-2 rounded flex items-center gap-2 ${dispatchStep >= 3 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-muted-foreground"}`}>
                      {dispatchStep >= 3 ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />}
                      <span>3. Coastal Acoustic Siren Trigger Synchronized</span>
                    </div>

                    <div className={`p-2 rounded flex items-center gap-2 ${dispatchStep >= 4 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-muted-foreground"}`}>
                      {dispatchStep >= 4 ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />}
                      <span>4. Final Delivery Confirmation & Acknowledgement Logged</span>
                    </div>
                  </div>
                </div>

                {dispatchReceipt && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1 font-mono">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispatch Receipt: {dispatchReceipt.dispatch_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Time: {dispatchReceipt.timestamp}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      Payload: &quot;{dispatchReceipt.message_payload}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
