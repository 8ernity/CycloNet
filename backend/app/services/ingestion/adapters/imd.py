"""IMD RSMC New Delhi bulletin polling and PDF archive extraction adapter."""

import datetime
import io
import re
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.core.observability import logger as event_logger
from app.models.feed_result import FeedResult, FeedStatus
from app.services.feed_http import FeedClient
from app.services.feed_policy import assess_feed, parse_time
from app.services.ingestion.parsers import (
    determine_imd_category_from_text,
    extract_bulletin_movement,
    extract_coordinates_from_bulletin,
    parse_ist_centered_timestamp,
)

IMD_URL = "https://rsmcnewdelhi.imd.gov.in/"
IMD_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

_BULLETIN_INDICATORS = [
    r"TROPICAL CYCLONE ADVISORY NO\.",
    r"CYCLONIC STORM BULLETIN NO\.",
    r"SPECIAL TROPICAL WEATHER OUTLOOK",
    r"DEEP DEPRESSION SPECIAL MESSAGE",
]

_SYSTEM_KEYWORDS = [
    r"Super Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
    r"Extremely Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
    r"Very Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
    r"Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
    r"Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
    r"Deep Depression\s+over\s+([A-Za-z0-9\/\-\s]+)",
]

_DIR_WORD_MAP = {
    "northwards": "N",
    "southwards": "S",
    "eastwards": "E",
    "westwards": "W",
    "northwestwards": "NW",
    "northeastwards": "NE",
    "north-northwestward": "NNW",
}


def _parse_single_html_advisory(text_content: str, source_url: str) -> FeedResult | List[Dict[str, Any]]:
    advisory_body = re.sub(r"CYCLONIC STORM BULLETIN\s+NO\.\s*\d+", "", text_content, flags=re.IGNORECASE)
    names = {n.upper() for n in re.findall(r"Cyclonic Storm\s+['\"]?([A-Za-z0-9-]+)", advisory_body, re.IGNORECASE)}
    positions = set(re.findall(r"(\d{1,2}(?:\.\d+)?)\s*°?\s*N.*?(\d{2,3}(?:\.\d+)?)\s*°?\s*E", text_content, re.IGNORECASE))
    dates = set(re.findall(r"20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|\+00:00)", text_content))

    if len(names) > 1 or len(positions) > 1 or len(dates) != 1:
        return assess_feed(
            source="IMD_RSMC",
            status=FeedStatus.DEGRADED,
            systems=[],
            error="Unsupported or ambiguous advisory scope",
            source_url=source_url,
        )

    doc_match = re.search(
        r"((?:TROPICAL CYCLONE ADVISORY|CYCLONIC STORM BULLETIN|SPECIAL MESSAGE)\s+NO\.\s*\d+)",
        text_content,
        re.IGNORECASE,
    )
    doc_id = doc_match.group(1).strip() if doc_match else None
    date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|\+00:00))", text_content)
    obs_time_dt = parse_time(date_match.group(1)) if date_match else None

    systems: List[Dict[str, Any]] = []
    for kw in _SYSTEM_KEYWORDS:
        match = re.search(kw, advisory_body, re.IGNORECASE)
        if not match:
            continue
        coords = extract_coordinates_from_bulletin(text_content)
        if not coords:
            continue

        matched_text = match.group(0)
        cat = determine_imd_category_from_text(matched_text)
        basin = "Bay of Bengal" if "bay" in text_content.lower() or "bob" in matched_text.lower() else "Arabian Sea"
        lat_extracted, lon_extracted = coords

        name_match = re.search(r"Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?", matched_text, re.IGNORECASE)
        if name_match:
            raw = name_match.group(1).strip()
            final_name = f"Cyclone {raw.capitalize()}"
            sys_id = f"LIVE-IMD-{raw.upper()}"
        else:
            final_name = "Deep Depression (IMD RSMC Fix)"
            sys_id = f"LIVE-IMD-{datetime.datetime.utcnow().strftime('%Y%m%d%H')}"

        p_match = re.search(
            r"(?:CENTRAL\s+PRESSURE|PRESSURE|ECP)\s*(?:IS|ESTIMATED\s+AT)?\s*(\d{3,4})\s*(?:HPA|MB)",
            text_content,
            re.IGNORECASE,
        )
        pressure_val = int(p_match.group(1)) if p_match else None
        speed_raw, speed_unit, speed_val, dir_val = extract_bulletin_movement(text_content)

        w_match = re.search(
            r"(?:SUSTAINED\s+WINDS?|WIND\s+SPEED)\s*(?:OF)?\s*(\d{2,3})\s*(?:KT|KNOTS)",
            text_content,
            re.IGNORECASE,
        )
        knots_val = int(w_match.group(1)) if w_match else None

        systems.append(
            {
                "id": sys_id,
                "name": final_name,
                "basin": basin,
                "source": "IMD RSMC New Delhi (Live Bulletins)",
                "is_live_telemetry": True,
                "category": cat,
                "intensity_knots": knots_val,
                "lat": lat_extracted,
                "lon": lon_extracted,
                "central_pressure_hpa": pressure_val,
                "movement_speed_kmph": speed_val,
                "movement_speed_raw": speed_raw,
                "movement_speed_source_unit": speed_unit,
                "movement_direction": dir_val,
                "wind_convention": "3_MIN_SUSTAINED" if knots_val is not None else "UNAVAILABLE",
                "data_quality": {
                    "central_pressure": "OBSERVED" if pressure_val is not None else "UNAVAILABLE",
                    "movement_speed": "OBSERVED" if speed_val is not None else "UNAVAILABLE",
                    "movement_direction": "OBSERVED" if dir_val is not None else "UNAVAILABLE",
                    "wind_intensity": "OBSERVED" if knots_val is not None else "UNAVAILABLE",
                    "center_fix": "OBSERVED",
                },
                "observation_time_utc": obs_time_dt.isoformat() if obs_time_dt else None,
            }
        )
        break

    if systems:
        return assess_feed(
            source="IMD_RSMC",
            status=FeedStatus.HEALTHY,
            systems=systems,
            observed_at=obs_time_dt,
            document_id=doc_id,
            source_url=source_url,
        )
    return assess_feed(
        source="IMD_RSMC",
        status=FeedStatus.NO_ACTIVE_STORMS,
        systems=[],
        observed_at=obs_time_dt,
        document_id=doc_id,
        source_url=source_url,
    )


