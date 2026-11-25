import type { WeatherSystem } from "@/types/api";
import {
  COASTAL_INUNDATION_ZONES,
  EVACUATION_ROUTES,
  MEDICAL_SHELTERS,
  PARAMETRIC_INSURANCE_TRIGGERS,
  POWER_SUBSTATIONS,
} from "@/lib/infrastructureData";
import type { AffectedDistrict, AlertSummary, Bulletin, PortSignal } from "../types";

export function computeAlertSummary(knots: number | null): AlertSummary {
  if (knots == null || !Number.isFinite(knots)) {
    return {
      level: "DATA_UNAVAILABLE",
      title: "Wind measurement not available",
      desc: "Hazard cannot be evaluated. Consult official agencies.",
      color: "text-slate-400",
      bg: "bg-slate-500/10",
      border: "border-slate-500/40",
    };
  }
  if (knots >= 120) {
    return {
      level: "RED",
      title: "Experimental high-wind scenario",
      desc: "Wind threshold category only. Landfall timing, surge, and evacuation requirements are not established by this report.",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/40",
    };
  }
  if (knots >= 48) {
    return {
      level: "ORANGE",
      title: "Experimental wind assessment",
      desc:
        knots >= 90
          ? "Wind threshold category only. Consult official agencies for impact forecasts."
          : "Wind threshold category only. Rainfall and coastal impacts are not established.",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/40",
    };
  }
  if (knots >= 34) {
    return {
      level: "YELLOW",
      title: "Experimental wind assessment",
      desc: "Wind threshold category only. Sea conditions and coastal squalls are not established by this measurement.",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/40",
    };
  }
  return {
    level: "GREEN",
    title: "Experimental low-wind assessment",
    desc: "Low measured wind does not establish basin-wide calm or absence of other hazards.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
  };
}

export function buildJsonReportPayload(params: {
  reportMode: string;
  sourceBadge: { shortLabel: string; desc: string };
  system: WeatherSystem;
  alertInfo: AlertSummary;
  bulletins: Bulletin[];
  affectedDistricts: AffectedDistrict[];
  portSignals: PortSignal[];
}) {
  return {
    timestamp: new Date().toISOString(),
    mode: params.reportMode,
    disclaimer: "Experimental source summary. Not an official warning or independently validated forecast.",
    displayPreference: params.sourceBadge,
    system: params.system,
    alertInfo: params.alertInfo,
    bulletins: params.bulletins,
    affectedDistricts: params.affectedDistricts,
    portSignals: params.portSignals,
    infrastructureExposure: {
      is_simulation: true,
      disclaimer: "Illustrative planning fixtures; not measured storm exposure or verified facility status.",
      powerSubstations: POWER_SUBSTATIONS,
      evacuationRoutes: EVACUATION_ROUTES,
      medicalShelters: MEDICAL_SHELTERS,
      inundationZones: COASTAL_INUNDATION_ZONES,
    },
    parametricInsuranceTriggers: {
      is_simulation: true,
      disclaimer: "Illustrative thresholds; no coverage or payout established.",
      scenarios: PARAMETRIC_INSURANCE_TRIGGERS,
    },
  };
}

export function downloadBlobFile(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
