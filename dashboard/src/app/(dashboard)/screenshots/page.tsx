"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, MonitorSmartphone, RefreshCw, Maximize2 } from "lucide-react";
import type { Session } from "@/types";

const SERVER_LABELS: Record<string, string> = {
    srv1: "Servidor 1",
    srv2: "Servidor 2",
    srv3: "Servidor 3",
};

interface ScreenshotItem {
    server_id: string;
    username: string;
    session_id: number;
    image_url: string | null;
}

export default function ScreenshotsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    async function fetchSessions() {
        try {
            const res = await fetch("/api/sessions");
            if (res.ok) {
                setSessions(await res.json());
            }
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(() => {
            fetchSessions();
            setRefreshKey((k) => k + 1);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Group sessions by server
    const sessionsByServer = sessions.reduce<Record<string, Session[]>>((acc, session) => {
        if (session.state === "Active") {
            if (!acc[session.server_id]) acc[session.server_id] = [];
            acc[session.server_id].push(session);
        }
        return acc;
    }, {});

    function getScreenshotUrl(serverId: string, username: string, sessionId: number) {
        return `/api/screenshots/${serverId}/${username}_${sessionId}_thumb.jpg?t=${refreshKey}`;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pantallas en Tiempo Real</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Mosaico de sesiones activas — Actualización cada 10 segundos
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        fetchSessions();
                        setRefreshKey((k) => k + 1);
                    }}
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="glass border-border/30 animate-pulse">
                            <CardContent className="p-3">
                                <div className="aspect-video bg-accent rounded-md" />
                                <div className="h-4 bg-accent rounded mt-2 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : Object.keys(sessionsByServer).length === 0 ? (
                <Card className="glass border-border/30">
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No hay sesiones activas</p>
                        <p className="text-sm mt-1">Las capturas aparecerán aquí cuando los usuarios se conecten</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8">
                    {Object.entries(sessionsByServer)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([serverId, serverSessions]) => (
                            <div key={serverId}>
                                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                                    <MonitorSmartphone className="w-4 h-4 text-primary" />
                                    {SERVER_LABELS[serverId] || serverId}
                                    <Badge variant="secondary" className="text-xs font-normal">
                                        {serverSessions.length} sesiones
                                    </Badge>
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {serverSessions.map((session) => {
                                        const imgUrl = getScreenshotUrl(serverId, session.username, session.session_id);
                                        return (
                                            <Card
                                                key={`${serverId}-${session.session_id}`}
                                                className="glass border-border/30 hover:border-primary/40 transition-all duration-200 cursor-pointer group"
                                                onClick={() =>
                                                    setSelectedScreenshot({
                                                        server_id: serverId,
                                                        username: session.username,
                                                        session_id: session.session_id,
                                                        image_url: imgUrl,
                                                    })
                                                }
                                            >
                                                <CardContent className="p-2">
                                                    <div className="relative aspect-video bg-accent rounded-md overflow-hidden">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={imgUrl}
                                                            alt={`Pantalla de ${session.username}`}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = "none";
                                                                if (target.nextElementSibling) {
                                                                    (target.nextElementSibling as HTMLElement).style.display = "flex";
                                                                }
                                                            }}
                                                        />
                                                        <div
                                                            className="absolute inset-0 items-center justify-center text-muted-foreground/40 hidden"
                                                        >
                                                            <Camera className="w-8 h-8" />
                                                        </div>
                                                        {/* Hover overlay */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <Maximize2 className="w-5 h-5 text-white" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 px-1">
                                                        <p className="text-xs font-medium font-mono">{session.username}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Sesión #{session.session_id}
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Full-size Screenshot Dialog */}
            <Dialog
                open={!!selectedScreenshot}
                onOpenChange={() => setSelectedScreenshot(null)}
            >
                <DialogContent className="max-w-4xl glass">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            {selectedScreenshot?.username} — {SERVER_LABELS[selectedScreenshot?.server_id || ""] || selectedScreenshot?.server_id}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedScreenshot && (
                        <div className="aspect-video bg-accent rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={selectedScreenshot.image_url || ""}
                                alt={`Pantalla de ${selectedScreenshot.username}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
