"""NOAA/JTWC RSS + text warning adapter and meteorological news alert name lookup."""

import datetime
import re
import xml.etree.ElementTree as ET
from typing import Any, Callable, Dict, List, Optional

from app.core.observability import logger as event_logger
from app.models.feed_result import FeedResult, FeedStatus
from app.services.cyclone_classification import classify_imd_category_from_knots
from app.services.feed_http import FeedClient
from app.services.feed_policy import assess_feed, parse_time
from app.services.ingestion.parsers import extract_coordinates_from_bulletin

JTWC_URL = "https://www.metoc.navy.mil/jtwc/rss/jtwc.rss"
NEWS_RSS_URL = (
    "https://news.google.com/rss/search?q=Cyclone+Bay+of+Bengal+OR+Cyclone+Arabian+Sea+when:1d"
    "&hl=en-IN&gl=IN&ceid=IN:en"
)

_EXCLUDED_NEWS_WORDS = {
    "warning", "alert", "update", "track", "news", "storm", "today", "bay", "bengal",
    "arabian", "sea", "india", "odisha", "andhra", "tamil", "nadu", "kerala", "gujarat",
    "live", "landfall", "depression", "deep", "severe", "super", "coast", "coastal",
    "forecast", "imd", "rsmc", "season", "relief", "fund", "damage", "anniversary",
    "years", "former", "past",
}

_STALE_LIFECYCLE_WORDS = {
    "passed", "weakened into", "former cyclone", "remnants of", "dissipated",
    "last year", "anniversary", "historic", "in 2023", "in 2024", "in 2020",
    "aftermath", "death toll", "rebuilding", "clearing", "reconstruction",
}


