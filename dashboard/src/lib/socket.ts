import { Server as NetServer } from "http";
import { Server as ServerIO } from "socket.io";

export const getIO = (): ServerIO | null => {
  // @ts-ignore
  if (global.io) {
    // @ts-ignore
    return global.io as ServerIO;
  }
  return null;
};

// Helper methods to emit events from API Routes
export const notifyServerUpdate = (serverId: string, data: any) => {
  const io = getIO();
  if (io) {
    io.emit("server:update", { serverId, data });
  }
};

export const notifyAlert = (alert: any) => {
  const io = getIO();
  if (io) {
    io.emit("alert:new", alert);
  }
};

export const notifyNewScreenshot = (serverId: string, username: string, sessionId: number, base64Image: string) => {
  const io = getIO();
  if (io) {
    io.emit("screenshot:new", { serverId, username, sessionId, image: base64Image });
  }
};

export const notifySessionUpdate = (session: any) => {
  const io = getIO();
  if (io) {
    io.emit("session:update", session);
  }
};
