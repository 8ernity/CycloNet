import React from "react";

interface CycloneLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export function CycloneLogo({ size = 28, className = "", glow = true }: CycloneLogoProps) {
  const id = React.useId().replace(/:/g, "");
  const gradId = `cycloneGrad_${id}`;
  const glowId = `cycloneGlow_${id}`;

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          {glow && (
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>
        <path
          d="M50 10C27.9 10 10 27.9 10 50c0 9.8 3.6 18.8 9.6 25.8-2.1-6.1-1.4-12.9 2-18.7 4.5-7.8 12.9-12.6 22.1-12.6 5.8 0 11.3 2 15.7 5.4-3.6-7.8-11-13.8-20.4-15.7 6.1-3 12.9-4 19.6-.3 14.6 8.1 19.6 26.6 11.5 41.2-4.5 8-12.2 13.3-20.8 14.2 6.1 1.4 12.4.7 18.2-2.1 16.4-7.9 22.9-27.8 14.7-44.2C76.5 28.5 63.9 10 50 10z"
          fill={`url(#${gradId})`}
          filter={glow ? `url(#${glowId})` : undefined}
        />
        <circle cx="50" cy="50" r="7" fill="#93c5fd" />
      </svg>
    </div>
  );
}
