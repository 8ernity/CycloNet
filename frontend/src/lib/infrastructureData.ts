export interface PowerSubstation {
  id: string;
  name: string;
  type: "400kV Grid Substation" | "220kV Primary Substation" | "Thermal/Renewable Feeder";
  lat: number;
  lon: number;
  capacityMVA: number;
  elevationMeters: number;
  region: string;
  coastalDistanceKm: number;
  criticality: "Extreme" | "High" | "Moderate";
}

export interface EvacuationRoute {
  id: string;
  name: string;
  highwayCode: string;
  path: [number, number][];
  evacuationPriority: "Corridor 1 (Mandatory)" | "Corridor 2 (High Traffic)" | "Secondary Arterial";
  floodRiskLevel: "Severe Inundation Risk" | "Moderate Waterlogging" | "Clear / Elevated";
  elevationAvgM: number;
  region: string;
}

export interface MedicalCycloneShelter {
  id: string;
  name: string;
  type: "Multipurpose Cyclone Shelter" | "District Emergency Hospital" | "NDRF Staging Base" | "Community Relief Center";
  lat: number;
  lon: number;
  capacityPersons: number;
  medicalBeds: number;
  generatorBackup: boolean;
  satelliteComms: boolean;
  status: "Operational & Staged" | "Active Evacuation Receiving" | "Standby";
  region: string;
}

export interface ParametricInsuranceTrigger {
  tier: "Tier 1 (Catastrophic)" | "Tier 2 (Severe Storm)" | "Tier 3 (Moderate Wind)";
  windThresholdKnots: number;
  surgeThresholdMeters: number;
  payoutPercentage: number;
  disbursementWindow: string;
  targetBeneficiaries: string;
  hypotheticalPool: string;
}

// ── Illustrative Coastal Infrastructure Dataset (NIO / BoB / Arabian Sea) ──
// Metadata documentation addressing #50 (Static Asset Inventories) & #51 (Unverified Field Statuses)
export const INFRASTRUCTURE_METADATA = {
  inventoryType: "Illustrative scenario inventory; no verified asset source",
  lastTopologicalSurvey: null,
  fieldVerificationRequired: true,
  operationalNotice: "All asset fields are unverified scenario assumptions. No surveyed inventory, current readiness or funded insurance facility is connected."
};

export const POWER_SUBSTATIONS: PowerSubstation[] = [
  {
    id: "SUB-AP-01",
    name: "Visakhapatnam 400kV Ultra-Grid Substation",
    type: "400kV Grid Substation",
    lat: 17.72,
    lon: 83.28,
    capacityMVA: 1200,
    elevationMeters: 8,
    region: "Andhra Pradesh Coast",
    coastalDistanceKm: 3.2,
    criticality: "Extreme"
  },
  {
    id: "SUB-AP-02",
    name: "Srikakulam / Kalingapatnam 220kV Primary Feeder",
    type: "220kV Primary Substation",
    lat: 18.33,
    lon: 83.90,
    capacityMVA: 600,
    elevationMeters: 5,
    region: "North Andhra Pradesh",
    coastalDistanceKm: 4.8,
    criticality: "Extreme"
  },
  {
    id: "SUB-OD-01",
    name: "Gopalpur Port 220kV Industrial Substation",
    type: "220kV Primary Substation",
    lat: 19.26,
    lon: 84.88,
    capacityMVA: 800,
    elevationMeters: 6,
    region: "South Odisha",
    coastalDistanceKm: 2.1,
    criticality: "Extreme"
  },
  {
    id: "SUB-OD-02",
    name: "Paradip 400kV Coastal Maritime Power Terminal",
    type: "400kV Grid Substation",
    lat: 20.29,
    lon: 86.64,
    capacityMVA: 1500,
    elevationMeters: 4,
    region: "Central Odisha Coast",
    coastalDistanceKm: 1.8,
    criticality: "Extreme"
  },
  {
    id: "SUB-OD-03",
    name: "Dhamra Port 220kV LNG Substation",
    type: "220kV Primary Substation",
    lat: 20.81,
    lon: 86.95,
    capacityMVA: 650,
    elevationMeters: 3,
    region: "Bhadrak / Odisha",
    coastalDistanceKm: 1.5,
    criticality: "High"
  },
  {
    id: "SUB-WB-01",
    name: "Haldia / Sagar Island 400kV Transmission Hub",
    type: "400kV Grid Substation",
    lat: 22.03,
    lon: 88.08,
    capacityMVA: 1400,
    elevationMeters: 4,
    region: "West Bengal Sundarbans",
    coastalDistanceKm: 5.0,
    criticality: "Extreme"
  },
  {
    id: "SUB-GJ-01",
    name: "Mundra Port 400kV Super-Grid Terminal",
    type: "400kV Grid Substation",
    lat: 22.84,
    lon: 69.71,
    capacityMVA: 2000,
    elevationMeters: 7,
    region: "Kutch Coast, Gujarat",
    coastalDistanceKm: 3.5,
    criticality: "Extreme"
  },
  {
    id: "SUB-GJ-02",
    name: "Jakhau / Mandvi 220kV Coastal Feeder",
    type: "220kV Primary Substation",
    lat: 23.23,
    lon: 68.60,
    capacityMVA: 500,
    elevationMeters: 4,
    region: "Kutch Coast, Gujarat",
    coastalDistanceKm: 2.2,
    criticality: "Extreme"
  },
  {
    id: "SUB-TN-01",
    name: "Puducherry / Cuddalore 400kV Substation",
    type: "400kV Grid Substation",
    lat: 11.94,
    lon: 79.80,
    capacityMVA: 1100,
    elevationMeters: 5,
    region: "Tamil Nadu / Puducherry",
    coastalDistanceKm: 2.8,
    criticality: "High"
  }
];

