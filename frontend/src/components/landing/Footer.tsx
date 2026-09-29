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
      { label: "48h Track Forecast & Cone", href: "/forecast" },
      { label: "AI Satellite Classifier", href: "/classification" },
      { label: "Surge & Infrastructure Forecaster", href: "/infrastructure" },
      { label: "Official Bulletins & CAP Dispatches", href: "/reports" }
    ]
  },
  {
    title: "Vulnerability Modules",
    links: [
      { label: "400kV Power Grid Hardening", href: "/infrastructure" },
      { label: "Evacuation Corridors & Shelters", href: "/infrastructure" },
      { label: "Parametric Insurance Triggers", href: "/reports" },
      { label: "System Comparison Matrix", href: "/compare" },
      { label: "Historical Storm Database", href: "/archive" }
    ]
  },
  {
    title: "Documentation & Feeds",
    links: [
      { label: "Google Earth Engine SAR Docs", href: "/infrastructure" },
      { label: "OASIS CAP-CP v1.2 XML Feed", href: "/reports" },
      { label: "FastAPI REST API Docs", href: "http://localhost:8000/docs" },
      { label: "Data Ingestion & Feed Status", href: "/settings" }
    ]
  },
  {
    title: "Architecture & Standards",
    links: [
      { label: "IMD & RSMC Alignment", href: "/reports" },
      { label: "Jelesnianski Surge Model", href: "/infrastructure" },
      { label: "Sovereign Cloud Deployment", href: "/settings" },
      { label: "Multi-Agency Alert Standards", href: "/reports" }
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
              AI-powered predictive risk and vulnerability modeling platform for tropical cyclone tracking, parametric storm surge simulation, and early-warning advisory dispatches.
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

        {/* Bottom bar */}
        <div className="pt-8 border-t border-surface-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} CycloNet — Cyclone Impact & Infrastructure Vulnerability Forecaster. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> OASIS CAP-CP v1.2</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-sky-500" /> Designed to ISO 27001</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
