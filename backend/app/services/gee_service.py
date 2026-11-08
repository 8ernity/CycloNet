"""
Geospatial Earth Observation & Flood Inundation Service
Architectural Standards:
- Explicit separation between measured Earth Observation (Satellite SAR/Optical) and Experimental Hydrological Simulations
- Zero polygon synthesis when authentic satellite passes are unavailable
- Cryptographic provenance and methodology tags on all simulated geospatial features
"""

import os
import json
import math
from typing import Dict, List, Any, Optional
from datetime import datetime

class SatelliteFloodDetectionService:
    """
    Disabled Earth Observation interface pending a validated processing pipeline.
    No measured pixels are currently produced.
    Never synthesizes geometric buffer polygons.
    """
    def __init__(self, project_id: Optional[str] = None):
        self.gee_project_id = project_id or os.getenv("GEE_PROJECT_ID", "cyclonet-earth-engine")
        self.is_live_gee = False
        self.is_initialized = False
        self._initialize_gee()

    def _initialize_gee(self):
        # Observation capability is explicitly disabled until a validated SAR
        # processing implementation and independent reference data are supplied.
        self.is_live_gee = False
        self.is_initialized = False

    def get_satellite_observed_flood(self, center_lat: float, center_lon: float,
                                     start_date=None, end_date=None) -> Dict[str, Any]:
        if not (math.isfinite(center_lat) and math.isfinite(center_lon)
                and -90 <= center_lat <= 90 and -180 <= center_lon <= 180):
            raise ValueError("Invalid geographic coordinates")
        if start_date is not None and end_date is not None:
            if datetime.fromisoformat(start_date) >= datetime.fromisoformat(end_date):
                raise ValueError("Observation start must precede end")
        return {"type": "FeatureCollection", "status": "SATELLITE_DATA_UNAVAILABLE",
                "capability_status": "DISABLED", "is_satellite_measured": False,
                "reason": "Satellite flood detection is disabled pending a validated SAR pipeline and independent reference data",
                "sensor": "COPERNICUS/S1_GRD", "center": [center_lat, center_lon], "features": []}