def _find_pdf_link(soup: BeautifulSoup) -> Optional[str]:
    tip = soup.find("dd", class_="tipMid")
    if tip:
        anchor = tip.find("a")
        if anchor and anchor.get("href"):
            return str(anchor.get("href"))
    for anchor in soup.find_all("a"):
        href = str(anchor.get("href", ""))
        if "uploads/archive" in href and href.endswith(".pdf"):
            return href
    return None


def _parse_pdf_bulletin(p_text: str, source_url: str) -> Optional[FeedResult]:
    doc_m = re.search(
        r"((?:NATIONAL BULLETIN|TROPICAL CYCLONE ADVISORY|CYCLONIC STORM BULLETIN|SPECIAL MESSAGE)\s+NO\.\s*\d+(?:\s*\([^)]+\))?)",
        p_text,
        re.IGNORECASE,
    )
    p_doc_id = doc_m.group(1).strip() if doc_m else "NATIONAL BULLETIN"

    name_m = re.search(r'(?:Cyclonic Storm|Cyclone)\s*[“"\'\‘]([A-Za-z]{3,15})[”"\'\’]', p_text, re.IGNORECASE)
    if not name_m:
        name_m = re.search(r'[“"\'\‘]([A-Za-z]{3,15})[”"\'\’]', p_text)
    p_name = name_m.group(1).capitalize() if name_m else None

    p_cat = "Depression"
    for cat_candidate in (
        "Super Cyclonic Storm",
        "Extremely Severe Cyclonic Storm",
        "Very Severe Cyclonic Storm",
        "Severe Cyclonic Storm",
        "Cyclonic Storm",
        "Deep Depression",
        "Depression",
    ):
        if re.search(r"\b" + cat_candidate + r"\b", p_text, re.IGNORECASE):
            p_cat = cat_candidate
            break

    p_coords = extract_coordinates_from_bulletin(p_text)
    if not p_coords:
        table_m = re.search(r"(\d{1,2}\.\d+)/(\d{2,3}\.\d+)", p_text)
        if table_m:
            p_coords = (float(table_m.group(1)), float(table_m.group(2)))
    if not p_coords:
        return None

    s_m = re.search(r"(?:speed\s+of|moved\s+at)\s*(\d{1,2})\s*kmph", p_text, re.IGNORECASE)
    p_speed_kmph = float(s_m.group(1)) if s_m else None

    d_m = re.search(
        r"moved\s+(northwards|southwards|eastwards|westwards|north-northwestward|northwestwards|northeastwards)",
        p_text,
        re.IGNORECASE,
    )
    p_dir = _DIR_WORD_MAP.get(d_m.group(1).lower()) if d_m else None

    w_m = re.search(r"(\d{2,3})(?:-(\d{2,3}))?\s*gusting\s+to\s+(\d{2,3})", p_text, re.IGNORECASE)
    p_knots = int(float(w_m.group(2) or w_m.group(1)) / 1.852) if w_m else None
    p_obs_dt = parse_ist_centered_timestamp(p_text)

    sys_name = f"Cyclone {p_name}" if p_name else "Deep Depression (IMD Fix)"
    sys_id = f"LIVE-IMD-{p_name.upper()}" if p_name else f"LIVE-IMD-{datetime.datetime.utcnow().strftime('%Y%m%d%H')}"
    basin = "Bay of Bengal" if "bay" in p_text.lower() or "bob" in p_doc_id.lower() or p_coords[1] > 78 else "Arabian Sea"

    system = {
        "id": sys_id,
        "name": sys_name,
        "basin": basin,
        "source": "IMD RSMC New Delhi (Official National Bulletin)",
        "is_live_telemetry": True,
        "category": p_cat,
        "intensity_knots": p_knots,
        "lat": p_coords[0],
        "lon": p_coords[1],
        "central_pressure_hpa": None,
        "movement_speed_kmph": p_speed_kmph,
        "movement_direction": p_dir,
        "wind_convention": "3_MIN_SUSTAINED" if p_knots is not None else "UNAVAILABLE",
        "data_quality": {
            "central_pressure": "UNAVAILABLE",
            "movement_speed": "OBSERVED" if p_speed_kmph is not None else "UNAVAILABLE",
            "movement_direction": "OBSERVED" if p_dir else "UNAVAILABLE",
            "wind_intensity": "OBSERVED" if p_knots is not None else "UNAVAILABLE",
            "center_fix": "OBSERVED",
        },
        "observation_time_utc": p_obs_dt.isoformat() if p_obs_dt else None,
    }
    return assess_feed(
        source="IMD_RSMC",
        status=FeedStatus.HEALTHY,
        systems=[system],
        observed_at=p_obs_dt,
        document_id=p_doc_id,
        source_url=source_url,
    )


