import asyncio
import json
import datetime
from typing import List, Dict, Any, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.live_ingestion import live_ingestion_service

ws_router = APIRouter()

class WebSocketConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.radar_angle: float = 0.0
        self.pulse_counter: int = 0
        self._broadcaster_task: asyncio.Task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        # Send initial connection handshake
        await websocket.send_json({
            "type": "handshake",
            "message": "Connected to CycloNet Real-Time Meteorological Surveillance Stream",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "active_connections": len(self.active_connections)
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        if not self.active_connections:
            return
        
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                dead_connections.add(connection)
        
        for dead in dead_connections:
            self.disconnect(dead)

    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        """Pushes immediate high-priority emergency alert to all connected operators."""
        payload = {
            "type": "emergency_alert_push",
            "alert": alert_data,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
        await self.broadcast(payload)

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
                    "pulse": self.pulse_counter,
                    "active_systems_count": len(live_sys),
                    "latest_system": latest_summary,
                    "sources_status": live_ingestion_service.sources_status,
                    "is_syncing": live_ingestion_service.is_syncing,
                    "connected_clients": len(self.active_connections)
                }

                await self.broadcast(telemetry_payload)
            except Exception as e:
                # Keep background loop running
                pass

            await asyncio.sleep(2.0)

ws_manager = WebSocketConnectionManager()

@ws_router.websocket("/ws/cyclone-stream")
async def cyclone_websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
