"""Simulation fixtures and diagnostic Dvorak attribution helpers for ingestion."""

import datetime
from typing import Any, Dict

from app.services.cyclone_classification import derive_empirical_dvorak_t


def get_default_active_bob_system() -> Dict[str, Any]:
    """Return synthetic demonstration telemetry for Deep Depression BOB-05."""
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    synoptic_hour = (now_utc.hour // 6) * 6
    base_time = now_utc.replace(hour=synoptic_hour, minute=0, second=0, microsecond=0)

    def make_live_label(offset_h: int, knots: int, cat: str, desc: str) -> str:
        pt_time = base_time + datetime.timedelta(hours=offset_h)
        cat_l = cat.lower()
        abbr = "DD" if "deep" in cat_l else ("D" if "depression" in cat_l else ("WML" if "low" in cat_l else "CS"))
        return f"{pt_time.day:02d}/{pt_time.hour:02d},{knots}KT,{abbr} ({desc})"

    return {
        "id": "BOB05-2026",
        "name": "Deep Depression (BOB-05)",
        "basin": "Bay of Bengal",
        "source": "CycloNet synthetic demonstration fixture",
        "is_simulation": True,
        "data_state": "DEMONSTRATION_PRESET",
        "is_live_telemetry": False,
        "is_measured_observation": False,
        "wind_convention": "3_MIN_SUSTAINED",
        "data_quality_status": "CALIBRATED_SIMULATION",
        "telemetry_badge": "SIMULATION / MODEL BASELINE",
        "telemetry_type": "SIMULATION",
        "dvorak_derivation_method": "Parametric Wind-Speed Scale (Baseline Model)",
        "dvorak_is_empirical_estimate": True,
        "track_generation_method": "Hydrodynamic Baseline Simulation Track",
        "telemetry_attribution": {
            "center_fix": "SIMULATED_BASELINE",
            "intensity_knots": "SIMULATED_BASELINE",
            "dvorak_t": "PARAMETRIC_ESTIMATE",
            "trajectory_forecast": "BASELINE_SIMULATION_TRACK",
            "satellite_image_dvorak": "AVAILABLE_IN_CLASSIFICATION_TAB",
        },
        "category": "Deep Depression",
        "intensity_knots": 35,
        "lat": 18.1,
        "lon": 83.7,
        "central_pressure_hpa": 996,
        "movement_speed_kmph": 15,
        "movement_direction": "WNW",
        "dvorak_t": "T2.5",
        "track_forecast": [
            {"lat": 16.2, "lon": 87.1, "time_offset_hours": -48, "category": "Depression", "intensity_knots": 25, "is_forecast": False, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(-48, 25, "Depression", "Genesis in Central BoB")},
            {"lat": 17.0, "lon": 86.2, "time_offset_hours": -24, "category": "Deep Depression", "intensity_knots": 30, "is_forecast": False, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(-24, 30, "Deep Depression", "Intensification in West-Central BoB")},
            {"lat": 17.8, "lon": 85.2, "time_offset_hours": -12, "category": "Deep Depression", "intensity_knots": 35, "is_forecast": False, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(-12, 35, "Deep Depression", "Approach to Coast")},
            {"lat": 18.1, "lon": 83.7, "time_offset_hours": 0, "category": "Deep Depression", "intensity_knots": 35, "is_forecast": False, "is_observed": False, "origin_type": "SIMULATION_CENTER_FIX", "label": make_live_label(0, 35, "Deep Depression", "Simulation Center - Coastal Crossing near Kalingapatnam")},
            {"lat": 19.2, "lon": 82.8, "time_offset_hours": 12, "category": "Depression", "intensity_knots": 25, "is_forecast": True, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(12, 25, "Depression", "Inland over South Odisha / North AP")},
            {"lat": 20.5, "lon": 81.5, "time_offset_hours": 24, "category": "Well Marked Low", "intensity_knots": 18, "is_forecast": True, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(24, 18, "Well Marked Low", "Dissipation over Chhattisgarh")},
        ],
    }


def calibrate_system_telemetry(system: Dict[str, Any]) -> None:
    """Attach diagnostic Dvorak CI estimate, provenance stamps, and 0h fallback point."""
    knots = system.get("intensity_knots")
    dvorak_t, dvorak_derivation_method, dvorak_is_empirical = derive_empirical_dvorak_t(knots)

    system["dvorak_t"] = dvorak_t
    system["dvorak_derivation_method"] = dvorak_derivation_method
    system["dvorak_is_empirical_estimate"] = dvorak_is_empirical

    has_forecast = any(point.get("is_forecast") for point in system.get("track_forecast", []))
    if has_forecast:
        system.setdefault("track_generation_method", "Supplied track; generation method unverified")
    else:
        system["track_generation_method"] = (
            "Simulation center fix only; forecast unavailable"
            if system.get("is_simulation")
            else "Source center fix only; forecast unavailable"
        )

    provenance = "SIMULATION" if system.get("is_simulation") else "OBSERVED_FEED"
    system["telemetry_attribution"] = {
        "center_fix": provenance,
        "intensity_knots": provenance if knots is not None else "UNAVAILABLE",
        "dvorak_t": "PARAMETRIC_ESTIMATE" if knots is not None else "UNAVAILABLE",
        "trajectory_forecast": "UNAVAILABLE" if not has_forecast else system["track_generation_method"],
        "track_accuracy_claim": "UNVERIFIED_EXPERIMENTAL_LAYER",
        "satellite_image_dvorak": "AVAILABLE_IN_CLASSIFICATION_TAB",
    }

    if not system.get("track_forecast"):
        system["track_generation_method"] = (
            "Simulation center fix only; forecast unavailable"
            if system.get("is_simulation")
            else "Source center fix only; forecast unavailable"
        )
        wind_label = f"{knots} KT" if knots is not None else "Not available"
        obs_time = system.get("observation_time_utc") or "Not available"
        system["track_forecast"] = [
            {
                "lat": system["lat"],
                "lon": system["lon"],
                "time_offset_hours": 0,
                "category": system["category"],
                "intensity_knots": knots,
                "is_forecast": False,
                "is_observed": not system.get("is_simulation", False),
                "method": "SIMULATION" if system.get("is_simulation") else "OFFICIAL_OBSERVATION",
                "origin_type": "SIMULATION_CENTER_FIX" if system.get("is_simulation") else "OBSERVED_CENTER_FIX",
                "label": f"Wind: {wind_label}; source time: {obs_time}",
                "issue_time_utc": system.get("observation_time_utc"),
                "source": system.get("source"),
            }
        ]


def build_demo_injection_system(
    name: str,
    basin: str,
    category: str,
    knots: int,
    now_utc: datetime.datetime,
) -> Dict[str, Any]:
    """Construct a labeled synthetic drill cyclone record."""
    return {
        "id": f"SIM-DEMO-{name.upper()}",
        "name": f"Cyclone {name} (Demo)",
        "basin": basin,
        "source": "Simulation Sandbox (Demo Injection)",
        "is_simulation": True,
        "source_type": "DEMO",
        "origin_type": "OPERATIONAL_DRILL",
        "telemetry_badge": "SIMULATED / DRILL EXERCISE",
        "telemetry_type": "SIMULATION",
        "category": category,
        "intensity_knots": knots,
        "lat": 15.4 if basin == "Bay of Bengal" else 18.2,
        "lon": 87.8 if basin == "Bay of Bengal" else 66.5,
        "central_pressure_hpa": 974,
        "movement_speed_kmph": 18,
        "movement_direction": "NNW",
        "created_at_utc": now_utc.isoformat() + "Z",
        "expires_at_utc": (now_utc + datetime.timedelta(hours=4)).isoformat() + "Z",
    }
