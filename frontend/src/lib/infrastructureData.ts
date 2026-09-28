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
  totalPoolFunded: string;
}

// ── Realistic Coastal Critical Infrastructure Dataset (NIO / BoB / Arabian Sea) ──

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
    region: "Andhra Pradesh"
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
    region: "Andhra Pradesh"
  },
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
    region: "Odisha"
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
    region: "Odisha"
  },
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
    region: "West Bengal"
  },
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
    region: "Gujarat"
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
    region: "Gujarat"
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
    totalPoolFunded: "₹250 Crore / $30M USD"
  },
  {
    tier: "Tier 2 (Severe Storm)",
    windThresholdKnots: 64,
    surgeThresholdMeters: 2.0,
    payoutPercentage: 70,
    disbursementWindow: "Pre-Landfall T-12h (Anticipatory Emergency Transfer)",
    targetBeneficiaries: "Municipal Hardening, Coastal Power Utility Restoration & Shelter Food Banks",
    totalPoolFunded: "₹140 Crore / $17M USD"
  },
  {
    tier: "Tier 3 (Moderate Wind)",
    windThresholdKnots: 48,
    surgeThresholdMeters: 1.0,
    payoutPercentage: 35,
    disbursementWindow: "Post-Event T+24h (Automated Satellite Index Payout)",
    targetBeneficiaries: "Fishermen Livelihood Compensation & Rural Drainage Clearing",
    totalPoolFunded: "₹65 Crore / $8M USD"
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
