"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface TelemetryPayload {
  type: string;
  timestamp: string;
  radar_angle: number;
  pulse: number;
  active_systems_count: number;
  latest_system: any;
  sources_status: Record<string, string>;
  is_syncing: boolean;
  connected_clients: number;
}

export interface EmergencyAlertPush {
  type: string;
  alert: any;
  timestamp: string;
}

export function useCycloneWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeSystemsCount, setActiveSystemsCount] = useState(0);
  const [sourcesStatus, setSourcesStatus] = useState<Record<string, string>>({
    IMD: "CONNECTED",
    JTWC: "CONNECTED",
    GDACS: "CONNECTED",
    MOSDAC: "CONNECTED",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectedClients, setConnectedClients] = useState(1);
  const [latestAlert, setLatestAlert] = useState<any | null>(null);
  const [lastPayload, setLastPayload] = useState<any | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const wsUrl = "ws://localhost:8000/ws/cyclone-stream";
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastPayload(data);

          if (data.type === "surveillance_telemetry") {
            if (typeof data.radar_angle === "number") setRadarAngle(data.radar_angle);
            if (typeof data.active_systems_count === "number") setActiveSystemsCount(data.active_systems_count);
            if (data.sources_status) setSourcesStatus(data.sources_status);
            if (typeof data.is_syncing === "boolean") setIsSyncing(data.is_syncing);
            if (typeof data.connected_clients === "number") setConnectedClients(data.connected_clients);
          } else if (data.type === "emergency_alert_push") {
            setLatestAlert(data.alert);
          }
        } catch (e) {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch (err) {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: "ping" }));
    }
  }, []);

  return {
    isConnected,
    radarAngle,
    activeSystemsCount,
    sourcesStatus,
    isSyncing,
    connectedClients,
    latestAlert,
    lastPayload,
    sendPing
  };
}
