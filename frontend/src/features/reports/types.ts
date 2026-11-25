export interface Bulletin {
  id: string;
  number: number;
  title: string;
  timestamp_utc: string;
  timestamp_ist: string;
  category: string;
  intensity_knots: number | null;
  intensity_kmh: number;
  gusts_kmh: number;
  central_pressure_hpa: number;
  storm_surge_meters: number;
  wave_height_meters: number;
  alert_level: string;
  stage: string;
  full_text: string;
  is_latest: boolean;
}

export interface AffectedDistrict {
  district: string;
  risk: string;
  state: string;
  shelters: string;
  evacuation: string;
}

export interface PortSignal {
  signal: string;
  meaning: string;
}

export interface ReportCatalogItem {
  id: string;
  name: string;
  category: string;
}

export interface AlertSummary {
  level: "DATA_UNAVAILABLE" | "RED" | "ORANGE" | "YELLOW" | "GREEN";
  title: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}
