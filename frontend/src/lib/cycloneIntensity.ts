/**
 * Canonical Cyclone Intensity & Wind Threshold Reference
 *
 * IMD (RSMC New Delhi, 3-minute sustained winds, North Indian Ocean):
 *   < 17 kt  : Low Pressure Area (LPA)
 *   17–27 kt : Depression (D)
 *   28–33 kt : Deep Depression (DD)
 *   34–47 kt : Cyclonic Storm (CS)
 *   48–63 kt : Severe Cyclonic Storm (SCS)
 *   64–89 kt : Very Severe Cyclonic Storm (VSCS)
 *   90–119 kt: Extremely Severe Cyclonic Storm (ESCS)
 *   >= 120 kt: Super Cyclonic Storm (SuCS)
 *
 * Saffir-Simpson / JTWC (1-minute sustained winds):
 *   < 34 kt  : Tropical Depression
 *   34–63 kt : Tropical Storm
 *   64–82 kt : Category 1 Cyclone
 *   83–95 kt : Category 2 Cyclone
 *   96–112 kt: Category 3 Major Cyclone
 *   113–136 kt: Category 4 Major Cyclone
 *   >= 137 kt: Category 5 Super Cyclone
 */

export const KNOT_TO_KMH = 1.852;

export function knotsToKmh(knots: number | null | undefined): number | null {
  if (knots == null || !Number.isFinite(knots)) return null;
  return Math.round(knots * KNOT_TO_KMH);
}

export function classifyImdCategory(knots: number | null | undefined): string {
  if (knots == null || !Number.isFinite(knots)) return "Not available";
  if (knots < 17) return "Low Pressure Area";
  if (knots < 28) return "Depression";
  if (knots < 34) return "Deep Depression";
  if (knots < 48) return "Cyclonic Storm";
  if (knots < 64) return "Severe Cyclonic Storm";
  if (knots < 90) return "Very Severe Cyclonic Storm";
  if (knots < 120) return "Extremely Severe Cyclonic Storm";
  return "Super Cyclonic Storm";
}

export function classifyJtwcCategory(knots: number | null | undefined): string {
  if (knots == null || !Number.isFinite(knots)) return "Not available";
  if (knots < 34) return "Tropical Depression";
  if (knots < 64) return "Tropical Storm";
  if (knots < 83) return "Category 1 Cyclone";
  if (knots < 96) return "Category 2 Cyclone";
  if (knots < 113) return "Category 3 Major Cyclone";
  if (knots < 137) return "Category 4 Major Cyclone";
  return "Category 5 Super Cyclone";
}

export function getIntensityColor(knots: number | null | undefined): string {
  if (knots == null || !Number.isFinite(knots)) return "#94a3b8";
  if (knots < 34) return "#a855f7";
  if (knots < 48) return "#3b82f6";
  if (knots < 64) return "#10b981";
  if (knots < 90) return "#f59e0b";
  if (knots < 120) return "#ef4444";
  return "#7f1d1d";
}

export function getCategoryBadgeClass(knots: number | null | undefined): string {
  if (knots == null || !Number.isFinite(knots)) {
    return "bg-secondary text-muted-foreground border-border";
  }
  if (knots < 34) return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  if (knots < 48) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  if (knots < 64) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (knots < 90) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  if (knots < 120) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
}

export function getCategoryAbbr(cat: string, knots: number | null | undefined): string {
  if (knots == null || !Number.isFinite(knots)) return "Not available";
  const c = (cat || "").toLowerCase();
  if (c.includes("super")) return "SuCS";
  if (c.includes("extremely")) return "ESCS";
  if (c.includes("very severe")) return "VSCS";
  if (c.includes("severe")) return "SCS";
  if (c.includes("cyclonic")) return "CS";
  if (c.includes("deep depression")) return "DD";
  if (c.includes("depression")) return "D";
  if (knots >= 120) return "SuCS";
  if (knots >= 90) return "ESCS";
  if (knots >= 64) return "VSCS";
  if (knots >= 48) return "SCS";
  if (knots >= 34) return "CS";
  if (knots >= 28) return "DD";
  return "D";
}
