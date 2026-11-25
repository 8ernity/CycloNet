"use client";

import React from "react";
import { Sparkles, X } from "lucide-react";
import type { Briefing } from "@/types/api";

interface BriefingModalProps {
  open: boolean;
  loading: boolean;
  data: Briefing | null;
  error: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onRetry: () => void;
}

export function BriefingModal({ open, loading, data, error, dialogRef, onClose, onRetry }: BriefingModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-summary-title"
        className="glass-card w-full max-w-3xl border-primary/40 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" aria-hidden="true" />
            <h3 id="scenario-summary-title" className="text-lg font-bold text-foreground">
              Deterministic scenario summary
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close scenario summary"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground font-mono">
              Preparing a summary of the selected scenario inputs. No satellite observations are being analyzed.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
              <h4 className="font-bold text-primary text-sm uppercase tracking-wider">Executive Summary</h4>
              <p className="text-foreground leading-relaxed">{data.executive_summary}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-xs">Scenario review checklist</h4>
              <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                {data.action_checklist?.map((act: string, idx: number) => (
                  <li key={idx} className="text-foreground">
                    {act}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div role="status" className="text-xs text-muted-foreground">
            <p>{error ? "Scenario summary unavailable. No complete result was received." : "No scenario summary has been generated."}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-primary px-3 py-2 text-primary-foreground cursor-pointer"
            >
              Retry scenario summary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
