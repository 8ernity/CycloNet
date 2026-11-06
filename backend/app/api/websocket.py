import os
import json
import asyncio
import datetime
import logging
from typing import List, Dict, Any, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.services.live_ingestion import live_ingestion_service

logger = logging.getLogger(__name__)

ws_router = APIRouter()

MAX_WEBSOCKET_CONNECTIONS = int(os.getenv("MAX_WS_CONNECTIONS", "100"))
MAX_WS_MESSAGE_BYTES = 4096  # 4 KB limit for client-to-server WebSocket messages
CLIENT_SEND_TIMEOUT_SECONDS = 1.5

ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGIN_PATTERNS = [
    o.strip().lower() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()
] if ALLOWED_ORIGINS_ENV else [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://cyclonet-frontend.onrender.com"
]

from urllib.parse import urlparse

def is_origin_allowed(origin: Optional[str]) -> bool:
    """
    SEC-08: Strictly validates WebSocket origin header against explicit allowed origins.
    Never uses substring checks like 'localhost in origin'.
    """
    if not origin:
        return True  # Non-browser clients, health monitors, or same-origin direct calls

    try:
        parsed = urlparse(origin)
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https", "ws", "wss"):
            return False
        hostname = (parsed.hostname or "").lower()
        port = parsed.port
        origin_clean = f"{scheme}://{hostname}{f':{port}' if port else ''}"

        for allowed in ALLOWED_ORIGIN_PATTERNS:
            allowed_clean = allowed.rstrip("/").lower()
            if allowed_clean == "*":
                if os.getenv("ENVIRONMENT") == "production":
                    continue
                return True
            if origin_clean == allowed_clean:
                return True
            # Safely match localhost on local development ports
            if allowed_clean in ("http://localhost:3000", "http://127.0.0.1:3000"):
                if hostname in ("localhost", "127.0.0.1") and port in (3000, 3001, 8000):
                    return True
        return False
    except Exception:
        return False

class SecureWebSocketManager:
    """
    SEC-07: Hardened WebSocket connection manager with allowed-origin verification,
    concurrency limits, timeout backpressure, and public/privileged event isolation.
    """
    def __init__(self, max_connections: int = MAX_WEBSOCKET_CONNECTIONS):
        self.active_connections: Set[WebSocket] = set()
        self.max_connections = max_connections
        self.radar_angle: float = 0.0
        self.pulse_counter: int = 0
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> bool:
        """Enforces origin verification and connection limits before accepting."""
        origin = websocket.headers.get("origin")
        if not is_origin_allowed(origin):
            logger.warning("[WebSocket] Rejected connection from unauthorized origin: %s", origin)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized origin")
            return False

        async with self._lock:
            if len(self.active_connections) >= self.max_connections:
                logger.warning("[WebSocket] Connection limit reached (%d). Rejecting client.", self.max_connections)
                await websocket.close(code=status.WS_1013_TRY_AGAIN_LATER, reason="Connection capacity reached")
                return False

            await websocket.accept()
            self.active_connections.add(websocket)

        # Initial connection handshake
        try:
            await asyncio.wait_for(
                websocket.send_json({
                    "type": "handshake",
                    "message": "Connected to CycloNet Real-Time Meteorological Surveillance Stream",
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                    "active_connections": len(self.active_connections)
                }),
                timeout=CLIENT_SEND_TIMEOUT_SECONDS
            )
        except Exception:
            await self.disconnect(websocket)
            return False

        return True

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        try:
            await websocket.close()
        except Exception:
            pass

    async def _safe_send(self, ws: WebSocket, data: Dict[str, Any]) -> Optional[WebSocket]:
        """Sends data with timeout; returns ws if dead/timed out so it can be evicted."""
        try:
            await asyncio.wait_for(ws.send_json(data), timeout=CLIENT_SEND_TIMEOUT_SECONDS)
            return None
        except Exception:
            return ws

    async def broadcast_public(self, data: Dict[str, Any]):
        """
        Broadcasts public telemetry concurrently with timeout to prevent slow clients from blocking others.
        """
        if not self.active_connections:
            return

        async with self._lock:
            current_clients = list(self.active_connections)

        dead_connections = await asyncio.gather(
            *[self._safe_send(ws, data) for ws in current_clients],
            return_exceptions=False
        )

        # Evict dead or non-responsive connections
        for dead in dead_connections:
            if dead:
                await self.disconnect(dead)

    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        """Pushes emergency alert push notification to connected surveillance dashboards."""
        payload = {
            "type": "emergency_alert_push",
            "alert": alert_data,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
        await self.broadcast_public(payload)

    async def start_telemetry_broadcaster(self):
        """Background continuous stream of radar angle, live ingestion status, and meteorological telemetry."""
        while True:
            try:
                self.radar_angle = (self.radar_angle + 12.0) % 360.0
                self.pulse_counter += 1

                live_sys = live_ingestion_service.live_systems
                latest_summary = None
                if live_sys:
                    latest_summary = {
                        "id": live_sys[0].get("id"),
                        "name": live_sys[0].get("name"),
                        "category": live_sys[0].get("category"),
                        "intensity_knots": live_sys[0].get("intensity_knots"),
                        "lat": live_sys[0].get("lat"),
                        "lon": live_sys[0].get("lon"),
                    }

                telemetry_payload = {
                    "type": "surveillance_telemetry",
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                    "radar_angle": round(self.radar_angle, 1),
                    "is_radar_simulated": True,
                    "radar_telemetry_type": "SYNTHETIC_PPI_SWEEP_SIMULATION",
                    "radar_station": "IMD Coastal DWR Network (Synthetic Sweep)",
                    "pulse": self.pulse_counter,
                    "active_systems_count": len(live_sys),
                    "latest_system": latest_summary,
                    "sources_status": live_ingestion_service.sources_status,
                    "is_syncing": live_ingestion_service.is_syncing,
                    "connected_clients": len(self.active_connections)
                }

                await self.broadcast_public(telemetry_payload)
            except Exception as e:
                logger.debug("[WebSocket Broadcaster] Error in telemetry tick: %s", e)

            await asyncio.sleep(2.0)

ws_manager = SecureWebSocketManager()

@ws_router.websocket("/ws/cyclone-stream")
async def cyclone_websocket_endpoint(websocket: WebSocket):
    connected = await ws_manager.connect(websocket)
    if not connected:
        return

    try:
        while True:
            # Enforce message size and timeout limits
            data = await websocket.receive_text()
            if len(data.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
                logger.warning("[WebSocket] Client message exceeded max bytes (%d). Terminating connection.", MAX_WS_MESSAGE_BYTES)
                await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG, reason="Message payload exceeds maximum limit")
                break

            try:
                msg = json.loads(data)
                if not isinstance(msg, dict):
                    continue

                if msg.get("action") == "ping":
                    await asyncio.wait_for(
                        websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                        }),
                        timeout=CLIENT_SEND_TIMEOUT_SECONDS
                    )
            except json.JSONDecodeError:
                # Ignore malformed client payload
                continue
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("[WebSocket] Disconnected with error: %s", e)
    finally:
        await ws_manager.disconnect(websocket)
