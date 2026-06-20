const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Helper to parse cookies from handshake header
const parseCookies = (cookieHeader) => {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, cookieStr) => {
        const [key, ...val] = cookieStr.trim().split('=');
        acc[key] = val.join('=');
        return acc;
    }, {});
};

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    });

    // Initialize Socket.io
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Attach io to global object for API routes to access
    global.io = io;

    // Authentication middleware for Socket.io connections
    io.use((socket, nextConn) => {
        const serverId = socket.handshake.query.server_id;
        const apiKey = socket.handshake.headers["x-api-key"] || socket.handshake.query.api_key;
        const expectedApiKey = process.env.AGENT_API_KEY || 'eca-dev-api-key-2026';

        // 1. Allow agents using their API Key
        if (serverId && apiKey === expectedApiKey) {
            socket.isAgent = true;
            return nextConn();
        }

        // 2. Allow dashboard web clients using their auth-token cookie (JWT)
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = cookies["auth-token"];

        if (!token) {
            console.warn(`[SOCKET AUTH REJECTED] Connection from ${socket.id} closed: Missing auth token.`);
            return nextConn(new Error("Authentication error: Missing token"));
        }

        try {
            const secret = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
            const decoded = jwt.verify(token, secret);
            socket.user = decoded;
            return nextConn();
        } catch (err) {
            console.warn(`[SOCKET AUTH REJECTED] Invalid token from ${socket.id}: ${err.message}`);
            return nextConn(new Error("Authentication error: Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id} (Agent: ${!!socket.isAgent})`);

        // Join room for specific server updates
        socket.on("join-server", (serverId) => {
            socket.join(`server:${serverId}`);
            console.log(`Socket ${socket.id} joined room server:${serverId}`);
        });

        // Agent sends screenshot frames here (C# agent emits "agent:screenshot")
        socket.on("agent:screenshot", (data) => {
            // C# agent sends: { server_id, username, session_id, image_url, timestamp }
            if (data && data.server_id && data.image_url) {
                // Verify that the socket belongs to an authenticated agent
                if (!socket.isAgent) {
                    console.warn(`[AGENT SPOOF DETECTED] Unauthorized socket ${socket.id} tried to send screenshot for server ${data.server_id}`);
                    return;
                }
                
                console.log(`[FRAME] ${data.server_id} user=${data.username} session=${data.session_id} size=${data.image_url?.length || 0}`);
                // Broadcast ONLY to dashboard clients viewing this server
                io.to(`server:${data.server_id}`).emit("screenshot:new", {
                    serverId: data.server_id,
                    username: data.username,
                    sessionId: data.session_id,
                    image: data.image_url
                });
            }
        });

        socket.on("leave-server", (serverId) => {
            socket.leave(`server:${serverId}`);
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

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
