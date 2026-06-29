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
export const notifyServerUpdate = (tenantId: string, serverId: string, data: any) => {
  const io = getIO();
  if (io) {
    io.to(`server:${tenantId}:${serverId}`).emit("server:update", { serverId, data });
  }
};

export const notifyAlert = (tenantId: string, alert: any) => {
  const io = getIO();
  if (io) {
    io.to(`tenant:${tenantId}`).emit("alert:new", alert);
  }
};

export const notifyNewScreenshot = (tenantId: string, serverId: string, username: string, sessionId: number, base64Image: string) => {
  const io = getIO();
  if (io) {
    io.to(`server:${tenantId}:${serverId}`).emit("screenshot:new", { serverId, username, sessionId, image: base64Image });
  }
};

export const notifySessionUpdate = (tenantId: string, serverId: string, session: any) => {
  const io = getIO();
  if (io) {
    io.to(`server:${tenantId}:${serverId}`).emit("session:update", session);
  }
};