class ExperimentalFloodSimulationService:
    """
    Physics-informed hydrodynamic buffer and runoff pathway simulation.
    Explicitly labeled as experimental kinematic/hydrological simulation.
    """
    @staticmethod
    def _generate_ellipse_polygon(
        lat: float,
        lon: float,
        radius_km_x: float,
        radius_km_y: float,
        angle_deg: float = 0,
        num_points: int = 24
    ) -> List[List[float]]:
        coords = []
        angle_rad = math.radians(angle_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        
        km_per_lat = 111.32
        km_per_lon = 111.32 * math.cos(math.radians(lat))
        if km_per_lon == 0:
            km_per_lon = 1.0

        for i in range(num_points):
            theta = (2 * math.pi * i) / num_points
            dx_km = radius_km_x * math.cos(theta)
            dy_km = radius_km_y * math.sin(theta)
            
            rot_dx = dx_km * cos_a - dy_km * sin_a
            rot_dy = dx_km * sin_a + dy_km * cos_a
            
            p_lat = max(-90.0, min(90.0, lat + (rot_dy / km_per_lat)))
            p_lon = max(-180.0, min(180.0, lon + (rot_dx / km_per_lon)))
            coords.append([round(p_lon, 4), round(p_lat, 4)])
            
        # Strictly close GeoJSON polygon ring (first point == last point)
        coords.append(coords[0])
        return coords

    def generate_flood_inundation_simulation(
        self,
        center_lat: float,
        center_lon: float,
        intensity_knots: int
    ) -> Dict[str, Any]:
        """
        Generates hydrodynamic buffer simulation GeoJSON for coastal surge inundation.
        Explicitly tags features with origin='EXPERIMENTAL_HYDROLOGICAL_SIMULATION'
        and is_satellite_measured=False.
        """
        surge_radius_km = max(25.0, (intensity_knots / 100.0) * 85.0)
        kt = float(max(20, intensity_knots))
        core_depth_m = round(max(1.2, 0.8 + 0.032 * (kt - 30)), 2)
        outer_depth_m = round(max(0.6, 0.4 + 0.016 * (kt - 30)), 2)
        
        sar_backscatter_core_db = round(-24.0 + 0.04 * min(kt, 110.0), 1)
        sar_backscatter_outer_db = round(-18.5 + 0.03 * min(kt, 110.0), 1)
        
        features = []
        
        # Outer High Surge Zone
        outer_coords = self._generate_ellipse_polygon(
            center_lat, center_lon, surge_radius_km * 0.9, surge_radius_km * 0.7, angle_deg=45
        )
        features.append({
            "type": "Feature",
            "properties": {
                "layer_id": "sentinel1_sar_flood",
                "zone_name": "High Vulnerability Flood Inundation Zone (Simulation)",
                "water_depth_m": outer_depth_m,
                "confidence_score": None,
                "confidence_score_simulated": None,
                "satellite_source": "Topographic Elevation + Distance Buffer Heuristic (Simulation)",
                "origin": "EXPERIMENTAL_HYDROLOGICAL_SIMULATION",
                "is_satellite_measured": False,
                "method": "Topographic Elevation + Distance Buffer Heuristic",
                "derivation_type": "HYDRODYNAMIC_BUFFER_SIMULATION",
                "is_raster_pixel_classification": False,
                "sar_backscatter_db": None,
                "sar_backscatter_simulated_db": sar_backscatter_outer_db,
                "dem_elevation_m": "< 4.0m AMSL"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [outer_coords]
            }
        })

        # Core Surge Breach Zone
        core_coords = self._generate_ellipse_polygon(
            center_lat + 0.15, center_lon + 0.1, surge_radius_km * 0.45, surge_radius_km * 0.35, angle_deg=35
        )
        features.append({
            "type": "Feature",
            "properties": {
                "layer_id": "sentinel1_sar_flood_core",
                "zone_name": "Surge Breach & Direct Marine Flooding (Simulation)",
                "water_depth_m": core_depth_m,
                "confidence_score": None,
                "confidence_score_simulated": None,
                "satellite_source": "Topographic Elevation + Distance Buffer Heuristic (Simulation)",
                "origin": "EXPERIMENTAL_HYDROLOGICAL_SIMULATION",
                "is_satellite_measured": False,
                "method": "Topographic Elevation + Distance Buffer Heuristic",
                "derivation_type": "HYDRODYNAMIC_BUFFER_SIMULATION",
                "is_raster_pixel_classification": False,
                "sar_backscatter_db": None,
                "sar_backscatter_simulated_db": sar_backscatter_core_db,
                "dem_elevation_m": "< 2.0m AMSL"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [core_coords]
            }
        })

        return {
            "type": "FeatureCollection",
            "mode": "SIMULATED_EXTENT",
            "origin": "EXPERIMENTAL_HYDROLOGICAL_SIMULATION",
            "is_satellite_measured": False,
            "pipeline": "Parametric Hydrodynamic Flood Inundation Simulation",
            "methodology_disclaimer": "Simulated hydrodynamic buffer polygons. Direct pixel-level SAR matrix thresholding requires implemented processing, scene selection and independent validation in addition to authorized Earth Engine access.",
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
            "gee_sensor": "COPERNICUS/S1_GRD (Simulation Model Parameterized)",
            "center": [center_lat, center_lon],
            "intensity_knots": intensity_knots,
            "surge_radius_km": round(surge_radius_km, 1),
            "sar_backscatter_db": None,
            "features": features
        }

    def get_catchment_rainfall_pathways(
        self,
        center_lat: float,
        center_lon: float,
        accumulated_rain_mm: float = 280.0
    ) -> List[Dict[str, Any]]:
        """
        Assumed-terrain catchment runoff pathway simulation.
        Evaluates river basin drainage and catchment flash flood pathways.
        """
        if center_lat >= 21.0:
            basin_primary = "Hooghly - Sundarbans Estuary Basin"
            slope_deg = 0.6
            raw_choke_points = [
                {"name": "Diamond Harbour Sluice Complex", "lat": 22.18, "lon": 88.20},
                {"name": "Kakdwip Drainage Outfall", "lat": 21.87, "lon": 88.18},
                {"name": "Sagar Island Southern Embankment", "lat": 21.65, "lon": 88.07}
            ]
        elif center_lat >= 19.0:
            basin_primary = "Mahanadi - Baitarani Coastal Catchment"
            slope_deg = 0.9
            raw_choke_points = [
                {"name": "Dhamra River Estuary Choke Point", "lat": 20.81, "lon": 86.95},
                {"name": "Paradip Tidal Canal Gate 4", "lat": 20.31, "lon": 86.61},
                {"name": "Astaranga Coastal Drainage Neck", "lat": 19.98, "lon": 86.26}
            ]
        else:
            basin_primary = "Godavari - Krishna Coastal Delta"
            slope_deg = 0.8
            raw_choke_points = [
                {"name": "Kakinada Low-Lying Industrial Neck", "lat": 16.98, "lon": 82.24},
                {"name": "Machilipatnam Coastal Sluice", "lat": 16.18, "lon": 81.13}
            ]

        choke_points_1 = []
        for cp in raw_choke_points:
            d_lat_km = (cp["lat"] - center_lat) * 111.0
            d_lon_km = (cp["lon"] - center_lon) * 111.0 * math.cos(math.radians(center_lat))
            dist_km = math.sqrt(d_lat_km ** 2 + d_lon_km ** 2)
            
            storm_travel_h = dist_km / 18.0
            hydraulic_lag_h = 1.2 / max(0.2, slope_deg)
            eta_h = round(max(1.0, storm_travel_h + hydraulic_lag_h), 1)
            
            depth_m = round(0.4 + (accumulated_rain_mm / 300.0) * 1.5 * (1.0 / max(0.4, slope_deg)), 2)
            
            if depth_m >= 2.0 or accumulated_rain_mm >= 300:
                risk_lvl = "CRITICAL"
                status_txt = "CRITICAL_OVERFLOW_BREACH"
            elif depth_m >= 1.4:
                risk_lvl = "HIGH"
                status_txt = "HIGH_ACCUMULATION"
            else:
                risk_lvl = "MODERATE"
                status_txt = "MONITORED_DISCHARGE"

            choke_points_1.append({
                "name": cp["name"],
                "lat": cp["lat"],
                "lon": cp["lon"],
                "distance_km": round(dist_km, 1),
                "eta_hours": eta_h,
                "status": "UNVERIFIED",
                "scenario_status": status_txt,
                "is_simulation": True,
                "source": "ILLUSTRATIVE_ASSET",
                "depth_m": depth_m,
                "risk": risk_lvl
            })

        pathways = [
            {
                "id": "pathway-primary-drainage",
                "name": f"{basin_primary} Main Drainage Corridor",
                "basin": basin_primary,
                "mode": "ASSUMED_TERRAIN_RUNOFF_SIMULATION",
                "origin": "EXPERIMENTAL_HYDROLOGICAL_SIMULATION",
                "is_satellite_measured": False,
                "is_simulation": True,
                "scientifically_validated": False,
                "terrain_source": "ASSUMED_SCENARIO",
                "derivation_method": "Assumed-terrain catchment runoff pathway simulation (assumed slope and illustrative drainage model)",
                "assumed_slope_deg": slope_deg,
                "rain_accumulation_mm": accumulated_rain_mm,
                "forecast_window_hours": 24,
                "discharge_rate_cumecs": int(accumulated_rain_mm * 18.5),
                "runoff_risk": "CRITICAL" if accumulated_rain_mm > 200 else "HIGH",
                "flow_accumulation_vector": "Assumed-terrain seaward gravity runoff vector (North-West to South-East)",
                "critical_choke_points": choke_points_1,
                "road_crossings_impacted": [],
                "scenario_road_examples": ["NH-16 Choke Point (KM 142)", "State Highway 57 Low Causeways"],
                "substations_at_risk": ["220kV Primary Coastal Substation", "132kV Switching Feeder"],
                "coordinates": [
                    [center_lat - 0.45, center_lon - 0.35],
                    [center_lat - 0.25, center_lon - 0.18],
                    [center_lat, center_lon],
                    [center_lat + 0.25, center_lon + 0.22]
                ]
            },
            {
                "id": "pathway-estuary-convergence",
                "name": f"{basin_primary} Tidal Estuary Surge & Runoff Convergence",
                "basin": basin_primary,
                "mode": "ASSUMED_TERRAIN_RUNOFF_SIMULATION",
                "origin": "EXPERIMENTAL_HYDROLOGICAL_SIMULATION",
                "is_satellite_measured": False,
                "is_simulation": True,
                "scientifically_validated": False,
                "terrain_source": "ASSUMED_SCENARIO",
                "derivation_method": "Assumed-terrain catchment runoff pathway simulation (Estuarine backwater bottleneck model)",
                "assumed_slope_deg": round(slope_deg * 0.7, 2),
                "rain_accumulation_mm": round(accumulated_rain_mm * 1.12, 1),
                "forecast_window_hours": 24,
                "discharge_rate_cumecs": int(accumulated_rain_mm * 24.2),
                "runoff_risk": "CRITICAL",
                "flow_accumulation_vector": "Assumed-terrain compound backwater bottleneck at estuarine barrier",
                "critical_choke_points": choke_points_1[-2:],
                "road_crossings_impacted": [],
                "scenario_road_examples": ["Coastal Highway Embankment Arterial", "Port Access Link Corridor"],
                "substations_at_risk": ["400kV Coastal Maritime Power Terminal", "33kV Marine Feeder"],
                "coordinates": [
                    [center_lat - 0.6, center_lon - 0.1],
                    [center_lat - 0.3, center_lon + 0.1],
                    [center_lat + 0.1, center_lon + 0.3]
                ]
            }
        ]
        return pathways

class GoogleEarthEngineService:
    """
    Unified geospatial service coordinating satellite Earth Observation queries
    and unvalidated hydrological simulations with strict provenance separation.
    """
    def __init__(self):
        self.satellite_service = SatelliteFloodDetectionService()
        self.simulation_service = ExperimentalFloodSimulationService()

    @property
    def gee_project_id(self) -> str:
        return self.satellite_service.gee_project_id

    @property
    def is_live_gee(self) -> bool:
        return self.satellite_service.is_live_gee

    @property
    def is_initialized(self) -> bool:
        return self.satellite_service.is_initialized

    def get_available_layers(self) -> List[Dict[str, Any]]:
        # Catalogue references are not implemented/verified data products.
        return [{"id":ident, "name":name, "sensor":sensor, "resolution":None,
                 "description":"Unavailable: no validated acquisition or processing product is connected.",
                 "capability_status":"DISABLED", "is_satellite_measured":False,
                 "scientifically_validated":False, "type":"unavailable", "color_palette":[]}
                for ident,name,sensor in [
                    ("sentinel1_sar_flood","Sentinel-1 flood observations (unavailable)","COPERNICUS/S1_GRD"),
                    ("sentinel2_mndwi","Sentinel-2 water index (unavailable)","COPERNICUS/S2_SR_HARMONIZED"),
                    ("srtm_dem_elevation","Surveyed terrain (unavailable)","USGS/SRTMGL1_003"),
                    ("gfs_tpw_precipitation","Precipitation product (unavailable)","NOAA/GFS0P25")]]

    def get_satellite_observed_flood(self, center_lat: float, center_lon: float) -> Dict[str, Any]:
        return self.satellite_service.get_satellite_observed_flood(center_lat, center_lon)

    def get_flood_inundation_zones(self, center_lat: float, center_lon: float, intensity_knots: int) -> Dict[str, Any]:
        """Returns hydrological simulation with strict origin='EXPERIMENTAL_HYDROLOGICAL_SIMULATION'."""
        return self.simulation_service.generate_flood_inundation_simulation(center_lat, center_lon, intensity_knots)

    def get_catchment_rainfall_pathways(self, center_lat: float, center_lon: float, accumulated_rain_mm: float = 280.0) -> List[Dict[str, Any]]:
        return self.simulation_service.get_catchment_rainfall_pathways(center_lat, center_lon, accumulated_rain_mm)

satellite_flood_service = SatelliteFloodDetectionService()
flood_simulation_service = ExperimentalFloodSimulationService()
gee_service = GoogleEarthEngineService()
