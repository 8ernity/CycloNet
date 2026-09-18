"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Radar, Moon, Globe, Shield } from 'lucide-react';
import { MicroLabel } from './MicroLabel';

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Live Monitoring", href: "/" },
      { label: "48h Track Forecast", href: "/forecast" },
      { label: "Dvorak Classifier", href: "/classification" },
      { label: "Storm Surge Simulator", href: "/forecast" },
      { label: "Meteorological Reports", href: "/reports" }
    ]
  },
  {
    title: "Solutions",
    links: [
      { label: "State Disaster HQ (SDMA)", href: "/" },
      { label: "Coast Guard Maritime", href: "/" },
      { label: "Port Authorities", href: "/" },
      { label: "Offshore Platforms", href: "/" }
    ]
  },
  {
    title: "Resources",
    links: [
      { label: "IMD RSMC Documentation", href: "#" },
      { label: "INSAT-3DR Data Pipeline", href: "#" },
      { label: "API Reference", href: "#" },
      { label: "Operational Status", href: "#" }
    ]
  },
  {
    title: "Governance",
    links: [
      { label: "MoES & IMD Alignment", href: "#" },
      { label: "Terms of Operational Use", href: "#" },
      { label: "Security & Sovereignty", href: "#" },
      { label: "Data Residency (India)", href: "#" }
    ]
  }
];

export function Footer() {
  const [lang, setLang] = useState('EN');

  return (
    <footer className="bg-bg-elevated pt-20 pb-10 border-t border-surface-border">
      <div className="container max-w-[1200px] mx-auto px-4">
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                <Radar className="h-5 w-5 text-blue-600" />
              </div>
              <span className="brand-logo font-bold text-2xl text-blue-600">CycloNet</span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              AI-powered tropical cyclone trajectory, intensity estimation, and coastal disaster intelligence platform.
            </p>
            
            <div className="flex gap-4 mt-auto">
              <button 
                onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')}
                className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors bg-surface-glass px-3 py-1.5 rounded-full border border-surface-border cursor-pointer"
              >
                <Globe className="w-3 h-3 text-blue-600" />
                {lang === 'EN' ? 'हिन्दी' : 'English'}
              </button>
            </div>
          </div>

          {/* Links Cols */}
          {FOOTER_LINKS.map(group => (
            <div key={group.title} className="flex flex-col gap-4">
              <MicroLabel className="text-text-primary">{group.title}</MicroLabel>
              <ul className="flex flex-col gap-3">
                {group.links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-text-muted hover:text-accent transition-colors">
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
          <p className="text-xs text-text-faint">
            &copy; {new Date().getFullYear()} CycloNet Meteorological Intelligence. Developed for SIH26070. All rights reserved.
          </p>
          <p className="text-xs text-text-faint flex gap-4">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-600" /> ISO 27001 Aligned</span>
            <span>Data Residency: India</span>
          </p>
        </div>

      </div>
    </footer>
  );
}
