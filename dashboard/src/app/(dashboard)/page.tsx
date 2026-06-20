"use client";

import { useEffect, useState, useRef } from "react";
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
import { cn } from "@/lib/utils";
import { gsap } from "gsap";

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
    const bgColors = {
        default: "bg-primary/10 text-primary shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_15%,transparent)]",
        success: "bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
        warning: "bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
        destructive: "bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
    };

    return (
        <Card className="glass glass-interactive border-border/20">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                        <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-3xl font-extrabold tracking-tight">{value}</span>
                            {variant !== "default" && (
                                <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                                    variant === "success" ? "bg-emerald-500" : 
                                    variant === "warning" ? "bg-amber-500" : "bg-red-500"
                                )} />
                            )}
                        </div>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{description}</p>
                        )}
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${bgColors[variant]}`}>
                        <Icon className="w-5.5 h-5.5" />
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
            <div className="h-2 bg-accent/40 rounded-full overflow-hidden p-[0.5px] border border-border/5">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        );
    }

    return (
        <Card className="glass glass-interactive border-border/20 group">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300", 
                            isOnline 
                                ? "bg-emerald-500/10 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.1)]" 
                                : "bg-red-500/10 text-red-500"
                        )}>
                            {isOnline ? (
                                <Wifi className="w-5 h-5" />
                            ) : (
                                <WifiOff className="w-5 h-5" />
                            )}
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold tracking-tight">
                                {server.id.toUpperCase()}
                            </CardTitle>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {server.hostname}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isOnline ? "default" : "destructive"} className={cn("text-[10px] font-semibold border-none rounded-full", 
                        isOnline 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "bg-red-500/10 text-red-500"
                    )}>
                        {isOnline ? (
                            <span className="relative flex h-1.5 w-1.5 mr-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                        )}
                        {isOnline ? "Online" : "Offline"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Network info */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono bg-accent/30 p-2 rounded-lg border border-border/5">
                    <div>
                        <span className="text-foreground/40 font-sans font-medium">LAN:</span>{" "}
                        <span>{server.ip_lan}</span>
                    </div>
                    <div>
                        <span className="text-foreground/40 font-sans font-medium">Tailscale:</span>{" "}
                        <span className="text-[9px]">{server.ip_tailscale}</span>
                    </div>
                </div>

                {/* Metrics */}
                {isOnline && server.metrics && (
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-muted-foreground/85" /> CPU
                                </span>
                                <span className={cn("font-semibold", 
                                    cpuPercent > 80 ? "text-red-500" : cpuPercent > 60 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                    {cpuPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar
                                value={cpuPercent}
                                color={
                                    cpuPercent > 80 ? "bg-gradient-to-r from-red-500 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" : 
                                    cpuPercent > 60 ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : 
                                    "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                }
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <MemoryStick className="w-3.5 h-3.5 text-muted-foreground/85" /> RAM
                                </span>
                                <span className={cn("font-semibold", 
                                    ramPercent > 85 ? "text-red-500" : ramPercent > 70 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                    {ramPercent}% ({Math.round(server.metrics.ram_used_mb / 1024)}GB / {server.ram_gb}GB)
                                </span>
                            </div>
                            <ProgressBar
                                value={ramPercent}
                                color={
                                    ramPercent > 85 ? "bg-gradient-to-r from-red-500 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" : 
                                    ramPercent > 70 ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : 
                                    "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                }
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground/85" /> {server.metrics.disk_percent !== undefined ? "Disk" : "Disco"}
                                </span>
                                <span className={cn("font-semibold", 
                                    diskPercent > 90 ? "text-red-500" : "text-muted-foreground"
                                )}>
                                    {diskPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar
                                value={diskPercent}
                                color={
                                    diskPercent > 90 ? "bg-gradient-to-r from-red-500 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]" : 
                                    "bg-gradient-to-r from-primary to-violet-400 shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
                                }
                            />
                        </div>
                    </div>
                )}

                {/* Active sessions count */}
                <div className="flex items-center justify-between pt-3 border-t border-border/20 text-xs">
                    <span className="text-muted-foreground font-medium">{t("dashboard.activeSessionsCount")}</span>
                    <Badge variant="secondary" className="font-semibold bg-accent/40 text-foreground border-none rounded-full px-2.5 py-0.5">
                        <Users className="w-3 h-3 mr-1.5 text-muted-foreground" />
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
    const containerRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (!loading && containerRef.current) {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            tl.fromTo(containerRef.current.querySelector(".dashboard-header"),
                { opacity: 0, y: -12 },
                { opacity: 1, y: 0, duration: 0.6 }
            )
            .fromTo(containerRef.current.querySelectorAll(".stat-card-anim"),
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                "-=0.45"
            )
            .fromTo(containerRef.current.querySelector(".servers-header"),
                { opacity: 0, y: -10 },
                { opacity: 1, y: 0, duration: 0.45 },
                "-=0.3"
            )
            .fromTo(containerRef.current.querySelectorAll(".server-card-anim"),
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                "-=0.35"
            );
        }
    }, [loading]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("dashboard.loading")}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="glass border-border/20 animate-pulse">
                            <CardContent className="p-6 h-24" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="space-y-8">
            {/* Header */}
            <div className="dashboard-header opacity-0">
                <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {t("dashboard.subtitle")}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card-anim opacity-0">
                    <StatCard
                        title={t("dashboard.serversTitle")}
                        value={`${stats?.online_servers ?? 0} / ${stats?.total_servers ?? 3}`}
                        icon={Server}
                        description={t("dashboard.serversDesc")}
                        variant={stats?.online_servers === stats?.total_servers ? "success" : "warning"}
                    />
                </div>
                <div className="stat-card-anim opacity-0">
                    <StatCard
                        title={t("dashboard.activeSessions")}
                        value={stats?.total_active_sessions ?? 0}
                        icon={Users}
                        description={t("dashboard.usersConnected")}
                        variant="default"
                    />
                </div>
                <div className="stat-card-anim opacity-0">
                    <StatCard
                        title={t("dashboard.generalState")}
                        value={stats?.online_servers === stats?.total_servers ? t("dashboard.stateNormal") : t("dashboard.stateAttention")}
                        icon={Activity}
                        description={t("dashboard.osSystem")}
                        variant={stats?.online_servers === stats?.total_servers ? "success" : "warning"}
                    />
                </div>
                <div className="stat-card-anim opacity-0">
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
            </div>

            {/* Server Cards */}
            <div className="space-y-4">
                <h2 className="servers-header text-lg font-semibold mb-4 opacity-0">{t("dashboard.serversTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servers.map((server) => (
                        <div key={server.id} className="server-card-anim opacity-0">
                            <ServerCard server={server} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
