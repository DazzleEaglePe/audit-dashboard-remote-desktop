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
    RefreshCw,
    LayoutGrid,
    List,
    Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServerWithMetrics, DashboardStats } from "@/types";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cva } from "class-variance-authority";
import { Skeleton } from "@/components/ui/skeleton";
import { getSocket } from "@/lib/socket-client";

// ─── Stat Card Variants (CVA) ───
const statCardVariants = cva(
    "glass glass-interactive border transition-all duration-300 rounded-2xl",
    {
        variants: {
            variant: {
                default: "border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.04)]",
                success: "border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.04)]",
                warning: "border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.04)]",
                destructive: "border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.04)]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

const statIconVariants = cva(
    "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 hover:scale-105 shrink-0",
    {
        variants: {
            variant: {
                default: "bg-blue-500/10 border border-blue-500/30 text-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
                success: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
                warning: "bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
                destructive: "bg-red-500/10 border border-red-500/30 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

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
    return (
        <Card className={statCardVariants({ variant })}>
            <CardContent className="p-5 flex flex-row items-center justify-between">
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/85">{title}</p>
                    <div className="flex items-baseline gap-1.5 mt-2.5">
                        <span className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</span>
                        {variant !== "default" && (
                            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                                variant === "success" ? "bg-emerald-500" : 
                                variant === "warning" ? "bg-amber-500" : "bg-red-500"
                            )} />
                        )}
                    </div>
                    {description && (
                        <p className="text-xs text-muted-foreground/60 mt-1.5 font-medium">{description}</p>
                    )}
                </div>
                <div className={statIconVariants({ variant })}>
                    <Icon className="w-5.5 h-5.5" aria-hidden="true" />
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Metrics Tone Helpers ───
type MetricTone = "ok" | "warn" | "danger" | "info";

function getMetricTone(value: number, warnThreshold: number, dangerThreshold: number): MetricTone {
    if (value > dangerThreshold) return "danger";
    if (value > warnThreshold) return "warn";
    return "ok";
}

const metricTextClass: Record<MetricTone, string> = {
    ok: "text-emerald-500",
    warn: "text-amber-500",
    danger: "text-red-500",
    info: "text-primary",
};

const metricBarClass: Record<MetricTone, string> = {
    ok: "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]",
    warn: "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]",
    danger: "bg-gradient-to-r from-red-500 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]",
    info: "bg-gradient-to-r from-primary to-violet-400 shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_20%,transparent)]",
};

// ─── Shared Progress Bar Component ───
function ProgressBar({ value, tone }: { value: number; tone: MetricTone }) {
    return (
        <div className="h-2 bg-accent/40 rounded-full overflow-hidden p-[0.5px] border border-border/5">
            <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", metricBarClass[tone])}
                style={{ width: `${Math.min(value, 100)}%` }}
            />
        </div>
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

    const cpuTone = getMetricTone(cpuPercent, 60, 80);
    const ramTone = getMetricTone(ramPercent, 70, 85);
    const diskTone = getMetricTone(diskPercent, 90, 90);

    return (
        <Card className={cn(
            "glass transition-all duration-300 group rounded-2xl overflow-hidden",
            isOnline 
                ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.06)] hover:border-emerald-500/50" 
                : "border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.06)] hover:border-red-500/50"
        )}>
            <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105",
                            isOnline
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                                : "bg-red-500/10 border border-red-500/30 text-red-500"
                        )}>
                            <Server className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-extrabold tracking-tight text-foreground">
                                {server.name || server.hostname || server.id}
                            </CardTitle>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {server.name ? server.hostname : server.id}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isOnline ? "default" : "destructive"} className={cn("text-[9px] font-bold border-none rounded-full px-2.5 py-0.5 flex items-center gap-1.5", 
                        isOnline 
                            ? "bg-emerald-500/15 text-emerald-500" 
                            : "bg-red-500/15 text-red-500"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", 
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                        )} />
                        {isOnline ? "Online" : "Offline"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
                {/* Network info */}
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono bg-accent/20 px-3 py-2 rounded-xl border border-border/10">
                    <div>
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/60 font-sans font-bold mr-1.5">LAN</span>
                        <span className="text-foreground/90 font-semibold">{server.ip_lan}</span>
                    </div>
                    <div className="w-[1px] h-3 bg-border/20 mx-1.5" aria-hidden="true" />
                    <div>
                        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/60 font-sans font-bold mr-1.5">Tailscale</span>
                        <span className="text-foreground/90 font-semibold">{server.ip_tailscale || "—"}</span>
                    </div>
                </div>

                {/* Metrics */}
                {isOnline && server.metrics ? (
                    <div className="space-y-3 pt-1">
                        <div>
                            <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-muted-foreground/80" aria-hidden="true" /> CPU
                                </span>
                                <span className={cn("font-semibold tabular-nums", metricTextClass[cpuTone])}>
                                    {cpuPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar value={cpuPercent} tone={cpuTone} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <MemoryStick className="w-3.5 h-3.5 text-muted-foreground/80" aria-hidden="true" /> RAM
                                </span>
                                <span className={cn("font-semibold tabular-nums", metricTextClass[ramTone])}>
                                    {ramPercent}% ({Math.round(server.metrics.ram_used_mb / 1024)}GB / {server.ram_gb || 32}GB)
                                </span>
                            </div>
                            <ProgressBar value={ramPercent} tone={ramTone} />
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground/80" aria-hidden="true" /> Disco
                                </span>
                                <span className={cn("font-semibold tabular-nums", diskTone === "danger" ? "text-red-500" : "text-muted-foreground")}>
                                    {diskPercent.toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar value={diskPercent} tone={diskTone === "danger" ? "danger" : "info"} />
                        </div>
                    </div>
                ) : (
                    <div className="py-[34px] flex flex-col items-center justify-center border border-dashed border-red-500/10 rounded-xl bg-red-500/[0.02]">
                        <WifiOff className="w-6 h-6 text-red-500/40 mb-1" aria-hidden="true" />
                        <p className="text-[9px] text-red-500/60 font-sans font-semibold tracking-wider uppercase">Servidor fuera de línea</p>
                    </div>
                )}

                {/* Active sessions count */}
                <div className="flex items-center justify-between pt-3 border-t border-border/20 text-xs">
                    <span className="text-muted-foreground font-medium">{t("dashboard.activeSessionsCount")}</span>
                    <Badge variant="secondary" className="font-bold bg-accent/40 text-foreground border-none rounded-full px-2.5 py-0.5">
                        <Users className="w-3 h-3 mr-1.5 text-muted-foreground" aria-hidden="true" />
                        {server.active_sessions_count ?? 0}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Skeletons for Loading State ───
function StatCardSkeleton() {
    return (
        <Card className="glass border border-border/10 rounded-2xl">
            <CardContent className="p-5 flex flex-row items-center justify-between">
                <div className="space-y-2.5 flex-1">
                    <Skeleton className="h-3 w-16 rounded bg-accent/60" />
                    <Skeleton className="h-8 w-24 rounded-lg bg-accent/80" />
                    <Skeleton className="h-3 w-32 rounded bg-accent/40" />
                </div>
                <Skeleton className="w-12 h-12 rounded-2xl bg-accent/60 shrink-0" />
            </CardContent>
        </Card>
    );
}

function ServerCardSkeleton() {
    return (
        <Card className="glass border border-border/10 rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl bg-accent/60" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-16 rounded bg-accent/80" />
                            <Skeleton className="h-3 w-20 rounded bg-accent/40" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full bg-accent/45" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
                {/* Mock network */}
                <div className="flex justify-between items-center bg-accent/15 px-3 py-2 rounded-xl border border-border/5">
                    <Skeleton className="h-3 w-20 rounded bg-accent/40" />
                    <Skeleton className="h-3 w-20 rounded bg-accent/40" />
                </div>
                {/* Mock progress bars */}
                <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-12 rounded bg-accent/40" />
                            <Skeleton className="h-3 w-8 rounded bg-accent/50" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full bg-accent/30" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-12 rounded bg-accent/40" />
                            <Skeleton className="h-3 w-8 rounded bg-accent/50" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full bg-accent/30" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-12 rounded bg-accent/40" />
                            <Skeleton className="h-3 w-8 rounded bg-accent/50" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full bg-accent/30" />
                    </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border/20">
                    <Skeleton className="h-3.5 w-24 rounded bg-accent/40" />
                    <Skeleton className="h-5 w-8 rounded-full bg-accent/50" />
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-lg bg-accent/80" />
                    <Skeleton className="h-4 w-64 rounded-md bg-accent/40" />
                </div>
                <Skeleton className="h-9 w-36 rounded-xl bg-accent/40 self-end sm:self-center" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>

            {/* Server Section Header */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="space-y-1.5">
                        <Skeleton className="h-6 w-32 rounded-lg bg-accent/80" />
                        <Skeleton className="h-3.5 w-52 rounded-md bg-accent/40" />
                    </div>
                    <Skeleton className="h-9 w-48 rounded-xl bg-accent/40" />
                </div>

                {/* Server Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <ServerCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Main Dashboard Page ───
export default function DashboardPage() {
    const { t } = useLanguage();
    const [servers, setServers] = useState<ServerWithMetrics[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [profileName, setProfileName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const containerRef = useRef<HTMLDivElement>(null);

    function changeViewMode(mode: "grid" | "table") {
        setViewMode(mode);
        localStorage.setItem("dashboard-view-mode", mode);
    }

    async function fetchData() {
        try {
            const [serversRes, statsRes, profileRes] = await Promise.all([
                fetch("/api/servers"),
                fetch("/api/stats"),
                fetch("/api/auth/profile"),
            ]);

            if (serversRes.ok) {
                setServers(await serversRes.json());
            }
            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                setProfileName(profileData.fullName || "");
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const savedView = localStorage.getItem("dashboard-view-mode");
        if (savedView === "grid" || savedView === "table") setViewMode(savedView);
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Fallback refresh every 60s

        const handleProfileUpdate = async () => {
            try {
                const res = await fetch("/api/auth/profile");
                if (res.ok) {
                    const profileData = await res.json();
                    setProfileName(profileData.fullName || "");
                }
            } catch {}
        };
        window.addEventListener("profile-updated", handleProfileUpdate);

        // Realtime updates using WebSocket singleton
        const socketIo = getSocket();
        if (socketIo) {
            socketIo.on("alert:new", fetchData);
            socketIo.on("server:update", fetchData);
        }

        return () => {
            clearInterval(interval);
            window.removeEventListener("profile-updated", handleProfileUpdate);
            if (socketIo) {
                socketIo.off("alert:new", fetchData);
                socketIo.off("server:update", fetchData);
            }
        };
    }, []);

    useGSAP(() => {
        if (!loading) {
            const mm = gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => {
                const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
                tl.fromTo(".dashboard-header",
                    { opacity: 0, y: -12 },
                    { opacity: 1, y: 0, duration: 0.6 }
                )
                .fromTo(".stat-card-anim",
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                    "-=0.45"
                )
                .fromTo(".servers-header",
                    { opacity: 0, y: -10 },
                    { opacity: 1, y: 0, duration: 0.45 },
                    "-=0.3"
                )
                .fromTo(".server-card-anim",
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                    "-=0.35"
                );
            });
        }
    }, { dependencies: [loading, viewMode], scope: containerRef });

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div ref={containerRef} className="space-y-8">
            {/* Header */}
            <div className="dashboard-header opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {t("dashboard.welcome") 
                            ? t("dashboard.welcome").replace("Admin", profileName || "Admin") 
                            : `¡Bienvenido de nuevo, ${profileName || "Admin"}!`} <span className="animate-bounce">👋</span>
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">
                        {t("dashboard.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center bg-accent/20 px-3 py-1.5 rounded-xl border border-border/10 shadow-sm shadow-black/5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>{t("dashboard.updatedNow") || "Actualizado ahora"}</span>
                    </div>
                    <div className="w-[1px] h-4 bg-border/25" />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors duration-200"
                        onClick={fetchData}
                        aria-label={t("dashboard.refresh") || "Actualizar datos"}
                    >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card-anim opacity-0">
                    <StatCard
                        title={t("dashboard.serversTitle")}
                        value={`${stats?.online_servers ?? 0} / ${stats?.total_servers ?? 3}`}
                        icon={Server}
                        description={t("dashboard.serversDesc")}
                        variant={stats?.online_servers === stats?.total_servers ? "default" : "warning"}
                    />
                </div>
                <div className="stat-card-anim opacity-0">
                    <StatCard
                        title={t("dashboard.activeSessions")}
                        value={stats?.total_active_sessions ?? 0}
                        icon={Users}
                        description={t("dashboard.usersConnected")}
                        variant="success"
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

            {/* Server Section */}
            <div className="space-y-4">
                <div className="servers-header opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Server className="w-5 h-5 text-primary" />
                            {t("dashboard.serversTitle")}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Estado y rendimiento de los servidores</p>
                    </div>
                    
                    {/* View mode toggle */}
                    <div className="flex items-center bg-accent/20 p-1 rounded-xl border border-border/10 shrink-0 select-none">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all duration-200",
                                viewMode === "grid"
                                    ? "bg-primary/20 text-primary border border-primary/25 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => changeViewMode("grid")}
                            aria-pressed={viewMode === "grid"}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                            Vista de tarjetas
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all duration-200",
                                viewMode === "table"
                                    ? "bg-primary/20 text-primary border border-primary/25 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => changeViewMode("table")}
                            aria-pressed={viewMode === "table"}
                        >
                            <List className="w-3.5 h-3.5" aria-hidden="true" />
                            Vista de tabla
                        </Button>
                    </div>
                </div>

                {servers.length === 0 ? (
                    <div className="server-card-anim opacity-0 glass border border-border/20 rounded-2xl flex flex-col items-center justify-center text-center py-16 px-6">
                        <div className="w-14 h-14 rounded-2xl bg-accent/40 border border-border/20 flex items-center justify-center mb-4">
                            <Server className="w-6 h-6 text-muted-foreground/70" aria-hidden="true" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">{t("dashboard.noServersTitle") || "Aún no hay servidores"}</h3>
                        <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-xs">
                            {t("dashboard.noServersDesc") || "Cuando un agente se conecte con su API Key, aparecerá aquí automáticamente."}
                        </p>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {servers.map((server) => (
                            <div key={server.id} className="server-card-anim opacity-0">
                                <ServerCard server={server} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="server-card-anim opacity-0 glass border-border/20 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border/10 bg-accent/15">
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Servidor</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Estado</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Red</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">CPU</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">RAM</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Disco</th>
                                        <th className="p-4 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sesiones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {servers.map((server) => {
                                        const isOnline = server.status === "online";
                                        const cpuPercent = server.metrics?.cpu_percent ?? 0;
                                        const ramPercent = server.metrics
                                            ? Math.round((server.metrics.ram_used_mb / server.metrics.ram_total_mb) * 100)
                                            : 0;
                                        const diskPercent = server.metrics?.disk_percent ?? 0;

                                        const cpuTone = getMetricTone(cpuPercent, 60, 80);
                                        const ramTone = getMetricTone(ramPercent, 70, 85);
                                        const diskTone = getMetricTone(diskPercent, 90, 90);

                                        return (
                                            <tr key={server.id} className="border-b border-border/10 hover:bg-accent/25 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-sm text-foreground">{server.name || server.hostname || server.id}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{server.name ? server.hostname : server.id}</div>
                                                </td>
                                                <td className="p-4">
                                                    <Badge className={cn("text-[9px] font-bold border-none rounded-full px-2.5 py-0.5",
                                                        isOnline ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {isOnline ? "Online" : "Offline"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 font-mono text-[10px] space-y-0.5">
                                                    <div><span className="text-muted-foreground/60 mr-1 text-[8px] font-bold uppercase">LAN:</span> {server.ip_lan}</div>
                                                    <div><span className="text-muted-foreground/60 mr-1 text-[8px] font-bold uppercase">TS:</span> {server.ip_tailscale || "—"}</div>
                                                </td>
                                                <td className="p-4">
                                                    {isOnline && server.metrics ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-mono text-xs w-10 shrink-0 font-semibold", metricTextClass[cpuTone])}>{cpuPercent.toFixed(1)}%</span>
                                                            <div className="w-20">
                                                                <ProgressBar value={cpuPercent} tone={cpuTone} />
                                                            </div>
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                <td className="p-4">
                                                    {isOnline && server.metrics ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-mono text-xs w-10 shrink-0 font-semibold", metricTextClass[ramTone])}>{ramPercent}%</span>
                                                            <div className="w-20">
                                                                <ProgressBar value={ramPercent} tone={ramTone} />
                                                            </div>
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                <td className="p-4">
                                                    {isOnline && server.metrics ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-mono text-xs w-10 shrink-0 font-semibold", diskTone === "danger" ? "text-red-500" : "text-muted-foreground")}>{diskPercent.toFixed(1)}%</span>
                                                            <div className="w-20">
                                                                <ProgressBar value={diskPercent} tone={diskTone === "danger" ? "danger" : "info"} />
                                                            </div>
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant="secondary" className="font-semibold bg-accent/30 text-foreground border-none rounded-full px-2.5 py-0.5">
                                                        {server.active_sessions_count ?? 0}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer shield indicator */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 font-semibold py-4">
                <Shield className="w-3.5 h-3.5 text-muted-foreground/45" />
                <span>Monitoreo seguro y continuo 24/7 para mantener tu infraestructura siempre disponible.</span>
            </div>
        </div>
    );
}
