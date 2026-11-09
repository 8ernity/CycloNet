import asyncio
import os
import json
import re
import datetime
import time
from app.core.observability import logger as event_logger
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import httpx
from app.services.feed_http import FeedClient
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.domain import CycloneArchive, ActiveCycloneState
from app.models.feed_result import FeedResult, FeedStatus
from app.services.feed_policy import assess_feed, reconcile, parse_time, fresh, BASINS
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
            {"lat": 18.1, "lon": 83.7, "time_offset_hours": 0, "category": "Deep Depression", "intensity_knots": 35, "is_forecast": False, "is_observed": False, "origin_type": "SIMULATION_CENTER_FIX", "label": make_live_label(0, 35, "Deep Depression", "Simulation Center - Coastal Crossing near Kalingapatnam")},
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
        self.last_sync: Optional[datetime.datetime] = None
        self.last_attempt_at = None
        self.last_duration_ms = None
        self.last_sync_outcome = 'not_started'
        self.is_syncing: bool = False
        self.last_error: Optional[str] = None
        self.sources_status: Dict[str, str] = {
            "IMD_RSMC": "UNAVAILABLE",
            "JTWC_NOAA": "UNAVAILABLE",
            "GDACS_UN": "UNAVAILABLE",
            "ISRO_MOSDAC": "UNAVAILABLE"
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
                if os.getenv('ENVIRONMENT', '').lower() == 'production':
                    raise RuntimeError('Shared active state is missing; migration required')
            finally:
                db.close()
        except Exception:
            if os.getenv("ENVIRONMENT", "development").lower() == "production":
                raise
        return getattr(self, "_in_memory_systems", [])

    @live_systems.setter
    def live_systems(self, systems: List[Dict[str, Any]]):
        """
        Persists active cyclone state into DB/shared storage for multi-process cross-worker synchronization.
        """
        if os.getenv("ENVIRONMENT", "development").lower() == "production":
            from app.core import process_lock
            from app.core.shared_state import commit_systems
            generation = getattr(self, "_sync_generation", process_lock.get_leader_generation())
            commit_systems(systems, generation, process_lock.WORKER_TOKEN, process_lock.update_worker_heartbeat)
            self._in_memory_systems = systems
            return
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

        from app.core import process_lock
        if os.getenv("ENVIRONMENT", "development").lower() == "production" and not process_lock.update_worker_heartbeat():
            raise RuntimeError("Only the active lease owner may ingest")
        self._sync_generation = process_lock.get_leader_generation()
        self.is_syncing = True
        started = time.monotonic()
        self.last_attempt_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.last_sync_outcome = 'failed'
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

            systems, retired = reconcile(self.live_systems, results)
            for system in systems:
                self._calibrate_system_telemetry(system)
            self.live_systems = systems
            healthy_count = sum(r.status in (FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS) for r in results)
            status_label = "success" if healthy_count == len(results) else "partial_monitoring" if healthy_count else "outage"
            self.basin_status = "ACTIVE_VERIFIED" if any(s.get("reconciliation_status") == "ACTIVE_VERIFIED" for s in systems) else "STATUS_UNCERTAIN"
            if not systems and all(r.status == FeedStatus.NO_ACTIVE_STORMS and r.calm_evidence and r.complete_coverage for r in results):
                self.basin_status = "NO_ACTIVE_STORMS_VERIFIED"
            self.retired_systems = retired

            self.last_sync = datetime.datetime.utcnow()
            self.last_sync_outcome = status_label

            return {
                "status": status_label,
                "basin_status": self.basin_status,
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
                "synced_at": self.last_sync.isoformat() + "Z" if self.last_sync else None,
                "active_systems_count": len(self.live_systems),
                "systems": self.live_systems,
                "sources_status": self.sources_status,
                "error": str(e),
                "note": "Synchronization encountered an unhandled error; serving cached basin telemetry."
            }
        finally:
            self.is_syncing = False
            self.last_duration_ms = round((time.monotonic() - started) * 1000, 2)
            event_logger.info(json.dumps({'event':'ingestion_sync','outcome':self.last_sync_outcome,
                                         'duration_ms':self.last_duration_ms,'time':self.last_attempt_at}))

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
            async with FeedClient(timeout=6.0, follow_redirects=True) as client:
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
            async with FeedClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    text_content = soup.get_text()

                    # This adapter supports one dated advisory only. A landing page
                    # containing multiple systems/positions is not an observation.
                    # Document headings describe the bulletin, not a storm named BULLETIN.
                    advisory_body = re.sub(r"CYCLONIC STORM BULLETIN\s+NO\.\s*\d+", "", text_content, flags=re.IGNORECASE)
                    names = set(n.upper() for n in re.findall(r"Cyclonic Storm\s+['\"]?([A-Za-z0-9-]+)", advisory_body, re.IGNORECASE))
                    positions = set(re.findall(r"(\d{1,2}(?:\.\d+)?)\s*°?\s*N.*?(\d{2,3}(?:\.\d+)?)\s*°?\s*E", text_content, re.IGNORECASE))
                    dates = set(re.findall(r"20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|\+00:00)", text_content))
                    if len(names) > 1 or len(positions) > 1 or len(dates) != 1:
                        return assess_feed(source="IMD_RSMC", status=FeedStatus.DEGRADED,
                            systems=[], error="Unsupported or ambiguous advisory scope", source_url=url)

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

                    date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|\+00:00))", text_content)
                    obs_time_dt = parse_time(date_match.group(1)) if date_match else None

                    if has_active_bulletin:
                        for kw in keywords:
                            match = re.search(kw, advisory_body, re.IGNORECASE)
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

                                speed_matches = re.findall(r"(?:MOVEMENT\s+SPEED|MOVED|MOVING\s+AT)\s*(\d{1,3}(?:\.\d+)?)\s*(KMPH|KM/H|KNOTS|KT)\b", text_content, re.IGNORECASE)
                                # More than one speed could refer to wind/another fix.
                                speed_raw, speed_unit = (float(speed_matches[0][0]), speed_matches[0][1].upper()) if len(speed_matches) == 1 else (None, None)
                                speed_val = speed_raw * (1.852 if speed_unit in ("KT", "KNOTS") else 1) if speed_raw is not None else None

                                compass = {'NORTH':'N', 'SOUTH':'S', 'EAST':'E', 'WEST':'W',
                                    'NORTHWEST':'NW', 'NORTHEAST':'NE', 'SOUTHWEST':'SW', 'SOUTHEAST':'SE'}
                                compass.update({d:d for d in ('N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW')})
                                directions = re.findall(r"\b(?:DIRECTION|TOWARDS?|MOVING)\s+(" + '|'.join(compass) + r")\b", text_content, re.IGNORECASE)
                                direction_values = {compass[d.upper()] for d in directions}
                                dir_val = next(iter(direction_values)) if len(direction_values) == 1 else None

                                w_match = re.search(r"(?:SUSTAINED\s+WINDS?|WIND\s+SPEED)\s*(?:OF)?\s*(\d{2,3})\s*(?:KT|KNOTS)", text_content, re.IGNORECASE)
                                knots_val = int(w_match.group(1)) if w_match else None

                                systems.append({
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
                                        "center_fix": "OBSERVED"
                                    },
                                    "observation_time_utc": obs_time_dt.isoformat() if obs_time_dt else None
                                })
                                break

                        if systems:
                            self.sources_status["IMD_RSMC"] = "HEALTHY"
                            self.last_successful_sync["IMD_RSMC"] = datetime.datetime.utcnow()
                            return assess_feed(
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
                            return assess_feed(
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
                        return assess_feed(
                            source="IMD_RSMC",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            observed_at=obs_time_dt,
                            source_url=url
                        )
                else:
                    self.sources_status["IMD_RSMC"] = f"FAILED (HTTP {resp.status_code})"
                    return assess_feed(
                        source="IMD_RSMC",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["IMD_RSMC"] = f"FAILED ({type(e).__name__})"
            self.last_error = f"IMD fetch error: {e}"
            return assess_feed(
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
            async with FeedClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    try:
                        root = ET.fromstring(resp.content)
                    except Exception as parse_err:
                        self.sources_status["GDACS_UN"] = f"FAILED (XML Parse Error: {type(parse_err).__name__})"
                        return assess_feed(
                            source="GDACS_UN",
                            status=FeedStatus.FAILED,
                            systems=[],
                            error=f"XML parse error: {parse_err}",
                            source_url=url
                        )
                    channel = root.find("channel")
                    if root.tag != "rss" or channel is None or "gdacs" not in (channel.findtext("title") or "").lower():
                        return assess_feed(source="GDACS_UN", status=FeedStatus.FAILED, error="Unrecognized GDACS document", source_url=url)
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
                                                "center_fix": "OBSERVED"
                                            },
                                            "observation_time_utc": obs_time_str
                                        })

                    if systems:
                        self.sources_status["GDACS_UN"] = "HEALTHY"
                        self.last_successful_sync["GDACS_UN"] = datetime.datetime.utcnow()
                        return assess_feed(
                            source="GDACS_UN",
                            status=FeedStatus.HEALTHY,
                            systems=systems,
                            source_url=url
                        )
                    else:
                        self.sources_status["GDACS_UN"] = "NO_ACTIVE_STORMS"
                        self.last_successful_sync["GDACS_UN"] = datetime.datetime.utcnow()
                        return assess_feed(
                            source="GDACS_UN",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            source_url=url
                        )
                else:
                    self.sources_status["GDACS_UN"] = f"FAILED (HTTP {resp.status_code})"
                    return assess_feed(
                        source="GDACS_UN",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["GDACS_UN"] = f"FAILED ({type(e).__name__})"
            return assess_feed(
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
            async with FeedClient(timeout=6.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 200:
                    text_content = resp.text
                    is_valid_xml = False
                    try:
                        xml_root = ET.fromstring(resp.content)
                        channel = xml_root.find("channel")
                        is_valid_xml = xml_root.tag == "rss" and channel is not None and "jtwc" in (channel.findtext("title") or "").lower()
                    except Exception:
                        pass

                    is_valid_plain_bulletin = bool(re.search(r"Tropical Cyclone\s+\d+[AB]", text_content, re.IGNORECASE)) or ("NO ACTIVE WARNINGS" in text_content.upper())

                    if not is_valid_xml and not is_valid_plain_bulletin:
                        self.sources_status["JTWC_NOAA"] = "FAILED (Malformed Payload)"
                        return assess_feed(
                            source="JTWC_NOAA",
                            status=FeedStatus.FAILED,
                            systems=[],
                            error="Malformed feed payload (neither valid XML RSS nor recognized JTWC bulletin)",
                            source_url=url
                        )

                    issue = None
                    if is_valid_xml:
                        issue = parse_time(channel.findtext("lastBuildDate") or channel.findtext("pubDate"))
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
                            "observation_time_utc": None,  # RSS build time is not a physical storm observation
                            "source_issue_time_utc": issue.isoformat() if issue else None
                        })

                    if systems:
                        self.sources_status["JTWC_NOAA"] = "HEALTHY"
                        self.last_successful_sync["JTWC_NOAA"] = datetime.datetime.utcnow()
                        return assess_feed(
                            source="JTWC_NOAA",
                            status=FeedStatus.HEALTHY,
                            systems=systems,
                            source_url=url
                        )
                    else:
                        self.sources_status["JTWC_NOAA"] = "NO_ACTIVE_STORMS"
                        self.last_successful_sync["JTWC_NOAA"] = datetime.datetime.utcnow()
                        return assess_feed(
                            source="JTWC_NOAA",
                            status=FeedStatus.NO_ACTIVE_STORMS,
                            systems=[],
                            source_url=url
                        )
                else:
                    self.sources_status["JTWC_NOAA"] = f"FAILED (HTTP {resp.status_code})"
                    return assess_feed(
                        source="JTWC_NOAA",
                        status=FeedStatus.FAILED,
                        systems=[],
                        error=f"HTTP {resp.status_code}",
                        source_url=url
                    )
        except Exception as e:
            self.sources_status["JTWC_NOAA"] = f"FAILED ({type(e).__name__})"
            return assess_feed(
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
        has_forecast = any(point.get("is_forecast") for point in system.get("track_forecast", []))
        if has_forecast:
            system.setdefault("track_generation_method", "Supplied track; generation method unverified")
        else:
            system["track_generation_method"] = "Simulation center fix only; forecast unavailable" if system.get("is_simulation") else "Source center fix only; forecast unavailable"
        provenance = "SIMULATION" if system.get("is_simulation") else "OBSERVED_FEED"
        system["telemetry_attribution"] = {
            "center_fix": provenance,
            "intensity_knots": provenance if knots is not None else "UNAVAILABLE",
            "dvorak_t": "PARAMETRIC_ESTIMATE" if knots is not None else "UNAVAILABLE",
            "trajectory_forecast": "UNAVAILABLE" if not has_forecast else system["track_generation_method"],
            "track_accuracy_claim": "UNVERIFIED_EXPERIMENTAL_LAYER",
            "satellite_image_dvorak": "AVAILABLE_IN_CLASSIFICATION_TAB"
        }

        if not system.get("track_forecast"):
            system["track_generation_method"] = "Simulation center fix only; forecast unavailable" if system.get("is_simulation") else "Source center fix only; forecast unavailable"
            system["track_forecast"] = [{
                "lat": system["lat"], "lon": system["lon"], "time_offset_hours": 0,
                "category": system["category"], "intensity_knots": knots, "is_forecast": False,
                "is_observed": not system.get("is_simulation", False),
                "method": "SIMULATION" if system.get("is_simulation") else "OFFICIAL_OBSERVATION",
                "origin_type": "SIMULATION_CENTER_FIX" if system.get("is_simulation") else "OBSERVED_CENTER_FIX",
                "label": f"Wind: {str(knots) + ' KT' if knots is not None else 'Not available'}; source time: {system.get('observation_time_utc') or 'Not available'}",
                "issue_time_utc": system.get("observation_time_utc"), "source": system.get("source")
            }]

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