export const EVACUATION_ROUTES: EvacuationRoute[] = [
  {
    id: "RTE-NH16-01",
    name: "NH-16 East Coast Arterial Lifeline (Chennai - Vizag - Cuttack - Kolkata)",
    highwayCode: "NH-16",
    path: [
      [13.08, 80.27],
      [14.44, 79.98],
      [15.50, 80.05],
      [17.72, 83.28],
      [18.33, 83.90],
      [19.26, 84.88],
      [20.29, 85.82],
      [21.49, 86.92],
      [22.57, 88.36]
    ],
    evacuationPriority: "Corridor 1 (Mandatory)",
    floodRiskLevel: "Moderate Waterlogging",
    elevationAvgM: 14,
    region: "Bay of Bengal Coastal Belt"
  },
  {
    id: "RTE-NH51-01",
    name: "NH-51 Gujarat Coastal Evacuation Corridor (Dwarka - Porbandar - Diu - Bhavnagar)",
    highwayCode: "NH-51",
    path: [
      [22.24, 68.96],
      [21.64, 69.60],
      [20.91, 70.36],
      [20.71, 70.98],
      [21.76, 72.15]
    ],
    evacuationPriority: "Corridor 1 (Mandatory)",
    floodRiskLevel: "Severe Inundation Risk",
    elevationAvgM: 8,
    region: "Saurashtra Coast, Gujarat"
  },
  {
    id: "RTE-NH116-01",
    name: "NH-116B Digha - Kolaghat Sundarbans Evacuation Link",
    highwayCode: "NH-116B",
    path: [
      [21.62, 87.51],
      [21.78, 87.75],
      [22.03, 88.08],
      [22.42, 87.97]
    ],
    evacuationPriority: "Corridor 1 (Mandatory)",
    floodRiskLevel: "Severe Inundation Risk",
    elevationAvgM: 4,
    region: "West Bengal Coastal Corridor"
  }
];

