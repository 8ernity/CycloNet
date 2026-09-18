"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import { motion } from "framer-motion";

export interface ParallaxComponentProps {
  title?: string;
  pretitle?: string;
  subtitle?: string;
  layer1Src?: string;
  layer2Src?: string;
  layer4Src?: string;
}

export function ParallaxComponent({
  title = "CYCLONET",
  pretitle = "A SAFER TOMORROW FROM SPACE",
  subtitle = "GLOBAL INTELLIGENCE FOR A RESILIENT TOMORROW",
  layer1Src = "/Earth.png",
  layer2Src = "/NobgEarth.png",
  layer4Src = "/Astronaut.png",
}: ParallaxComponentProps) {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const triggerElement = parallaxRef.current?.querySelector("[data-parallax-layers]");

    if (triggerElement) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: triggerElement,
          start: "0% 0%",
          end: "100% 0%",
          scrub: 0,
        },
      });

      const layers = [
        { layer: "1", yPercent: 70 },
        { layer: "2", yPercent: 55 },
        { layer: "3", yPercent: 40 },
        { layer: "4", yPercent: 10 },
      ];

      layers.forEach((layerObj, idx) => {
        tl.to(
          triggerElement.querySelectorAll(`[data-parallax-layer="${layerObj.layer}"]`),
          {
            yPercent: layerObj.yPercent,
            ease: "none",
          },
          idx === 0 ? undefined : "<"
        );
      });
    }

    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      if (triggerElement) {
        gsap.killTweensOf(triggerElement);
      }
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="parallax relative w-full overflow-hidden bg-[#030712] select-none" ref={parallaxRef}>
      <section className="parallax__header relative h-[100vh] w-full overflow-hidden">
        <div className="parallax__visuals relative h-full w-full">
          <div className="parallax__black-line-overflow absolute top-0 left-0 right-0 h-[2px] bg-[#030712] z-20 pointer-events-none" />
          
          <div data-parallax-layers className="parallax__layers absolute inset-0 w-full h-full overflow-hidden">
            {/* Layer 1: Background Starry Deep Space */}
            <img
              src={layer1Src}
              loading="eager"
              data-parallax-layer="1"
              alt="Deep Space Background"
              className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-0"
            />

            {/* Layer 2: Earth Atmosphere & Orbital Rim */}
            <img
              src={layer2Src}
              loading="eager"
              data-parallax-layer="2"
              alt="Earth Orbital Layer"
              className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-1"
            />

            {/* Layer 3: CYCLONET 3D Depth Typography matching FullUI.png */}
            <div
              data-parallax-layer="3"
              className="parallax__layer-title absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center z-10 pb-28 sm:pb-36"
            >
              {/* Pre-title */}
              <p className="text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-[0.38em] text-blue-100/90 mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {pretitle}
              </p>

              {/* Main Glowing Metallic Title */}
              <div className="relative flex items-center justify-center my-1">
                {/* Radial Aurora Glow behind letters */}
                <div className="absolute w-[120%] h-[150%] bg-blue-500/20 blur-[90px] rounded-full pointer-events-none -z-10" />

                <h1 className="parallax__title text-6xl sm:text-8xl md:text-[8.5rem] lg:text-[10rem] font-black font-heading uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-[#f0f9ff] to-[#93c5fd] drop-shadow-[0_15px_45px_rgba(0,0,0,0.95)] text-center leading-none">
                  {title}
                </h1>

                {/* Horizontal Lens Flare Accent */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-80 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent blur-[1px] opacity-80 pointer-events-none" />
              </div>

              {/* Subtitle */}
              <p className="text-[10px] sm:text-xs md:text-sm font-semibold uppercase tracking-[0.32em] text-blue-200/75 mt-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] max-w-2xl">
                {subtitle}
              </p>
            </div>

            {/* Layer 4: Foreground Astronaut & Moon Surface Ridge */}
            <img
              src={layer4Src}
              loading="eager"
              data-parallax-layer="4"
              alt="Astronaut & Surface Foreground"
              className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-20"
            />
          </div>

          {/* Scroll to Explore Mouse Indicator (at the bottom) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
            <div className="w-5 h-8 rounded-full border-2 border-slate-400/50 flex items-start justify-center p-1 backdrop-blur-xs">
              <motion.div
                animate={{ y: [0, 8, 0], opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="w-1 h-2 rounded-full bg-slate-200"
              />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-[0.32em] text-slate-400/90 drop-shadow-sm">
              Scroll to Explore
            </span>
          </div>

          {/* Smooth Bottom Blend into the Deep Cosmic Content Sections */}
          <div className="parallax__fade absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#040714] via-[#040714]/70 to-transparent pointer-events-none z-20" />
        </div>
      </section>
    </div>
  );
}

export default ParallaxComponent;
