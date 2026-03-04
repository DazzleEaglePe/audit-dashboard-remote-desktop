# ECA Monitor – Remote Desktop Audit System 🔒🖥️

A high-performance, real-time auditing and monitoring dashboard designed for managing multiple Windows Servers and their active Remote Desktop (RDP) sessions. Built with modern web technologies to provide instant visibility into user activities, server health, and security events.

![Dashboard Preview](https://github.com/DazzleEaglePe/audit-dashboard-remote-desktop/blob/main/public/preview.png?raw=true) *(Note: Add a screenshot of the dashboard here)*

## 🚀 Purpose & Problem Solved
Managing multiple Windows servers with concurrent RDP users often leads to "blind spots" regarding what users are doing, when they log in, and the overall load on the servers.

ECA Monitor solves this by deploying a lightweight background agent on each Windows server that continuously feeds data, screenshots, and security metrics to a centralized, beautiful Next.js web dashboard. It acts as an elite "security camera" and health monitor for your RDP infrastructure.

## ✨ Key Features & Capabilities

*   **Real-Time Mosaics (Live Screenshots):** View live thumbnails of every active user's desktop across all servers simultaneously.
*   **Zero-Latency WebSocket Streaming:** Images are captured, encoded to Base64, and streamed instantly directly into the React DOM via Socket.io without any HTTP fetching delays.
*   **Active Session Management:** Instantly see who is logged in, their session ID, IP address, and connection state (`Active` vs `Disconnected`).
*   **Server Health Telemetry:** Tracks CPU, RAM, and Disk usage of each connected server in real-time, preventing bottlenecks.
*   **Automated Audit Logs:** Captures Windows Event Log data (Event IDs 4624/4634) to keep an immutable history of every successful logon and logoff.
*   **Smart Alert System:** Detects offline servers or suspicious disconnections and persistently alerts the administrator via the dashboard.

## 🛠️ Architecture & Tech Stack

This project uses a decoupled Agent-Server architecture designed for maximum stability on the endpoints and maximum performance on the viewing client.

### 1. The Dashboard (Backend & Frontend)
Hosted on a Linux VPS, orchestrating the agents and serving the UI.
*   **Framework:** Next.js 14+ (App Router) & React 19
*   **Real-time Protocol:** Socket.io (Dual HTTP Polling + WebSocket Base64 Streaming)
*   **Database:** High-speed local SQLite (`better-sqlite3`) for instant ingestion.
*   **Styling & UI:** Tailwind CSS, `shadcn/ui`, and Lucide Icons for a premium dark-mode aesthetic.
*   **Authentication:** JWT-based login (NextAuth / custom middleware) to protect the dashboard.

### 2. The Agent (Endpoint)
Runs silently on the target Windows Servers without interfering with users.
*   **Core:** Native PowerShell (C#-level API access).
*   **Sub-processes:** Sysinternals `PsExec` to securely jump into disconnected user sessions to capture screen arrays securely.
*   **Resiliency:** Runs as a robust Windows Scheduled Task (`AtLogOn`), automatically restarting and handling silent HTTP POST retries if the network drops.

## 📈 Benefits for the Organization
1.  **Increased Accountability:** Employees and contractors know their sessions are audited, naturally improving productivity and compliance.
2.  **Instant Troubleshooting:** IT can immediately see what a user is looking at without needing to initiate a disruptive screen-sharing session.
3.  **Proactive Resource Management:** Identifying which server is overwhelmed with heavy applications before the server crashes.
4.  **Forensic Capability:** If a security incident occurs, the logs and screenshots provide a clear timeline of RDP access.

## ⚙️ Installation & Deployment

### Dashboard (VPS Server)
```bash
git clone https://github.com/DazzleEaglePe/audit-dashboard-remote-desktop.git
cd audit-dashboard-remote-desktop/dashboard
npm install
# Set up .env.local with JWT_SECRET and API_KEY
npm run build
pm2 start server.js --name "eca-dashboard"
```

### Windows Agent Deployment
Run the consolidated PowerShell setup script found in the configuration manual on the target server as Administrator. It automatically creates `C:\ECA_Monitor`, downloads the necessary scripts, sets up Windows Defender exclusions, and registers the background scheduled task to survive reboots.

---

*Developed autonomously as an advanced infrastructure monitoring tool.*
