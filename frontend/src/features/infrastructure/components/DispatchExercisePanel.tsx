"use client";

import React from "react";
import { Check, CheckCircle2, Copy, Radio, RefreshCw, Send, Siren, Terminal } from "lucide-react";
import type { DispatchResult, SurgeCalculation } from "@/types/api";

interface DispatchExercisePanelProps {
  dispatchRegion: string;
  onDispatchRegionChange: (value: string) => void;
  dispatchRiskLevel: string;
  onDispatchRiskLevelChange: (value: string) => void;
  dispatchChannels: string[];
  onToggleChannel: (channelId: string) => void;
  dispatchLoading: boolean;
  dispatchResult: DispatchResult | null;
  dispatchViewerTab: "cap" | "sms" | "sachet" | "siren" | "vhf" | "directives";
  onDispatchViewerTabChange: (tab: "cap" | "sms" | "sachet" | "siren" | "vhf" | "directives") => void;
  onExecuteDispatch: () => void;
  surgeCalcData: SurgeCalculation | null;
  simWindKts: number;
  onCopyText: (text: string) => void;
}

const DISPATCH_CHANNEL_OPTIONS = [
  { id: "CAP", name: "OASIS CAP-CP v1.2 XML", desc: "Standardized National Disaster XML alert registry" },
  { id: "SMS", name: "Cell Broadcast & SMS Gateway", desc: "Trilingual SMS alerts (English, Hindi, Regional)" },
  { id: "SACHET", name: "Exercise notification JSON", desc: "Local JSON exercise template; no delivery adapter" },
  { id: "SIREN", name: "Siren exercise template", desc: "No hardware connection or verified tower inventory" },
  { id: "VHF", name: "Marine NAVTEX / VHF Ch 16", desc: "Local radio exercise template; no transmitter connected" },
];

