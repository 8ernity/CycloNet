"use client";

import React from "react";
import type { SurgeCalculation } from "@/types/api";
import type { ParametricInsuranceTrigger } from "@/lib/infrastructureData";
import { evaluateIllustrativeTrigger } from "@/lib/infrastructureData";

interface InsuranceScenarioPanelProps {
  triggers: ParametricInsuranceTrigger[];
  selectedTierIndex: number;
  onSelectTierIndex: (index: number) => void;
  surgeCalcData: SurgeCalculation | null;
  simWindKts: number;
  currentThresholdResult: ReturnType<typeof evaluateIllustrativeTrigger> | null;
  onEvaluateThresholds: () => void;
}

export function InsuranceScenarioPanel({
  triggers,
  selectedTierIndex,
  onSelectTierIndex,
  surgeCalcData,
  simWindKts,
  currentThresholdResult,
  onEvaluateThresholds,
}: InsuranceScenarioPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {triggers.map((trigger, i) => (
          <button
            type="button"
            aria-label={`Select ${trigger.tier}`}
            aria-pressed={selectedTierIndex === i}
            key={trigger.tier}
            onClick={() => onSelectTierIndex(i)}
            className={`glass-card text-left p-5 border cursor-pointer transition-all space-y-3 ${
              selectedTierIndex === i ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 font-mono">
                {trigger.tier}
              </span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {trigger.payoutPercentage}% illustrative share
              </span>
            </div>

            <p className="text-xl font-mono font-black text-foreground">{trigger.hypotheticalPool}</p>

            <div className="space-y-1.5 text-xs text-muted-foreground font-mono pt-1 border-t border-border/40">
              <p>
                Wind Trigger: <strong className="text-foreground">&ge; {trigger.windThresholdKnots} kt</strong>
              </p>
              <p>
                Surge Trigger: <strong className="text-foreground">&ge; {trigger.surgeThresholdMeters}m</strong>
              </p>
              <p>
                Assumed example window: <strong className="text-primary">{trigger.disbursementWindow}</strong>
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="glass-card p-6 border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-foreground">Illustrative threshold comparison</h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
              SANDBOX DRILL
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            This educational rule requires both the wind and surge thresholds (currently {simWindKts} kt and{" "}
            {surgeCalcData?.peak_surge_height_m ?? "Unavailable"} m). No policy eligibility, payout or transfer is
            established. All pools and timing windows are hypothetical.
          </p>
          <p role="status" aria-live="polite" className="mt-2 text-sm">
            {!surgeCalcData
              ? "Evaluation unavailable: a complete current scenario calculation is required."
              : currentThresholdResult === "MET"
                ? "Illustrative thresholds met."
                : currentThresholdResult === "NOT_MET"
                  ? "Illustrative thresholds not met."
                  : currentThresholdResult === "UNAVAILABLE"
                    ? "Evaluation unavailable: invalid inputs."
                    : "Not evaluated for the current inputs."}
          </p>
        </div>
        <button
          type="button"
          onClick={onEvaluateThresholds}
          disabled={!surgeCalcData}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-600/20 whitespace-nowrap"
        >
          Evaluate illustrative thresholds
        </button>
      </div>
    </div>
  );
}
