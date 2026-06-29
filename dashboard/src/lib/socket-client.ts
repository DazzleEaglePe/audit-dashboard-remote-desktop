"use client";

import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io({ transports: ["websocket"] });
  }
  return socket;
}
