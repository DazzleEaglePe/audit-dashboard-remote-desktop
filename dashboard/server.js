const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

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

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join room for specific server updates
        socket.on("join-server", (serverId) => {
            socket.join(`server:${serverId}`);
            console.log(`Socket ${socket.id} joined room server:${serverId}`);
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
