import type { ChartPoint, TrackPoint } from "@/types/api";
import { knotsToKmh } from "@/lib/cycloneIntensity";

export interface CycloneCatalogItem {
  id: string;
  name: string;
  year?: string;
  basin?: string;
  maxCategory?: string;
  dates?: string;
}

export interface WindConverters {
  getConvertedKnots: (knots: number | null | undefined) => number | null;
  getConvertedKmh: (knots: number | null | undefined) => number | null;
  getConvertedCategory: (knots: number | null | undefined) => string;
}

export interface ForecastTableRow extends TrackPoint {
  kmh: number | null;
  gustKnots: number | null;
  gustKmh: number | null;
  uncertaintyKm: number | null;
  status: string;
}

export const CHART_GEOMETRY = {
  chartW: 860,
  chartH: 260,
  padL: 45,
  padR: 25,
  padT: 30,
  padB: 40,
  plotW: 860 - 45 - 25,
  plotH: 260 - 30 - 40,
  minKnots: 10,
  maxKnots: 140,
} as const;

export function getChartX(idx: number, totalPoints: number): number {
  const { padL, plotW } = CHART_GEOMETRY;
  return padL + (idx / Math.max(1, totalPoints - 1)) * plotW;
}

export function getChartY(knots: number | null | undefined): number {
  if (knots == null || !Number.isFinite(knots)) return Number.NaN;
  const { padT, plotH, minKnots, maxKnots } = CHART_GEOMETRY;
  return padT + plotH - ((knots - minKnots) / (maxKnots - minKnots)) * plotH;
}

export function buildForecastChartData(
  trackForecast: TrackPoint[] | undefined,
  converters: WindConverters
): ChartPoint[] {
  if (!trackForecast || trackForecast.length === 0) return [];
  return trackForecast.map((pt) => ({
    timeOffset: pt.time_offset_hours,
    label:
      pt.time_offset_hours === 0
        ? "0h (Source reference)"
        : `${pt.time_offset_hours > 0 ? "+" : ""}${pt.time_offset_hours}h`,
    intensity: converters.getConvertedKnots(pt.intensity_knots),
    kmh: converters.getConvertedKmh(pt.intensity_knots),
    category: converters.getConvertedCategory(pt.intensity_knots),
    isForecast: pt.is_forecast,
    lat: pt.lat,
    lon: pt.lon,
    lowerBound: null,
    upperBound: null,
  }));
}

export function buildUncertaintyPath(chartData: ChartPoint[]): string {
  const forecastIndices = chartData
    .map((d, i) =>
      (d.isForecast || d.timeOffset === 0) && d.upperBound != null && d.lowerBound != null ? i : -1
    )
    .filter((i) => i >= 0);

  if (forecastIndices.length <= 1) return "";
  const total = chartData.length;
  const topCoords = forecastIndices.map((i) => `${getChartX(i, total)},${getChartY(chartData[i].upperBound)}`);
  const bottomCoords = [...forecastIndices]
    .reverse()
    .map((i) => `${getChartX(i, total)},${getChartY(chartData[i].lowerBound)}`);
  return `M ${topCoords.join(" L ")} L ${bottomCoords.join(" L ")} Z`;
}

export function buildForecastTableRows(
  trackForecast: TrackPoint[] | undefined,
  converters: WindConverters
): ForecastTableRow[] {
  if (!trackForecast || trackForecast.length === 0) return [];
  const relevantPoints = trackForecast.filter(
    (p) => p.is_forecast || p.time_offset_hours === 0 || p.is_landfall
  );
  return relevantPoints.map((pt) => {
    const convKnots = converters.getConvertedKnots(pt.intensity_knots);
    const convKmh = converters.getConvertedKmh(pt.intensity_knots);
    const convCat = converters.getConvertedCategory(pt.intensity_knots);
    const gustKnots: number | null = null;
    return {
      ...pt,
      intensity_knots: convKnots,
      category: convCat,
      kmh: convKmh,
      gustKnots,
      gustKmh: knotsToKmh(gustKnots),
      uncertaintyKm: null,
      status: pt.provenance ?? "UNKNOWN",
    };
  });
}
