import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import type { ServerWithMetrics } from "@/types";

export function useServers() {
  const [servers, setServers] = useState<ServerWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      } else {
        setError("Failed to fetch servers");
      }
    } catch (err) {
      console.error("Error fetching servers:", err);
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();

    // Set up real-time websocket listener safely (null-safe for SSR guards)
    const socket = getSocket();
    if (socket) {
      socket.on("server:update", fetchServers);
    }

    return () => {
      if (socket) {
        socket.off("server:update", fetchServers);
      }
    };
  }, [fetchServers]);

  const byId = useCallback((id: string) => {
    return servers.find((s) => s.id === id);
  }, [servers]);

  return {
    servers,
    loading,
    error,
    refresh: fetchServers,
    byId,
  };
}
