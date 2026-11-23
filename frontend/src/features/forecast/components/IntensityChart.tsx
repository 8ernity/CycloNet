"use client";

import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { ChartPoint } from "@/types/api";
import { getCategoryBadgeClass } from "@/lib/cycloneIntensity";
import { CHART_GEOMETRY, buildUncertaintyPath, getChartX, getChartY } from "../utils/forecastTransforms";

interface IntensityChartProps {
  chartData: ChartPoint[];
}

export function IntensityChart({ chartData }: IntensityChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const { chartW, chartH, padL, padR, padT, padB, plotW, plotH, minKnots, maxKnots } = CHART_GEOMETRY;

  const uncertaintyPath = buildUncertaintyPath(chartData);
  const currentIndex = chartData.findIndex((d) => d.timeOffset === 0);
  const activePt = hoveredPoint || chartData.find((d) => d.timeOffset === 0) || chartData[0];

  const pastPointsStr =
    currentIndex > 0 && chartData.slice(0, currentIndex + 1).every((d) => d.intensity != null)
      ? chartData
          .slice(0, currentIndex + 1)
          .map((d, i) => `${getChartX(i, chartData.length)},${getChartY(d.intensity)}`)
          .join(" ")
      : "";

  const forecastPointsStr =
    currentIndex >= 0 &&
    currentIndex < chartData.length - 1 &&
    chartData.slice(currentIndex).every((d) => d.intensity != null)
      ? chartData
          .slice(currentIndex)
          .map((d, i) => `${getChartX(currentIndex + i, chartData.length)},${getChartY(d.intensity)}`)
          .join(" ")
      : "";

  return (
    <div className="glass-card p-6 border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="font-heading font-bold text-lg text-foreground">Intensity Over Time & Predicted Decay</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Supplied wind values (knots). Missing observations and unvalidated uncertainty are not estimated.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Source track points
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-0 border-t-2 border-dashed border-red-500 inline-block" /> Experimental track
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-2 rounded-xs bg-red-500/20 border border-red-500/40 inline-block" /> Uncertainty
            unavailable
          </span>
        </div>
      </div>

      {!activePt ? (
        <p className="p-4 text-sm">Track waypoints unavailable. No trajectory is inferred from a single source fix.</p>
      ) : (
        <div
          aria-live="polite"
          className="mb-4 bg-secondary/40 border border-border rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${activePt.isForecast ? "bg-red-500" : "bg-blue-500"}`} />
            <span className="font-bold text-foreground">
              {activePt.timeOffset === 0 ? "Current Surveillance Center (0h)" : `Waypoint Lead: ${activePt.label}`}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadgeClass(activePt.intensity)}`}>
              {activePt.category}
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px] flex-wrap">
            <div>
              <span className="text-muted-foreground mr-1">Wind Speed:</span>
              <span className="font-bold text-foreground">{activePt.intensity ?? "Unavailable"} KT</span>
              <span className="text-muted-foreground ml-1">({activePt.kmh ?? "Unavailable"} km/h)</span>
            </div>
            {activePt.isForecast && (
              <div className="border-l border-border pl-3">
                <span className="text-muted-foreground mr-1">Uncertainty Envelope:</span>
                <span className="text-foreground font-semibold">
                  {activePt.lowerBound == null ? "Not available" : Math.round(activePt.lowerBound)} &ndash;{" "}
                  {activePt.upperBound == null ? "Not available" : Math.round(activePt.upperBound)} KT
                </span>
              </div>
            )}
            <div className="border-l border-border pl-3">
              <span className="text-muted-foreground mr-1">Fix Coords:</span>
              <span className="text-foreground">
                {activePt.lat?.toFixed(1)}&deg;N, {activePt.lon?.toFixed(1)}&deg;E
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-x-auto" onMouseLeave={() => setHoveredPoint(null)}>
        <svg
          role="group"
          aria-label="Cyclone wind intensity over time chart"
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full h-auto min-w-[700px] select-none"
        >
          <defs>
            <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="lineGradPast" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>

          <g opacity="0.12">
            <rect x={padL} y={getChartY(34)} width={plotW} height={getChartY(minKnots) - getChartY(34)} fill="#a855f7" />
            <rect x={padL} y={getChartY(48)} width={plotW} height={getChartY(34) - getChartY(48)} fill="#3b82f6" />
            <rect x={padL} y={getChartY(64)} width={plotW} height={getChartY(48) - getChartY(64)} fill="#10b981" />
            <rect x={padL} y={getChartY(90)} width={plotW} height={getChartY(64) - getChartY(90)} fill="#f59e0b" />
            <rect x={padL} y={getChartY(120)} width={plotW} height={getChartY(90) - getChartY(120)} fill="#ef4444" />
            <rect x={padL} y={getChartY(maxKnots)} width={plotW} height={getChartY(120) - getChartY(maxKnots)} fill="#7f1d1d" />
          </g>

          {[20, 34, 48, 64, 90, 120].map((knotVal) => (
            <g key={knotVal}>
              <line
                x1={padL}
                y1={getChartY(knotVal)}
                x2={chartW - padR}
                y2={getChartY(knotVal)}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeDasharray="4,4"
              />
              <text
                x={padL - 8}
                y={getChartY(knotVal) + 3}
                fontSize="10"
                textAnchor="end"
                className="fill-muted-foreground font-mono"
              >
                {knotVal}kt
              </text>
            </g>
          ))}

          {[
            { val: 26, name: "D/DD" },
            { val: 40, name: "CS" },
            { val: 56, name: "SCS" },
            { val: 77, name: "VSCS" },
            { val: 105, name: "ESCS" },
            { val: 128, name: "SuCS" },
          ].map((cat) => (
            <text
              key={cat.name}
              x={chartW - padR + 6}
              y={getChartY(cat.val)}
              fontSize="9"
              fontWeight="600"
              className="fill-muted-foreground/60 font-mono"
            >
              {cat.name}
            </text>
          ))}

          {currentIndex >= 0 && (
            <g>
              <line
                x1={getChartX(currentIndex, chartData.length)}
                y1={padT}
                x2={getChartX(currentIndex, chartData.length)}
                y2={chartH - padB}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              <text
                x={getChartX(currentIndex, chartData.length)}
                y={padT - 10}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                className="fill-red-500 font-sans"
              >
                Current Fix (0h)
              </text>
            </g>
          )}

          {uncertaintyPath && <path d={uncertaintyPath} fill="url(#uncertaintyGradient)" />}

          {pastPointsStr && (
            <polyline
              fill="none"
              stroke="url(#lineGradPast)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pastPointsStr}
            />
          )}

          {forecastPointsStr && (
            <polyline
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeDasharray="6,5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={forecastPointsStr}
            />
          )}

          {chartData.map((d, i) => {
            if (d.intensity == null) return null;
            const cx = getChartX(i, chartData.length);
            const cy = getChartY(d.intensity);
            const isCurr = d.timeOffset === 0;
            const isHovered = hoveredPoint?.timeOffset === d.timeOffset;
            const colHalf = Math.max(12, plotW / (chartData.length * 2));

            return (
              <g key={i}>
                <rect
                  x={cx - colHalf}
                  y={padT}
                  width={colHalf * 2}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label}: ${d.intensity} knots, ${d.category}`}
                  className="cursor-pointer focus:outline-none"
                  onMouseEnter={() => setHoveredPoint(d)}
                  onFocus={() => setHoveredPoint(d)}
                  onBlur={() => setHoveredPoint(null)}
                />

                {isHovered && (
                  <g pointerEvents="none">
                    <line
                      x1={cx}
                      y1={padT}
                      x2={cx}
                      y2={chartH - padB}
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeDasharray="3,3"
                    />
                    <circle cx={cx} cy={cy} r="11" fill={d.isForecast ? "#ef4444" : "#3b82f6"} opacity="0.3" />
                  </g>
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? "6.5" : isCurr ? "5.5" : "4"}
                  fill={d.isForecast ? "#ef4444" : "#3b82f6"}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  pointerEvents="none"
                />

                <text
                  x={cx}
                  y={chartH - padB + 18}
                  fontSize="9.5"
                  textAnchor="middle"
                  pointerEvents="none"
                  className={`font-mono ${
                    isHovered ? "fill-primary font-bold" : isCurr ? "fill-red-500 font-bold" : "fill-muted-foreground"
                  }`}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
