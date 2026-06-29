import "./load-env";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import type { 
    ClientToServerEvents, 
    ServerToClientEvents, 
    InterServerEvents, 
    SocketData 
} from "./src/types/socket";
import { 
  getDrizzleDb,
  verifyAndRegisterServer,
  ensureInstallation
} from "./src/lib/db";
import { 
  api_keys as apiKeysTable
} from "./src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { JWT_SECRET } from "./src/lib/auth-config";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Helper to parse cookies from handshake header
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, cookieStr) => {
        const [key, ...val] = cookieStr.trim().split('=');
        acc[key] = val.join('=');
        return acc;
    }, {} as Record<string, string>);
};

// ═══════════════════════════════════════════════════════
// Note: Obsolete background worker helper functions have been removed and migrated to workers.ts.

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Fail fast in production if critical secrets are missing or insecure
    if (process.env.NODE_ENV === 'production') {
        if (
            !process.env.NEXTAUTH_SECRET || 
            process.env.NEXTAUTH_SECRET === 'fallback-secret-change-me' ||
            process.env.NEXTAUTH_SECRET === 'dev-secret-change-in-production-abc123' ||
            process.env.NEXTAUTH_SECRET === 'generate-a-random-secret-here'
        ) {
            throw new Error('CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is missing or insecure in production environment!');
        }
        if (
            !process.env.ENCRYPTION_KEY || 
            process.env.ENCRYPTION_KEY === 'generate-a-random-encryption-key-here'
        ) {
            throw new Error('CRITICAL SECURITY ERROR: ENCRYPTION_KEY is missing or insecure in production environment!');
        }
    }
    // Ensure unique installation ID exists in database
    await ensureInstallation();
    // Note: Database seeding has been moved to the dedicated worker container initialization.

    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url || "", true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    });

    // Initialize Socket.io with typed events
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
      : (dev ? ["http://localhost:3000"] : [process.env.NEXT_PUBLIC_APP_URL || ""]);

    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(server, {
        transports: ["websocket"],
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
        },
    });

    // Redis Adapter Integration for scaling Socket.io multi-node
    if (process.env.REDIS_URL) {
        console.log(`[SOCKET] Connecting to Redis adapter: ${process.env.REDIS_URL}`);
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            console.log("[SOCKET] Redis adapter integrated successfully");
        }).catch(err => {
            console.error("[SOCKET] Redis adapter connection failed:", err);
        });
    } else {
        console.warn("[SOCKET] REDIS_URL not set. Running Socket.io without Redis adapter.");
    }

    // Attach io to global object for API routes to access
    (global as any).io = io;

    // Authentication middleware for Socket.io connections
    io.use(async (socket, nextConn) => {
        const query = socket.handshake.query;
        const serverId = query.server_id as string | undefined;
        
        const headers = socket.handshake.headers;
        const apiKey = (headers["x-api-key"] || query.api_key) as string | undefined;

        socket.data = socket.data || {};

        // 1. Allow agents using dynamic API Keys checked in DB
        if (serverId && apiKey) {
            try {
                const db = getDrizzleDb();
                const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
                const keyRowList = await db.select()
                    .from(apiKeysTable)
                    .where(eq(apiKeysTable.key_hash, keyHash));

                const keyRow = keyRowList[0];

                if (keyRow) {
                    // Check expiration
                    if (keyRow.expires_at && new Date() > new Date(keyRow.expires_at)) {
                        console.warn(`[SOCKET AUTH REJECTED] Agent key expired for server ${serverId}.`);
                        return nextConn(new Error("Authentication error: API Key expired"));
                    }

                    // Enforce device binding if key is tied to a specific device
                    if (keyRow.device_id && keyRow.device_id !== serverId) {
                        console.warn(`[SOCKET AUTH REJECTED] API Key device_id mismatch. Expected: ${keyRow.device_id}, Got: ${serverId}.`);
                        return nextConn(new Error("Authentication error: Device mismatch"));
                    }

                    // Verify ownership or auto-register
                    const verified = await verifyAndRegisterServer(serverId, keyRow.tenant_id);
                    if (!verified) {
                        console.warn(`[SOCKET AUTH REJECTED] Server ${serverId} owned by another tenant.`);
                        return nextConn(new Error("Authentication error: Server owned by another tenant"));
                    }

                    socket.data.isAgent = true;
                    socket.data.tenantId = keyRow.tenant_id;

                    // Update last used time asynchronously
                    await db.update(apiKeysTable)
                        .set({ last_used_at: new Date().toISOString() })
                        .where(eq(apiKeysTable.id, keyRow.id));

                    return nextConn();
                } else {
                    console.warn(`[SOCKET AUTH REJECTED] Invalid API Key from ${socket.id} for server ${serverId}.`);
                    return nextConn(new Error("Authentication error: Invalid API Key"));
                }
            } catch (dbErr: any) {
                console.error(`[SOCKET AUTH ERROR] DB error during agent handshake:`, dbErr);
                return nextConn(new Error("Authentication error: Internal server error"));
            }
        }

        // 2. Allow dashboard web clients using their auth-token cookie (JWT)
        const cookies = parseCookies(headers.cookie);
        const token = cookies["auth-token"];

        if (!token) {
            console.warn(`[SOCKET AUTH REJECTED] Connection from ${socket.id} closed: Missing auth token.`);
            return nextConn(new Error("Authentication error: Missing token"));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role?: string; tenantId?: string };
            socket.data.user = decoded;
            socket.data.tenantId = decoded.tenantId || 'default';
            socket.data.isAgent = false;
            return nextConn();
        } catch (err: any) {
            console.warn(`[SOCKET AUTH REJECTED] Invalid token from ${socket.id}: ${err.message}`);
            return nextConn(new Error("Authentication error: Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        const tenantId = socket.data.tenantId || 'default';
        console.log(`Socket connected: ${socket.id} (Tenant: ${tenantId}, Agent: ${!!socket.data.isAgent})`);

        // Auto-join tenant room for tenant-scoped updates
        socket.join(`tenant:${tenantId}`);
        console.log(`Socket ${socket.id} joined tenant room tenant:${tenantId}`);

        // Join room for specific server updates
        socket.on("join-server", (serverId: string) => {
            socket.join(`server:${tenantId}:${serverId}`);
            console.log(`Socket ${socket.id} joined room server:${tenantId}:${serverId}`);
        });

        // Agent sends screenshot frames here (C# agent emits "agent:screenshot")
        socket.on("agent:screenshot", (data) => {
            if (data && data.server_id && data.image_url) {
                if (!socket.data.isAgent) {
                    console.warn(`[AGENT SPOOF DETECTED] Unauthorized socket ${socket.id} tried to send screenshot for server ${data.server_id}`);
                    return;
                }
                
                console.log(`[FRAME] [Tenant: ${tenantId}] ${data.server_id} user=${data.username} session=${data.session_id} size=${data.image_url?.length || 0}`);
                io.to(`server:${tenantId}:${data.server_id}`).emit("screenshot:new", {
                    serverId: data.server_id,
                    username: data.username,
                    sessionId: data.session_id,
                    image: data.image_url
                });
            }
        });

        socket.on("leave-server", (serverId: string) => {
            socket.leave(`server:${tenantId}:${serverId}`);
            console.log(`Socket ${socket.id} left room server:${tenantId}:${serverId}`);
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    // Note: Background timers and Saas workers loops have been moved to workers.ts / worker.ts

    server.once("error", (err) => {
        console.error(err);
        process.exit(1);
    });

    server.listen(port, () => {
        console.log(
            `> Ready on http://${hostname}:${port} (custom server with Socket.io)`
        );
    });
});
