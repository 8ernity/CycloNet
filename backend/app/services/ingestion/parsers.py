"""Shared regex and text parsing utilities for meteorological bulletins."""

import datetime
import re
from typing import Optional, Tuple

_COMPASS_DIRECTIONS: dict[str, str] = {
    "NORTH": "N",
    "SOUTH": "S",
    "EAST": "E",
    "WEST": "W",
    "NORTHWEST": "NW",
    "NORTHEAST": "NE",
    "SOUTHWEST": "SW",
    "SOUTHEAST": "SE",
    **{
        d: d
        for d in (
            "N",
            "NNE",
            "NE",
            "ENE",
            "E",
            "ESE",
            "SE",
            "SSE",
            "S",
            "SSW",
            "SW",
            "WSW",
            "W",
            "WNW",
            "NW",
            "NNW",
        )
    },
}

_DIRECTION_PATTERN = re.compile(
    r"\b(?:DIRECTION|TOWARDS?|MOVING)\s+(" + "|".join(_COMPASS_DIRECTIONS) + r")\b",
    re.IGNORECASE,
)

_COORD_PATTERNS = [
    r"latitude\s*(\d{1,2}(?:\.\d+)?)\s*°?\s*N\s*(?:and|,|\s+)\s*longitude\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
    r"(?:near\s+)?lat(?:itude)?\.?\s*(\d{1,2}(?:\.\d+)?)\s*°?\s*N[^\d\n\r]{1,40}lon(?:g(?:itude)?)?\.?\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
    r"(?:near|posit:?|position:?|at)?\s*(\d{1,2}(?:\.\d+)?)\s*°?\s*N[\s,/and]+\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
    r"(\d{1,2}(?:\.\d+)?)\s*°?\s*N\s*(?:and|,|\/|\s)\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
    r"center\s+at\s+(\d{1,2}(?:\.\d+)?)\s*N[,\s]+(\d{2,3}(?:\.\d+)?)\s*E",
    r"position\s+near\s+(\d{1,2}(?:\.\d+)?)\s*N\s+(\d{2,3}(?:\.\d+)?)\s*E",
]


def extract_coordinates_from_bulletin(text: str) -> Optional[Tuple[float, float]]:
    """Extract center fix (lat, lon) within North Indian Ocean bounds, or None."""
    for pattern in _COORD_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        try:
            lat = float(match.group(1))
            lon = float(match.group(2))
            if 5.0 <= lat <= 30.0 and 50.0 <= lon <= 100.0:
                return (round(lat, 2), round(lon, 2))
        except (ValueError, IndexError):
            continue
    return None


def determine_imd_category_from_text(text: str) -> str:
    """Resolve official IMD cyclone category label from bulletin headline text."""
    lower = text.lower()
    if "super" in lower:
        return "Super Cyclonic Storm"
    if "extremely severe" in lower:
        return "Extremely Severe Cyclonic Storm"
    if "very severe" in lower:
        return "Very Severe Cyclonic Storm"
    if "severe" in lower:
        return "Severe Cyclonic Storm"
    if "deep depression" in lower:
        return "Deep Depression"
    if "depression" in lower:
        return "Depression"
    return "Cyclonic Storm"


def extract_bulletin_movement(
    text: str,
) -> Tuple[Optional[float], Optional[str], Optional[float], Optional[str]]:
    """Extract unambiguous movement speed (raw, unit, km/h) and compass direction."""
    speed_matches = re.findall(
        r"(?:MOVEMENT\s+SPEED|MOVED|MOVING\s+AT)\s*(\d{1,3}(?:\.\d+)?)\s*(KMPH|KM/H|KNOTS|KT)\b",
        text,
        re.IGNORECASE,
    )
    if len(speed_matches) == 1:
        speed_raw = float(speed_matches[0][0])
        speed_unit = speed_matches[0][1].upper()
        speed_kmph = speed_raw * (1.852 if speed_unit in ("KT", "KNOTS") else 1.0)
    else:
        speed_raw, speed_unit, speed_kmph = None, None, None

    directions = _DIRECTION_PATTERN.findall(text)
    direction_values = {_COMPASS_DIRECTIONS[d.upper()] for d in directions}
    dir_val = next(iter(direction_values)) if len(direction_values) == 1 else None
    return speed_raw, speed_unit, speed_kmph, dir_val


def parse_ist_centered_timestamp(text: str) -> Optional[datetime.datetime]:
    """Parse 'centered at HHMM hours IST of today, the DDth Month, YYYY' into UTC."""
    match = re.search(
        r"centered\s+at\s+(\d{4})\s*hours\s+IST\s+of\s+today,?\s*the\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    hhmm, day, month_str, year_str = match.groups()
    try:
        hour, minute = int(hhmm[:2]), int(hhmm[2:])
        month_num = datetime.datetime.strptime(month_str.capitalize(), "%B").month
        ist_dt = datetime.datetime(int(year_str), month_num, int(day), hour, minute, tzinfo=datetime.timezone.utc)
        return ist_dt - datetime.timedelta(hours=5, minutes=30)
    except (ValueError, TypeError):
        return None
