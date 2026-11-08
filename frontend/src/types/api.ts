export type Provenance = "LIVE_OBSERVATION" | "OFFICIAL_FORECAST" | "HISTORICAL_ARCHIVE" | "EXPERIMENTAL_FORECAST" | "DEMO_SIMULATION" | "UNKNOWN";
export interface TrackPoint {
  provenance?: Provenance;
  lat: number; lon: number; time_offset_hours: number; category: string;
  intensity_knots: number | null; is_forecast: boolean; is_landfall?: boolean;
  is_observed?: boolean; origin_type?: string; label?: string;
}
export interface LandfallInfo {
  status?: string; landfall_time_utc?: string; landfall_location?: string;
  landfall_intensity_knots?: number; landfall_intensity_kmph?: number;
  landfall_gusts_kmph?: number; landfall_category?: string; central_pressure_hpa?: number;
  storm_surge_m?: string; inland_decay?: string; impact_sector?: string;
}
export interface CatalogItem {
  id: string; name: string; basin?: string; max_category?: string; maxCategory?: string;
  category?: string; knots?: number | null; dates?: string; year?: string; is_simulation?: boolean;
}
export interface IngestStatus {
  basin_status?: string;
  status: string; last_sync: string | null; is_syncing: boolean;
  active_systems_count: number; sources_status: Record<string, string>; last_error?: string;
}
export interface Classification {
  is_cyclone: boolean | null; category: string; category_short?: string; confidence: number;
  dvorak_t?: string | null; wind_speed_knots?: number | null;
  checkpoint_status?: string; is_trained_weights?: boolean; is_offline_preset?: boolean;
  is_uncalibrated_demo?: boolean; model_architecture?: string; overlay_url?: string | null;
  gradcam_data_url?: string | null; probabilities?: Record<string, number>; warning?: string;
  scientifically_validated?: boolean; model_type?: string; is_reliable?: boolean; operational_status?: string;
}
export interface VisionAnalysis {
  category: string; dvorak_t_number?: string; estimated_knots?: number;
  eye_characterization?: string; convective_signature?: string; recommended_actions?: string[];
}
export interface SurgeCalculation {
  inland_penetration_km: number; inverted_barometer_m: number; peak_surge_height_m: number;
  severity_level: string; wind_setup_m: number;
}
export interface SurgeSector {
  sector_name: string; estimated_surge_m: number; inundation_depth_m: number; offset_km: number;
  sector: string; direction: string; surge_height_m: number; peak_surge_m: number;
  risk_level: string; risk_rating: string; critical_assets: string[];
  inundation_km: number; wave_height_m: number; name: string;
}
export interface RainfallPathway {
  id: string; name: string; basin: string; assumed_slope_deg: number; discharge_rate_cumecs: number;
  critical_choke_points: { name: string; status: string; depth_m: number; eta_hours: number }[];
}
export interface Briefing { executive_summary: string; action_checklist: string[]; }
export interface DispatchResult {
  dispatch_id: string; cap_xml: string; sms_payload: Record<string, string | null>;
  sachet_payload: Record<string, unknown>; siren_payload: Record<string, unknown>;
  vhf_payload: string; municipal_briefing: string[];
}
export interface DispatchReceipt { dispatch_id: string; message_payload: string; timestamp: string; }
export interface ChartPoint {
  timeOffset: number; timeLabel?: string; intensity: number | null; kmh: number | null;
  category: string; lat: number; lon: number; isForecast: boolean; isLandfall?: boolean;
  lowerBound: number | null; upperBound: number | null; label?: string;
}
export function errorMessage(value: unknown): string { return value instanceof Error ? value.message : 'Request failed'; }

export interface WeatherSystem {
  id:string; name:string; basin:string; lat:number; lon:number; category:string;
  intensity_knots:number|null; track_forecast:TrackPoint[];
  provenance?:Provenance; source?:string|null; source_type?:string; origin_type?:string;
  source_url?:string|null; observation_time_utc?:string|null; retrieved_at?:string|null;
  central_pressure_hpa?:number|null; gusts_kmh?:number|null;
  wind_convention?:string|null;
  movement_speed_kmph?:number|null; movement_speed_raw?:number|null; movement_speed_source_unit?:string|null;
  is_simulation?:boolean; is_stale?:boolean; is_live_telemetry?:boolean; year?:string;
  reconciliation_status?:string; telemetry_badge?:string; telemetry_type?:string;
  dvorak_t?:string; dvorak_derivation_method?:string; dvorak_is_empirical_estimate?:boolean;
  track_generation_method?:string; telemetry_attribution?:Record<string,string>;
  landfall_info?:LandfallInfo; is_landfall_completed?:boolean;
}
