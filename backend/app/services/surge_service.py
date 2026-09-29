import math
from typing import Dict, List, Any, Optional
from datetime import datetime

class HydrodynamicSurgeService:
    """
    Parametric Hydrodynamic Storm Surge & Compound Flooding Simulator.
    Implements a parametric hydrodynamic formulation (Jelesnianski formulation)
    superimposing inverted barometer effect, wind setup on shallow
    continental shelf bathymetry, and astronomical tidal phase.
    """

    def calculate_surge(
        self,
        intensity_knots: float,
        central_pressure_hpa: float,
        forward_speed_kmh: float = 18.0,
        approach_angle_deg: float = 75.0,
        astronomical_tide_m: float = 1.2,
        basin: str = "Bay of Bengal"
    ) -> Dict[str, Any]:
        """
        Calculates peak surge height, inland flood penetration, and coastal risk metrics.
        """
        # 1. Inverted Barometer Effect: ~1.0 cm per 1 hPa pressure deficit below standard 1013 hPa
        ambient_pressure = 1013.25
        delta_p = max(0.0, ambient_pressure - central_pressure_hpa)
        inverted_barometer_surge_m = delta_p * 0.01  # e.g. 60 hPa * 0.01 = 0.6m

        # 2. Wind Setup on Shallow Shelf:
        # Bay of Bengal has extreme shallow continental shelf bathymetry (~1.4x multiplier vs Arabian Sea)
        shelf_factor = 1.45 if "bengal" in basin.lower() else 1.10
        
        # Wind stress proportional to V^2
        v_knots = max(20.0, float(intensity_knots))
        wind_surge_m = 0.00018 * (v_knots ** 1.95) * shelf_factor * math.cos(math.radians(max(0, 90 - approach_angle_deg)))

        # 3. Forward speed resonance factor
        speed_factor = 1.0 + (min(35.0, forward_speed_kmh) / 120.0)

        # 4. Total Peak Storm Surge
        raw_meteorological_surge = (inverted_barometer_surge_m + wind_surge_m) * speed_factor
        total_peak_surge_m = round(raw_meteorological_surge + astronomical_tide_m, 2)

        # 5. Inland Inundation Extent (km) based on 30m DEM slope (avg 0.8m per km in coastal delta)
        coastal_slope_m_per_km = 0.75 if "bengal" in basin.lower() else 1.6
        inland_penetration_km = round(max(0.4, (total_peak_surge_m - 0.5) / coastal_slope_m_per_km), 2)

        # 6. Categorization
        if total_peak_surge_m >= 4.5:
            severity = "CATASTROPHIC_INUNDATION"
            color = "#ef4444"
            warning = "Complete inundation of coastal barrier islands and embankment breach across 5km belt."
        elif total_peak_surge_m >= 3.0:
            severity = "SEVERE_SURGE"
            color = "#f97316"
            warning = "Overtopping of saline embankments, submergence of 400kV substations and NH coastal links."
        elif total_peak_surge_m >= 1.5:
            severity = "MODERATE_SURGE"
            color = "#eab308"
            warning = "Localized coastal flooding in low-lying creeks, estuaries, and beachfront settlements."
        else:
            severity = "MINOR_SURGE"
            color = "#10b981"
            warning = "Low tidal surge within normal high-water mark; minimal structural threat."

        return {
            "peak_surge_height_m": total_peak_surge_m,
            "meteorological_surge_m": round(raw_meteorological_surge, 2),
            "astronomical_tide_m": astronomical_tide_m,
            "inverted_barometer_m": round(inverted_barometer_surge_m, 2),
            "wind_setup_m": round(wind_surge_m, 2),
            "inland_penetration_km": inland_penetration_km,
            "severity_level": severity,
            "color_hex": color,
            "warning_advisory": warning,
            "bathymetry_shelf_factor": shelf_factor,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        }

    def generate_coastal_surge_profile(self, cyclone_name: str, lat: float, lon: float, intensity_knots: int) -> List[Dict[str, Any]]:
        """Generates coastal sector vulnerability breakdown along the coastline."""
        pres = max(910, 1010 - int(intensity_knots * 0.75))
        surge_calc = self.calculate_surge(intensity_knots, pres, basin="Bay of Bengal" if lon > 80 else "Arabian Sea")
        peak = surge_calc["peak_surge_height_m"]

        sectors = [
            {
                "sector_name": "Landfall Epicenter & Right Forward Quadrant",
                "offset_km": "+25km Northeast",
                "estimated_surge_m": peak,
                "inundation_depth_m": f"{peak - 0.5:.1f}m - {peak:.1f}m",
                "risk_rating": "EXTREME",
                "critical_assets": ["Primary Port Terminal", "400kV Feeder Substation", "Coastal Evacuation Artery"]
            },
            {
                "sector_name": "Left Forward Quadrant (Offshore Wind Sector)",
                "offset_km": "-35km Southwest",
                "estimated_surge_m": max(0.8, round(peak * 0.55, 2)),
                "inundation_depth_m": f"{max(0.4, peak * 0.4):.1f}m - {peak * 0.55:.1f}m",
                "risk_rating": "HIGH",
                "critical_assets": ["Fishing Harbors", "220kV Secondary Grid", "Salt Pan Embankments"]
            },
            {
                "sector_name": "Estuarine / River Confluence Zone",
                "offset_km": "+60km North-East",
                "estimated_surge_m": max(1.2, round(peak * 0.85, 2)),
                "inundation_depth_m": f"{peak * 0.7:.1f}m - {peak * 0.85:.1f}m",
                "risk_rating": "CRITICAL",
                "critical_assets": ["Bridge Abutments", "Municipal Water Treatment Plant", "Rural Cyclone Shelters"]
            }
        ]
        return sectors

surge_service = HydrodynamicSurgeService()
