import asyncio
import os
import json
import re
import datetime
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.domain import CycloneArchive, ActiveCycloneState
from app.models.feed_result import FeedResult, FeedStatus
from app.services.ml_service import ml_service

def get_default_active_bob_system() -> Dict[str, Any]:
    """
    Returns telemetry for the active Bay of Bengal system (Deep Depression BOB-05).
    Dynamically generates real-time timestamps and labels based on current UTC time.
    """
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
        "source": "IMD RSMC New Delhi (Baseline Model Dataset)",
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
            "satellite_image_dvorak": "AVAILABLE_IN_CLASSIFICATION_TAB"
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
            {"lat": 18.1, "lon": 83.7, "time_offset_hours": 0, "category": "Deep Depression", "intensity_knots": 35, "is_forecast": False, "is_observed": True, "origin_type": "SIMULATION_CENTER_FIX", "label": make_live_label(0, 35, "Deep Depression", "Simulation Center - Coastal Crossing near Kalingapatnam")},
            {"lat": 19.2, "lon": 82.8, "time_offset_hours": 12, "category": "Depression", "intensity_knots": 25, "is_forecast": True, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(12, 25, "Depression", "Inland over South Odisha / North AP")},
            {"lat": 20.5, "lon": 81.5, "time_offset_hours": 24, "category": "Well Marked Low", "intensity_knots": 18, "is_forecast": True, "is_observed": False, "origin_type": "SIMULATION_WAYPOINT", "label": make_live_label(24, 18, "Well Marked Low", "Dissipation over Chhattisgarh")}
        ]
    }

