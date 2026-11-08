"use client";
import React from 'react';
import { StatTile } from './StatTile';
import { Satellite, ShieldCheck, Zap, Activity } from 'lucide-react';
export function StatsTicker() {
  return <section className="py-20 bg-bg-base"><div className="container max-w-[1200px] mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <StatTile icon={Satellite} value="Not measured" label="Service availability" tint="emerald" />
    <StatTile icon={Activity} value="Archive" label="Historical storm records" tint="sky" />
    <StatTile icon={ShieldCheck} value="Not validated" label="Forecast accuracy" tint="accent" />
    <StatTile icon={Zap} value="Not measured" label="Production inference latency" tint="amber" />
  </div></section>;
}
