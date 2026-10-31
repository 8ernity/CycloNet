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
        # 1. Inverted Barometer Effect (Static pressure response):
        # 1 hPa deficit ~ 0.0101 m static water rise: S_p = (P_ambient - P_c) / (rho_w * g)
        ambient_pressure = 1013.25
        delta_p = max(0.0, ambient_pressure - central_pressure_hpa)
        inverted_barometer_surge_m = delta_p * 0.0101  # e.g. 60 hPa * 0.0101 = 0.606m

        # 2. Wind Setup on Shallow Continental Shelf:
        # Implements steady-state shallow-water momentum balance: dS/dx = tau_w / (rho_w * g * h)
        # Garratt drag coefficient formulation: C_d = (0.75 + 0.067 * U_10) * 1e-3 capped at 0.003
        v_knots = max(20.0, float(intensity_knots))
        u10_ms = v_knots * 0.514444  # convert knots to m/s
        cd = min(0.0032, (0.75 + 0.067 * u10_ms) * 1e-3)
        rho_air = 1.225  # kg/m^3
        rho_water = 1025.0  # sea water kg/m^3
        gravity = 9.80665  # m/s^2
        tau_w = rho_air * cd * (u10_ms ** 2)

        # Continental shelf dimensions (Bay of Bengal has wide, gentle shelf ~160km vs Arabian Sea ~75km)
        is_bob = "bengal" in basin.lower()
        shelf_width_m = 165000.0 if is_bob else 75000.0
        avg_shelf_depth_m = 35.0 if is_bob else 55.0
        
        # Angle of approach attenuation: maximum surge occurs when onshore wind aligns normal to coast
        approach_rad = math.radians(max(15.0, min(90.0, approach_angle_deg)))
        angle_factor = math.sin(approach_rad)

        # Analytical wind setup: S_w = (tau_w * L) / (rho_w * g * h_bar) * angle_factor
        wind_surge_m = (tau_w * shelf_width_m) / (rho_water * gravity * avg_shelf_depth_m) * angle_factor

        # 3. Forward Speed Resonance Multiplier (Jelesnianski shallow-water wave resonance)
        c_wave = math.sqrt(gravity * avg_shelf_depth_m) * 3.6  # shallow wave phase speed in km/h (~66-83 km/h)
        speed_factor = 1.0 + 0.5 * (min(45.0, forward_speed_kmh) / c_wave)

        # 4. Total Peak Storm Surge
        raw_meteorological_surge = (inverted_barometer_surge_m + wind_surge_m) * speed_factor
        total_peak_surge_m = round(raw_meteorological_surge + astronomical_tide_m, 2)

        # 5. Inland Inundation Extent (km) based on 30m DEM coastal slope
        coastal_slope_m_per_km = 0.70 if is_bob else 1.55
        inland_penetration_km = round(max(0.4, (total_peak_surge_m - 0.4) / coastal_slope_m_per_km), 2)

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
            "bathymetry_shelf_width_km": round(shelf_width_m / 1000.0, 1),
            "bathymetry_avg_depth_m": avg_shelf_depth_m,
            "solver_architecture": "1D_PARAMETRIC_JELESNIANSKI_DEAN_ANALYTICAL_MODEL",
            "is_2d_mesh_hydrodynamic": False,
            "operational_disclaimer": "Analytical 1D shallow-shelf integration. For site-specific coastal engineering, full 2D unstructured mesh solvers (ADCIRC / SLOSH / Delft3D) are recommended.",
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
