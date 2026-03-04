"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const ALERT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    server_down: {
        label: "Servidor Caído",
        icon: Server,
        color: "text-red-500",
    },
    session_idle: {
        label: "Sesión Inactiva",
        icon: Clock,
        color: "text-amber-500",
    },
    high_cpu: {
        label: "CPU Alto",
        icon: Cpu,
        color: "text-orange-500",
    },
    login_failed: {
        label: "Login Fallido",
        icon: UserX,
        color: "text-red-400",
    },
    rdp_wrapper_broken: {
        label: "RDP Wrapper Roto",
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
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

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
                toast.success("Alerta marcada como leída");
            }
        } catch {
            toast.error("Error al actualizar alerta");
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
        toast.success(`${unread.length} alertas marcadas como leídas`);
    }

    const unreadCount = alerts.filter((a) => a.is_read === 0).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Alertas</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {unreadCount} alertas sin leer
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={showUnreadOnly ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        {showUnreadOnly ? "Mostrando sin leer" : "Ver solo sin leer"}
                    </Button>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={markAllRead}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar todas leídas
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="glass border-border/30 animate-pulse">
                            <CardContent className="p-4 h-20" />
                        </Card>
                    ))}
                </div>
            ) : alerts.length === 0 ? (
                <Card className="glass border-border/30">
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20 text-emerald-500" />
                        <p className="text-lg">Todo en orden</p>
                        <p className="text-sm mt-1">No hay alertas {showUnreadOnly ? "sin leer" : ""}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {alerts.map((alert) => {
                        const config = ALERT_CONFIG[alert.alert_type] || {
                            label: alert.alert_type,
                            icon: AlertTriangle,
                            color: "text-muted-foreground",
                        };
                        const AlertIcon = config.icon;
                        const isUnread = alert.is_read === 0;

                        return (
                            <Card
                                key={alert.id}
                                className={`glass border-border/30 transition-all duration-200 ${isUnread ? "border-l-2 border-l-primary" : "opacity-60"
                                    }`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${`bg-accent`
                                            }`}>
                                            <AlertIcon className={`w-5 h-5 ${config.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{config.label}</span>
                                                <Badge className={`text-[10px] ${SEVERITY_COLORS[alert.severity] || ""}`}>
                                                    {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Advertencia" : "Info"}
                                                </Badge>
                                                {alert.server_id && (
                                                    <Badge variant="secondary" className="text-[10px] font-mono">
                                                        {alert.server_id.toUpperCase()}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">
                                                {new Date(alert.created_at).toLocaleString("es-PE")}
                                            </p>
                                        </div>
                                        {isUnread && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() => markAsRead(alert.id)}
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