class LiveIngestionService:
    """
    Automated Meteorological Ingestion Worker for CycloNet.
    Continuously monitors official open feeds from IMD (RSMC New Delhi),
    NOAA/JTWC, and satellite endpoints to detect active cyclonic systems in the
    North Indian Ocean (Bay of Bengal & Arabian Sea).
    """

    def __init__(self):
        self.last_sync: Optional[datetime.datetime] = datetime.datetime.utcnow()
        self.is_syncing: bool = False
        self.last_error: Optional[str] = None
        self.sources_status: Dict[str, str] = {
            "IMD_RSMC": "NO_ACTIVE_STORMS",
            "JTWC_NOAA": "NO_ACTIVE_STORMS",
            "GDACS_UN": "NO_ACTIVE_STORMS",
            "ISRO_MOSDAC": "NO_ACTIVE_STORMS"
        }
        self.last_successful_sync: Dict[str, Optional[datetime.datetime]] = {
            "IMD_RSMC": None,
            "JTWC_NOAA": None,
            "GDACS_UN": None,
            "ISRO_MOSDAC": None
        }
        self._in_memory_systems: List[Dict[str, Any]] = []
        self._background_task: Optional[asyncio.Task] = None

    @property
    def live_systems(self) -> List[Dict[str, Any]]:
        """
        Retrieves active systems from persistent DB/shared storage.
        Ensures multi-worker processes share synchronized real-time active cyclone states.
        Fixes Problem #66 (Active cyclone state stored in process memory instead of Redis/DB).
        """
        try:
            db = SessionLocal()
            try:
                rec = db.query(ActiveCycloneState).filter(ActiveCycloneState.id == "CURRENT_ACTIVE_SYSTEMS").first()
                if rec and rec.systems_json:
                    return json.loads(rec.systems_json)
            finally:
                db.close()
        except Exception:
            pass
        return getattr(self, "_in_memory_systems", [])

    @live_systems.setter
    def live_systems(self, systems: List[Dict[str, Any]]):
        """
        Persists active cyclone state into DB/shared storage for multi-process cross-worker synchronization.
        """
        self._in_memory_systems = systems
        try:
            db = SessionLocal()
            try:
                rec = db.query(ActiveCycloneState).filter(ActiveCycloneState.id == "CURRENT_ACTIVE_SYSTEMS").first()
                if not rec:
                    rec = ActiveCycloneState(
                        id="CURRENT_ACTIVE_SYSTEMS",
                        active_count=len(systems),
                        systems_json=json.dumps(systems),
                        last_sync=datetime.datetime.utcnow()
                    )
                    db.add(rec)
                else:
                    rec.active_count = len(systems)
                    rec.systems_json = json.dumps(systems)
                    rec.last_sync = datetime.datetime.utcnow()
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

    async def sync_all_sources(self) -> Dict[str, Any]:
        """
        Executes a complete synchronization pass across all meteorological sources.
        Accurately distinguishes verified calm basin from feed failures (FIX-001, FIX-002).
        """
        if self.is_syncing:
            return {"status": "already_syncing", "message": "Synchronization is already in progress"}

        self.is_syncing = True
        self.last_error = None
        discovered_systems: List[Dict[str, Any]] = []

        # Deduplication rules preserving agency provenance (LIVE-08)
        def is_duplicate(candidate: Dict[str, Any], existing_list: List[Dict[str, Any]]) -> bool:
            cand_id = candidate.get("id", "").strip().upper()
            cand_name = candidate.get("name", "").strip().lower().replace("cyclone", "").strip()
            for ex in existing_list:
                ex_id = ex.get("id", "").strip().upper()
                ex_name = ex.get("name", "").strip().lower().replace("cyclone", "").strip()
                if cand_id and ex_id and cand_id == ex_id:
                    return True
                if cand_name and ex_name and (cand_name == ex_name):
                    return True
            return False

        try:
            # 1. Fetch real-time global satellite observations from UN/EC GDACS
            gdacs_res = await self._fetch_gdacs_active_systems()

            # 2. Fetch and parse IMD RSMC New Delhi bulletins
            imd_res = await self._fetch_imd_bulletins()

            # 3. Fetch NOAA / JTWC global active tropical cyclone feeds
            jtwc_res = await self._fetch_jtwc_active_systems()

            results = [gdacs_res, imd_res, jtwc_res]
            for r in results:
                self.sources_status[r.source] = r.status.value
                if r.status in [FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS]:
                    self.last_successful_sync[r.source] = r.retrieved_at
                elif r.error:
                    self.last_error = f"{r.source}: {r.error}"

            # Aggregate systems from healthy feeds
            for r in results:
                if r.status == FeedStatus.HEALTHY:
                    for isys in r.systems:
                        if not is_duplicate(isys, discovered_systems):
                            discovered_systems.append(isys)

            healthy_count = sum(1 for r in results if r.status in [FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS])
            failed_count = sum(1 for r in results if r.status in [FeedStatus.FAILED, FeedStatus.UNAVAILABLE])

            if discovered_systems:
                for system in discovered_systems:
                    self._calibrate_system_telemetry(system)
                    self._persist_to_database(system)
                self.live_systems = discovered_systems
                status_label = "success" if failed_count == 0 else "partial_monitoring"
            else:
                if healthy_count == len(results):
                    # All feeds are healthy and confirmed calm basin
                    self.live_systems = []
                    status_label = "success"
                elif healthy_count > 0:
                    # Some feeds healthy with 0 storms, others failed: partial monitoring
                    self.live_systems = []
                    status_label = "partial_monitoring"
                else:
                    # ALL feeds failed: CRITICAL OUTAGE!
                    # Preserve last known valid records as STALE, DO NOT declare calm (FIX-001)
                    status_label = "outage"
                    current = list(self.live_systems)
                    if current:
                        for s in current:
                            s["data_state"] = "STALE"
                            s["is_stale"] = True
                            s["telemetry_badge"] = "STALE TELEMETRY (OUTAGE)"
                        self.live_systems = current
                    print("[Live Ingestion Alert] CRITICAL: All cyclone monitoring feeds are currently UNAVAILABLE!")

            self.last_sync = datetime.datetime.utcnow()

            return {
                "status": status_label,
                "synced_at": self.last_sync.isoformat() + "Z",
                "active_systems_count": len(self.live_systems),
                "systems": self.live_systems,
                "sources_status": self.sources_status
            }
        except Exception as e:
            self.last_error = str(e)
            print(f"[Live Ingestion Error] Failed during sync: {e}")
            return {
                "status": "partial" if self.live_systems else "error",
                "synced_at": datetime.datetime.utcnow().isoformat() + "Z",
                "active_systems_count": len(self.live_systems),
                "systems": self.live_systems,
                "sources_status": self.sources_status,
                "error": str(e),
                "note": "Synchronization encountered an unhandled error; serving cached basin telemetry."
            }
        finally:
            self.is_syncing = False

    def _extract_coordinates_from_bulletin(self, text: str) -> Optional[tuple]:
        """
        Extracts genuine center fix coordinates from meteorological bulletin text.
        Returns (lat, lon) if verified within North Indian Ocean bounds, else None.
        Fixes Problem #11 (hardcoded scraper coordinates).
        """
        patterns = [
            r"(?:near\s+)?lat(?:itude)?\.?\s*(\d{1,2}(?:\.\d+)?)\s*°?\s*N[^\d\n\r]{1,40}lon(?:g(?:itude)?)?\.?\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
            r"(\d{1,2}(?:\.\d+)?)\s*°?\s*N\s*(?:and|,|\/)\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*E",
            r"center\s+at\s+(\d{1,2}(?:\.\d+)?)\s*N[,\s]+(\d{2,3}(?:\.\d+)?)\s*E",
            r"position\s+near\s+(\d{1,2}(?:\.\d+)?)\s*N\s+(\d{2,3}(?:\.\d+)?)\s*E",
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                try:
                    lat = float(match.group(1))
                    lon = float(match.group(2))
                    if 5.0 <= lat <= 30.0 and 50.0 <= lon <= 100.0:
                        return (round(lat, 2), round(lon, 2))
                except (ValueError, IndexError):
                    continue
        return None

    async def _fetch_meteorological_news_alerts(self) -> Optional[str]:
        """
        Dynamically extracts active cyclone names discussed across fresh (<24h)
        meteorological news alerts, ensuring strict bulletin lifecycle validation.
        Fixes Problem #15 (news RSS scraper lacking bulletin lifecycle checks).
        """
        url = "https://news.google.com/rss/search?q=Cyclone+Bay+of+Bengal+OR+Cyclone+Arabian+Sea+when:1d&hl=en-IN&gl=IN&ceid=IN:en"
        excluded_words = {
            "warning", "alert", "update", "track", "news", "storm", "today", 
            "bay", "bengal", "arabian", "sea", "india", "odisha", "andhra",
            "tamil", "nadu", "kerala", "gujarat", "live", "landfall", "depression",
            "deep", "severe", "super", "coast", "coastal", "forecast", "imd", "rsmc",
            "season", "relief", "fund", "damage", "anniversary", "years", "former", "past"
        }
        stale_lifecycle_words = {
            "passed", "weakened into", "former cyclone", "remnants of", "dissipated",
            "last year", "anniversary", "historic", "in 2023", "in 2024", "in 2020",
            "aftermath", "death toll", "rebuilding", "clearing", "reconstruction"
        }
        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    root = ET.fromstring(resp.content)
                    for item in root.findall(".//item"):
                        title = item.find("title").text if item.find("title") is not None else ""
                        desc = item.find("description").text if item.find("description") is not None else ""
                        full_txt = f"{title} {desc}".lower()
                        
                        # Discard dissipated or historical retrospective news
                        if any(term in full_txt for term in stale_lifecycle_words):
                            continue

                        matches = re.findall(r"(?:Cyclone|Cyclonic Storm)\s+['\"]?([A-Z][a-z]{2,15})['\"]?", f"{title} {desc}")
                        for candidate in matches:
                            cand_clean = candidate.strip()
                            if cand_clean.lower() not in excluded_words:
                                return cand_clean.capitalize()
        except Exception:
            pass
        return None

    async def _fetch_imd_bulletins(self) -> FeedResult:
        """
        Polls IMD RSMC New Delhi and Mausam portals for active tropical cyclone advisories.
        Returns FeedResult contract distinguishing healthy, no active storms, or failures (FIX-001).
        """
        systems = []
        self.sources_status["IMD_RSMC"] = "Polling"
        url = "https://rsmcnewdelhi.imd.gov.in/"
        
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    text_content = soup.get_text()

                    bulletin_indicators = [
                        r"TROPICAL CYCLONE ADVISORY NO\.",
                        r"CYCLONIC STORM BULLETIN NO\.",
                        r"SPECIAL TROPICAL WEATHER OUTLOOK",
                        r"DEEP DEPRESSION SPECIAL MESSAGE"
                    ]
                    has_active_bulletin = any(re.search(ind, text_content, re.IGNORECASE) for ind in bulletin_indicators)

                    keywords = [
                        r"Super Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
                        r"Extremely Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
                        r"Very Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
                        r"Severe Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
                        r"Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?",
                        r"Deep Depression\s+over\s+([A-Za-z0-9\/\-\s]+)"
                    ]

                    doc_id = None
                    doc_match = re.search(r"((?:TROPICAL CYCLONE ADVISORY|CYCLONIC STORM BULLETIN|SPECIAL MESSAGE)\s+NO\.\s*\d+)", text_content, re.IGNORECASE)
                    if doc_match:
                        doc_id = doc_match.group(1).strip()

                    obs_time_dt = None

                    if has_active_bulletin:
                        for kw in keywords:
                            match = re.search(kw, text_content, re.IGNORECASE)
                            if match:
                                matched_text = match.group(0)
                                cat = self._determine_imd_category_from_text(matched_text)
                                basin = "Bay of Bengal" if "bay" in text_content.lower() or "bob" in matched_text.lower() else "Arabian Sea"
                                
                                coords = self._extract_coordinates_from_bulletin(text_content)
                                if not coords:
                                    continue

                                lat_extracted, lon_extracted = coords

                                name_match = re.search(r"Cyclonic Storm\s+['\"]?([A-Za-z0-9\-]+)['\"]?", matched_text, re.IGNORECASE)
                                if name_match:
                                    final_name = f"Cyclone {name_match.group(1).strip().capitalize()}"
                                    sys_id = f"LIVE-IMD-{name_match.group(1).strip().upper()}"
                                else:
                                    final_name = "Deep Depression (IMD RSMC Fix)"
                                    sys_id = f"LIVE-IMD-{datetime.datetime.utcnow().strftime('%Y%m%d%H')}"

                                p_match = re.search(r"(?:CENTRAL\s+PRESSURE|PRESSURE|ECP)\s*(?:IS|ESTIMATED\s+AT)?\s*(\d{3,4})\s*(?:HPA|MB)", text_content, re.IGNORECASE)
                                pressure_val = int(p_match.group(1)) if p_match else None

                                s_match = re.search(r"(?:SPEED|MOVED|MOVING\s+AT)\s*(\d{1,3})\s*(?:KMPH|KM/H|KT|KNOTS)", text_content, re.IGNORECASE)
                                speed_val = int(s_match.group(1)) if s_match else None

                                d_match = re.search(r"(?:DIRECTION|TOWARDS?|MOVING)\s+([A-Z]{1,3}|NORTH|SOUTH|EAST|WEST|NORTHWEST|NORTHEAST|SOUTHWEST|SOUTHEAST)", text_content, re.IGNORECASE)
                                dir_val = d_match.group(1).upper() if d_match else None

                                w_match = re.search(r"(?:SUSTAINED\s+WINDS?|WIND\s+SPEED)\s*(?:OF)?\s*(\d{2,3})\s*(?:KT|KNOTS)", text_content, re.IGNORECASE)
                                knots_val = int(w_match.group(1)) if w_match else None

                                systems.append({
                                    "id": sys_id,
                                    "name": final_name,
                                    "basin": basin,
                                    "source": "IMD RSMC New Delhi (Live Bulletins)",
                                    "category": cat,
                                    "intensity_knots": knots_val,
                                    "lat": lat_extracted,
                                    "lon": lon_extracted,
                                    "central_pressure_hpa": pressure_val,
                                    "movement_speed_kmph": speed_val,
                                    "movement_direction": dir_val,
                                    "wind_convention": "3_MIN_SUSTAINED" if knots_val is not None else "UNAVAILABLE",
                                    "data_quality": {
                                        "central_pressure": "OBSERVED" if pressure_val is not None else "UNAVAILABLE",
                                        "movement_speed": "OBSERVED" if speed_val is not None else "UNAVAILABLE",
                                        "movement_direction": "OBSERVED" if dir_val is not None else "UNAVAILABLE",
                                        "wind_intensity": "OBSERVED" if knots_val is not None else "UNAVAILABLE",
                                        "center_fix": "OBSERVED"
                                    },
                                    "observation_time_utc": None
                                })
                                break

                        if systems:
                            self.sources_status["IMD_RSMC"] = "HEALTHY"
                            self.last_successful_sync["IMD_RSMC"] = datetime.datetime.utcnow()
                            return FeedResult(
                                source="IMD_RSMC",
                                status=FeedStatus.HEALTHY,
                                systems=systems,
                                observed_at=obs_time_dt,
                                document_id=doc_id,
                                source_url=url
                            )
                        else:
                            self.sources_status["IMD_RSMC"] = "NO_ACTIVE_STORMS"
                            self.last_successful_sync["IMD_RSMC"] = datetime.datetime.utcnow()
                            return FeedResult(
                                source="IMD_RSMC",
                                status=FeedStatus.NO_ACTIVE_STORMS,
                                systems=[],
                                observed_at=obs_time_dt,
                                document_id=doc_id,
                                source_url=url
                            )
                    else:
                        self.sources_status["IMD_RSMC"] = "NO_ACTIVE_STORMS"
                        self.last_successful_sync["IMD_RSMC"] = datetime.datetime.utcnow()
                        return FeedResult(
                            source="IMD_RSMC",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            observed_at=obs_time_dt,
                            source_url=url
                        )
                else:
                    self.sources_status["IMD_RSMC"] = f"FAILED (HTTP {resp.status_code})"
                    return FeedResult(
                        source="IMD_RSMC",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["IMD_RSMC"] = f"FAILED ({type(e).__name__})"
            self.last_error = f"IMD fetch error: {e}"
            return FeedResult(
                source="IMD_RSMC",
                status=FeedStatus.FAILED,
                systems=[],
                error=f"{type(e).__name__}: {str(e)}",
                source_url=url
            )

    async def _fetch_gdacs_active_systems(self) -> FeedResult:
        """
        Polls United Nations / European Commission GDACS live GeoRSS feed
        (https://www.gdacs.org/xml/rss.xml). Returns FeedResult with nullable wind (FIX-001, FIX-002).
        """
        systems = []
        self.sources_status["GDACS_UN"] = "Polling"
        url = "https://www.gdacs.org/xml/rss.xml"
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    try:
                        root = ET.fromstring(resp.content)
                    except Exception as parse_err:
                        self.sources_status["GDACS_UN"] = f"FAILED (XML Parse Error: {type(parse_err).__name__})"
                        return FeedResult(
                            source="GDACS_UN",
                            status=FeedStatus.FAILED,
                            systems=[],
                            error=f"XML parse error: {parse_err}",
                            source_url=url
                        )
                    ns_geo = "{http://www.georss.org/georss}"
                    
                    for item in root.findall(".//item"):
                        title = item.find("title").text if item.find("title") is not None else ""
                        desc = item.find("description").text if item.find("description") is not None else ""
                        pub_elem = item.find("pubDate")
                        obs_time_str = pub_elem.text if (pub_elem is not None and pub_elem.text) else None
                        
                        if "tropical cyclone" in title.lower() or "cyclone" in desc.lower():
                            point_elem = item.find(f"{ns_geo}point")
                            if point_elem is not None and point_elem.text:
                                parts = point_elem.text.strip().split()
                                if len(parts) == 2:
                                    try:
                                        lat_val = float(parts[0])
                                        lon_val = float(parts[1])
                                    except ValueError:
                                        continue
                                    
                                    # Filter for North Indian Ocean basin (Bay of Bengal & Arabian Sea)
                                    is_bob = (5.0 <= lat_val <= 26.0) and (79.0 <= lon_val <= 98.0)
                                    is_arb = (5.0 <= lat_val <= 26.0) and (55.0 <= lon_val <= 78.0)
                                    
                                    if is_bob or is_arb:
                                        basin = "Bay of Bengal" if is_bob else "Arabian Sea"
                                        w_match = re.search(r"(\d+)\s*km/h", title + " " + desc)
                                        if w_match:
                                            wind_kmph = int(w_match.group(1))
                                            knots = int(wind_kmph / 1.852)
                                            cat = "Deep Depression" if knots < 40 else ("Cyclonic Storm" if knots < 55 else "Severe Cyclonic Storm")
                                        else:
                                            wind_kmph = None
                                            knots = None
                                            cat = "Cyclonic Disturbance (Unclassified Wind)"
                                        
                                        name_match = re.search(r"cyclone\s+([A-Za-z0-9\-]+)", title, re.IGNORECASE)
                                        raw_name = name_match.group(1).strip() if name_match else "BOB-05"
                                        
                                        systems.append({
                                            "id": f"LIVE-GDACS-{raw_name.upper()}",
                                            "name": "Deep Depression (BOB-05)" if "one" in raw_name.lower() or "bob" in raw_name.lower() else f"Cyclone {raw_name.capitalize()}",
                                            "basin": basin,
                                            "source": "GDACS (United Nations / EC Real-Time Satellite Feed)",
                                            "is_live_telemetry": True,
                                            "telemetry_badge": "LIVE SOURCE VERIFIED",
                                            "telemetry_type": "LIVE",
                                            "category": cat,
                                            "intensity_knots": knots,
                                            "wind_convention": "1_MIN_SUSTAINED" if knots is not None else "UNAVAILABLE",
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
                                                "center_fix": "OBSERVED"
                                            },
                                            "observation_time_utc": obs_time_str
                                        })

                    if systems:
                        self.sources_status["GDACS_UN"] = "HEALTHY"
                        self.last_successful_sync["GDACS_UN"] = datetime.datetime.utcnow()
                        return FeedResult(
                            source="GDACS_UN",
                            status=FeedStatus.HEALTHY,
                            systems=systems,
                            source_url=url
                        )
                    else:
                        self.sources_status["GDACS_UN"] = "NO_ACTIVE_STORMS"
                        self.last_successful_sync["GDACS_UN"] = datetime.datetime.utcnow()
                        return FeedResult(
                            source="GDACS_UN",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            source_url=url
                        )
                else:
                    self.sources_status["GDACS_UN"] = f"FAILED (HTTP {resp.status_code})"
                    return FeedResult(
                        source="GDACS_UN",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["GDACS_UN"] = f"FAILED ({type(e).__name__})"
            return FeedResult(
                source="GDACS_UN",
                status=FeedStatus.FAILED,
                systems=[],
                error=f"{type(e).__name__}: {str(e)}",
                source_url=url
            )

    async def _fetch_jtwc_active_systems(self) -> FeedResult:
        """
        Polls NOAA / JTWC automated feeds for active tropical cyclones in the North Indian Ocean (IO).
        Returns FeedResult contract with nullable values when measurements are missing (LIVE-05, FIX-001, FIX-002).
        """
        systems = []
        self.sources_status["JTWC_NOAA"] = "Polling"
        url = "https://www.metoc.navy.mil/jtwc/rss/jtwc.rss"

        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    text_content = resp.text
                    is_valid_xml = False
                    try:
                        ET.fromstring(resp.content)
                        is_valid_xml = True
                    except Exception:
                        pass

                    is_valid_plain_bulletin = bool(re.search(r"Tropical Cyclone\s+\d+[AB]", text_content, re.IGNORECASE)) or ("NO ACTIVE WARNINGS" in text_content.upper())

                    if not is_valid_xml and not is_valid_plain_bulletin:
                        self.sources_status["JTWC_NOAA"] = "FAILED (Malformed Payload)"
                        return FeedResult(
                            source="JTWC_NOAA",
                            status=FeedStatus.FAILED,
                            systems=[],
                            error="Malformed feed payload (neither valid XML RSS nor recognized JTWC bulletin)",
                            source_url=url
                        )

                    io_matches = list(re.finditer(r"(Tropical Cyclone\s+(\d+[AB]))\s*(.*?)(?=(?:Tropical Cyclone\s+\d+[AB])|$)", text_content, re.IGNORECASE | re.DOTALL))
                    for match in io_matches:
                        full_title = match.group(1)
                        storm_code = match.group(2).upper()
                        item_body = match.group(3)
                        basin = "Bay of Bengal" if storm_code.endswith("B") else "Arabian Sea"

                        coords = self._extract_coordinates_from_bulletin(item_body)
                        if not coords:
                            continue

                        lat_val, lon_val = coords

                        w_match = re.search(r"(?:MAX(?:IMUM)?\s+SUSTAINED\s+WINDS?|WINDS?)\s+(\d{2,3})\s*KT", item_body, re.IGNORECASE)
                        knots_val = int(w_match.group(1)) if w_match else None

                        adv_match = re.search(r"WARNING\s+(?:NR|NO\.?)\s*(\d+)", item_body, re.IGNORECASE)
                        advisory_no = adv_match.group(1) if adv_match else None

                        p_match = re.search(r"(?:ESTIMATED\s+)?CENTRAL\s+PRESSURE\s+(\d{3,4})\s*(?:MB|HPA)", item_body, re.IGNORECASE)
                        pressure_val = int(p_match.group(1)) if p_match else None

                        m_match = re.search(r"PRESENT\s+MOVEMENT\s+(?:TOWARD\s+)?([A-Z0-9\s°]+?)\s+AT\s+(\d{1,2})\s*KT", item_body, re.IGNORECASE)
                        motion_dir = m_match.group(1).strip() if m_match else None
                        motion_speed_kmph = int(float(m_match.group(2)) * 1.852) if m_match else None

                        cat = "Deep Depression" if (knots_val and knots_val < 40) else ("Cyclonic Storm" if (knots_val and knots_val < 55) else "Severe Cyclonic Storm") if knots_val else "Tropical Cyclone (Unclassified)"

                        systems.append({
                            "id": f"LIVE-JTWC-{storm_code}",
                            "name": f"Cyclone {storm_code}",
                            "basin": basin,
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
                            "advisory_number": advisory_no,
                            "data_quality": {
                                "central_pressure": "OBSERVED" if pressure_val is not None else "UNAVAILABLE",
                                "movement_speed": "OBSERVED" if motion_speed_kmph is not None else "UNAVAILABLE",
                                "movement_direction": "OBSERVED" if motion_dir else "UNAVAILABLE",
                                "wind_intensity": "OBSERVED" if knots_val is not None else "UNAVAILABLE",
                                "center_fix": "OBSERVED"
                            },
                            "observation_time_utc": None
                        })

                    if systems:
                        self.sources_status["JTWC_NOAA"] = "HEALTHY"
                        self.last_successful_sync["JTWC_NOAA"] = datetime.datetime.utcnow()
                        return FeedResult(
                            source="JTWC_NOAA",
                            status=FeedStatus.HEALTHY,
                            systems=systems,
                            source_url=url
                        )
                    else:
                        self.sources_status["JTWC_NOAA"] = "NO_ACTIVE_STORMS"
                        self.last_successful_sync["JTWC_NOAA"] = datetime.datetime.utcnow()
                        return FeedResult(
                            source="JTWC_NOAA",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            source_url=url
                        )
                else:
                    self.sources_status["JTWC_NOAA"] = f"FAILED (HTTP {resp.status_code})"
                    return FeedResult(
                        source="JTWC_NOAA",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["JTWC_NOAA"] = f"FAILED ({type(e).__name__})"
            return FeedResult(
                source="JTWC_NOAA",
                status=FeedStatus.FAILED,
                systems=[],
                error=f"{type(e).__name__}: {str(e)}",
                source_url=url
            )

    def _determine_imd_category_from_text(self, text: str) -> str:
        t = text.lower()
        if "super" in t:
            return "Super Cyclonic Storm"
        if "extremely severe" in t:
            return "Extremely Severe Cyclonic Storm"
        if "very severe" in t:
            return "Very Severe Cyclonic Storm"
        if "severe" in t:
            return "Severe Cyclonic Storm"
        if "deep depression" in t:
            return "Deep Depression"
        if "depression" in t:
            return "Depression"
        return "Cyclonic Storm"

    def _category_to_knots(self, category: str) -> int:
        cat_map = {
            "Depression": 25,
            "Deep Depression": 35,
            "Cyclonic Storm": 45,
            "Severe Cyclonic Storm": 55,
            "Very Severe Cyclonic Storm": 75,
            "Extremely Severe Cyclonic Storm": 100,
            "Super Cyclonic Storm": 135
        }
        return cat_map.get(category, 35)

    def _calibrate_system_telemetry(self, system: Dict[str, Any]):
        """
        Computes Dvorak T-number (via empirical parametric wind lookup) and
        generates trajectory forecast waypoints (using kinematic vector extrapolation).
        Explicitly stamps metadata distinguishing between raw observed telemetry (0h fix, wind)
        and CycloNet-derived estimates (empirical Dvorak scale, extrapolated waypoints).
        Eliminates simulated past waypoints and false BAM forecast claims (FIX-002, FIX-003).
        """
        knots = system.get("intensity_knots")
        
        # Empirical parametric Dvorak mapping based on sustained core wind velocity
        if knots is not None:
            if knots >= 120:
                dvorak_t = "T6.0+"
            elif knots >= 90:
                dvorak_t = "T5.5"
            elif knots >= 65:
                dvorak_t = "T4.5"
            elif knots >= 45:
                dvorak_t = "T3.5"
            elif knots >= 30:
                dvorak_t = "T2.5"
            else:
                dvorak_t = "T1.5"
            dvorak_derivation_method = "Parametric Wind-Speed Scale (Decision Support Diagnostic Only)"
            dvorak_is_empirical = True
        else:
            dvorak_t = "T-Pending"
            dvorak_derivation_method = "Unavailable (Missing Wind Telemetry)"
            dvorak_is_empirical = False

        system["dvorak_t"] = dvorak_t
        system["dvorak_derivation_method"] = dvorak_derivation_method
        system["dvorak_is_empirical_estimate"] = dvorak_is_empirical
        system["track_generation_method"] = "Official Live Fix (0h) + Experimental Kinematic Extrapolation (Decision Support Layer Only)"
        system["telemetry_attribution"] = {
            "center_fix": "OBSERVED_FEED",
            "intensity_knots": "OBSERVED_FEED" if knots is not None else "UNAVAILABLE",
            "dvorak_t": "PARAMETRIC_ESTIMATE" if knots is not None else "UNAVAILABLE",
            "trajectory_forecast": "EXPERIMENTAL_KINEMATIC_EXTRAPOLATION",
            "track_accuracy_claim": "UNVERIFIED_EXPERIMENTAL_LAYER",
            "satellite_image_dvorak": "AVAILABLE_IN_CLASSIFICATION_TAB"
        }

        if not system.get("track_forecast"):
            import math
            lat = float(system["lat"])
            lon = float(system["lon"])
            cat = system["category"]
            knots_init = float(knots) if knots is not None else 35.0
            
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            synoptic_hour = (now_utc.hour // 6) * 6
            base_time = now_utc.replace(hour=synoptic_hour, minute=0, second=0, microsecond=0)
            
            def make_live_lbl(offset_h: int, knots_val: int, cat_name: str, desc_txt: str) -> str:
                pt_time = base_time + datetime.timedelta(hours=offset_h)
                cat_l = cat_name.lower()
                abbr = "DD" if "deep" in cat_l else ("D" if "dep" in cat_l else ("WML" if "low" in cat_l else "CS"))
                return f"{pt_time.day:02d}/{pt_time.hour:02d},{knots_val}KT,{abbr} ({desc_txt})"

            def classify_knots(kt: float) -> str:
                if kt >= 120: return "Super Cyclonic Storm (SuCS)"
                if kt >= 90: return "Extremely Severe Cyclonic Storm (ESCS)"
                if kt >= 64: return "Very Severe Cyclonic Storm (VSCS)"
                if kt >= 48: return "Severe Cyclonic Storm (SCS)"
                if kt >= 34: return "Cyclonic Storm (CS)"
                if kt >= 28: return "Deep Depression (DD)"
                if kt >= 17: return "Depression (D)"
                return "Well Marked Low (WML)"

            is_bay_of_bengal = lon > 78.0
            u_env_kmh = -12.5 if is_bay_of_bengal else -10.0
            v_env_kmh = 14.0 if is_bay_of_bengal else 11.5
            
            # FIX-003: Strictly official 0h fix, NO synthetic past waypoints
            track = [
                {
                    "lat": round(lat, 2),
                    "lon": round(lon, 2),
                    "time_offset_hours": 0,
                    "category": cat,
                    "intensity_knots": int(knots) if knots is not None else None,
                    "is_forecast": False,
                    "is_observed": True,
                    "method": "OFFICIAL_OBSERVATION",
                    "origin_type": "OBSERVED_CENTER_FIX",
                    "label": make_live_lbl(0, int(knots) if knots is not None else 0, cat, "Observed Live Center"),
                    "issue_time_utc": system.get("observation_time_utc") or datetime.datetime.utcnow().isoformat() + "Z",
                    "source": system.get("source", "Official Observation")
                }
            ]

            curr_lat = lat
            curr_lon = lon
            forecast_horizons = [12, 24, 48]
            prev_h = 0

            for target_h in forecast_horizons:
                dt_h = target_h - prev_h
                prev_h = target_h
                
                lat_rad = math.radians(curr_lat)
                cos_lat = max(0.2, math.cos(lat_rad))
                
                v_beta_kmh = 9.2 * cos_lat
                u_beta_kmh = -5.8 * cos_lat
                
                u_tot_kmh = u_env_kmh + u_beta_kmh
                v_tot_kmh = v_env_kmh + v_beta_kmh
                
                d_lat = (v_tot_kmh * dt_h) / 111.0
                d_lon = (u_tot_kmh * dt_h) / (111.0 * cos_lat)
                
                curr_lat += d_lat
                curr_lon += d_lon
                
                decay_alpha = 0.022 if target_h <= 24 else 0.038
                v_baseline = 20.0
                if knots is not None:
                    pred_knots = v_baseline + (knots_init - v_baseline) * math.exp(-decay_alpha * target_h)
                    pred_knots = max(18.0, round(pred_knots, 1))
                    pred_cat = classify_knots(pred_knots)
                    pred_knots_int = int(pred_knots)
                else:
                    pred_knots_int = None
                    pred_cat = cat
                
                track.append({
                    "lat": round(curr_lat, 2),
                    "lon": round(curr_lon, 2),
                    "time_offset_hours": target_h,
                    "category": pred_cat,
                    "intensity_knots": pred_knots_int,
                    "is_forecast": True,
                    "is_observed": False,
                    "method": "EXPERIMENTAL_EXTRAPOLATION",
                    "origin_type": "EXPERIMENTAL_EXTRAPOLATION",
                    "label": make_live_lbl(target_h, pred_knots_int or 0, pred_cat, f"+{target_h}h Experimental Kinematic Extrapolation"),
                    "issue_time_utc": datetime.datetime.utcnow().isoformat() + "Z",
                    "source": "CycloNet Experimental Extrapolation (Decision Support Layer Only)"
                })

            system["track_forecast"] = track

    def _persist_to_database(self, system: Dict[str, Any]):
        """
        Saves discovered active cyclone to database catalog if not already tracked.
        Excludes synthetic demo injections (LIVE-09) and sets dynamic observation dates (LIVE-10).
        """
        if system.get("is_simulation") or system.get("source_type") == "DEMO" or "SIM-" in system.get("id", ""):
            return

        try:
            db: Session = SessionLocal()
            sys_id = system["id"]
            clean_name = system.get("name", "").strip()
            current_year = datetime.datetime.utcnow().year

            # Check for existing record by exact ID or matching name in current year
            existing = db.query(CycloneArchive).filter(
                (CycloneArchive.id == sys_id) |
                ((CycloneArchive.name.ilike(f"%{clean_name}%")) & (CycloneArchive.year == current_year))
            ).first()
            
            obs_date = datetime.datetime.utcnow().strftime("%d %b %Y")
            if not existing and clean_name:
                db.add(CycloneArchive(
                    id=sys_id,
                    name=clean_name,
                    year=current_year,
                    basin=system["basin"],
                    max_category=system["category"],
                    dates=f"{obs_date} (Active Telemetry)"
                ))
                db.commit()
            elif existing:
                existing.dates = f"{obs_date} (Active Telemetry)"
                existing.name = clean_name
                db.commit()
            db.close()
        except Exception as e:
            print(f"[Live Ingestion DB Warning] Could not persist to cyclone_archive: {e}")

    def inject_test_system(self, name: str = "Shakti", basin: str = "Bay of Bengal", category: str = "Very Severe Cyclonic Storm", knots: int = 75) -> Dict[str, Any]:
        """
        Injects a synthetic simulation cyclone into the buffer for drills/tests without corrupting the historical database catalog (LIVE-09).
        """
        sys_id = f"SIM-DEMO-{name.upper()}"
        now_utc = datetime.datetime.utcnow()
        system = {
            "id": sys_id,
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
            "expires_at_utc": (now_utc + datetime.timedelta(hours=4)).isoformat() + "Z"
        }
        self._calibrate_system_telemetry(system)
        
        # Keep real live systems, only prepend the demo injection
        current_real = [s for s in self.live_systems if not s.get("is_simulation") and s.get("source_type") != "DEMO"]
        self.live_systems = [system] + current_real
        self.last_sync = now_utc
        return system

    def clear_live_systems(self, clear_all: bool = False):
        """
        Clears ONLY synthetic demo systems without deleting actual live storm state (LIVE-09),
        unless clear_all=True is explicitly specified.
        """
        if clear_all:
            self.live_systems = []
        else:
            real_systems = [s for s in self.live_systems if not s.get("is_simulation") and s.get("source_type") != "DEMO"]
            self.live_systems = real_systems
        self.last_sync = datetime.datetime.utcnow()

    async def start_periodic_worker(self, interval_seconds: int = 480):
        """
        Background loop executing sync passes every `interval_seconds`.
        Verifies active leadership status before each pass (FIX-02).
        """
        from app.core.process_lock import is_leader, update_worker_heartbeat
        print(f"[Live Ingestion Worker] Background daemon started (polling every {interval_seconds}s).")
        while True:
            try:
                if not is_leader():
                    print("[Live Ingestion Worker] Process is no longer leader. Halting ingestion loop.")
                    break
                update_worker_heartbeat()
                await self.sync_all_sources()
                
                # Optional keep-alive ping for hosted containers (configured via environment)
                if os.getenv("ENABLE_SELF_PING", "false").lower() in ("1", "true"):
                    try:
                        backend_url = os.getenv("BACKEND_HEALTH_URL", "https://cyclonet-backend.onrender.com/health")
                        frontend_url = os.getenv("FRONTEND_URL", "https://cyclonet-frontend.onrender.com")
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            await client.get(backend_url)
                            await client.get(frontend_url)
                    except Exception:
                        pass
            except Exception as e:
                print(f"[Live Ingestion Worker Exception] {e}")
            await asyncio.sleep(interval_seconds)

# Global singleton
live_ingestion_service = LiveIngestionService()
