"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface TelemetryPayload {
  type: string;
  timestamp: string;
  radar_angle: number;
  pulse: number;
  active_systems_count: number;
  latest_system: Record<string, unknown> | null;
  sources_status: Record<string, string>;
  is_syncing: boolean;
  connected_clients: number;
}

export interface EmergencyAlertPush {
  type: string;
  alert: Record<string, unknown>;
  timestamp: string;
}

export function useCycloneWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [radarAngle, setRadarAngle] = useState(0);
  const [activeSystemsCount, setActiveSystemsCount] = useState(0);
  const [sourcesStatus, setSourcesStatus] = useState<Record<string, string>>({
    IMD: "STANDBY",
    JTWC: "STANDBY",
    GDACS: "STANDBY",
    MOSDAC: "STANDBY",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectedClients, setConnectedClients] = useState(1);
  const [latestAlert, setLatestAlert] = useState<Record<string, unknown> | null>(null);
  const [lastPayload, setLastPayload] = useState<TelemetryPayload | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef<boolean>(false);

  const getWebSocketUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== "undefined") {
      try {
        const source = localStorage.getItem("cyclonet_data_source");
        if (source === "CUSTOM") {
          const customUrl = localStorage.getItem("cyclonet_custom_api_url");
          if (customUrl && customUrl.trim()) {
            const clean = customUrl.trim().replace(/\/+$/, "").replace(/\/api$/, "");
            const wsProto = clean.startsWith("https://") ? "wss://" : "ws://";
            const hostPath = clean.replace(/^https?:\/\//, "");
            return `${wsProto}${hostPath}/ws/cyclone-stream`;
          }
        }
      } catch {
        // Fallback on restricted storage access
      }

      const isHttps = window.location.protocol === "https:";
      const host = window.location.host;
      if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
        return `${isHttps ? "wss:" : "ws:"}//cyclonet-backend.onrender.com/ws/cyclone-stream`;
      }
    }
    return "ws://localhost:8000/ws/cyclone-stream";
  }, []);

  const connect = useCallback(function connect() {
    if (isUnmountedRef.current) return;
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isUnmountedRef.current) setIsConnected(true);
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
        } catch {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (isUnmountedRef.current) return;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) connect();
        }, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      setIsConnected(false);
      if (isUnmountedRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) connect();
      }, 3000);
    }
  }, [getWebSocketUrl]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    const handleSourceChange = () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
      }
      connect();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("cyclonet:data-source-changed", handleSourceChange);
      window.addEventListener("storage", handleSourceChange);
    }

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typeof window !== "undefined") {
        window.removeEventListener("cyclonet:data-source-changed", handleSourceChange);
        window.removeEventListener("storage", handleSourceChange);
      }
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
        socketRef.current = null;
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
