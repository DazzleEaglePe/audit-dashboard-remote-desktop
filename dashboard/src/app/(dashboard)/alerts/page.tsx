"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Bell,
    AlertTriangle,
    Server,
    Cpu,
    UserX,
    Shield,
    CheckCircle,
    Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { Alert } from "@/types";
import { useLanguage } from "@/components/language-provider";
import { parseUtcDate, cn } from "@/lib/utils";
import { useServers } from "@/hooks/use-servers";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Skeleton } from "@/components/ui/skeleton";


const ALERT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
    server_down: {
        icon: Server,
        color: "text-red-500",
    },
    session_idle: {
        icon: Clock,
        color: "text-amber-500",
    },
    high_cpu: {
        icon: Cpu,
        color: "text-orange-500",
    },
    login_failed: {
        icon: UserX,
        color: "text-red-400",
    },
    rdp_wrapper_broken: {
        icon: Shield,
        color: "text-red-600",
    },
};

const SEVERITY_COLORS: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function AlertsPage() {
    const { t } = useLanguage();
    const { servers } = useServers();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    async function fetchAlerts() {
        try {
            const params = showUnreadOnly ? "?unread=true" : "";
            const res = await fetch(`/api/alerts${params}`);
            if (res.ok) {
                setAlerts(await res.json());
            }
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUnreadOnly]);

    useGSAP(() => {
        if (!loading) {
            const mm = gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => {
                const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
                tl.fromTo(".alerts-header",
                    { opacity: 0, y: -12 },
                    { opacity: 1, y: 0, duration: 0.6 }
                )
                .fromTo(".alert-card-anim",
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 },
                    "-=0.45"
                );
            });
        }
    }, { dependencies: [loading, alerts.length], scope: containerRef });

    async function markAsRead(alertId: number) {
        try {
            const res = await fetch("/api/alerts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: alertId }),
            });
            if (res.ok) {
                setAlerts((prev) =>
                    prev.map((a) => (a.id === alertId ? { ...a, is_read: 1 } : a))
                );
                toast.success(t("alerts.markReadToast"));
            }
        } catch {
            toast.error(t("alerts.errorToast"));
        }
    }

    async function markAllRead() {
        const unread = alerts.filter((a) => a.is_read === 0);
        for (const alert of unread) {
            await fetch("/api/alerts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: alert.id }),
            });
        }
        setAlerts((prev) => prev.map((a) => ({ ...a, is_read: 1 })));
        toast.success(`${unread.length} ${t("alerts.markAllReadToast")}`);
    }

    const unreadCount = alerts.filter((a) => a.is_read === 0).length;

    return (
        <div ref={containerRef} className="space-y-6">
            <div className="alerts-header opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{t("alerts.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">
                        {unreadCount} {t("alerts.unreadAlerts")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={showUnreadOnly ? "default" : "outline"}
                        size="sm"
                        className="rounded-xl transition-all duration-300 font-semibold"
                        onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        {showUnreadOnly ? t("alerts.showingUnread") : t("alerts.showOnlyUnread")}
                    </Button>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" className="rounded-xl transition-all duration-300 font-semibold" onClick={markAllRead}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {t("alerts.markAllRead")}
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="glass border border-border/10">
                            <div className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <Skeleton className="w-10 h-10 rounded-xl bg-accent/60 shrink-0" />
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-28 rounded bg-accent/80" />
                                            <Skeleton className="h-3 w-16 rounded bg-accent/40" />
                                        </div>
                                        <Skeleton className="h-3.5 w-3/4 rounded bg-accent/50" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-20 rounded-xl bg-accent/50 shrink-0" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : alerts.length === 0 ? (
                <Card className="glass border-border/20 alert-card-anim opacity-0">
                    <div className="py-16 text-center text-muted-foreground">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20 text-emerald-500" />
                        <p className="text-lg font-semibold">{t("alerts.allClear")}</p>
                        <p className="text-sm mt-1">{t("alerts.noAlertsPrefix")} {showUnreadOnly ? t("alerts.noAlertsSuffix") : ""}</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-2.5">
                    {alerts.map((alert) => {
                        const config = ALERT_CONFIG[alert.alert_type] || {
                            icon: AlertTriangle,
                            color: "text-muted-foreground",
                        };

                        let label: string = alert.alert_type;
                        if (alert.alert_type === "server_down") label = t("alerts.serverDown");
                        if (alert.alert_type === "session_idle") label = t("alerts.sessionIdle");
                        if (alert.alert_type === "high_cpu") label = t("alerts.highCpu");
                        if (alert.alert_type === "login_failed") label = t("alerts.loginFailed");
                        if (alert.alert_type === "rdp_wrapper_broken") label = t("alerts.rdpBroken");

                        const AlertIcon = config.icon;
                        const isUnread = alert.is_read === 0;

                        const iconBgColor = alert.severity === "critical"
                            ? "bg-red-500/10 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.12)]"
                            : alert.severity === "warning"
                            ? "bg-amber-500/10 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                            : "bg-blue-500/10 text-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.12)]";

                        return (
                            <div key={alert.id} className="alert-card-anim opacity-0">
                                <Card
                                    className={cn(
                                        "glass transition-all duration-300",
                                        isUnread 
                                            ? "border-l-3 border-l-primary shadow-[0_0_15px_rgba(99,102,241,0.06)] bg-primary/5!" 
                                            : "opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300", iconBgColor)}>
                                                <AlertIcon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-bold text-sm leading-none">{label}</span>
                                                    <Badge className={cn("text-[9px] font-semibold border-none rounded-full px-2 py-0.5", SEVERITY_COLORS[alert.severity] || "")}>
                                                        {alert.severity === "critical" ? t("alerts.sevCritical") : alert.severity === "warning" ? t("alerts.sevWarning") : t("alerts.sevInfo")}
                                                    </Badge>
                                                    {alert.server_id && (
                                                        <Badge variant="outline" className="text-[9px] font-semibold bg-accent/30 text-muted-foreground border-border/10 rounded-lg px-1.5 py-0">
                                                            {servers.find(s => s.id === alert.server_id)?.name || servers.find(s => s.id === alert.server_id)?.hostname || alert.server_id}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground font-medium mt-1.5">{alert.message}</p>
                                                <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                                                    {parseUtcDate(alert.created_at)?.toLocaleString("es-PE")}
                                                </p>
                                            </div>
                                            {isUnread && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-xl transition-all duration-300"
                                                    onClick={() => markAsRead(alert.id)}
                                                    title={t("alerts.markReadToast")}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