export const MEDICAL_SHELTERS: MedicalCycloneShelter[] = [
  // ── Odisha Coast (OSDMA / NCRMP Multi-Purpose Cyclone Shelters) ──
  {
    id: "SHL-OD-01",
    name: "Puri Coastal Multi-Hazard Disaster Center",
    type: "Multipurpose Cyclone Shelter",
    lat: 19.81,
    lon: 85.83,
    capacityPersons: 6000,
    medicalBeds: 80,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "Puri, Odisha"
  },
  {
    id: "SHL-OD-02",
    name: "Paradip Port NDRF Coastal Staging Base",
    type: "NDRF Staging Base",
    lat: 20.31,
    lon: 86.62,
    capacityPersons: 2800,
    medicalBeds: 120,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Jagatsinghpur, Odisha"
  },
  {
    id: "SHL-OD-03",
    name: "Gopalpur Port Community Cyclone Shelter",
    type: "Multipurpose Cyclone Shelter",
    lat: 19.27,
    lon: 84.90,
    capacityPersons: 3500,
    medicalBeds: 40,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Ganjam, Odisha"
  },
  {
    id: "SHL-OD-04",
    name: "Dhamra Port & Bhadrak Coastal Emergency Shelter",
    type: "Multipurpose Cyclone Shelter",
    lat: 20.82,
    lon: 86.96,
    capacityPersons: 4200,
    medicalBeds: 60,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "Bhadrak, Odisha"
  },
  {
    id: "SHL-OD-05",
    name: "Balasore Chandipur Coastal Evacuation Center",
    type: "Multipurpose Cyclone Shelter",
    lat: 21.47,
    lon: 87.02,
    capacityPersons: 5000,
    medicalBeds: 75,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Balasore, Odisha"
  },
  {
    id: "SHL-OD-06",
    name: "Kendrapara Astaranga Estuary Relief Camp",
    type: "Community Relief Center",
    lat: 19.98,
    lon: 86.27,
    capacityPersons: 3000,
    medicalBeds: 35,
    generatorBackup: true,
    satelliteComms: false,
    status: "Operational & Staged",
    region: "Kendrapara, Odisha"
  },

  // ── Andhra Pradesh Coast (APSDMA / Coastal Cyclone Shelters) ──
  {
    id: "SHL-AP-01",
    name: "Srikakulam Multipurpose Cyclone Shelter Complex",
    type: "Multipurpose Cyclone Shelter",
    lat: 18.30,
    lon: 83.91,
    capacityPersons: 4500,
    medicalBeds: 60,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "Srikakulam, Andhra Pradesh"
  },
  {
    id: "SHL-AP-02",
    name: "King George Hospital & Disaster Trauma Center (Vizag)",
    type: "District Emergency Hospital",
    lat: 17.70,
    lon: 83.30,
    capacityPersons: 3200,
    medicalBeds: 450,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Visakhapatnam, Andhra Pradesh"
  },
  {
    id: "SHL-AP-03",
    name: "Kakinada Port Coastal Marine Relief Staging Base",
    type: "NDRF Staging Base",
    lat: 16.98,
    lon: 82.26,
    capacityPersons: 3800,
    medicalBeds: 50,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Kakinada, Andhra Pradesh"
  },
  {
    id: "SHL-AP-04",
    name: "Machilipatnam Coastal Multi-Purpose Shelter",
    type: "Multipurpose Cyclone Shelter",
    lat: 16.18,
    lon: 81.14,
    capacityPersons: 4000,
    medicalBeds: 45,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Krishna, Andhra Pradesh"
  },
  {
    id: "SHL-AP-05",
    name: "Nellore Krishnapatnam Port Emergency Base",
    type: "Multipurpose Cyclone Shelter",
    lat: 14.28,
    lon: 80.12,
    capacityPersons: 3600,
    medicalBeds: 40,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Nellore, Andhra Pradesh"
  },

  // ── West Bengal Sundarbans & Coastal Belt (WBSDMA) ──
  {
    id: "SHL-WB-01",
    name: "Bakkhali - Sagar Island Cyclone Relief Hub",
    type: "Multipurpose Cyclone Shelter",
    lat: 21.57,
    lon: 88.26,
    capacityPersons: 5200,
    medicalBeds: 50,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "South 24 Parganas, West Bengal"
  },
  {
    id: "SHL-WB-02",
    name: "Digha Coastal Emergency Hospital & Shelter",
    type: "District Emergency Hospital",
    lat: 21.63,
    lon: 87.52,
    capacityPersons: 4600,
    medicalBeds: 180,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "East Midnapore, West Bengal"
  },
  {
    id: "SHL-WB-03",
    name: "Kakdwip Sundarbans Delta Marine Staging Shelter",
    type: "Multipurpose Cyclone Shelter",
    lat: 21.87,
    lon: 88.19,
    capacityPersons: 3900,
    medicalBeds: 40,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Sundarbans, West Bengal"
  },
  {
    id: "SHL-WB-04",
    name: "Gosaba Mangrove Sector Emergency Hub",
    type: "Community Relief Center",
    lat: 22.16,
    lon: 88.80,
    capacityPersons: 3200,
    medicalBeds: 30,
    generatorBackup: true,
    satelliteComms: false,
    status: "Operational & Staged",
    region: "South 24 Parganas, West Bengal"
  },

  // ── Tamil Nadu & Puducherry Coast ──
  {
    id: "SHL-TN-01",
    name: "Nagapattinam Coastal Disaster Response Center",
    type: "Multipurpose Cyclone Shelter",
    lat: 10.76,
    lon: 79.84,
    capacityPersons: 5500,
    medicalBeds: 90,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Nagapattinam, Tamil Nadu"
  },
  {
    id: "SHL-TN-02",
    name: "Cuddalore Port Cyclone Evacuation Complex",
    type: "Multipurpose Cyclone Shelter",
    lat: 11.75,
    lon: 79.77,
    capacityPersons: 4800,
    medicalBeds: 65,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Cuddalore, Tamil Nadu"
  },
  {
    id: "SHL-TN-03",
    name: "Chennai Rajiv Gandhi Emergency Trauma Center",
    type: "District Emergency Hospital",
    lat: 13.08,
    lon: 80.28,
    capacityPersons: 6500,
    medicalBeds: 600,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Chennai, Tamil Nadu"
  },

  // ── Gujarat Saurashtra & Kutch Coast (GSDMA) ──
  {
    id: "SHL-GJ-01",
    name: "Kutch / Mandvi Emergency Relief Staging Shelter",
    type: "Multipurpose Cyclone Shelter",
    lat: 22.83,
    lon: 69.35,
    capacityPersons: 4800,
    medicalBeds: 70,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Kutch, Gujarat"
  },
  {
    id: "SHL-GJ-02",
    name: "Dwarka District Emergency Hospital & Shelter",
    type: "District Emergency Hospital",
    lat: 22.25,
    lon: 68.97,
    capacityPersons: 3500,
    medicalBeds: 220,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "Devbhumi Dwarka, Gujarat"
  },
  {
    id: "SHL-GJ-03",
    name: "Jakhau Port Marine Emergency Command Base",
    type: "NDRF Staging Base",
    lat: 23.24,
    lon: 68.61,
    capacityPersons: 3100,
    medicalBeds: 45,
    generatorBackup: true,
    satelliteComms: true,
    status: "Active Evacuation Receiving",
    region: "Kutch Coast, Gujarat"
  },
  {
    id: "SHL-GJ-04",
    name: "Porbandar Coastal Evacuation Shelter Complex",
    type: "Multipurpose Cyclone Shelter",
    lat: 21.64,
    lon: 69.61,
    capacityPersons: 4200,
    medicalBeds: 80,
    generatorBackup: true,
    satelliteComms: true,
    status: "Operational & Staged",
    region: "Porbandar, Gujarat"
  }
];

