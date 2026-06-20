"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, MonitorSmartphone, RefreshCw, Maximize2, WifiOff, Pin, PinOff, Maximize, User } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Session } from "@/types";
import { io } from "socket.io-client";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";

const SERVER_LABELS: Record<string, string> = {
    srv1: "Servidor 1",
    srv2: "Servidor 2",
    srv3: "Servidor 3",
};

const USER_DIRECTORY: Record<string, string> = {
    // Servidor 1
    cont: "Winner Huamantalla",
    cont1: "Melany Roldan Berrocal",
    sist: "Gianmarco Hugo Villalva Castillo",
    sist1: "Luna Esmeralda Giron Subilete",
    sist4: "Alexander Alania",
    // Servidor 2
    sist2: "María Melendez Contreras",
    sist9: "Edith Cerrón Alvarez",
    sist10: "Fernanda Rojas",
    // Servidor 3
    sist3: "Miluska Alvarez Sandoval",
    sist6: "Adrian Antonio Zavaleta Ticona",
    sist7: "Mallury Carrasco Segundo",
    sist8: "Evelyn Acero Castillo",
};

interface ScreenshotItem {
    server_id: string;
    username: string;
    session_id: number;
    image_url: string | null;
    full_name?: string | null;
}

export default function ScreenshotsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
    const [pinnedScreenshot, setPinnedScreenshot] = useState<ScreenshotItem | null>(null);
    const [refreshKey, setRefreshKey] = useState(Date.now());
    const [base64Images, setBase64Images] = useState<Record<string, string>>({});
    const [statusFilter, setStatusFilter] = useState<string>("active");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && containerRef.current) {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            tl.fromTo(containerRef.current.querySelector(".screenshots-header"),
                { opacity: 0, y: -12 },
                { opacity: 1, y: 0, duration: 0.6 }
            )
            .fromTo(containerRef.current.querySelectorAll(".server-section-anim"),
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                "-=0.4"
            );
        }
    }, [loading, sessions.length]);

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
        // WebSocket connection for real-time updates
        const socketIo = io();

        socketIo.on("connect", () => {
            console.log("Connected to WebSocket for real-time screenshots (Base64)");
            // Join all server rooms to receive screenshot broadcasts
            Object.keys(SERVER_LABELS).forEach((serverId) => {
                socketIo.emit("join-server", serverId);
            });
        });

        socketIo.on("screenshot:new", (data: { serverId: string; username: string; sessionId: number; image?: string }) => {
            const normalizedUser = data.username ? data.username.toLowerCase() : "";
            const key = `${data.serverId}-${normalizedUser}-${data.sessionId}`;

            if (data.image) {
                // Update state with the full Base64 image
                setBase64Images((prev) => ({ ...prev, [key]: data.image as string }));
            }
        });

        return () => {
            socketIo.disconnect();
        };
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(() => {
            fetchSessions();
            setRefreshKey(Date.now());
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Group sessions by server and filter by status
    const sessionsByServer = sessions.reduce<Record<string, Session[]>>((acc, session) => {
        const isOffline = session.state !== "Active";

        if (statusFilter === "active" && isOffline) return acc;
        if (statusFilter === "offline" && !isOffline) return acc;

        if (!acc[session.server_id]) acc[session.server_id] = [];
        acc[session.server_id].push(session);
        return acc;
    }, {});

    function getScreenshotUrl(serverId: string, username: string, sessionId: number) {
        const normalizedUser = username ? username.toLowerCase() : "";
        const key = `${serverId}-${normalizedUser}-${sessionId}`;
        
        const base64Data = base64Images[key];
        if (!base64Data) return "";
        
        return base64Data.startsWith('data:image') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
    }

    return (
        <div ref={containerRef} className="space-y-6">
            <div className="screenshots-header opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Pantallas en Tiempo Real</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Mosaico de sesiones activas — Monitoreo continuo vía WebSockets
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-48 rounded-xl border-border/20 backdrop-blur-md">
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/20 backdrop-blur-md">
                            <SelectItem value="all" className="rounded-lg">Todas las sesiones</SelectItem>
                            <SelectItem value="active" className="rounded-lg">Solo Activas (Online)</SelectItem>
                            <SelectItem value="offline" className="rounded-lg">Solo Fuera de línea</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 hover:bg-accent/40 font-medium text-xs gap-2"
                        onClick={() => {
                            fetchSessions();
                            setRefreshKey((k) => k + 1);
                        }}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="glass border-border/20 animate-pulse">
                            <CardContent className="p-3">
                                <div className="aspect-video bg-accent/40 rounded-xl" />
                                <div className="h-4 bg-accent/40 rounded-lg mt-3 w-24" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : Object.keys(sessionsByServer).length === 0 ? (
                <Card className="glass border-border/20 server-section-anim opacity-0">
                    <CardContent className="py-20 text-center text-muted-foreground">
                        <Camera className="w-16 h-16 mx-auto mb-4 opacity-15" />
                        <p className="text-base font-semibold">No hay sesiones activas</p>
                        <p className="text-xs mt-1 max-w-sm mx-auto text-muted-foreground/80">
                            Las transmisiones en vivo aparecerán tan pronto como los agentes inicien sesión en sus escritorios.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8">
                    {/* Sección de Pantalla Fijada (Teams Style) */}
                    {pinnedScreenshot && (
                        <Card className="glass border-primary/40 border-2 overflow-hidden shadow-2xl shadow-primary/5 rounded-2xl glow-spot-primary">
                            <CardHeader className="py-3 px-5 flex flex-row items-center justify-between border-b border-border/20 bg-primary/5">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Pin className="w-4 h-4 text-primary fill-primary" />
                                    Pantalla Fijada: {pinnedScreenshot.full_name || USER_DIRECTORY[pinnedScreenshot.username.toLowerCase()] || pinnedScreenshot.username}
                                    <Badge className="text-[9px] uppercase ml-2 border-none bg-primary/10 text-primary">
                                        {SERVER_LABELS[pinnedScreenshot.server_id] || pinnedScreenshot.server_id}
                                    </Badge>
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setPinnedScreenshot(null)} className="h-8 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-xs gap-1.5">
                                    <PinOff className="w-3.5 h-3.5" />
                                    Desfijar
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="relative aspect-video xl:aspect-[21/9] bg-black/90 group/pinned">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={getScreenshotUrl(pinnedScreenshot.server_id, pinnedScreenshot.username, pinnedScreenshot.session_id)}
                                        alt={`Pantalla fijada de ${pinnedScreenshot.username}`}
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover/pinned:opacity-100 transition-opacity">
                                        <Button variant="secondary" size="icon" className="bg-background/80 hover:bg-background backdrop-blur-sm shadow-md rounded-xl" onClick={(e) => {
                                            const imgEl = e.currentTarget.parentElement?.previousElementSibling as HTMLElement;
                                            if (imgEl && imgEl.requestFullscreen) {
                                                imgEl.requestFullscreen();
                                            }
                                        }}>
                                            <Maximize className="w-4.5 h-4.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-8">
                    {Object.entries(sessionsByServer)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([serverId, serverSessions]) => (
                            <div key={serverId} className="server-section-anim opacity-0 space-y-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <MonitorSmartphone className="w-4 h-4 text-primary" />
                                    {SERVER_LABELS[serverId] || serverId}
                                    <Badge variant="secondary" className="text-[10px] font-semibold bg-accent/40 text-foreground border-none rounded-full px-2 py-0.5">
                                        {serverSessions.length} {serverSessions.length === 1 ? 'sesión' : 'sesiones'}
                                    </Badge>
                                </h2>
                                
                                <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                                    {serverSessions.map((session) => {
                                        const imgUrl = getScreenshotUrl(serverId, session.username, session.session_id);
                                        const isServerOffline = session.server_status === "offline";
                                        const isOffline = session.state !== "Active";
                                        const isIdle = !isOffline && session.idle_time && !["0", ".", "none", "ninguno"].includes(session.idle_time.trim().toLowerCase());

                                        return (
                                            <Card
                                                key={`${serverId}-${session.session_id}`}
                                                className={`glass glass-interactive border-border/20 cursor-pointer overflow-hidden flex flex-col ${(isOffline || isServerOffline) ? "opacity-75" : ""}`}
                                                onClick={() =>
                                                    setSelectedScreenshot({
                                                        server_id: serverId,
                                                        username: session.username,
                                                        session_id: session.session_id,
                                                        image_url: imgUrl,
                                                        full_name: session.full_name,
                                                    })
                                                }
                                            >
                                                <CardContent className="p-3 flex-1 flex flex-col">
                                                    <div className="relative aspect-video bg-accent/20 rounded-xl overflow-hidden shrink-0 border border-border/5">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={imgUrl}
                                                            alt={`Pantalla de ${session.username}`}
                                                            style={{ visibility: imgUrl ? "visible" : "hidden" }}
                                                            className={`w-full h-full object-cover relative z-10 transition-all duration-300 ${isServerOffline ? "grayscale brightness-50" : isOffline ? "brightness-[0.35]" : ""}`}
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.visibility = "hidden";
                                                                if (target.nextElementSibling && !isServerOffline && !isOffline && !isIdle) {
                                                                    (target.nextElementSibling as HTMLElement).style.display = "flex";
                                                                }
                                                            }}
                                                            onLoad={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.visibility = "visible";
                                                                if (target.nextElementSibling) {
                                                                    (target.nextElementSibling as HTMLElement).style.display = "none";
                                                                }
                                                            }}
                                                        />
                                                        {/* Status badge — Teams style corner indicator */}
                                                        {isServerOffline ? (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm z-10">
                                                                <WifiOff className="w-8 h-8 text-muted-foreground/60 mb-2 animate-pulse" />
                                                                <Badge variant="outline" className="text-[10px] text-muted-foreground bg-background/40 border-muted-foreground/20 rounded-full font-semibold">
                                                                    Servidor Offline
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
                                                                {isOffline && (
                                                                    <Badge variant="outline" className="text-red-400 bg-background/80 border-red-500/20 text-[9px] px-2 py-0.5 backdrop-blur-md rounded-full font-bold flex items-center gap-1 shadow-sm">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                                                        Desconectada
                                                                    </Badge>
                                                                )}
                                                                {isIdle && (
                                                                    <Badge variant="outline" className="text-amber-500 bg-background/80 border-amber-500/20 text-[9px] px-2 py-0.5 backdrop-blur-md rounded-full font-bold flex items-center gap-1 shadow-sm">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                                                                        Inactiva ({session.idle_time})
                                                                    </Badge>
                                                                )}
                                                                {!isOffline && !isIdle && (
                                                                    <Badge variant="outline" className="text-emerald-500 bg-background/80 border-emerald-500/20 text-[9px] px-2 py-0.5 backdrop-blur-md rounded-full font-bold flex items-center gap-1 shadow-sm">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                                                                        Activa
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`absolute inset-0 items-center justify-center text-muted-foreground/30 flex bg-accent/20 z-0 ${(isServerOffline || isOffline || isIdle) ? '!hidden' : ''}`}
                                                        >
                                                            <Camera className="w-8 h-8" />
                                                        </div>
                                                        
                                                        {/* Hover Actions overlay */}
                                                        <div className={`absolute inset-0 bg-black/45 z-20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3`}>
                                                            <div className="w-9 h-9 rounded-xl bg-background/80 flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-md">
                                                                <Maximize2 className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-3 px-1 flex items-center justify-between flex-1">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {/* User Avatar Circle */}
                                                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-primary shrink-0 bg-primary/10",
                                                                isOffline ? "bg-red-500/10 text-red-500" : isIdle ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                                                            )}>
                                                                {(session.full_name || session.username).substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold truncate leading-tight" title={session.full_name || USER_DIRECTORY[session.username.toLowerCase()] || session.username}>
                                                                    {session.full_name || USER_DIRECTORY[session.username.toLowerCase()] || session.username}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                                                                    {session.username} — ID: {session.session_id}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1.5 items-center shrink-0 pl-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Fijar pantalla"
                                                                className="h-8 w-8 hover:bg-primary/20 hover:text-primary rounded-xl z-30 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100" 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setPinnedScreenshot({ server_id: serverId, username: session.username, session_id: session.session_id, image_url: imgUrl, full_name: session.full_name });
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }}>
                                                                <Pin className="w-4 h-4 text-muted-foreground/80" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Full-size Screenshot Dialog */}
            <Dialog
                open={!!selectedScreenshot}
                onOpenChange={() => setSelectedScreenshot(null)}
            >
                <DialogContent className="max-w-4xl glass border-border/20 rounded-2xl shadow-2xl p-6">
                    <DialogHeader className="pb-3 border-b border-border/10">
                        <DialogTitle className="flex items-center justify-between pe-6 text-sm font-bold">
                            <span className="flex items-center gap-2">
                                <Camera className="w-4.5 h-4.5 text-primary" />
                                {selectedScreenshot?.full_name || USER_DIRECTORY[selectedScreenshot?.username?.toLowerCase() || ""] || selectedScreenshot?.username} 
                                <span className="text-muted-foreground font-normal">({SERVER_LABELS[selectedScreenshot?.server_id || ""] || selectedScreenshot?.server_id})</span>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedScreenshot && (
                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden group/modal mt-4 border border-border/10 shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={getScreenshotUrl(selectedScreenshot.server_id, selectedScreenshot.username, selectedScreenshot.session_id)}
                                alt={`Pantalla de ${selectedScreenshot.username}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                }}
                            />
                            <div className="absolute top-4 right-4 opacity-0 group-hover/modal:opacity-100 transition-opacity">
                                <Button variant="secondary" size="icon" className="bg-background/80 hover:bg-background backdrop-blur-sm shadow-md rounded-xl" onClick={(e) => {
                                    const imgEl = e.currentTarget.parentElement?.previousElementSibling as HTMLElement;
                                    if (imgEl && imgEl.requestFullscreen) {
                                        imgEl.requestFullscreen();
                                    }
                                }}>
                                    <Maximize className="w-4.5 h-4.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
