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
import { useLanguage } from "@/components/language-provider";
import { parseUtcDate } from "@/lib/utils";

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
    connect: { icon: LogIn, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    disconnect: { icon: LogOut, color: "bg-red-500/10 text-red-500 border-red-500/20" },
    idle: { icon: Clock, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    active: { icon: Zap, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
};

export default function LogsPage() {
    const { t } = useLanguage();
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
                <h1 className="text-2xl font-bold">{t("logs.title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {t("logs.subtitle")}
                </p>
            </div>

            {/* Filters */}
            <Card className="glass border-border/30">
                <CardContent className="p-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("logs.searchPlaceholder")}
                                value={usernameFilter}
                                onChange={(e) => setUsernameFilter(e.target.value.toUpperCase())}
                                className="pl-9"
                            />
                        </div>
                        <Select value={serverFilter} onValueChange={(v) => { setServerFilter(v); setPage(0); }}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder={t("logs.serverPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("logs.filterAll")}</SelectItem>
                                <SelectItem value="srv1">{t("logs.server1")}</SelectItem>
                                <SelectItem value="srv2">{t("logs.server2")}</SelectItem>
                                <SelectItem value="srv3">{t("logs.server3")}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit" variant="secondary">
                            <Search className="w-4 h-4 mr-2" />
                            {t("logs.searchButton")}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="glass border-border/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ScrollText className="w-4 h-4 text-primary" />
                        {t("logs.recordsTitle")}
                        <Badge variant="secondary" className="text-xs font-normal ml-2">
                            {total} {t("logs.recordsCount")}
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
                            <p>{t("logs.noRecords")}</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">{t("logs.colDate")}</TableHead>
                                            <TableHead>{t("logs.colEvent")}</TableHead>
                                            <TableHead>{t("logs.colUser")}</TableHead>
                                            <TableHead>{t("logs.colServer")}</TableHead>
                                            <TableHead>{t("logs.colSessionId")}</TableHead>
                                            <TableHead>{t("logs.colIp")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => {
                                            const eventConf = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.active;
                                            const EventIcon = eventConf.icon;

                                            // Get translated label
                                            let label = t("logs.eventActive");
                                            if (log.event_type === "connect") label = t("logs.eventConnect");
                                            if (log.event_type === "disconnect") label = t("logs.eventDisconnect");
                                            if (log.event_type === "idle") label = t("logs.eventIdle");

                                            return (
                                                <TableRow key={log.id} className="hover:bg-accent/50 transition-colors">
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {parseUtcDate(log.timestamp)?.toLocaleString("es-PE", {
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
                                                            {label}
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
                                    {t("logs.showing")} {page * limit + 1}–{Math.min((page + 1) * limit, total)} {t("logs.of")} {total}
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
