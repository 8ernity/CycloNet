"""Cyclone track catalog lookup and trajectory formatting service."""

import re
from typing import Any, Dict, List, Optional, Tuple

from app.data.historical_tracks import IMD_ABBR, REAL_CYCLONE_TRACKS
from app.services.cyclone_classification import classify_imd_category_from_knots

_STORM_PREFIX_PATTERN = re.compile(
    r"^(?:super cyclonic storm|extremely severe cyclonic storm|very severe cyclonic storm|"
    r"severe cyclonic storm|cyclonic storm|deep depression|depression|super cyclone|cyclone)\b",
    re.IGNORECASE,
)


def _normalize_storm_name(name: Optional[str]) -> str:
    if not name or not name.strip():
        return ""
    cleaned = name.strip().lower()
    while True:
        updated = _STORM_PREFIX_PATTERN.sub("", cleaned).strip(" :-_()[]\"'")
        if updated == cleaned:
            break
        cleaned = updated
    return cleaned


def _lookup_track(cyclone_id: str, name: Optional[str]) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Resolve a track strictly by ID first, then by exact or unique token name match."""
    if cyclone_id and cyclone_id in REAL_CYCLONE_TRACKS:
        return cyclone_id, REAL_CYCLONE_TRACKS[cyclone_id]

    target_norm = _normalize_storm_name(name)
    if not target_norm:
        return cyclone_id, None

    exact_matches = [
        (k, v)
        for k, v in REAL_CYCLONE_TRACKS.items()
        if _normalize_storm_name(v.get("name")) == target_norm
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]

    # Allow whole-word matching only for multi-character specific names; skip ambiguous hits.
    if len(target_norm) >= 3:
        token_pattern = re.compile(rf"\b{re.escape(target_norm)}\b", re.IGNORECASE)
        token_matches = [
            (k, v)
            for k, v in REAL_CYCLONE_TRACKS.items()
            if token_pattern.search(_normalize_storm_name(v.get("name")))
        ]
        if len(token_matches) == 1:
            return token_matches[0]

    return cyclone_id, None


def format_cyclone_display_name(name: str) -> str:
    """
    Format meteorological system display names cleanly without duplicate prefixes.
    e.g. 'Deep Depression (BOB-05)' -> 'Deep Depression (BOB-05)'
         'Amphan' -> 'Cyclone Amphan'
    """
    if not name:
        return ""
    cleaned = name.strip()
    lower = cleaned.lower()
    if (
        lower.startswith("cyclone")
        or lower.startswith("super cyclone")
        or "depression" in lower
        or "low" in lower
    ):
        return cleaned
    return f"Cyclone {cleaned}"


def _derive_landfall_info(data: Dict[str, Any], formatted_points: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive structured landfall metadata for catalog storms without pre-configured summaries."""
    peak_knots = data.get("peak_knots", 45)
    category = data.get("category", "Cyclonic Storm")
    basin = data.get("basin", "Bay of Bengal")
    is_bob = "bengal" in basin.lower() or "bob" in basin.lower()

    landfall_pt = next((p for p in formatted_points if p.get("is_landfall")), None)
    if not landfall_pt:
        landfall_pt = formatted_points[min(len(formatted_points) - 1, max(0, len(formatted_points) // 2))]

    knots = landfall_pt.get("intensity_knots", peak_knots)
    kmph = int(knots * 1.852)
    gusts = int(kmph * 1.25)
    loc = "Odisha / Andhra Pradesh Coast" if is_bob else "Gujarat / Saurashtra Coast"

    return {
        "status": "Landfall Completed",
        "landfall_time_utc": "Track Landfall Crossing",
        "landfall_location": loc,
        "landfall_intensity_knots": knots,
        "landfall_intensity_kmph": kmph,
        "landfall_gusts_kmph": gusts,
        "landfall_category": landfall_pt.get("category", category),
        "central_pressure_hpa": 980 if knots > 60 else 995,
        "storm_surge_m": "1.5 - 2.5m" if knots > 60 else "0.5 - 1.0m",
        "inland_decay": "Weakened over inland sector into Depression",
        "impact_sector": loc,
    }


def get_cyclone_trajectory(cyclone_id: str, name: str, basin: str, category: str) -> Dict[str, Any]:
    """
    Return curated catalog tracks or an explicitly labeled illustrative scenario.
    Embedded demonstration entries retain their simulation provenance.
    """
    resolved_id, data = _lookup_track(cyclone_id, name)
    if not data:
        return _generate_curved_meteorological_track(cyclone_id, name, basin, category)

    peak_idx = data.get("peak_index", 0)
    peak_pt = data["points"][peak_idx]
    is_active = data.get("is_active", False)
    simulation = data.get("is_simulation", False)

    formatted_points = []
    for i, pt in enumerate(data["points"]):
        # Historical points occurring after peak intensity are NOT forecasts (DATA-04)
        is_fc = (i > peak_idx) if is_active else pt.get("is_forecast", False)
        is_obs = not is_fc and not simulation
        offset_h = pt.get("time_offset_hours", 0)
        abbr = IMD_ABBR.get(pt.get("category", ""), "CS")
        desc = pt.get("desc", "")
        is_landfall = pt.get("is_landfall", False)

        label = pt.get("label")
        if not label:
            day = max(1, 15 + int(offset_h // 24))
            hour = int((6 + offset_h) % 24)
            suffix = f" ({desc})" if desc else (" (Landfall Crossing)" if is_landfall else "")
            label = f"{day:02d}/{hour:02d},{pt['intensity_knots']}KT,{abbr}{suffix}"

        origin_type = (
            "SIMULATION_WAYPOINT"
            if simulation
            else ("HISTORICAL_OBSERVATION" if is_obs else "OFFICIAL_FORECAST_TRACK")
        )
        formatted_points.append(
            {
                "lat": pt["lat"],
                "lon": pt["lon"],
                "time_offset_hours": offset_h,
                "category": pt["category"],
                "intensity_knots": pt["intensity_knots"],
                "is_forecast": is_fc,
                "is_observed": is_obs,
                "origin_type": origin_type,
                "is_landfall": is_landfall,
                "label": label,
            }
        )

    landfall_info = data.get("landfall_info") or _derive_landfall_info(data, formatted_points)
    status_lower = landfall_info.get("status", "").lower()
    is_completed = status_lower.startswith("landfall completed") or status_lower.startswith("dissipated")

    return {
        "id": resolved_id,
        "name": format_cyclone_display_name(data["name"]),
        "basin": data["basin"],
        "lat": peak_pt["lat"],
        "lon": peak_pt["lon"],
        "intensity_knots": peak_pt["intensity_knots"],
        "category": data["category"],
        "is_simulation": simulation,
        "is_measured_observation": False if simulation else None,
        "data_quality_status": "DEMONSTRATION" if simulation else "CURATED_CATALOG_NOT_INDEPENDENTLY_VERIFIED",
        "telemetry_type": "SIMULATION" if simulation else "HISTORICAL_BEST_TRACK",
        "dvorak_t": f"T{min(6.5, max(2.5, round(2.5 + (peak_pt['intensity_knots'] - 30) / 20.0, 1)))}",
        "dvorak_derivation_method": "Empirical Dvorak CI from Historical Max Wind",
        "dvorak_is_empirical_estimate": True,
        "track_generation_method": (
            "Explicit demonstration track"
            if simulation
            else "Curated historical catalog excerpt; independent source verification required"
        ),
        "telemetry_attribution": {
            "center_fix": "SIMULATED_BASELINE" if simulation else "CURATED_HISTORICAL_CATALOG",
            "intensity_knots": "SIMULATED_BASELINE" if simulation else "CURATED_HISTORICAL_CATALOG",
            "dvorak_t": "PARAMETRIC_ESTIMATE",
            "trajectory_forecast": "SIMULATED_BASELINE" if simulation else "CURATED_HISTORICAL_CATALOG",
        },
        "track_forecast": formatted_points,
        "landfall_info": landfall_info,
        "is_landfall_completed": is_completed,
    }


def _generate_curved_meteorological_track(
    cyclone_id: str,
    name: str,
    basin: str,
    category: str,
) -> Dict[str, Any]:
    """Generate a curved illustrative scenario track for uncatalogued queries."""
    is_bob = "bay" in basin.lower() or "bengal" in basin.lower() or "bob" in cyclone_id.lower()

    if "Super" in category:
        peak_knots = 135
    elif "Extremely" in category:
        peak_knots = 100
    elif "Very Severe" in category:
        peak_knots = 75
    elif "Severe" in category:
        peak_knots = 55
    else:
        peak_knots = 42

    points: List[Dict[str, Any]] = []
    num_steps = 13
    peak_step = 8
    landfall_step = 10

    for step in range(num_steps):
        t = step / (num_steps - 1)
        offset_hours = (step - peak_step) * 12

        if is_bob:
            lat = 9.5 + 12.0 * t + 1.2 * (t**2)
            lon = 88.5 - 4.5 * t + 6.0 * (t**2)
        else:
            lat = 10.5 + 13.0 * t + 0.8 * (t**2)
            lon = 66.8 - 2.5 * t + 4.8 * (t**2)

        if step <= peak_step:
            ratio = 0.35 + 0.65 * (step / peak_step)
        else:
            decay_ratio = (step - peak_step) / (num_steps - 1 - peak_step)
            ratio = 1.0 - 0.55 * decay_ratio

        knots = max(28, int(peak_knots * ratio))
        p_cat = classify_imd_category_from_knots(knots)
        abbr = IMD_ABBR.get(p_cat, "CS")
        day = max(1, 15 + int(offset_hours // 24))
        hour = int((6 + offset_hours) % 24)
        is_landfall = step == landfall_step
        suffix = " (Landfall Crossing)" if is_landfall else ""
        label = f"{day:02d}/{hour:02d},{knots}KT,{abbr}{suffix}"

        points.append(
            {
                "lat": round(lat, 2),
                "lon": round(lon, 2),
                "time_offset_hours": offset_hours,
                "category": p_cat,
                "intensity_knots": knots,
                "is_forecast": False,
                "is_observed": False,
                "origin_type": "ILLUSTRATIVE_SIMULATION",
                "is_landfall": is_landfall,
                "label": f"{label} [Simulated Scenario]",
            }
        )

    peak_pt = points[peak_step]
    display_name = format_cyclone_display_name(name)

    landfall_loc = "Odisha / West Bengal Coast" if is_bob else "Gujarat / Saurashtra Coast"
    landfall_knots = points[landfall_step]["intensity_knots"]
    landfall_info = {
        "status": "Landfall (Illustrative Scenario Only)",
        "landfall_time_utc": "Simulated Timeline (+24h)",
        "landfall_location": f"{landfall_loc} (Hypothetical Scenario)",
        "landfall_intensity_knots": landfall_knots,
        "landfall_intensity_kmph": int(landfall_knots * 1.852),
        "landfall_gusts_kmph": int(landfall_knots * 1.852 * 1.25),
        "landfall_category": points[landfall_step]["category"],
        "central_pressure_hpa": None,
        "storm_surge_m": "Not Measured (Simulation Scenario)",
        "inland_decay": "Simulated inland dissipation",
        "impact_sector": f"{landfall_loc} (Scenario)",
    }

    return {
        "id": cyclone_id,
        "name": display_name,
        "basin": basin,
        "lat": peak_pt["lat"],
        "lon": peak_pt["lon"],
        "intensity_knots": peak_knots,
        "category": category,
        "is_simulation": True,
        "is_uncatalogued_storm": True,
        "track_unavailable": True,
        "telemetry_type": "ILLUSTRATIVE_SIMULATION",
        "data_provenance": "SYNTHETIC_SIMULATION (UNCATALOGUED)",
        "dvorak_t": f"T{min(6.5, max(2.5, round(2.5 + (peak_knots - 30) / 20.0, 1)))}",
        "dvorak_derivation_method": "Parametric Wind-Speed Scale (Simulated Approximation)",
        "dvorak_is_empirical_estimate": True,
        "track_generation_method": "Illustrative Synthetic Simulation (No Official IMD Best-Track In Catalog)",
        "catalog_warning": (
            "Official 6-hourly best-track coordinates are not catalogued in the local IBTrACS / IMD "
            "dataset for this system. This path is an illustrative synthetic simulation, not observed "
            "historical fact."
        ),
        "telemetry_attribution": {
            "center_fix": "SYNTHETIC_SIMULATION",
            "intensity_knots": "SYNTHETIC_SIMULATION",
            "dvorak_t": "PARAMETRIC_ESTIMATE",
            "trajectory_forecast": "SYNTHETIC_SIMULATION",
        },
        "track_forecast": points,
        "landfall_info": landfall_info,
        "is_landfall_completed": True,
    }
