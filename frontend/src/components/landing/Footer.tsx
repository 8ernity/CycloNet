"use client";

import React from "react";
import Link from "next/link";
import { Radar, Shield, CheckCircle2 } from "lucide-react";
import { MicroLabel } from "./MicroLabel";

const FOOTER_LINKS = [
  {
    title: "Product & Intelligence",
    links: [
      { label: "Active Storm Dashboard", href: "/dashboard" },
      { label: "Source Tracks & Experimental Forecasts", href: "/forecast" },
      { label: "AI Satellite Classifier", href: "/classification" },
      { label: "Surge & Infrastructure Forecaster", href: "/infrastructure" },
      { label: "Source Bulletins & Exercise Drafts", href: "/reports" }
    ]
  },
  {
    title: "Vulnerability Modules",
    links: [
      { label: "Illustrative Power Assets", href: "/infrastructure" },
      { label: "Road & Shelter Data Availability", href: "/infrastructure" },
      { label: "Hypothetical Insurance Scenarios", href: "/reports" },
      { label: "System Comparison Matrix", href: "/compare" },
      { label: "Historical Storm Database", href: "/archive" }
    ]
  },
  {
    title: "Documentation & Feeds",
    links: [
      { label: "Satellite Validation Status", href: "/infrastructure" },
      { label: "CAP Exercise Drafts", href: "/reports" },
      { label: "API Configuration", href: "/settings" },
      { label: "Data Ingestion & Feed Status", href: "/settings" }
    ]
  },
  {
    title: "Architecture & Standards",
    links: [
      { label: "Official Source References", href: "/reports" },
      { label: "Jelesnianski Surge Model", href: "/infrastructure" },
      { label: "Application Settings", href: "/settings" },
      { label: "Exercise Communications", href: "/reports" }
    ]
  }
];

export function Footer() {
  return (
    <footer className="bg-bg-elevated pt-20 pb-10 border-t border-surface-border">
      <div className="container max-w-[1200px] mx-auto px-4">
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                <Radar className="h-5 w-5 text-blue-600" />
              </div>
              <span className="brand-logo font-bold text-2xl text-blue-600">CycloNet</span>
            </Link>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Experimental cyclone observations, historical records, image classification and explicitly labeled research scenarios. No operational warning delivery is connected.
            </p>
          </div>

          {/* Links Cols */}
          {FOOTER_LINKS.map(group => (
            <div key={group.title} className="flex flex-col gap-4">
              <MicroLabel className="text-text-primary">{group.title}</MicroLabel>
              <ul className="flex flex-col gap-2.5">
                {group.links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-xs sm:text-sm text-text-muted hover:text-accent transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Statutory Civil Defense & Operational Readiness Advisory (#36) */}
        <div className="py-4 px-5 mb-8 rounded-xl bg-surface-glass border border-surface-border text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div>
            <strong className="text-text-primary uppercase font-mono text-[10.5px] block mb-0.5">Operational Readiness Notice (Non-Statutory Decision Support Prototype)</strong>
            <span>CycloNet is an experimental meteorological AI research prototype. Official evacuation orders, nautical port warnings, and disaster response directives must follow statutory bulletins issued by the India Meteorological Department (IMD / RSMC New Delhi) and the National Disaster Management Authority (NDMA).</span>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono text-[10px] font-bold">
            RESEARCH PROTOTYPE
          </span>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-surface-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} CycloNet — Cyclone Impact & Infrastructure Vulnerability Forecaster. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Exercise outputs only</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-sky-500" /> Independent security certification not verified</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
