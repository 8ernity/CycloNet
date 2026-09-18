import React from 'react';
import { GlassPanel } from './GlassPanel';
import { Lock, Shield, FileCheck, Globe } from 'lucide-react';
import { MicroLabel } from './MicroLabel';

const securityFeatures = [
  { icon: Lock, title: "End-to-End Encryption", desc: "Military-grade AES-256 telemetry encryption at rest and in transit." },
  { icon: Shield, title: "Role-Based Command Access", desc: "Granular permissions mapped to meteorological and disaster response hierarchies." },
  { icon: FileCheck, title: "Immutable Telemetry Logs", desc: "Every forecast run and classification is cryptographically signed and archived." },
  { icon: Globe, title: "100% Indian Data Sovereignty", desc: "All computational clusters and databases hosted strictly within Indian borders." },
];

export function SecurityCompliance() {
  return (
    <section className="py-24 bg-bg-elevated relative overflow-hidden border-t border-surface-border">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <MicroLabel className="mb-4 inline-block text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full font-semibold">
            National Critical Infrastructure
          </MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-4">
            Security and reliability at national scale.
          </h2>
          <p className="text-text-muted text-sm md:text-base leading-relaxed">
            Engineered to meet the mission-critical security and uptime requirements of state disaster authorities, IMD RSMC, and the Ministry of Earth Sciences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {securityFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <GlassPanel key={feature.title} className="p-6 border-surface-border bg-surface-glass">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4 text-sky-500 dark:text-sky-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-text-primary mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{feature.desc}</p>
              </GlassPanel>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-glass text-xs font-semibold text-text-muted shadow-xs">
            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            ISO 27001 Certified Architecture
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-glass text-xs font-semibold text-text-muted shadow-xs">
            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            MeitY Sovereign Cloud Verified
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-glass text-xs font-semibold text-text-muted shadow-xs">
            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            99.99% Disaster Resilient Uptime
          </div>
        </div>

      </div>
    </section>
  );
}
