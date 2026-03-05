"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Server,
    Users,
    Activity,
    AlertTriangle,
    Cpu,
    MemoryStick,
    HardDrive,
    Wifi,
    WifiOff,
} from "lucide-react";
import type { ServerWithMetrics, DashboardStats } from "@/types";
import { useLanguage } from "@/components/language-provider";

// ─── Stat Card Component ───
function StatCard({
    title,
    value,
    icon: Icon,
    description,
    variant = "default",
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    variant?: "default" | "success" | "warning" | "destructive";
}) {
    const colors = {
        default: "text-primary",
        success: "text-emerald-500",
        warning: "text-amber-500",
        destructive: "text-red-500",
    };

    return (
        <Card className="glass border-border/30 hover:border-border/60 transition-all duration-300">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold mt-1">{value}</p>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-1">{description}</p>
                        )}
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-accent flex items-center justify-center ${colors[variant]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Server Card Component ───
function ServerCard({ server }: { server: ServerWithMetrics }) {
    const { t } = useLanguage();
    const isOnline = server.status === "online";
    const cpuPercent = server.metrics?.cpu_percent ?? 0;
    const ramPercent = server.metrics
        ? Math.round((server.metrics.ram_used_mb / server.metrics.ram_total_mb) * 100)
        : 0;
    const diskPercent = server.metrics?.disk_percent ?? 0;

    function ProgressBar({ value, color }: { value: number; color: string }) {
        return (
            <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        );
    }

    return (
        <Card className="glass border-border/30 hover:border-border/60 transition-all duration-300 group">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? "bg-emerald-500/10" : "bg-red-500/10"
                            }`}>
                            {isOnline ? (
                                <Wifi className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-red-500" />
                            )}
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold">
                                {server.id.toUpperCase()}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground font-mono">
                                {server.hostname}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isOnline ? "default" : "destructive"} className={`text-xs ${isOnline ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? "bg-emerald-500 animate-pulse-dot" : "bg-red-500"
                            }`} />
                        {isOnline ? "Online" : "Offline"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Network info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                        <span className="text-foreground/60">LAN:</span>{" "}
                        <span className="font-mono">{server.ip_lan}</span>
                    </div>
                    <div>
                        <span className="text-foreground/60">Tailscale:</span>{" "}
                        <span className="font-mono text-[10px]">{server.ip_tailscale}</span>
                    </div>
                </div>

                {/* Metrics */}
                {isOnline && server.metrics && (
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Cpu className="w-3 h-3" /> CPU
                                </span>
                                <span className={cpuPercent > 80 ? "text-red-500" : cpuPercent > 60 ? "text-amber-500" : "text-emerald-500"}>
                                    {cpuPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar
                                value={cpuPercent}
                                color={cpuPercent > 80 ? "bg-red-500" : cpuPercent > 60 ? "bg-amber-500" : "bg-emerald-500"}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <MemoryStick className="w-3 h-3" /> RAM
                                </span>
                                <span className={ramPercent > 85 ? "text-red-500" : ramPercent > 70 ? "text-amber-500" : "text-emerald-500"}>
                                    {ramPercent}% ({Math.round(server.metrics.ram_used_mb / 1024)}GB / {server.ram_gb}GB)
                                </span>
                            </div>
                            <ProgressBar
                                value={ramPercent}
                                color={ramPercent > 85 ? "bg-red-500" : ramPercent > 70 ? "bg-amber-500" : "bg-emerald-500"}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" /> {server.metrics.disk_percent !== undefined ? "Disk" : "Disco"}
                                </span>
                                <span className={diskPercent > 90 ? "text-red-500" : "text-muted-foreground"}>
                                    {diskPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar
                                value={diskPercent}
                                color={diskPercent > 90 ? "bg-red-500" : "bg-primary"}
                            />
                        </div>
                    </div>
                )}

                {/* Active sessions count */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-xs text-muted-foreground">{t("dashboard.activeSessionsCount")}</span>
                    <Badge variant="secondary" className="font-mono">
                        <Users className="w-3 h-3 mr-1" />
                        {server.active_sessions_count ?? 0}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Dashboard Page ───
export default function DashboardPage() {
    const { t } = useLanguage();
    const [servers, setServers] = useState<ServerWithMetrics[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    async function fetchData() {
        try {
            const [serversRes, statsRes] = await Promise.all([
                fetch("/api/servers"),
                fetch("/api/stats"),
            ]);

            if (serversRes.ok) {
                setServers(await serversRes.json());
            }
            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // Refresh every 15s
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("dashboard.loading")}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="glass border-border/30 animate-pulse">
                            <CardContent className="p-6 h-24" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {t("dashboard.subtitle")}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title={t("dashboard.serversTitle")}
                    value={`${stats?.online_servers ?? 0} / ${stats?.total_servers ?? 3}`}
                    icon={Server}
                    description={t("dashboard.serversDesc")}
                    variant={stats?.online_servers === stats?.total_servers ? "success" : "warning"}
                />
                <StatCard
                    title={t("dashboard.activeSessions")}
                    value={stats?.total_active_sessions ?? 0}
                    icon={Users}
                    description={t("dashboard.usersConnected")}
                    variant="default"
                />
                <StatCard
                    title={t("dashboard.generalState")}
                    value={stats?.online_servers === stats?.total_servers ? t("dashboard.stateNormal") : t("dashboard.stateAttention")}
                    icon={Activity}
                    description={t("dashboard.osSystem")}
                    variant={stats?.online_servers === stats?.total_servers ? "success" : "warning"}
                />
                <StatCard
                    title={t("dashboard.alertsTitle")}
                    value={stats?.unread_alerts ?? 0}
                    icon={AlertTriangle}
                    description={t("dashboard.alertsUnread")}
                    variant={
                        (stats?.unread_alerts ?? 0) > 0 ? "destructive" : "success"
                    }
                />
            </div>

            {/* Server Cards */}
            <div>
                <h2 className="text-lg font-semibold mb-4">{t("dashboard.serversTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servers.map((server) => (
                        <ServerCard key={server.id} server={server} />
                    ))}
                </div>
            </div>
        </div>
    );
}
