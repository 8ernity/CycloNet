import type {
  EvacuationRoute,
  MedicalCycloneShelter,
  PowerSubstation,
  calculateRouteVulnerability,
  calculateShelterSuitability,
  calculateSubstationVulnerability,
} from "@/lib/infrastructureData";

export type InfrastructureTab = "grid" | "routes" | "shelters" | "surge_rain" | "dispatch" | "insurance";

export interface InfrastructureStormPreset {
  id: string;
  name: string;
  basin: string;
  category: string;
  knots: number | null;
}

export interface AnalyzedSubstation extends PowerSubstation {
  ivf: ReturnType<typeof calculateSubstationVulnerability> | null;
}

export interface AnalyzedRoute extends EvacuationRoute {
  vuln: ReturnType<typeof calculateRouteVulnerability> | null;
}

export interface AnalyzedShelter extends MedicalCycloneShelter {
  suitability: ReturnType<typeof calculateShelterSuitability>;
}
