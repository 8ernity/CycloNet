import React from "react";
import { GlassPanel } from "./GlassPanel";
import { Lock, Shield, FileCheck, Globe, Server, CheckCircle2 } from "lucide-react";
import { MicroLabel } from "./MicroLabel";

const securityFeatures = [
  {
    icon: Lock,
    title: "Transport & Storage Encryption",
    desc: "Hosted transport, database encryption and backup configuration require deployment verification."
  },
  {
    icon: Shield,
    title: "Role-Based Access Control",
    desc: "Verified tokens and roles protect privileged endpoints and the operator event channel."
  },
  {
    icon: FileCheck,
    title: "Auditable Forecasting Logs",
    desc: "Request limits and inference failures are logged. Exercise drafts include an integrity hash, not delivery receipts."
  },
  {
    icon: Globe,
    title: "Sovereign Cloud Architecture",
    desc: "Container configuration is available; hosted readiness requires verified staging checks."
  },
];

export function SecurityCompliance() {
  return (
    <section className="py-24 bg-bg-elevated relative overflow-hidden border-t border-surface-border">
      <div className="container max-w-[1200px] mx-auto px-4 relative z-10">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <MicroLabel className="mb-4 inline-block text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full font-semibold">
            Architectural Specifications
          </MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-4">
            Security controls with explicit release gates.
          </h2>
          <p className="text-text-muted text-sm md:text-base leading-relaxed">
            Architectural design blueprints intended for state disaster management authorities and emergency operations centers.
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
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            No compliance certification claimed
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-glass text-xs font-semibold text-text-muted shadow-xs">
            <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            Deployment verification required
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-glass text-xs font-semibold text-text-muted shadow-xs">
            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            CAP 1.2 exercise templates
          </div>
        </div>

      </div>
    </section>
  );
}