export const PARAMETRIC_INSURANCE_TRIGGERS: ParametricInsuranceTrigger[] = [
  {
    tier: "Tier 1 (Catastrophic)",
    windThresholdKnots: 90,
    surgeThresholdMeters: 3.5,
    payoutPercentage: 100,
    disbursementWindow: "Pre-Landfall T-24h (Immediate Digital Liquidity)",
    targetBeneficiaries: "District Administration, SDRF Mobilization & Vulnerable Smallholders",
    hypotheticalPool: "₹250 Crore / $30M USD"
  },
  {
    tier: "Tier 2 (Severe Storm)",
    windThresholdKnots: 64,
    surgeThresholdMeters: 2.0,
    payoutPercentage: 70,
    disbursementWindow: "Pre-Landfall T-12h (Anticipatory Emergency Transfer)",
    targetBeneficiaries: "Municipal Hardening, Coastal Power Utility Restoration & Shelter Food Banks",
    hypotheticalPool: "₹140 Crore / $17M USD"
  },
  {
    tier: "Tier 3 (Moderate Wind)",
    windThresholdKnots: 48,
    surgeThresholdMeters: 1.0,
    payoutPercentage: 35,
    disbursementWindow: "Post-Event T+24h (Automated Satellite Index Payout)",
    targetBeneficiaries: "Fishermen Livelihood Compensation & Rural Drainage Clearing",
    hypotheticalPool: "₹65 Crore / $8M USD"
  }
];

