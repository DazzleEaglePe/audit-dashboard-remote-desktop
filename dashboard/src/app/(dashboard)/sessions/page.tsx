"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Monitor, Clock, Wifi, User } from "lucide-react";
import type { Session } from "@/types";

const SERVER_NAMES: Record<string, string> = {
    srv1: "DESKTOP-E4F6THB",
    srv2: "DESKTOP-TR7OGR1",
    srv3: "DESKTOP-LKSNKOL",
};

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverFilter, setServerFilter] = useState<string>("all");

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
        const interval = setInterval(fetchSessions, 10000);
        return () => clearInterval(interval);
    }, []);

    const filteredSessions =
        serverFilter === "all"
            ? sessions
            : sessions.filter((s) => s.server_id === serverFilter);

    const stateColors: Record<string, string> = {
        Active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        Idle: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        Disconnected: "bg-red-500/10 text-red-500 border-red-500/20",
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Sesiones Activas</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {filteredSessions.length} sesiones en{" "}
                        {serverFilter === "all" ? "todos los servidores" : SERVER_NAMES[serverFilter]}
                    </p>
                </div>

                <Select value={serverFilter} onValueChange={setServerFilter}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtrar servidor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los servidores</SelectItem>
                        <SelectItem value="srv1">Servidor 1</SelectItem>
                        <SelectItem value="srv2">Servidor 2</SelectItem>
                        <SelectItem value="srv3">Servidor 3</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="glass border-border/30">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-primary" />
                        Sesiones RDP
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-12 bg-accent rounded animate-pulse" />
                            ))}
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No hay sesiones activas</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Servidor</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>ID Sesión</TableHead>
                                        <TableHead>Tiempo Inactivo</TableHead>
                                        <TableHead>IP Origen</TableHead>
                                        <TableHead>Hora Conexión</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSessions.map((session) => (
                                        <TableRow key={session.id} className="hover:bg-accent/50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                    <span className="font-medium font-mono text-sm">
                                                        {session.username}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {session.server_id.toUpperCase()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-xs ${stateColors[session.state] || ""}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${session.state === "Active" ? "bg-emerald-500 animate-pulse-dot" :
                                                            session.state === "Idle" ? "bg-amber-500" : "bg-red-500"
                                                        }`} />
                                                    {session.state === "Active" ? "Activa" : session.state === "Idle" ? "Inactiva" : "Desconectada"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{session.session_id}</TableCell>
                                            <TableCell className="flex items-center gap-1 text-sm">
                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                {session.idle_time || "00:00:00"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Wifi className="w-3 h-3 text-muted-foreground" />
                                                    {session.source_ip || "—"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {session.logon_time
                                                    ? new Date(session.logon_time).toLocaleString("es-PE")
                                                    : "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