async def fetch_imd_bulletins(
    set_status: Callable[[str], None],
    mark_success: Callable[[], None],
    set_error: Callable[[str], None],
) -> FeedResult:
    """Poll IMD RSMC New Delhi portals and linked archive PDFs for active advisories."""
    set_status("Polling")
    try:
        async with FeedClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(IMD_URL, headers=IMD_HEADERS)
            if resp.status_code != 200:
                set_status(f"FAILED (HTTP {resp.status_code})")
                return assess_feed(
                    source="IMD_RSMC",
                    status=FeedStatus.FAILED,
                    systems=[],
                    error=f"HTTP {resp.status_code}",
                    source_url=IMD_URL,
                )

            soup = BeautifulSoup(resp.text, "html.parser")
            text_content = soup.get_text()
            if any(re.search(ind, text_content, re.IGNORECASE) for ind in _BULLETIN_INDICATORS):
                result = _parse_single_html_advisory(text_content, IMD_URL)
                if isinstance(result, FeedResult):
                    if result.status in (FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS):
                        set_status(result.status.value)
                        mark_success()
                    else:
                        set_status(result.status.value)
                    return result

            pdf_link = _find_pdf_link(soup)
            if pdf_link:
                try:
                    pdf_resp = await client.get(urljoin(IMD_URL, pdf_link), headers=IMD_HEADERS)
                    if pdf_resp.status_code == 200:
                        import pdfplumber

                        with pdfplumber.open(io.BytesIO(pdf_resp.content)) as pdf:
                            p_text = pdf.pages[0].extract_text() or ""
                        parsed_pdf = _parse_pdf_bulletin(p_text, IMD_URL)
                        if parsed_pdf is not None:
                            set_status("HEALTHY")
                            mark_success()
                            return parsed_pdf
                except Exception as pdf_err:
                    event_logger.warning("IMD PDF extraction error: %s", pdf_err)

            set_status("DEGRADED")
            return assess_feed(
                source="IMD_RSMC",
                status=FeedStatus.DEGRADED,
                systems=[],
                error="No dated authoritative evidence of basin-wide calm",
                source_url=IMD_URL,
            )
    except Exception as exc:
        set_status(f"FAILED ({type(exc).__name__})")
        set_error(f"IMD fetch error: {exc}")
        return assess_feed(
            source="IMD_RSMC",
            status=FeedStatus.FAILED,
            systems=[],
            error=f"{type(exc).__name__}: {str(exc)}",
            source_url=IMD_URL,
        )
