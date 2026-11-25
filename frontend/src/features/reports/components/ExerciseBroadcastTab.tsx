"use client";

import React, { useState } from "react";
import { CheckCircle2, PhoneCall, Radio, RefreshCw, Send, ShieldCheck, Siren } from "lucide-react";
import type { DispatchReceipt } from "@/types/api";
import type { AffectedDistrict } from "../types";

interface ExerciseBroadcastTabProps {
  affectedDistricts: AffectedDistrict[];
  dispatchStatus: "idle" | "dispatching" | "completed";
  dispatchReceipt: DispatchReceipt | null;
  onDispatchDraft: (alertType: string, selectedChannels: string[]) => void;
}

const CHANNELS = [
  { id: "sms", label: "Cell Broadcast & SMS" },
  { id: "siren", label: "Acoustic Sirens" },
  { id: "vhf", label: "Marine VHF / Navtex" },
  { id: "sachet", label: "Exercise notification template" },
];

export function ExerciseBroadcastTab({
  affectedDistricts,
  dispatchStatus,
  dispatchReceipt,
  onDispatchDraft,
}: ExerciseBroadcastTabProps) {
  const [alertType, setAlertType] = useState<string>("EVACUATION_WARNING");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sms", "siren", "vhf", "sachet"]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(channelId)) {
        return prev.length > 1 ? prev.filter((c) => c !== channelId) : prev;
      }
      return [...prev, channelId];
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              SIMULATED DRILL
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Cell Broadcast & SMS Pipeline</p>
          <p className="text-xl font-mono font-bold text-foreground">No delivery adapter</p>
          <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <Siren className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              SIMULATED DRILL
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Coastal Acoustic Sirens</p>
          <p className="text-xl font-mono font-bold text-foreground">No hardware connection</p>
          <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Radio className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">DRAFT ONLY</span>
          </div>
          <p className="text-xs text-muted-foreground">Radio exercise template</p>
          <p className="text-xl font-mono font-bold text-foreground">No hardware connection</p>
          <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
        </div>

        <div className="glass-card p-5 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              SIMULATED DRILL
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Official agency resources</p>
          <p className="text-xl font-mono font-bold text-foreground">OASIS CAP v1.2</p>
          <p className="text-[11px] text-muted-foreground">Live Delivery: NOT_APPLICABLE</p>
        </div>
      </div>

      <div className="glass-card p-6 border-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" aria-hidden="true" />
              Local exercise draft generator
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a local exercise document. No public warning, transmission, gateway handshake or hardware activation
              occurs.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded">
            Protocol: OASIS-CAP-1.2-IN
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="exercise-alert-type" className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Alert Directive Type
              </label>
              <select
                id="exercise-alert-type"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value)}
                disabled={dispatchStatus === "dispatching"}
                className="w-full px-3 py-2 bg-secondary/80 border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="EVACUATION_WARNING">RED ALERT: Coastal Hazard Advisory Simulation (Exercise Only)</option>
                <option value="STORM_SURGE_EMERGENCY">ORANGE ALERT: Storm Surge & Inundation Warning</option>
                <option value="FISHERMEN_RECALL">YELLOW ALERT: Marine Return & Total Sea Suspension</option>
                <option value="ALL_CLEAR">ALL CLEAR: Threat Passed / Return Safe</option>
              </select>
            </div>

            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Transmission Channels
              </span>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    aria-pressed={selectedChannels.includes(ch.id)}
                    onClick={() => toggleChannel(ch.id)}
                    disabled={dispatchStatus === "dispatching"}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer ${
                      selectedChannels.includes(ch.id)
                        ? "bg-primary/15 border-primary/50 text-foreground ring-1 ring-primary/20"
                        : "bg-secondary/40 border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selectedChannels.includes(ch.id) ? "bg-primary" : "bg-muted-foreground"
                        }`}
                      />
                      {ch.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                Targeted Coastal Districts ({affectedDistricts.length})
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-secondary/20 border border-border">
                {affectedDistricts.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-foreground">
                    {d.district}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDispatchDraft(alertType, selectedChannels)}
              disabled={dispatchStatus === "dispatching"}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {dispatchStatus === "dispatching" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> Generating exercise draft...
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 animate-pulse" aria-hidden="true" /> Generate exercise draft
                </>
              )}
            </button>
          </div>

          <div className="p-5 rounded-xl bg-zinc-950/80 border border-border flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-mono font-bold text-primary uppercase">Exercise draft status</p>

              <div role="status" className="text-xs text-muted-foreground">
                {dispatchStatus === "dispatching"
                  ? "Requesting a local exercise document. Nothing has been transmitted."
                  : dispatchStatus === "completed"
                    ? "Draft received. No transmission or hardware activation occurred."
                    : "No exercise document has been generated for this request."}
              </div>
            </div>

            {dispatchReceipt && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1 font-mono">
                <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Exercise draft receipt:{" "}
                  {dispatchReceipt.dispatch_id}
                </p>
                <p className="text-[11px] text-muted-foreground">Time: {dispatchReceipt.timestamp}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Payload: &quot;{dispatchReceipt.message_payload}&quot;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
