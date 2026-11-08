import React from 'react';
import { GlassPanel } from './GlassPanel';
export function Testimonials() {
  return <section className="py-20 bg-bg-base"><div className="container max-w-[1200px] mx-auto px-4"><h2 className="text-3xl font-bold mb-8">Evidence before operational use</h2><div className="grid md:grid-cols-3 gap-6">
    <GlassPanel className="p-6"><h3>Scientific review</h3><p>Independent evaluation and calibration remain pending. No forecast accuracy is claimed.</p></GlassPanel>
    <GlassPanel className="p-6"><h3>Field verification</h3><p>Road access, shelter occupancy and utility readiness require current authorized observations.</p></GlassPanel>
    <GlassPanel className="p-6"><h3>Institutional authorization</h3><p>No agency endorsement or operational emergency dispatch authorization is claimed.</p></GlassPanel>
  </div></div></section>;
}