export function DispatchExercisePanel({
  dispatchRegion,
  onDispatchRegionChange,
  dispatchRiskLevel,
  onDispatchRiskLevelChange,
  dispatchChannels,
  onToggleChannel,
  dispatchLoading,
  dispatchResult,
  dispatchViewerTab,
  onDispatchViewerTabChange,
  onExecuteDispatch,
  surgeCalcData,
  simWindKts,
  onCopyText,
}: DispatchExercisePanelProps) {
  const surgeM = surgeCalcData?.peak_surge_height_m ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-background to-orange-950/30 border border-red-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3.5 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
            <Siren className="w-7 h-7 animate-pulse text-red-400" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">
              CycloNet local exercise templates
            </span>
            <h3 className="text-xl font-bold text-foreground">Local multi-channel exercise drafts</h3>
            <p className="text-xs text-muted-foreground max-w-3xl">
              Creates local draft templates for training. No message is transmitted, no agency is represented, and no
              hardware is activated.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExecuteDispatch}
          disabled={dispatchLoading || !surgeCalcData}
          className={`px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition-all flex items-center gap-2.5 shrink-0 cursor-pointer shadow-xl ${
            dispatchLoading
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-600/30 active:scale-95"
          }`}
        >
          {dispatchLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Generating exercise draft...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Generate exercise draft</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-card p-5 border-border space-y-4">
          <h4 className="text-sm font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" aria-hidden="true" /> Target Zone & Parameters
          </h4>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="dispatch-target-region" className="text-muted-foreground block mb-1">
                Target Coastal Region:
              </label>
              <input
                id="dispatch-target-region"
                type="text"
                aria-label="Target coastal region"
                value={dispatchRegion}
                onChange={(e) => onDispatchRegionChange(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="dispatch-severity-level" className="text-muted-foreground block mb-1">
                Alert Severity Level:
              </label>
              <select
                id="dispatch-severity-level"
                aria-label="Exercise alert severity"
                value={dispatchRiskLevel}
                onChange={(e) => onDispatchRiskLevelChange(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/80 border border-border rounded-lg text-foreground font-semibold"
              >
                <option value="CRITICAL">CRITICAL (Exercise category)</option>
                <option value="HIGH">HIGH (Alert & Staging)</option>
                <option value="MODERATE">MODERATE (Watch & Caution)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-2 rounded bg-secondary/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block">Peak Surge:</span>
                <strong className="text-foreground">{surgeM ?? "Unavailable"}m</strong>
              </div>
              <div className="p-2 rounded bg-secondary/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block">Sustained Wind:</span>
                <strong className="text-foreground">{simWindKts} kt</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 border-border space-y-4 md:col-span-2">
          <h4 className="text-sm font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" aria-hidden="true" /> Dispatched Broadcast Channels
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {DISPATCH_CHANNEL_OPTIONS.map((ch) => {
              const isSelected = dispatchChannels.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onToggleChannel(ch.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 text-left ${
                    isSelected
                      ? "bg-red-500/10 border-red-500/40 text-foreground"
                      : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? "bg-red-500 text-white" : "border border-muted-foreground"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{ch.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ch.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {dispatchLoading && (
        <div role="status" className="glass-card p-6">
          Generating local exercise drafts. No transmission or hardware activation occurs.
        </div>
      )}

      {dispatchResult && (
        <div className="glass-card p-6 border-border space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  EXERCISE DRAFT CREATED — NOT TRANSMITTED
                </span>
                <span className="text-xs font-mono text-muted-foreground">ID: {dispatchResult.dispatch_id}</span>
              </div>
              <h4 className="text-base font-bold text-foreground mt-1">Local exercise templates and audit record</h4>
            </div>

            <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border flex-wrap">
              {[
                { id: "cap", label: "CAP XML" },
                { id: "sms", label: "SMS Alerts" },
                { id: "sachet", label: "SACHET" },
                { id: "siren", label: "Sirens" },
                { id: "vhf", label: "VHF Marine" },
                { id: "directives", label: "Directives" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={dispatchViewerTab === t.id}
                  onClick={() => onDispatchViewerTabChange(t.id as typeof dispatchViewerTab)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                    dispatchViewerTab === t.id
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {dispatchViewerTab === "cap" && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>OASIS CAP-CP v1.2 Standard Emergency XML Document:</span>
                <button
                  type="button"
                  onClick={() => onCopyText(dispatchResult.cap_xml)}
                  className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-mono flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Copy className="w-3 h-3" aria-hidden="true" /> Copy XML
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-border font-mono text-xs text-emerald-400 overflow-x-auto max-h-80 leading-relaxed scrollbar-thin">
                {dispatchResult.cap_xml}
              </pre>
            </div>
          )}

          {dispatchViewerTab === "sms" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(dispatchResult.sms_payload || {}).map(([lang, txt]) => (
                <div key={lang} className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">{lang} Broadcast</span>
                    <button
                      type="button"
                      aria-label={`Copy ${lang} exercise text`}
                      onClick={() => onCopyText(txt ?? "Translation unavailable")}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Copy className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed font-sans">{txt ?? "Translation unavailable"}</p>
                </div>
              ))}
            </div>
          )}

          {dispatchViewerTab === "sachet" && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Exercise notification JSON:</span>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-border font-mono text-xs text-cyan-400 overflow-x-auto max-h-80 leading-relaxed">
                {JSON.stringify(dispatchResult.sachet_payload, null, 2)}
              </pre>
            </div>
          )}

          {dispatchViewerTab === "siren" && (
            <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3 text-xs font-mono">
              <p className="font-bold text-amber-400">Coastal Acoustic Warning Array Activation Protocol:</p>
              <pre className="text-foreground leading-relaxed">{JSON.stringify(dispatchResult.siren_payload, null, 2)}</pre>
            </div>
          )}

          {dispatchViewerTab === "vhf" && (
            <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">
                Radio exercise draft (not transmitted):
              </span>
              <p className="font-mono text-xs text-foreground leading-relaxed p-3 rounded bg-zinc-950 border border-border">
                {dispatchResult.vhf_payload}
              </p>
            </div>
          )}

          {dispatchViewerTab === "directives" && (
            <div className="p-5 rounded-xl bg-secondary/30 border border-border space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Municipal & Disaster Magistrate Directives:
              </span>
              <ul className="space-y-2 text-xs text-foreground">
                {dispatchResult.municipal_briefing?.map((dir: string, dIdx: number) => (
                  <li key={dIdx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{dir}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
