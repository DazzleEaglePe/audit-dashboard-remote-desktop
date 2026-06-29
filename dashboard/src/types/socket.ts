// ═══════════════════════════════════════════════════════
// TypeScript Types — Socket.io Events for Auditoría ECA
// ═══════════════════════════════════════════════════════

export interface ServerToClientEvents {
    "screenshot:new": (data: {
        serverId: string;
        username: string;
        sessionId: number;
        image: string;
    }) => void;
    "alert:new": (alert: {
        id: number;
        tenant_id: string;
        server_id: string | null;
        alert_type: string;
        severity: string;
        message: string;
        is_read: number;
        created_at: Date | string | null;
    }) => void;
    "server:update": (data: {
        serverId: string;
        data: any;
    }) => void;
    "session:update": (session: any) => void;
}

export interface ClientToServerEvents {
    "join-server": (serverId: string) => void;
    "leave-server": (serverId: string) => void;
    "agent:screenshot": (data: {
        server_id: string;
        username: string;
        session_id: number;
        image_url: string;
        timestamp: string;
    }) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    user?: {
        username: string;
        role?: string;
        tenantId?: string;
    };
    isAgent?: boolean;
    tenantId?: string;
}
