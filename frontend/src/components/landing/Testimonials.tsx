"use client";

import React, { useRef, useState, useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { Quote } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useMotionTokens } from '@/lib/motion-tokens';
import { MicroLabel } from './MicroLabel';

const testimonials = [
  {
    quote: "The 48-hour ensemble landfall cone and storm surge simulation gave our district emergency collectors 14 extra hours to execute zero-casualty coastal evacuations.",
    name: "P. K. Jena",
    role: "State Disaster Management Chief (Illustrative)",
    initials: "PJ"
  },
  {
    quote: "CycloNet's deep learning Dvorak classifier accurately flagged the rapid intensification of Cyclone Biparjoy hours before legacy numerical guidance converged.",
    name: "Dr. S. Bhattacharya",
    role: "Senior Meteorological Scientist (Illustrative)",
    initials: "SB"
  },
  {
    quote: "Having explainable AI SHAP decompositions allowed our maritime commanders to reposition offshore patrol vessels and rescue choppers with total operational confidence.",
    name: "Capt. R. Nair",
    role: "Coast Guard Maritime Operations (Illustrative)",
    initials: "RN"
  }
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const { shouldReduceMotion } = useMotionTokens();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [4, -4]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-4, 4]), { stiffness: 300, damping: 30 });

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 1024 && window.matchMedia("(hover: hover)").matches);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || shouldReduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(normX);
    y.set(normY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: isDesktop && !shouldReduceMotion ? rotateX : 0,
        rotateY: isDesktop && !shouldReduceMotion ? rotateY : 0,
        perspective: 1000
      }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export function Testimonials() {
  const { tier1, tier1Variants } = useMotionTokens();

  return (
    <section className="py-24 bg-bg-base text-text-primary overflow-hidden border-t border-surface-border transition-colors duration-300">
      <div className="container max-w-[1200px] mx-auto px-4">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <MicroLabel className="mb-4 inline-block">Command Citations</MicroLabel>
          <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight text-text-primary mb-4">
            Trusted across coastal commands.
          </h2>
          <p className="text-text-muted text-sm md:text-base leading-relaxed">
            See how predictive meteorological intelligence transforms reactive disaster response into proactive coastal safety.
          </p>
        </div>

        <motion.div 
          className="grid md:grid-cols-3 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ staggerChildren: tier1.stagger }}
        >
          {testimonials.map((t, i) => (
            <motion.div 
              key={i}
              variants={tier1Variants}
              className="h-full"
            >
              <TiltCard>
                <GlassPanel hoverEffect={false} className="p-8 h-full flex flex-col relative overflow-hidden group bg-surface-glass border-surface-border">
                  <Quote className="absolute top-4 right-4 w-20 h-20 text-text-primary/5 -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 pointer-events-none" />
                  
                  <p className="text-sm text-text-primary leading-relaxed mb-8 relative z-10 font-medium">
                    &quot;{t.quote}&quot;
                  </p>
                  
                  <div className="mt-auto flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-500 dark:text-sky-300 font-bold text-xs shadow-sm">
                      {t.initials}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{t.name}</h4>
                      <p className="text-xs text-text-muted">{t.role}</p>
                    </div>
                  </div>
                </GlassPanel>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