async def fetch_meteorological_news_alerts() -> Optional[str]:
    """Extract an active cyclone name from fresh (<24h) meteorological news alerts."""
    try:
        async with FeedClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(NEWS_RSS_URL, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                return None
            root = ET.fromstring(resp.content)
            for item in root.findall(".//item"):
                full_txt = f"{item.findtext('title') or ''} {item.findtext('description') or ''}"
                if any(term in full_txt.lower() for term in _STALE_LIFECYCLE_WORDS):
                    continue
                for candidate in re.findall(r"(?:Cyclone|Cyclonic Storm)\s+['\"]?([A-Z][a-z]{2,15})['\"]?", full_txt):
                    clean = candidate.strip()
                    if clean.lower() not in _EXCLUDED_NEWS_WORDS:
                        return clean.capitalize()
    except Exception as exc:
        event_logger.debug("News RSS cyclone lookup skipped: %s", type(exc).__name__)
    return None


async def _parse_jtwc_match(
    storm_code: str,
    item_body: str,
    client: FeedClient,
    issue: Optional[datetime.datetime],
) -> Optional[Dict[str, Any]]:
    target_text = item_body
    link_m = re.search(r"href=['\"]([^'\"]*?(?:io|sh|wp)\d+web\.txt)['\"]", item_body, re.IGNORECASE)
    if link_m:
        w_url = link_m.group(1)
        if not w_url.startswith("http"):
            w_url = "https://www.metoc.navy.mil/jtwc/products/" + w_url.split("/")[-1]
        try:
            resp_w = await client.get(w_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp_w.status_code == 200:
                target_text = resp_w.text
        except Exception as sub_err:
            event_logger.debug("JTWC warning text fetch failed for %s: %s", storm_code, type(sub_err).__name__)

    coords = extract_coordinates_from_bulletin(target_text)
    if not coords:
        return None
    lat_val, lon_val = coords

    name_m = re.search(r"TROPICAL CYCLONE\s+\d+[AB]\s*(?:\(([^)]+)\))?", target_text, re.IGNORECASE)
    named = name_m.group(1).strip() if (name_m and name_m.group(1)) else None
    if not named:
        name_m2 = re.search(r"Tropical Cyclone\s+\d+[AB]\s*\(([^)]+)\)", item_body, re.IGNORECASE)
        named = name_m2.group(1).strip() if name_m2 else None
    storm_name = f"Cyclone {named.capitalize()}" if named else f"Cyclone {storm_code}"

    w_match = re.search(r"(?:MAX(?:IMUM)?\s+SUSTAINED\s+WINDS?|WINDS?)\s*(?:-|IS)?\s*(\d{2,3})\s*KT", target_text, re.IGNORECASE)
    knots_val = int(w_match.group(1)) if w_match else None

    adv_match = re.search(r"WARNING\s+(?:NR|NO\.?)\s*(\d+)", target_text, re.IGNORECASE)
    p_match = re.search(r"(?:ESTIMATED\s+)?CENTRAL\s+PRESSURE(?:\s+AT\s+\S+)?\s+(?:IS\s+)?(\d{3,4})\s*(?:MB|HPA)", target_text, re.IGNORECASE)
    pressure_val = int(p_match.group(1)) if p_match else None

    m_match = re.search(r"(?:PRESENT\s+MOVEMENT|MOVEMENT\s+PAST\s+\w+\s+HOURS)\s*(?:-|TOWARD\s+)?\s*([A-Z0-9\s°]+?)\s+AT\s+(\d{1,2})\s*KTS?", target_text, re.IGNORECASE)
    motion_dir = m_match.group(1).strip() if m_match else None
    motion_speed_kmph = int(float(m_match.group(2)) * 1.852) if m_match else None

    pos_m = re.search(r"WARNING POSITION:\s*(\d{6}Z)", target_text, re.IGNORECASE)
    issued_m = re.search(r"Issued at\s+(\d{1,2}/\d{4}Z)", item_body, re.IGNORECASE)
    obs_time_str = pos_m.group(1) if pos_m else (issued_m.group(1) if issued_m else None)
    obs_dt = (
        parse_time(obs_time_str)
        if obs_time_str
        else (parse_time(issue) if issue else datetime.datetime.now(datetime.timezone.utc))
    )

    cat = classify_imd_category_from_knots(knots_val) if knots_val is not None else "Tropical Cyclone (Unclassified)"
    return {
        "id": f"LIVE-JTWC-{storm_code}",
        "name": storm_name,
        "basin": "Bay of Bengal" if storm_code.endswith("B") else "Arabian Sea",
        "source": "JTWC / NOAA (Official Advisory Bulletin)",
        "is_live_telemetry": True,
        "telemetry_badge": "JTWC VERIFIED",
        "telemetry_type": "LIVE",
        "category": cat,
        "intensity_knots": knots_val,
        "wind_averaging_period": "1-minute sustained" if knots_val is not None else "UNAVAILABLE",
        "lat": lat_val,
        "lon": lon_val,
        "central_pressure_hpa": pressure_val,
        "movement_speed_kmph": motion_speed_kmph,
        "movement_direction": motion_dir,
        "advisory_number": adv_match.group(1) if adv_match else None,
        "data_quality": {
            "central_pressure": "OBSERVED" if pressure_val is not None else "UNAVAILABLE",
            "movement_speed": "OBSERVED" if motion_speed_kmph is not None else "UNAVAILABLE",
            "movement_direction": "OBSERVED" if motion_dir else "UNAVAILABLE",
            "wind_intensity": "OBSERVED" if knots_val is not None else "UNAVAILABLE",
            "center_fix": "OBSERVED",
        },
        "observation_time_utc": obs_dt.isoformat() if obs_dt else None,
        "source_issue_time_utc": issue.isoformat() if issue else None,
    }


def _parse_jtwc_envelope(resp_content: bytes, text_content: str) -> tuple[bool, Optional[datetime.datetime]]:
    is_valid_xml = False
    channel = None
    try:
        xml_root = ET.fromstring(resp_content)
        channel = xml_root.find("channel")
        is_valid_xml = (
            xml_root.tag == "rss"
            and channel is not None
            and "jtwc" in (channel.findtext("title") or "").lower()
        )
    except Exception:
        is_valid_xml = False

    is_valid_plain = bool(re.search(r"Tropical Cyclone\s+\d+[AB]", text_content, re.IGNORECASE)) or (
        "NO ACTIVE WARNINGS" in text_content.upper()
    )
    if not is_valid_xml and not is_valid_plain:
        return False, None
    issue = parse_time(channel.findtext("lastBuildDate") or channel.findtext("pubDate")) if is_valid_xml and channel is not None else None
    return True, issue


async def fetch_jtwc_active_systems(
    set_status: Callable[[str], None],
    mark_success: Callable[[], None],
) -> FeedResult:
    """Poll NOAA / JTWC feeds for active North Indian Ocean tropical cyclones."""
    systems: List[Dict[str, Any]] = []
    set_status("Polling")

    try:
        async with FeedClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(JTWC_URL, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                set_status(f"FAILED (HTTP {resp.status_code})")
                return assess_feed(
                    source="JTWC_NOAA",
                    status=FeedStatus.FAILED,
                    systems=[],
                    error=f"HTTP {resp.status_code}",
                    source_url=JTWC_URL,
                )

            valid, issue = _parse_jtwc_envelope(resp.content, resp.text)
            if not valid:
                set_status("FAILED (Malformed Payload)")
                return assess_feed(
                    source="JTWC_NOAA",
                    status=FeedStatus.FAILED,
                    systems=[],
                    error="Malformed feed payload (neither valid XML RSS nor recognized JTWC bulletin)",
                    source_url=JTWC_URL,
                )

            pattern = r"(Tropical Cyclone\s+(\d+[AB]))\s*(.*?)(?=(?:Tropical Cyclone\s+\d+[AB])|$)"
            for match in re.finditer(pattern, resp.text, re.IGNORECASE | re.DOTALL):
                parsed = await _parse_jtwc_match(match.group(2).upper(), match.group(3), client, issue)
                if parsed is not None:
                    systems.append(parsed)
    except Exception as exc:
        set_status(f"FAILED ({type(exc).__name__})")
        return assess_feed(
            source="JTWC_NOAA",
            status=FeedStatus.FAILED,
            systems=[],
            error=f"{type(exc).__name__}: {str(exc)}",
            source_url=JTWC_URL,
        )

    if systems:
        set_status("HEALTHY")
        mark_success()
        return assess_feed(source="JTWC_NOAA", status=FeedStatus.HEALTHY, systems=systems, source_url=JTWC_URL)

    set_status("NO_ACTIVE_STORMS")
    mark_success()
    return assess_feed(source="JTWC_NOAA", status=FeedStatus.NO_ACTIVE_STORMS, systems=[], source_url=JTWC_URL)
