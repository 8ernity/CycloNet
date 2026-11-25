"""Automated meteorological ingestion service and multi-source orchestrator."""

import asyncio
import datetime
import json
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from app.core.observability import logger as event_logger
from app.models.feed_result import FeedResult, FeedStatus
from app.services.feed_policy import reconcile
from app.services.ingestion.adapters.gdacs import fetch_gdacs_active_systems
from app.services.ingestion.adapters.imd import fetch_imd_bulletins
from app.services.ingestion.adapters.jtwc import fetch_jtwc_active_systems, fetch_meteorological_news_alerts
from app.services.ingestion.fixtures import (
    build_demo_injection_system,
    calibrate_system_telemetry,
    get_default_active_bob_system,
)
from app.services.ingestion.parsers import determine_imd_category_from_text, extract_coordinates_from_bulletin
from app.services.ingestion.state_store import read_live_systems, write_live_systems

__all__ = ["LiveIngestionService", "get_default_active_bob_system", "live_ingestion_service"]


class LiveIngestionService:
    """Monitors open feeds (IMD RSMC, NOAA/JTWC, UN GDACS) and reconciles active NIO cyclones."""

    def __init__(self) -> None:
        self.last_sync: Optional[datetime.datetime] = None
        self.last_attempt_at: Optional[str] = None
        self.last_duration_ms: Optional[float] = None
        self.last_sync_outcome: str = "not_started"
        self.is_syncing: bool = False
        self.last_error: Optional[str] = None
        self.basin_status: str = "STATUS_UNCERTAIN"
        self.retired_systems: List[Dict[str, Any]] = []
        self.sources_status: Dict[str, str] = {
            "IMD_RSMC": "UNAVAILABLE",
            "JTWC_NOAA": "UNAVAILABLE",
            "GDACS_UN": "UNAVAILABLE",
            "ISRO_MOSDAC": "UNAVAILABLE",
        }
        self.last_successful_sync: Dict[str, Optional[datetime.datetime]] = {
            "IMD_RSMC": None,
            "JTWC_NOAA": None,
            "GDACS_UN": None,
            "ISRO_MOSDAC": None,
        }
        self._in_memory_systems: List[Dict[str, Any]] = []
        self._background_task: Optional[asyncio.Task[Any]] = None
        self._sync_generation: Optional[int] = None

    @property
    def live_systems(self) -> List[Dict[str, Any]]:
        """Retrieve active systems from persistent DB/shared storage."""
        return read_live_systems(getattr(self, "_in_memory_systems", []))

    @live_systems.setter
    def live_systems(self, systems: List[Dict[str, Any]]) -> None:
        """Persist active cyclone state into DB/shared storage across workers."""
        write_live_systems(systems, getattr(self, "_sync_generation", None))
        self._in_memory_systems = systems

    async def sync_all_sources(self) -> Dict[str, Any]:
        """Execute a synchronization pass across all meteorological sources."""
        if self.is_syncing:
            return {"status": "already_syncing", "message": "Synchronization is already in progress"}

        from app.core import process_lock

        if os.getenv("ENVIRONMENT", "development").lower() == "production" and not process_lock.update_worker_heartbeat():
            raise RuntimeError("Only the active lease owner may ingest")
        self._sync_generation = process_lock.get_leader_generation()
        self.is_syncing = True
        started = time.monotonic()
        self.last_attempt_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.last_sync_outcome = "failed"
        self.last_error = None

        try:
            gdacs_res = await self._fetch_gdacs_active_systems()
            imd_res = await self._fetch_imd_bulletins()
            jtwc_res = await self._fetch_jtwc_active_systems()
            results = [gdacs_res, imd_res, jtwc_res]

            for result in results:
                self.sources_status[result.source] = result.status.value
                if result.status in (FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS):
                    self.last_successful_sync[result.source] = result.retrieved_at
                elif result.error:
                    self.last_error = f"{result.source}: {result.error}"

            systems, retired = reconcile(self.live_systems, results)
            for system in systems:
                if (system.get("name") and re.match(r"^Cyclone \d+[AB]$", system["name"])) or not system.get("name"):
                    news_name = await self._fetch_meteorological_news_alerts()
                    if news_name:
                        system["name"] = f"Cyclone {news_name}"
                self._calibrate_system_telemetry(system)

            self.live_systems = systems
            healthy_count = sum(r.status in (FeedStatus.HEALTHY, FeedStatus.NO_ACTIVE_STORMS) for r in results)
            status_label = "success" if healthy_count == len(results) else "partial_monitoring" if healthy_count else "outage"

            if not systems and all(
                r.status == FeedStatus.NO_ACTIVE_STORMS and r.calm_evidence and r.complete_coverage for r in results
            ):
                self.basin_status = "NO_ACTIVE_STORMS_VERIFIED"
            elif any(s.get("reconciliation_status") == "ACTIVE_VERIFIED" for s in systems):
                self.basin_status = "ACTIVE_VERIFIED"
            else:
                self.basin_status = "STATUS_UNCERTAIN"

            self.retired_systems = retired
            self.last_sync = datetime.datetime.utcnow()
            self.last_sync_outcome = status_label

            return {
                "status": status_label,
                "basin_status": self.basin_status,
                "synced_at": self.last_sync.isoformat() + "Z",
                "active_systems_count": len(self.live_systems),
                "systems": self.live_systems,
                "sources_status": self.sources_status,
            }
        except Exception as exc:
            self.last_error = str(exc)
            event_logger.error("[Live Ingestion Error] Failed during sync: %s", exc)
            return {
                "status": "partial" if self.live_systems else "error",
                "synced_at": self.last_sync.isoformat() + "Z" if self.last_sync else None,
                "active_systems_count": len(self.live_systems),
                "systems": self.live_systems,
                "sources_status": self.sources_status,
                "error": str(exc),
                "note": "Synchronization encountered an unhandled error; serving cached basin telemetry.",
            }
        finally:
            self.is_syncing = False
            self.last_duration_ms = round((time.monotonic() - started) * 1000, 2)
            event_logger.info(
                json.dumps(
                    {
                        "event": "ingestion_sync",
                        "outcome": self.last_sync_outcome,
                        "duration_ms": self.last_duration_ms,
                        "time": self.last_attempt_at,
                    }
                )
            )

    def _extract_coordinates_from_bulletin(self, text: str) -> Optional[tuple[float, float]]:
        return extract_coordinates_from_bulletin(text)

    async def _fetch_meteorological_news_alerts(self) -> Optional[str]:
        return await fetch_meteorological_news_alerts()

    async def _fetch_imd_bulletins(self) -> FeedResult:
        return await fetch_imd_bulletins(
            set_status=lambda status: self.sources_status.__setitem__("IMD_RSMC", status),
            mark_success=lambda: self.last_successful_sync.__setitem__("IMD_RSMC", datetime.datetime.utcnow()),
            set_error=lambda err: setattr(self, "last_error", err),
        )

    async def _fetch_gdacs_active_systems(self) -> FeedResult:
        return await fetch_gdacs_active_systems(
            set_status=lambda status: self.sources_status.__setitem__("GDACS_UN", status),
            mark_success=lambda: self.last_successful_sync.__setitem__("GDACS_UN", datetime.datetime.utcnow()),
        )

    async def _fetch_jtwc_active_systems(self) -> FeedResult:
        return await fetch_jtwc_active_systems(
            set_status=lambda status: self.sources_status.__setitem__("JTWC_NOAA", status),
            mark_success=lambda: self.last_successful_sync.__setitem__("JTWC_NOAA", datetime.datetime.utcnow()),
        )

    def _determine_imd_category_from_text(self, text: str) -> str:
        return determine_imd_category_from_text(text)

    def _calibrate_system_telemetry(self, system: Dict[str, Any]) -> None:
        calibrate_system_telemetry(system)

    def inject_test_system(
        self,
        name: str = "Shakti",
        basin: str = "Bay of Bengal",
        category: str = "Very Severe Cyclonic Storm",
        knots: int = 75,
    ) -> Dict[str, Any]:
        """Inject a synthetic simulation cyclone for drills without modifying the catalog."""
        now_utc = datetime.datetime.utcnow()
        system = build_demo_injection_system(name, basin, category, knots, now_utc)
        self._calibrate_system_telemetry(system)
        current_real = [
            s for s in self.live_systems if not s.get("is_simulation") and s.get("source_type") != "DEMO"
        ]
        self.live_systems = [system] + current_real
        self.last_sync = now_utc
        return system

    def clear_live_systems(self, clear_all: bool = False) -> None:
        """Clear synthetic demo systems (or all active systems when clear_all=True)."""
        if clear_all:
            self.live_systems = []
        else:
            self.live_systems = [
                s for s in self.live_systems if not s.get("is_simulation") and s.get("source_type") != "DEMO"
            ]
        self.last_sync = datetime.datetime.utcnow()

    async def start_periodic_worker(self, interval_seconds: int = 480) -> None:
        """Background loop executing sync passes every `interval_seconds` while leader."""
        from app.core.process_lock import is_leader, update_worker_heartbeat

        event_logger.info("[Live Ingestion Worker] Background daemon started (interval=%ss).", interval_seconds)
        while True:
            try:
                if not is_leader():
                    event_logger.info("[Live Ingestion Worker] Process is no longer leader. Halting ingestion loop.")
                    break
                update_worker_heartbeat()
                await self.sync_all_sources()

                if os.getenv("ENABLE_SELF_PING", "false").lower() in ("1", "true"):
                    try:
                        backend_url = os.getenv("BACKEND_HEALTH_URL", "https://cyclonet-backend.onrender.com/health")
                        frontend_url = os.getenv("FRONTEND_URL", "https://cyclonet-frontend.onrender.com")
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            await client.get(backend_url)
                            await client.get(frontend_url)
                    except Exception as ping_err:
                        event_logger.debug("Self-ping failed: %s", type(ping_err).__name__)
            except Exception as exc:
                event_logger.warning("[Live Ingestion Worker Exception] %s", exc)
            await asyncio.sleep(interval_seconds)


live_ingestion_service = LiveIngestionService()
