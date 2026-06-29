"use client";

import { useEffect, useState, useRef } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { parseUtcDate, cn } from "@/lib/utils";
import { useServers } from "@/hooks/use-servers";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";


const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
    connect: { icon: LogIn, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    disconnect: { icon: LogOut, color: "bg-red-500/10 text-red-500 border-red-500/20" },
    idle: { icon: Clock, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    active: { icon: Zap, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
};

export default function LogsPage() {
    const { t } = useLanguage();
    const { servers } = useServers();
    const [logs, setLogs] = useState<SessionLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [usernameFilter, setUsernameFilter] = useState("");
    const [serverFilter, setServerFilter] = useState("all");
    const limit = 25;
    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        if (!loading) {
            const mm = gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => {
                const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
                tl.fromTo(".logs-header",
                    { opacity: 0, y: -12 },
                    { opacity: 1, y: 0, duration: 0.6 }
                )
                .fromTo(".logs-anim-element",
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
                    "-=0.45"
                );
            });
        }
    }, { dependencies: [loading], scope: containerRef });

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
        <div ref={containerRef} className="space-y-6">
            <div className="logs-header opacity-0">
                <h1 className="text-2xl font-bold">{t("logs.title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {t("logs.subtitle")}
                </p>
            </div>

            {/* Filters */}
            <Card className="logs-anim-element opacity-0 glass border-border/20 rounded-2xl">
                <CardContent className="p-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                            <Input
                                placeholder={t("logs.searchPlaceholder")}
                                value={usernameFilter}
                                onChange={(e) => setUsernameFilter(e.target.value.toUpperCase())}
                                className="pl-10 rounded-xl border-border/20"
                            />
                        </div>
                        <Select value={serverFilter} onValueChange={(v) => { setServerFilter(v); setPage(0); }}>
                            <SelectTrigger className="w-48 rounded-xl border-border/20 backdrop-blur-md">
                                <SelectValue placeholder={t("logs.serverPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/20 backdrop-blur-md">
                                <SelectItem value="all" className="rounded-lg">{t("logs.filterAll")}</SelectItem>
                                {servers.map((s) => (
                                    <SelectItem key={s.id} value={s.id} className="rounded-lg">
                                        {s.name || s.hostname || s.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="submit" variant="secondary" className="rounded-xl h-9 hover:bg-accent/40 font-medium text-xs gap-1.5 shrink-0">
                            <Search className="w-3.5 h-3.5" />
                            {t("logs.searchButton")}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="logs-anim-element opacity-0 glass border-border/20 rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ScrollText className="w-4.5 h-4.5 text-primary" />
                        {t("logs.recordsTitle")}
                        <Badge variant="secondary" className="text-[10px] font-semibold bg-accent/40 text-foreground border-none rounded-full px-2.5 py-0.5 ml-1">
                            {total} {t("logs.recordsCount")}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-4 animate-pulse">
                                    <Skeleton className="h-4 w-28 bg-accent/60 rounded" />
                                    <Skeleton className="h-4 w-20 bg-accent/50 rounded" />
                                    <Skeleton className="h-4 w-24 bg-accent/40 rounded" />
                                    <Skeleton className="h-4 w-32 bg-accent/50 rounded flex-1" />
                                    <Skeleton className="h-4 w-16 bg-accent/40 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <ScrollText className="w-16 h-16 mx-auto mb-4 opacity-15 animate-pulse" />
                            <p className="text-base font-semibold">{t("logs.noRecords")}</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-accent/15">
                                        <TableRow className="border-b border-border/10 hover:bg-transparent">
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11 px-5 w-48">{t("logs.colDate")}</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("logs.colEvent")}</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("logs.colUser")}</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("logs.colServer")}</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("logs.colSessionId")}</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11 px-5">{t("logs.colIp")}</TableHead>
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
                                                <TableRow key={log.id} className="border-b border-border/10 hover:bg-accent/25 transition-colors">
                                                    <TableCell className="text-xs text-muted-foreground/80 font-mono whitespace-nowrap px-5 py-3">
                                                        {parseUtcDate(log.timestamp)?.toLocaleString("es-PE", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit",
                                                        })}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge className={cn("text-[9px] font-semibold border-none rounded-full px-2 py-0.5", eventConf.color)}>
                                                            <EventIcon className="w-3 h-3 mr-1" />
                                                            {label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-semibold py-3">
                                                        {log.username}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge variant="outline" className="font-mono text-[9px] bg-accent/30 text-muted-foreground border-border/10 rounded-lg px-2 py-0.5">
                                                            {servers.find(s => s.id === log.server_id)?.name || servers.find(s => s.id === log.server_id)?.hostname || log.server_id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs py-3">
                                                        {log.session_id ?? "—"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs py-3 px-5">
                                                        {log.source_ip || "—"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between p-4 border-t border-border/10 bg-accent/5">
                                <p className="text-xs text-muted-foreground font-medium">
                                    {t("logs.showing")} {page * limit + 1}–{Math.min((page + 1) * limit, total)} {t("logs.of")} {total}
                                </p>
                                <div className="flex gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 0}
                                        onClick={() => setPage((p) => p - 1)}
                                        className="rounded-xl h-8 px-2.5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="rounded-xl h-8 px-2.5"
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
