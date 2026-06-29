"use client";

import { useEffect, useState, useRef } from "react";
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
import { useLanguage } from "@/components/language-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { parseUtcDate, cn } from "@/lib/utils";
import { useServers } from "@/hooks/use-servers";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";


export default function SessionsPage() {
    const { t } = useLanguage();
    const { servers } = useServers();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverFilter, setServerFilter] = useState<string>("all");
    const containerRef = useRef<HTMLDivElement>(null);

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

    useGSAP(() => {
        if (!loading) {
            const mm = gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => {
                const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
                tl.fromTo(".sessions-header",
                    { opacity: 0, y: -12 },
                    { opacity: 1, y: 0, duration: 0.6 }
                )
                .fromTo(".sessions-card",
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.5 },
                    "-=0.45"
                );
            });
        }
    }, { dependencies: [loading], scope: containerRef });

    return (
        <div ref={containerRef} className="space-y-6">
            <div className="sessions-header opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{t("sessions.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {filteredSessions.length} {t("sessions.sessionsIn")}{" "}
                        {serverFilter === "all" ? t("sessions.filterAll").toLowerCase() : (servers.find(s => s.id === serverFilter)?.name || servers.find(s => s.id === serverFilter)?.hostname || serverFilter)}
                    </p>
                </div>

                <Select value={serverFilter} onValueChange={setServerFilter}>
                    <SelectTrigger className="w-48 rounded-xl border-border/20 backdrop-blur-md">
                        <SelectValue placeholder={t("sessions.filterServer")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/20 backdrop-blur-md">
                        <SelectItem value="all" className="rounded-lg">{t("sessions.filterAll")}</SelectItem>
                        {servers.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg">
                                {s.name || s.hostname || s.id}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card className="sessions-card opacity-0 glass border-border/20 rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Monitor className="w-4.5 h-4.5 text-primary" />
                        {t("sessions.historyTitle")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-4 animate-pulse">
                                    <Skeleton className="h-4 w-28 bg-accent/60 rounded" />
                                    <Skeleton className="h-4 w-20 bg-accent/50 rounded" />
                                    <Skeleton className="h-4 w-24 bg-accent/40 rounded" />
                                    <Skeleton className="h-4 w-32 bg-accent/50 rounded flex-1" />
                                    <Skeleton className="h-4 w-16 bg-accent/40 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Monitor className="w-16 h-16 mx-auto mb-4 opacity-15 animate-pulse" />
                            <p className="text-base font-semibold">{t("sessions.noSessions")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-accent/15">
                                    <TableRow className="border-b border-border/10 hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11 px-5">{t("sessions.colUser")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("sessions.colServer")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("sessions.colState")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("sessions.colSessionId")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("sessions.colIdle")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">{t("sessions.colIp")}</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11 px-5">{t("sessions.colLogon")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSessions.map((session) => (
                                        <TableRow key={session.id} className="border-b border-border/10 hover:bg-accent/25 transition-colors">
                                            <TableCell className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    {/* User avatar derived from status */}
                                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-primary/10 text-primary", 
                                                        session.state === "Active" ? "bg-emerald-500/10 text-emerald-500" :
                                                        session.state === "Idle" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {(session.full_name || session.username).substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-xs leading-none">
                                                            {session.full_name || session.username}
                                                        </span>
                                                        {session.full_name && (
                                                            <span className="text-[9px] text-muted-foreground font-mono mt-1">
                                                                {session.username}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Badge variant="outline" className="font-mono text-[9px] bg-accent/30 text-muted-foreground border-border/10 rounded-lg px-2 py-0.5">
                                                    {servers.find(s => s.id === session.server_id)?.name || servers.find(s => s.id === session.server_id)?.hostname || session.server_id}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <Badge className={cn("text-[9px] font-semibold border-none rounded-full px-2.5 py-0.5", stateColors[session.state] || "")}>
                                                    <span className={cn("w-1 h-1 rounded-full mr-1.5", 
                                                        session.state === "Active" ? "bg-emerald-500 animate-pulse-dot" :
                                                        session.state === "Idle" ? "bg-amber-500" : "bg-red-500"
                                                    )} />
                                                    {session.state === "Active" ? t("sessions.stateActive") : session.state === "Idle" ? t("sessions.stateIdle") : t("sessions.stateDisconnected")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs py-3">{session.session_id}</TableCell>
                                            <TableCell className="text-xs text-foreground/80 font-mono py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                    <span>
                                                        {["0", ".", "none", "ninguno"].includes(session.idle_time?.trim().toLowerCase() || "") ? `00:00 ${t("sessions.idleActive")}` : session.idle_time ? `${session.idle_time}` : "—"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Wifi className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                    <span>{session.source_ip || "—"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium py-3 px-5 text-muted-foreground/90">
                                                {session.logon_time
                                                    ? parseUtcDate(session.logon_time)?.toLocaleString("es-PE", {
                                                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                                                    })
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
