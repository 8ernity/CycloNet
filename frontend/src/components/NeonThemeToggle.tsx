"use client";

import React, { useEffect, useState, useId } from "react";
import { useTheme } from "next-themes";

interface NeonThemeToggleProps {
  /** Optional CSS scaling or wrapper classes */
  className?: string;
  /** Scale factor: "sm" (0.55), "md" (0.75), "lg" (1.0) */
  size?: "sm" | "md" | "lg";
}

export function NeonThemeToggle({ className = "", size = "sm" }: NeonThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const rawId = useId();
  const id = rawId.replace(/:/g, "_");

  useEffect(() => {
    setMounted(true);
  }, []);

  // When dark, checkbox is checked (Neon Green Power ON)
  const isDark = mounted ? theme === "dark" : true;

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTheme(e.target.checked ? "dark" : "light");
  };

  const scaleMap = {
    sm: "scale-[0.55] origin-center",
    md: "scale-[0.75] origin-center",
    lg: "scale-100 origin-center",
  };

  const containerDimensions = {
    sm: "w-[56px] h-[34px]",
    md: "w-[76px] h-[46px]",
    lg: "w-[100px] h-[60px]",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${containerDimensions[size]} ${className}`}
      title={mounted ? (isDark ? "Dark Cyber Mode Active (Click for Light Mode)" : "Light Mode Active (Click for Dark Mode)") : "Toggle Theme"}
    >
      <div className={`shrink-0 transform ${scaleMap[size]}`}>
        <label className="switch" htmlFor={`switch-${id}`}>
          <input
            id={`switch-${id}`}
            className="switch__input"
            type="checkbox"
            role="switch"
            checked={isDark}
            onChange={handleToggle}
            aria-label="Toggle dark/light theme"
          />
          <span className="switch__base-outer"></span>
          <span className="switch__base-inner"></span>
          <svg
            className="switch__base-neon"
            viewBox="0 0 40 24"
            width="60"
            height="36"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <filter id={`glow-${id}`}>
                <feGaussianBlur result="coloredBlur" stdDeviation="1"></feGaussianBlur>
                <feMerge>
                  <feMergeNode in="coloredBlur"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
              </filter>
              <linearGradient id={`g1-${id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(123,90%,70%)"></stop>
                <stop offset="100%" stopColor="hsl(168,90%,70%)"></stop>
              </linearGradient>
              <linearGradient id={`g2-${id}`} x1="0.7" y1="0" x2="0.3" y2="1">
                <stop offset="25%" stopColor="hsla(123,90%,70%,0)"></stop>
                <stop offset="50%" stopColor="hsla(123,90%,70%,0.3)"></stop>
                <stop offset="100%" stopColor="hsla(168,90%,70%,0.3)"></stop>
              </linearGradient>
            </defs>
            <path
              fill="none"
              filter={`url(#glow-${id})`}
              stroke={`url(#g1-${id})`}
              strokeWidth="1"
              strokeDasharray="0 104.26 0"
              strokeDashoffset="0.01"
              strokeLinecap="round"
              d="m.5,12C.5,5.649,5.649.5,12,.5h16c6.351,0,11.5,5.149,11.5,11.5s-5.149,11.5-11.5,11.5H12C5.649,23.5.5,18.351.5,12Z"
            ></path>
          </svg>
          <span className="switch__knob-shadow"></span>
          <span className="switch__knob-container">
            <span className="switch__knob">
              <svg
                className="switch__knob-neon"
                viewBox="0 0 48 48"
                width="36"
                height="36"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  fill="none"
                  stroke={`url(#g2-${id})`}
                  strokeDasharray="0 90.32 0 54.19"
                  strokeLinecap="round"
                  strokeWidth="1"
                  r="23"
                  cx="24"
                  cy="24"
                  transform="rotate(-112.5,24,24)"
                ></circle>
              </svg>
            </span>
          </span>
          <span className="switch__led"></span>
          <span className="switch__text">Power</span>
        </label>
      </div>
    </div>
  );
}
