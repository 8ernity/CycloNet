"use client";

import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { formatCoordinates } from "@/lib/coordinates";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { useClipboard } from "@/hooks/useClipboard";
import { useReportsData } from "@/features/reports/hooks/useReportsData";
import {
  buildJsonReportPayload,
  computeAlertSummary,
  downloadBlobFile,
} from "@/features/reports/utils/reportExports";
import { HazardMatrixTab } from "@/features/reports/components/HazardMatrixTab";
import { BulletinsTab } from "@/features/reports/components/BulletinsTab";
import { ExerciseBroadcastTab } from "@/features/reports/components/ExerciseBroadcastTab";

function renderAlertIcon(level: string) {
  if (level === "DATA_UNAVAILABLE" || level === "GREEN") {
    return <Info className={`w-8 h-8 ${level === "GREEN" ? "text-emerald-500" : ""}`} aria-hidden="true" />;
  }
  if (level === "RED") {
    return <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" aria-hidden="true" />;
  }
  if (level === "ORANGE") {
    return <AlertTriangle className="w-8 h-8 text-orange-500" aria-hidden="true" />;
  }
  return <AlertTriangle className="w-8 h-8 text-yellow-500" aria-hidden="true" />;
}

export default function ReportsPage() {
  const { copyText, copyStatus } = useClipboard();
  const { selectedCycloneId, selectCyclone } = useActiveCyclone();
  const { getConvertedKnots, getConvertedKmh, getConvertedCategory, getSourceBadge } = useDataSource();
  const sourceBadge = getSourceBadge();

  const {
    system,
    cyclonesList,
    bulletins,
    affectedDistricts,
    portSignals,
    capXml,
    loading,
    selectedBulletin,
    setSelectedBulletin,
    toast,
    showToast,
    reportError,
    reportMode,
    dispatchStatus,
    dispatchReceipt,
    fetchReportData,
    dispatchExerciseDraft,
  } = useReportsData(selectedCycloneId);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"hazards" | "bulletins" | "broadcast">("hazards");

  const alertInfo = useMemo(
    () => computeAlertSummary(getConvertedKnots(system?.intensity_knots ?? null)),
    [system, getConvertedKnots]
  );

  const handleDownloadPdf = async () => {
    if (pdfLoading || !system) return;
    setPdfLoading(true);
    try {
      const { generateCyclonePdfReport } = await import("@/lib/pdfReportGenerator");
      generateCyclonePdfReport({
        system,
        alertInfo,
        bulletins: bulletins.length > 0 ? bulletins : [],
        affectedDistricts,
        portSignals,
      });
      showToast("Experimental PDF report download started.");
    } catch (err: unknown) {
      console.error("PDF generation failed:", err);
      const message = err instanceof Error && err.message ? err.message : "Request failed";
      showToast(`PDF generation error: ${message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadXml = () => {
    if (!capXml) {
      showToast("CAP exercise unavailable");
      return;
    }
    downloadBlobFile(capXml, "application/xml", `CAP-EXERCISE-${system?.name || "CYCLONE"}-${Date.now()}.xml`);
    showToast("Downloaded OASIS CAP-CP XML Exercise Document");
  };

  const handleDownloadJson = () => {
    if (!system) return;
    const payload = buildJsonReportPayload({
      reportMode,
      sourceBadge,
      system,
      alertInfo,
      bulletins,
      affectedDistricts,
      portSignals,
    });
    downloadBlobFile(JSON.stringify(payload, null, 2), "application/json", `CYCLONET-MET-REPORT-${system.name || "CYCLONE"}.json`);
    showToast("Downloaded Complete JSON Meteorological Report");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4">
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading source reports...</p>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-muted-foreground gap-4">
        <Bell className="w-12 h-12 opacity-40 text-primary" aria-hidden="true" />
        <p className="text-base font-semibold text-foreground">Report unavailable</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{reportError ?? "No report source is available."}</p>
        <button
          type="button"
          onClick={() => void fetchReportData()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer"
        >
          Retry
        </button>
        <button type="button" onClick={() => void fetchReportData(true)} className="cursor-pointer">
          Open synthetic demonstration report
        </button>
        <div className="flex flex-wrap gap-2 mt-2 max-w-2xl justify-center">
          {cyclonesList.slice(0, 8).map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => selectCyclone(s.id, s.name)}
              className="px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-all cursor-pointer"
            >
              {s.name} ({s.category ? s.category.split(" ")[0] : "Storm"})
            </button>
          ))}
        </div>
      </div>
    );
  }

  const knots = getConvertedKnots(system.intensity_knots);
  const kmh = getConvertedKmh(system.intensity_knots);
  const gusts = system.gusts_kmh ?? null;
  const displayCategory = getConvertedCategory(system.intensity_knots);
  const pressureHpa = system.central_pressure_hpa ?? "Not available";

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full">
      <p role="status" className="text-sm text-amber-400">
        {reportMode}: CycloNet experimental analysis — not an official warning.{" "}
        {system.is_simulation ? "Synthetic / historical replay." : "Source telemetry."} Source:{" "}
        {system.source ?? "Not available"}. Issue time: {system.observation_time_utc ?? "Not available"}. Retrieved:{" "}
        {system.retrieved_at ?? "Not available"}.
      </p>

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
              {alertInfo.level} — EXPERIMENTAL ACTIVE
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Fix: {formatCoordinates(system.lat, system.lon)} • {system.basin}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Alerts & Meteorological Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            CycloNet experimental analyses, OASIS CAP-CP warning protocols (Exercise), infrastructure exposure, and
            parametric insurance scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 z-10">
          <select
            aria-label="Select report storm"
            value={selectedCycloneId || system.id}
            onChange={(e) => {
              const storm = cyclonesList.find((s) => s.id === e.target.value);
              selectCyclone(e.target.value, storm?.name);
            }}
            className="px-3 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
          >
            {cyclonesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.category ? `(${s.category})` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadJson}
            title="Download full JSON dataset with infrastructure and parametric triggers"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> JSON
          </button>

          <button
            type="button"
            onClick={handleDownloadXml}
            title="Download OASIS CAP-CP v1.2 XML Document (Exercise Status)"
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary/70 hover:bg-secondary border border-border rounded-lg text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" /> CAP XML
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={pdfLoading}
            aria-busy={pdfLoading}
            title="Download experimental source summary (not an official warning)"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs shadow-lg shadow-primary/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> {pdfLoading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? "glass-card p-3 text-sm" : "sr-only"}>
        {copyStatus}
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-zinc-900 text-white border border-primary/40 px-4 py-3 rounded-xl shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-3 z-50 flex items-center gap-2.5 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {toast}
        </div>
      )}

      <div className={`glass-card p-6 md:p-7 border-2 ${alertInfo.border} ${alertInfo.bg} transition-all`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="p-3.5 rounded-2xl bg-background/80 border border-border shadow-inner shrink-0">
              {renderAlertIcon(alertInfo.level)}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xl sm:text-2xl font-black tracking-wider ${alertInfo.color}`}>
                  {alertInfo.level} — EXPERIMENTAL
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
                {alertInfo.desc} The system is sustaining winds of{" "}
                <strong className="text-foreground">
                  {knots ?? "Not available"} knots ({kmh ?? "Not available"} km/h)
                </strong>{" "}
                with gusts up to <strong className="text-foreground">{gusts ?? "Not available"} km/h</strong> and central
                pressure of <strong className="text-foreground">{pressureHpa} hPa</strong>.
              </p>
            </div>
          </div>

          <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto shrink-0 gap-2 border-t md:border-t-0 border-border/40 pt-4 md:pt-0">
            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Max Sustained Wind ({sourceBadge.shortLabel})
              </p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-primary">
                {kmh ?? "Not available"} <span className="text-sm font-normal text-muted-foreground">km/h</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded">
                Gusts {gusts ?? "Not available"} km/h
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-3 overflow-x-auto scrollbar-none">
        <div role="group" aria-label="Report sections" className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={activeTab === "hazards"}
            onClick={() => setActiveTab("hazards")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "hazards"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Hazard Matrix & Threats
          </button>

          <button
            type="button"
            aria-pressed={activeTab === "bulletins"}
            onClick={() => setActiveTab("bulletins")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "bulletins"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" /> Experimental Analyses ({bulletins.length})
          </button>

          <button
            type="button"
            aria-pressed={activeTab === "broadcast"}
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "broadcast"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Radio className="w-4 h-4 text-red-400 animate-pulse" aria-hidden="true" /> Emergency Broadcast Hub
          </button>
        </div>

        <a
          href={`/infrastructure?cyclone_id=${encodeURIComponent(system.id)}`}
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-semibold text-foreground transition-all shrink-0 shadow-xs hover:scale-[1.02]"
        >
          <Building2 className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Infrastructure & Resilience →</span>
        </a>
      </div>

      {activeTab === "hazards" && (
        <HazardMatrixTab
          knots={knots}
          kmh={kmh}
          gusts={gusts}
          portSignals={portSignals}
          affectedDistricts={affectedDistricts}
        />
      )}

      {activeTab === "bulletins" && (
        <BulletinsTab
          bulletins={bulletins}
          selectedBulletin={selectedBulletin}
          onSelectBulletin={setSelectedBulletin}
          sourceShortLabel={sourceBadge.shortLabel}
          getConvertedKnots={getConvertedKnots}
          getConvertedKmh={getConvertedKmh}
          onCopyText={(txt) => void copyText(txt)}
          onDownloadPdf={() => void handleDownloadPdf()}
          pdfLoading={pdfLoading}
        />
      )}

      {activeTab === "broadcast" && (
        <ExerciseBroadcastTab
          affectedDistricts={affectedDistricts}
          dispatchStatus={dispatchStatus}
          dispatchReceipt={dispatchReceipt}
          onDispatchDraft={(type, channels) => void dispatchExerciseDraft(type, channels)}
        />
      )}
    </div>
  );
}
