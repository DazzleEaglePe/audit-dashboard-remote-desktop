"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollText, Search, ChevronLeft, ChevronRight, LogIn, LogOut, Clock, Zap } from "lucide-react";
import type { SessionLog } from "@/types";

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    connect: { label: "Conexión", icon: LogIn, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    disconnect: { label: "Desconexión", icon: LogOut, color: "bg-red-500/10 text-red-500 border-red-500/20" },
    idle: { label: "Inactivo", icon: Clock, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    active: { label: "Activo", icon: Zap, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
};

export default function LogsPage() {
    const [logs, setLogs] = useState<SessionLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [usernameFilter, setUsernameFilter] = useState("");
    const [serverFilter, setServerFilter] = useState("all");
    const limit = 25;

    async function fetchLogs() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: String(limit),
                offset: String(page * limit),
            });
            if (usernameFilter) params.set("username", usernameFilter);
            if (serverFilter !== "all") params.set("server_id", serverFilter);

            const res = await fetch(`/api/logs?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, serverFilter]);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(0);
        fetchLogs();
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Logs de Auditoría</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Historial de conexiones y desconexiones RDP
                </p>
            </div>

            {/* Filters */}
            <Card className="glass border-border/30">
                <CardContent className="p-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por usuario (ej: CONT, SIST4)..."
                                value={usernameFilter}
                                onChange={(e) => setUsernameFilter(e.target.value.toUpperCase())}
                                className="pl-9"
                            />
                        </div>
                        <Select value={serverFilter} onValueChange={(v) => { setServerFilter(v); setPage(0); }}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Servidor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="srv1">Servidor 1</SelectItem>
                                <SelectItem value="srv2">Servidor 2</SelectItem>
                                <SelectItem value="srv3">Servidor 3</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit" variant="secondary">
                            <Search className="w-4 h-4 mr-2" />
                            Buscar
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="glass border-border/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ScrollText className="w-4 h-4 text-primary" />
                        Registros
                        <Badge variant="secondary" className="text-xs font-normal ml-2">
                            {total} total
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-10 bg-accent rounded animate-pulse" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No se encontraron registros</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">Fecha / Hora</TableHead>
                                            <TableHead>Evento</TableHead>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Servidor</TableHead>
                                            <TableHead>Sesión ID</TableHead>
                                            <TableHead>IP Origen</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => {
                                            const eventConf = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.active;
                                            const EventIcon = eventConf.icon;
                                            return (
                                                <TableRow key={log.id} className="hover:bg-accent/50 transition-colors">
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleString("es-PE", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit",
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-xs ${eventConf.color}`}>
                                                            <EventIcon className="w-3 h-3 mr-1" />
                                                            {eventConf.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-medium">
                                                        {log.username}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {log.server_id.toUpperCase()}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {log.session_id ?? "—"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {log.source_ip || "—"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                                <p className="text-xs text-muted-foreground">
                                    Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 0}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
