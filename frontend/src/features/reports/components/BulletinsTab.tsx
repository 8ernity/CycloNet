"use client";

import React, { useMemo, useState } from "react";
import { Copy, Download, FileText, Search } from "lucide-react";
import type { Bulletin } from "../types";

interface BulletinsTabProps {
  bulletins: Bulletin[];
  selectedBulletin: Bulletin | null;
  onSelectBulletin: (bulletin: Bulletin) => void;
  sourceShortLabel: string;
  getConvertedKnots: (knots: number | null | undefined) => number | null;
  getConvertedKmh: (knots: number | null | undefined) => number | null;
  onCopyText: (text: string) => void;
  onDownloadPdf: () => void;
  pdfLoading: boolean;
}

export function BulletinsTab({
  bulletins,
  selectedBulletin,
  onSelectBulletin,
  sourceShortLabel,
  getConvertedKnots,
  getConvertedKmh,
  onCopyText,
  onDownloadPdf,
  pdfLoading,
}: BulletinsTabProps) {
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredBulletins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bulletins.filter((b) => {
      const matchesFilter = filterLevel === "ALL" || b.alert_level.toUpperCase() === filterLevel;
      const matchesSearch =
        !query ||
        b.title.toLowerCase().includes(query) ||
        b.category.toLowerCase().includes(query) ||
        b.full_text.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [bulletins, filterLevel, searchQuery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      <div className="lg:col-span-1 space-y-4">
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" aria-hidden="true" />
              Bulletins Feed
            </h3>
            <span className="text-xs text-muted-foreground">{filteredBulletins.length} available</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search bulletin text"
              placeholder="Search bulletin text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {["ALL", "RED", "ORANGE", "YELLOW"].map((lvl) => (
              <button
                key={lvl}
                type="button"
                aria-pressed={filterLevel === lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
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

        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {filteredBulletins.map((b) => (
            <button
              type="button"
              aria-label={`Select bulletin ${b.number}`}
              aria-pressed={selectedBulletin?.id === b.id}
              key={b.id}
              onClick={() => onSelectBulletin(b)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
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
              <p className="text-xs text-muted-foreground line-clamp-1">
                {b.category} • {b.intensity_knots ?? "Not available"} kts
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40 font-mono">
                <span>{b.timestamp_ist}</span>
                <span className={`font-bold ${b.alert_level === "RED" ? "text-red-400" : "text-orange-400"}`}>
                  {b.alert_level}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {selectedBulletin ? (
          <div className="glass-card p-6 border-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary">BULLETIN RECORD</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground">
                    {selectedBulletin.id}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground mt-1">{selectedBulletin.title}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Issued: {selectedBulletin.timestamp_utc ?? "Not available"} (
                  {selectedBulletin.timestamp_ist ?? "Not available"})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCopyText(selectedBulletin.full_text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={pdfLoading}
                  aria-busy={pdfLoading}
                  title="Download experimental source summary (not an official warning)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                  {pdfLoading ? "Preparing PDF…" : "Download PDF"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Wind Speed ({sourceShortLabel})
                </p>
                <p className="text-lg font-mono font-bold text-foreground">
                  {getConvertedKnots(selectedBulletin.intensity_knots) ?? "Not available"} kts
                </p>
                <p className="text-xs text-muted-foreground">
                  {getConvertedKmh(selectedBulletin.intensity_knots) ?? "Not available"} km/h
                </p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Peak Gusts</p>
                <p className="text-lg font-mono font-bold text-orange-400">
                  {selectedBulletin.gusts_kmh ?? "Not available"} km/h
                </p>
                <p className="text-xs text-muted-foreground">Gale force</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Storm Surge</p>
                <p className="text-lg font-mono font-bold text-cyan-400">
                  {selectedBulletin.storm_surge_meters ?? "Not available"} m
                </p>
                <p className="text-xs text-muted-foreground">Above tide</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Central Pressure</p>
                <p className="text-lg font-mono font-bold text-foreground">
                  {selectedBulletin.central_pressure_hpa ?? "Not available"} hPa
                </p>
                <p className="text-xs text-muted-foreground">Estimated</p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950/80 border border-border font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text shadow-inner max-h-[450px] overflow-y-auto">
              {selectedBulletin.full_text}
            </div>
          </div>
        ) : (
          <div className="glass-card p-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" aria-hidden="true" />
            <p>Select a bulletin from the left panel to inspect full technical text.</p>
          </div>
        )}
      </div>
    </div>
  );
}