// Inundation buffer zones (coastal polygons) for storm surge simulation
export const COASTAL_INUNDATION_ZONES: { name: string; polygon: [number, number][]; riskLevel: string; depthM: string }[] = [
  {
    name: "North AP & South Odisha Coastal Surge Sector",
    polygon: [
      [17.65, 83.20],
      [18.25, 83.85],
      [18.80, 84.40],
      [19.30, 84.95],
      [19.10, 85.20],
      [18.50, 84.60],
      [17.80, 83.90],
      [17.50, 83.35]
    ],
    riskLevel: "Critical Inundation (2.5 - 4.0m Surge)",
    depthM: "3.2m"
  },
  {
    name: "Odisha Dhamra - Paradip - Mahanadi Estuary Zone",
    polygon: [
      [19.70, 85.80],
      [20.30, 86.70],
      [20.90, 87.05],
      [21.30, 87.10],
      [21.15, 86.80],
      [20.50, 86.40],
      [19.90, 85.60]
    ],
    riskLevel: "High Inundation (2.0 - 3.5m Surge)",
    depthM: "2.8m"
  },
  {
    name: "Gujarat Kutch & Gulf of Kutch Coastal Zone",
    polygon: [
      [22.70, 69.10],
      [23.10, 68.50],
      [23.40, 68.60],
      [23.20, 69.50],
      [22.80, 70.00]
    ],
    riskLevel: "High Inundation (2.5 - 3.5m Tidal Surge)",
    depthM: "3.0m"
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Track 5: Multi-Factor Infrastructure Vulnerability Index (IVF) Scoring Engine
// Formula: Risk = Flood (30%) + Wind (25%) + Elevation (15%) + Coast (10%) + Criticality (20%)
// ─────────────────────────────────────────────────────────────────────────────

export interface SubstationVulnerabilityAnalysis {
  floodDepthM: number;
  windExposureKts: number;
  elevationM: number;
  coastalDistanceKm: number;
  backupCapacityHrs: number;
  riskScore: number; // 0 - 100
  riskCategory: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factorBreakdown: {
    floodFactor: number;
    windFactor: number;
    elevationFactor: number;
    coastalFactor: number;
    criticalityFactor: number;
  };
  recommendedAction: string;
  scoringMethodology: string;
  is_heuristic_simulation: boolean;
  methodologyNotice: string;
}

export function calculateSubstationVulnerability(
  sub: PowerSubstation,
  stormKnots: number = 85,
  surgeMeters: number = 2.8,
  rainMm: number = 220
): SubstationVulnerabilityAnalysis {
  // 1. Estimated local flood depth based on surge, elevation deficit, and coastal proximity
  const distDecay = Math.max(0.2, 1.0 - (sub.coastalDistanceKm / 12.0));
  const elevationDeficit = Math.max(0, surgeMeters - (sub.elevationMeters * 0.4));
  const rainWaterlogging = (rainMm / 250.0) * 0.6;
  const floodDepthM = Number(Math.max(0.1, (elevationDeficit * distDecay) + rainWaterlogging).toFixed(1));

  // 2. Wind exposure at site
  const windExposureKts = Math.round(stormKnots * (1.0 - (sub.coastalDistanceKm * 0.02)));

  // 3. Backup battery / DG runtime capacity before total blackout
  const backupCapacityHrs = sub.criticality === "Extreme" ? 8 : (sub.criticality === "High" ? 6 : 4);

  // 4. Multi-Attribute Utility Theory (MAUT) parameter weighting
  // Flood Fragility: Sigmoidal water ingress response (critical busbar submergence begins at 0.8m)
  const floodScore = Math.min(100, Math.round((1.0 / (1.0 + Math.exp(-3.5 * (floodDepthM - 0.9)))) * 100));
  // Wind Fragility: Aerodynamic mast shear failure curve (severe risk accelerates above 80 kt)
  const windScore = Math.min(100, Math.round((1.0 / (1.0 + Math.exp(-0.06 * (windExposureKts - 80)))) * 100));
  // Elevation Deficit (15%): Low elevation (<3m) = high risk
  const elevScore = Math.max(10, Math.min(100, (10 - sub.elevationMeters) * 11));
  // Distance to Coast (10%): Close (<2km) = high risk
  const coastScore = Math.max(10, Math.min(100, (10 - sub.coastalDistanceKm) * 11));
  // Criticality & Redundancy (20%): Extreme = 100, High = 70, Moderate = 40
  const critScore = sub.criticality === "Extreme" ? 95 : (sub.criticality === "High" ? 70 : 40);

  const weightedTotal = Math.round(
    (floodScore * 0.35) +
    (windScore * 0.25) +
    (elevScore * 0.15) +
    (coastScore * 0.10) +
    (critScore * 0.15)
  );

  const riskScore = Math.min(99, Math.max(12, weightedTotal));

  let riskCategory: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  if (riskScore >= 75) riskCategory = "CRITICAL";
  else if (riskScore >= 50) riskCategory = "HIGH";
  else if (riskScore >= 25) riskCategory = "MODERATE";

  const recommendedAction = "Illustrative exposure calculation only. No utility switching decision is supported; obtain an authorized utility assessment.";

  return {
    floodDepthM,
    windExposureKts,
    elevationM: sub.elevationMeters,
    coastalDistanceKm: sub.coastalDistanceKm,
    backupCapacityHrs,
    riskScore,
    riskCategory,
    factorBreakdown: {
      floodFactor: Math.round(floodScore * 0.35),
      windFactor: Math.round(windScore * 0.25),
      elevationFactor: Math.round(elevScore * 0.15),
      coastalFactor: Math.round(coastScore * 0.10),
      criticalityFactor: Math.round(critScore * 0.15)
    },
    recommendedAction,
    scoringMethodology: "Parametric Multi-Attribute Utility Theory (MAUT) Fragility Model",
    is_heuristic_simulation: true,
    methodologyNotice: "Parametric decision-support simulation based on sigmoidal component fragility curves. Does not replace on-site physical SCADA relay telemetry."
  };
}

export interface RouteVulnerabilityAnalysis {
  floodDepthM: number;
  etaToInundationHrs: number;
  status: "SCENARIO_LOW" | "SCENARIO_MODERATE" | "SCENARIO_HIGH";
  observed_road_status: VerifiedAttribute<"OPEN" | "CLOSED" | "RESTRICTED" | "UNKNOWN">;
  scenario_road_risk: "LOW" | "MODERATE" | "HIGH";
  statusBadge: string;
  statusColor: string; // 🔵 blue, 🟠 orange, 🔴 red
  riskScore: number;
  alternativeRouteName: string;
  recommendedAction: string;
  scoringMethodology: string;
  is_heuristic_simulation: boolean;
  methodologyNotice: string;
}

export function calculateRouteVulnerability(
  route: EvacuationRoute,
  stormKnots: number = 85,
  surgeMeters: number = 2.8,
  rainMm: number = 220,
  roadObservation?: VerifiedAttribute<"OPEN" | "CLOSED" | "RESTRICTED" | "UNKNOWN">,
  now = Date.now()
): RouteVulnerabilityAnalysis {
  const isLowLying = route.elevationAvgM < 10;
  const floodDepthM = Number((isLowLying ? Math.max(0.6, (surgeMeters * 0.5) + (rainMm / 400)) : 0.2).toFixed(1));
  const etaToInundationHrs = isLowLying ? Math.max(1.5, Number((8.0 - (stormKnots / 20.0)).toFixed(1))) : 14.0;

  // Dynamic route risk score computed via non-linear logistic inundation function
  const rawRisk = Math.round((1.0 / (1.0 + Math.exp(-4.0 * (floodDepthM - 0.6)))) * 85 + (stormKnots / 140) * 15);
  const riskScore = Math.min(99, Math.max(15, rawRisk));

  const scenario_road_risk = floodDepthM >= 1.2 ? "HIGH" : floodDepthM >= 0.5 ? "MODERATE" : "LOW";
  const status = scenario_road_risk === "HIGH" ? "SCENARIO_HIGH" : scenario_road_risk === "MODERATE" ? "SCENARIO_MODERATE" : "SCENARIO_LOW";
  const statusBadge = `SIMULATED ${scenario_road_risk} EXPOSURE — ROAD STATUS UNKNOWN`;
  const statusColor = "#94a3b8";
  const alternativeRouteName = "No verified alternative route";
  const recommendedAction = "Scenario only. No travel or closure decision is supported; consult authorized road-condition updates.";

  return {
    floodDepthM,
    etaToInundationHrs,
    observed_road_status: currentObservation(roadObservation, now) != null ? roadObservation! : unavailable<"OPEN" | "CLOSED" | "RESTRICTED" | "UNKNOWN">("UNKNOWN"),
    scenario_road_risk,
    status,
    statusBadge,
    statusColor,
    riskScore,
    alternativeRouteName,
    recommendedAction,
    scoringMethodology: "Parametric Inundation-Terrain Multi-Criteria Evaluation (MCE)",
    is_heuristic_simulation: true,
    methodologyNotice: "Inundation lag and route risk are parametric hydrodynamic estimates. Confirm highway traffic gates with State Highway Police before dispatching convoys."
  };
}

export interface VerifiedAttribute<T> {
  value: T | null;
  source: string | null;
  verified_at: string | null;
  expires_at: string | null;
  verification_status: "VERIFIED" | "UNAVAILABLE" | "EXPIRED" | "SIMULATED";
  authorized: boolean;
}
export function unavailable<T>(value: T | null = null): VerifiedAttribute<T> {
  return {value, source:null, verified_at:null, expires_at:null, verification_status:"UNAVAILABLE", authorized:false};
}
export function currentObservation<T>(attribute?: VerifiedAttribute<T>, now = Date.now()): T | null {
  if (!attribute || !attribute.authorized || attribute.verification_status !== "VERIFIED" || !attribute.source) return null;
  const verified = Date.parse(attribute.verified_at ?? "");
  const expires = Date.parse(attribute.expires_at ?? "");
  return Number.isFinite(verified) && Number.isFinite(expires) && verified <= now && expires > now && expires > verified ? attribute.value : null;
}
export interface ShelterOperationalData {
  capacity: VerifiedAttribute<number>;
  occupancy: VerifiedAttribute<number>;
  medicalBeds: VerifiedAttribute<number>;
  road: VerifiedAttribute<"OPEN" | "RESTRICTED" | "BLOCKED">;
  generator: VerifiedAttribute<"OPERATIONAL" | "UNAVAILABLE">;
  destinationApproval: VerifiedAttribute<boolean>;
}
export interface ShelterScenarioSimulation {
  mode: "SCENARIO";
  assumedCapacity: number;
  assumedOccupancy: number;
  isRecommendedDestination: false;
}
export function simulateShelterScenario(capacity: number, occupancy: number): ShelterScenarioSimulation {
  if (!Number.isInteger(capacity) || !Number.isInteger(occupancy) || capacity < 0 || occupancy < 0 || occupancy > capacity) throw new Error("Invalid scenario counts");
  return {mode:"SCENARIO", assumedCapacity:capacity, assumedOccupancy:occupancy, isRecommendedDestination:false};
}
export function calculateShelterSuitability(
  _shelter: MedicalCycloneShelter, _stormKnots = 85, observations?: ShelterOperationalData, now = Date.now()
) {
  const count = (field?: VerifiedAttribute<number>) => {
    const value = currentObservation(field, now);
    return value != null && Number.isInteger(value) && value >= 0 ? value : null;
  };
  const capacity = count(observations?.capacity);
  const occupancy = count(observations?.occupancy);
  const currentOccupancy = capacity != null && occupancy != null && occupancy <= capacity ? occupancy : null;
  const availableCapacity = capacity != null && currentOccupancy != null ? capacity - currentOccupancy : null;
  const roadAccessStatus = currentObservation(observations?.road, now);
  const powerBackupStatus = currentObservation(observations?.generator, now);
  const medicalBeds = count(observations?.medicalBeds);
  const isRecommendedDestination = currentObservation(observations?.destinationApproval, now) === true &&
    availableCapacity != null && availableCapacity > 0 && roadAccessStatus === "OPEN" && powerBackupStatus === "OPERATIONAL" && medicalBeds != null;
  return {capacity, currentOccupancy, availableCapacity, medicalBeds,
    occupancyPercentage: capacity && currentOccupancy != null ? Math.round(currentOccupancy / capacity * 100) : null,
    roadAccessStatus, powerBackupStatus, isRecommendedDestination,
    observations: observations ?? null,
    decisionNote: isRecommendedDestination ? "Current authorized destination approval recorded; confirm with the issuing authority before travel." : "Operational status not verified",
    is_heuristic_simulation:false};
}

// Per-field provenance travels separately from illustrative numeric inputs.
export const INFRASTRUCTURE_FIELD_PROVENANCE = Object.fromEntries(
  [...POWER_SUBSTATIONS, ...EVACUATION_ROUTES, ...MEDICAL_SHELTERS].map(asset => [asset.id,
    Object.fromEntries(Object.keys(asset).map(field => [field, {
      source: "Illustrative scenario assumption", verified_at:null, expires_at:null,
      verification_status:"SIMULATED", authorized:false
    }]))
  ])
);
