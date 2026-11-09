import os
import time
import json
import asyncio
import datetime
import logging
from typing import List, Dict, Any, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, HTTPException
from app.core.auth import decode_token_payload, parse_role_from_claims, Role
from app.core.rate_limit import enforce_rate_limit

from app.services.live_ingestion import live_ingestion_service

logger = logging.getLogger(__name__)

ws_router = APIRouter()

MAX_WEBSOCKET_CONNECTIONS = int(os.getenv("MAX_WS_CONNECTIONS", "100"))
MAX_WS_MESSAGE_BYTES = 4096  # 4 KB limit for client-to-server WebSocket messages
CLIENT_SEND_TIMEOUT_SECONDS = 1.5

from app.core.origins import configured_origins, normalize_origin


def is_origin_allowed(origin: Optional[str]) -> bool:
    # This is a public telemetry stream; non-browser clients may omit Origin.
    if origin is None:
        return True
    normalized = normalize_origin(origin)
    if normalized is None:
        return False
    allowed = configured_origins()
    return normalized in allowed or "*" in allowed

class SecureWebSocketManager:
    """
    SEC-07: Hardened WebSocket connection manager with allowed-origin verification,
    concurrency limits, timeout backpressure, and public/privileged event isolation.
    """
    def __init__(self, max_connections: int = MAX_WEBSOCKET_CONNECTIONS, operator_only=False):
        self.operator_only = operator_only
        self.expires = {}
        self.pending = set()
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

        try:
            enforce_rate_limit(websocket, endpoint_type="websocket")
        except HTTPException:
            await websocket.close(code=1013, reason="Connection rate exceeded or limiter unavailable")
            return False
        async with self._lock:
            if len(self.active_connections) + len(self.pending) >= self.max_connections:
                await websocket.close(code=1013, reason="Connection capacity reached")
                return False
            self.pending.add(websocket)
        try:
            await websocket.accept()
            if self.operator_only:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=5)
                if len(raw.encode()) > MAX_WS_MESSAGE_BYTES:
                    raise ValueError("Authentication frame too large")
                frame = json.loads(raw)
                claims = await asyncio.wait_for(asyncio.to_thread(decode_token_payload, frame.get("token", "")), timeout=5)
                if not claims or not claims.get("sub") or parse_role_from_claims(claims) not in (Role.ADMINISTRATOR, Role.AUTHORIZED_OPERATOR):
                    raise ValueError("Operator credentials required")
                self.expires[websocket] = float(claims['exp'])
            async with self._lock:
                self.active_connections.add(websocket)
        except Exception:
            self.expires.pop(websocket, None)
            await websocket.close(code=1008, reason="Operator authentication required")
            return False
        finally:
            async with self._lock:
                self.pending.discard(websocket)

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
        self.expires.pop(websocket, None)
        try:
            await websocket.close()
        except Exception:
            pass

    async def _safe_send(self, ws: WebSocket, data: Dict[str, Any]) -> Optional[WebSocket]:
        """Sends data with timeout; returns ws if dead/timed out so it can be evicted."""
        if self.operator_only and self.expires.get(ws, 0) <= time.time():
            return ws
        try:
            await asyncio.wait_for(ws.send_json(data), timeout=CLIENT_SEND_TIMEOUT_SECONDS)
            return None
        except Exception:
            return ws

    async def broadcast_public(self, data: Dict[str, Any]):
        # Only the public telemetry schema is allowed; unknown event types fail closed.
        if data.get("type") != "surveillance_telemetry":
            return
        allowed = {"type", "timestamp", "radar_angle", "is_radar_simulated", "radar_telemetry_type",
                   "radar_station", "pulse", "active_systems_count", "latest_system",
                   "sources_status", "is_syncing", "connected_clients"}
        public = {key: value for key, value in data.items() if key in allowed}
        if isinstance(public.get("latest_system"), dict):
            public['latest_system'] = {key: value for key, value in public['latest_system'].items()
                if key in {'id','name','category','intensity_knots','lat','lon','source','observation_time_utc','is_stale'}}
        await self._broadcast(public)

    async def _broadcast(self, data: Dict[str, Any]):
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
        """Privileged drafts never share the public telemetry transport."""
        await operator_manager._broadcast({"type":"operator_exercise_draft", "mode":"EXERCISE",
            "alert":alert_data, "timestamp":datetime.datetime.now(datetime.timezone.utc).isoformat()})

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
                        "source": live_sys[0].get("source"),
                        "observation_time_utc": live_sys[0].get("observation_time_utc"),
                        "is_stale": live_sys[0].get("is_stale", True),
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
operator_manager = SecureWebSocketManager(operator_only=True)

async def serve_socket(websocket, manager):
    if not await manager.connect(websocket):
        return
    messages = []
    try:
        while True:
            remaining = manager.expires.get(websocket, time.time()+60) - time.time()
            if remaining <= 0:
                await websocket.close(code=1008, reason="Credentials expired")
                break
            data = await asyncio.wait_for(websocket.receive_text(), timeout=min(60, remaining))
            now = time.time()
            messages = [t for t in messages if t > now-60]
            if len(messages) >= 60:
                await websocket.close(code=1008, reason="Message rate exceeded")
                break
            messages.append(now)
            if len(data.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
                await websocket.close(code=1009, reason="Message too large")
                break
            try:
                msg = json.loads(data)
                if isinstance(msg, dict) and msg.get("action") == "ping":
                    await asyncio.wait_for(websocket.send_json({"type":"pong"}), CLIENT_SEND_TIMEOUT_SECONDS)
            except (ValueError, RecursionError):
                await websocket.close(code=1008, reason="Malformed message")
                break
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        await manager.disconnect(websocket)

@ws_router.websocket("/ws/cyclone-stream")
@ws_router.websocket("/ws/live")
async def cyclone_websocket_endpoint(websocket: WebSocket):
    await serve_socket(websocket, ws_manager)

@ws_router.websocket("/ws/operator-events")
async def operator_websocket_endpoint(websocket: WebSocket):
    # JWT is sent in the first bounded frame, never in URLs or public events.
    await serve_socket(websocket, operator_manager)
