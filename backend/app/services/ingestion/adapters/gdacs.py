"""UN/EC GDACS GeoRSS tropical cyclone feed adapter."""

import re
import xml.etree.ElementTree as ET
from typing import Any, Callable, Dict, Optional

from app.models.feed_result import FeedResult, FeedStatus
from app.services.cyclone_classification import classify_imd_category_from_knots
from app.services.feed_http import FeedClient
from app.services.feed_policy import assess_feed
from app.services.ingestion.parsers import parse_safe_xml

GDACS_URL = "https://www.gdacs.org/xml/rss.xml"
GDACS_HEADERS = {
    "User-Agent": "CycloneTracker/1.0 (Cyclone Research and Monitoring; +https://github.com/8ernity/CycloneNet)"
}
_NS_GEO = "{http://www.georss.org/georss}"


def _parse_gdacs_item(item: ET.Element) -> Optional[Dict[str, Any]]:
    title = item.findtext("title") or ""
    desc = item.findtext("description") or ""
    if "tropical cyclone" not in title.lower() and "cyclone" not in desc.lower():
        return None

    point_elem = item.find(f"{_NS_GEO}point")
    if point_elem is None or not point_elem.text:
        return None
    parts = point_elem.text.strip().split()
    if len(parts) != 2:
        return None
    try:
        lat_val = float(parts[0])
        lon_val = float(parts[1])
    except ValueError:
        return None

    is_bob = (5.0 <= lat_val <= 26.0) and (79.0 <= lon_val <= 98.0)
    is_arb = (5.0 <= lat_val <= 26.0) and (55.0 <= lon_val <= 78.0)
    if not (is_bob or is_arb):
        return None

    w_match = re.search(r"(\d+)\s*km/h", f"{title} {desc}")
    if w_match:
        knots: Optional[int] = int(int(w_match.group(1)) / 1.852)
        cat = classify_imd_category_from_knots(knots)
    else:
        knots = None
        cat = "Cyclonic Disturbance (Unclassified Wind)"

    name_match = re.search(r"(?:tropical cyclone|cyclone)\s+([A-Za-z0-9\-]+)", title, re.IGNORECASE)
    raw_name = name_match.group(1).strip() if name_match else "BOB-05"
    clean_name = re.sub(r"-\d+$", "", raw_name).strip()

    return {
        "id": f"LIVE-GDACS-{clean_name.upper()}",
        "name": (
            "Deep Depression (BOB-05)"
            if "one" in clean_name.lower() or "bob" in clean_name.lower()
            else f"Cyclone {clean_name.capitalize()}"
        ),
        "basin": "Bay of Bengal" if is_bob else "Arabian Sea",
        "source": "GDACS (United Nations / EC Real-Time Satellite Feed)",
        "is_live_telemetry": True,
        "telemetry_badge": "LIVE SOURCE VERIFIED",
        "telemetry_type": "LIVE",
        "category": cat,
        "intensity_knots": knots,
        "wind_convention": "SOURCE_UNSPECIFIED" if knots is not None else "UNAVAILABLE",
        "lat": round(lat_val, 2),
        "lon": round(lon_val, 2),
        "central_pressure_hpa": None,
        "movement_speed_kmph": None,
        "movement_direction": None,
        "data_quality": {
            "central_pressure": "UNAVAILABLE",
            "movement_speed": "UNAVAILABLE",
            "movement_direction": "UNAVAILABLE",
            "wind_intensity": "OBSERVED" if knots is not None else "UNAVAILABLE",
            "center_fix": "OBSERVED",
        },
        "observation_time_utc": item.findtext("pubDate") or None,
    }


async def fetch_gdacs_active_systems(
    set_status: Callable[[str], None],
    mark_success: Callable[[], None],
) -> FeedResult:
    """Poll United Nations / EC GDACS live GeoRSS feed and filter for North Indian Ocean."""
    set_status("Polling")
    try:
        async with FeedClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(GDACS_URL, headers=GDACS_HEADERS)
    except Exception as exc:
        set_status(f"FAILED ({type(exc).__name__})")
        return assess_feed(
            source="GDACS_UN",
            status=FeedStatus.FAILED,
            systems=[],
            error=f"{type(exc).__name__}: {str(exc)}",
            source_url=GDACS_URL,
        )

    if resp.status_code != 200:
        set_status(f"FAILED (HTTP {resp.status_code})")
        return assess_feed(
            source="GDACS_UN",
            status=FeedStatus.FAILED,
            systems=[],
            error=f"HTTP {resp.status_code}",
            source_url=GDACS_URL,
        )

    content_type = resp.headers.get("content-type", "").lower()
    if "html" in content_type or b"<title>Request Rejected</title>" in resp.content:
        set_status("UNAVAILABLE (WAF Challenge)")
        return assess_feed(
            source="GDACS_UN",
            status=FeedStatus.UNAVAILABLE,
            systems=[],
            error="GDACS WAF challenge page returned",
            source_url=GDACS_URL,
        )

    try:
        root = parse_safe_xml(resp.content)
    except Exception as parse_err:
        set_status(f"FAILED (XML Parse Error: {type(parse_err).__name__})")
        return assess_feed(
            source="GDACS_UN",
            status=FeedStatus.FAILED,
            systems=[],
            error=f"XML parse error: {parse_err}",
            source_url=GDACS_URL,
        )

    channel = root.find("channel")
    if root.tag != "rss" or channel is None or "gdacs" not in (channel.findtext("title") or "").lower():
        return assess_feed(
            source="GDACS_UN",
            status=FeedStatus.FAILED,
            error="Unrecognized GDACS document",
            source_url=GDACS_URL,
        )

    systems = [parsed for item in root.findall(".//item") if (parsed := _parse_gdacs_item(item)) is not None]
    if systems:
        set_status("HEALTHY")
        mark_success()
        return assess_feed(source="GDACS_UN", status=FeedStatus.HEALTHY, systems=systems, source_url=GDACS_URL)

    set_status("NO_ACTIVE_STORMS")
    mark_success()
    return assess_feed(source="GDACS_UN", status=FeedStatus.NO_ACTIVE_STORMS, systems=[], source_url=GDACS_URL)
