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
  pretitle = "NEVER MISS A CYCLONE",
  subtitle = "AI TROPICAL CYCLONE TRAJECTORY & LANDFALL INTELLIGENCE",
  layer1Src = "/Galaxy.mp4",
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
          scrub: 0.8,
          fastScrollEnd: true,
          preventOverlaps: true,
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
            force3D: true,
          },
          idx === 0 ? undefined : "<"
        );
      });
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(500, 33);

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
            {/* Layer 1: Background Starry Deep Space or Video */}
            {layer1Src?.match(/\.(mp4|webm|mov|m4v|ogg)$/i) ? (
              <video
                src={layer1Src}
                autoPlay
                loop
                muted
                playsInline
                data-parallax-layer="1"
                className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-0 will-change-transform"
                style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
              />
            ) : (
              <img
                src={layer1Src}
                loading="eager"
                data-parallax-layer="1"
                alt="Deep Space Background"
                className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-0 will-change-transform"
                style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
              />
            )}

            {/* Layer 2: Earth Atmosphere & Orbital Rim or Video */}
            {layer2Src?.match(/\.(mp4|webm|mov|m4v|ogg)$/i) ? (
              <video
                src={layer2Src}
                autoPlay
                loop
                muted
                playsInline
                data-parallax-layer="2"
                className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-1 will-change-transform"
                style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
              />
            ) : (
              <img
                src={layer2Src}
                loading="eager"
                data-parallax-layer="2"
                alt="Earth Orbital Layer"
                className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-1 will-change-transform"
                style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
              />
            )}

            {/* Layer 3: CYCLONET 3D Depth Typography matching Reference Images */}
            <div
              data-parallax-layer="3"
              className="parallax__layer-title absolute inset-0 flex flex-col items-center justify-start pt-[10vh] sm:pt-[11vh] md:pt-[12vh] lg:pt-[13vh] pointer-events-none px-4 text-center z-10 will-change-transform"
              style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
            >
              {/* Pre-title */}
              <p 
                className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.44em] text-[#67e8f9] mb-2 sm:mb-2.5 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] drop-shadow-[0_0_16px_rgba(34,211,238,0.6)] select-none"
                style={{ fontFamily: "'Montserrat', var(--font-sans), sans-serif" }}
              >
                {pretitle}
              </p>

              {/* Main Glowing Metallic Title */}
              <div className="relative flex items-center justify-center my-0.5 select-none">
                <h1 
                  className="parallax__title text-4xl sm:text-6xl md:text-7xl lg:text-[5.4rem] xl:text-[6.2rem] font-extrabold uppercase tracking-[0.02em] text-center leading-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.98)] drop-shadow-[0_0_40px_rgba(56,189,248,0.4)]"
                  style={{
                    fontFamily: "'Montserrat', var(--font-sans), sans-serif",
                    backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 42%, #F0F9FF 55%, #BAE6FD 75%, #38BDF8 92%, #0284C7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {title}
                </h1>

                {/* Optical Starburst Gleam resting on the horizontal foot of the letter L */}
                <div className="absolute left-[47.2%] top-[77%] -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-20">
                  {/* Central Bright White Diamond / Core */}
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full shadow-[0_0_10px_#38bdf8,0_0_20px_#0284c7,0_0_30px_#38bdf8] blur-[0.2px]" />
                  {/* Anamorphic Horizontal Ray Flare */}
                  <div className="absolute w-32 sm:w-48 md:w-64 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent blur-[0.4px]" />
                  {/* Vertical Ray Flare */}
                  <div className="absolute h-10 sm:h-14 w-[1.5px] bg-gradient-to-b from-transparent via-cyan-200 to-transparent blur-[0.4px]" />
                  {/* Diagonal Sparkle 1 */}
                  <div className="absolute w-10 sm:w-14 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rotate-45 blur-[0.3px] opacity-80" />
                  {/* Diagonal Sparkle 2 */}
                  <div className="absolute w-10 sm:w-14 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent -rotate-45 blur-[0.3px] opacity-80" />
                  {/* Soft Cyan Bloom Aura */}
                  <div className="absolute w-10 h-10 bg-cyan-400/35 rounded-full blur-lg" />
                </div>
              </div>

              {/* Subtitle */}
              <p 
                className="text-[9px] sm:text-[10.5px] md:text-[11.5px] font-semibold uppercase tracking-[0.38em] text-[#bae6fd] mt-2 sm:mt-2.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] drop-shadow-[0_0_16px_rgba(56,189,248,0.35)] max-w-2xl select-none"
                style={{ fontFamily: "'Montserrat', var(--font-sans), sans-serif" }}
              >
                {subtitle}
              </p>
            </div>

            {/* Layer 4: Foreground Astronaut & Moon Surface Ridge */}
            <img
              src={layer4Src}
              loading="eager"
              data-parallax-layer="4"
              alt="Astronaut & Surface Foreground"
              className="parallax__layer-img absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-20 will-change-transform"
              style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
            />
          </div>

          {/* Scroll to Explore Mouse Indicator (positioned comfortably above the blend) */}
          <div className="absolute bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none select-none">
            <div className="w-5 h-8 rounded-full border-2 border-slate-300/80 flex items-start justify-center p-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              <motion.div
                animate={{ y: [0, 8, 0], opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="w-1 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#38bdf8]"
              />
            </div>
            <span 
              className="text-[9px] uppercase font-bold tracking-[0.32em] text-slate-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              style={{ fontFamily: "'Montserrat', var(--font-sans), sans-serif" }}
            >
              Scroll to Explore
            </span>
          </div>

          {/* Smooth Bottom Atmospheric Feather Blend into the Content Sections */}
          <div className="parallax__fade absolute bottom-0 left-0 right-0 h-48 sm:h-64 bg-gradient-to-t from-bg-base via-bg-base/85 via-45% to-transparent pointer-events-none z-30 transition-colors duration-500" />
        </div>
      </section>
    </div>
  );
}

export default ParallaxComponent;
